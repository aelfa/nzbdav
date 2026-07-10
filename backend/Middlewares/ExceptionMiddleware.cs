using Microsoft.AspNetCore.Http;
using NWebDav.Server.Helpers;
using NzbWebDAV.Database.Models;
using NzbWebDAV.Exceptions;
using NzbWebDAV.Extensions;
using NzbWebDAV.Utils;
using Serilog;

namespace NzbWebDAV.Middlewares;

public class ExceptionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context).ConfigureAwait(false);
        }
        catch (Exception e) when (IsCausedByAbortedRequest(e, context))
        {
            // If the response has not started, we can write our custom response
            if (!context.Response.HasStarted)
            {
                context.Response.Clear();
                context.Response.StatusCode = 499; // Non-standard status code for client closed request
                await context.Response.WriteAsync("Client closed request.").ConfigureAwait(false);
            }
        }
        catch (Exception e) when (e.TryGetCausingException(out UsenetArticleNotFoundException? notFound))
        {
            if (!context.Response.HasStarted)
            {
                context.Response.Clear();
                context.Response.StatusCode = 404;
            }

            var filePath = GetRequestFilePath(context);
            Log.Error(
                "File {FilePath} has missing articles: {Reason}",
                filePath,
                notFound!.Message);
        }
        catch (SeekPositionNotFoundException)
        {
            if (!context.Response.HasStarted)
            {
                context.Response.Clear();
                context.Response.StatusCode = 404;
            }

            var filePath = GetRequestFilePath(context);
            var seekPosition = context.Request.GetRange()?.Start?.ToString() ?? "unknown";
            Log.Error(
                "File {FilePath} could not seek to byte position {SeekPosition}",
                filePath,
                seekPosition);
        }
        catch (Exception e) when (IsDavItemRequest(context))
        {
            if (!context.Response.HasStarted)
            {
                context.Response.Clear();
                context.Response.StatusCode = 500;
            }

            var filePath = GetRequestFilePath(context);
            var seekPosition = context.Request.GetRange()?.Start?.ToString() ?? "0";

            // Known download errors carry a human-readable message;
            // reserve full stack traces for unexpected failures.
            if (IsKnownDownloadException(e, out var knownError))
            {
                Log.Error(
                    "File {FilePath} could not be read from byte position {SeekPosition}: {Reason}",
                    filePath,
                    seekPosition,
                    knownError);
            }
            else
            {
                Log.Error(
                    e,
                    "File {FilePath} could not be read from byte position {SeekPosition}",
                    filePath,
                    seekPosition);
            }
        }
    }

    private static bool IsKnownDownloadException(Exception e, out string message)
    {
        if (e.TryGetCausingException<RetryableDownloadException>(out var retryable))
        {
            message = retryable!.Message;
            return true;
        }

        if (e.TryGetCausingException<NonRetryableDownloadException>(out var nonRetryable))
        {
            message = nonRetryable!.Message;
            return true;
        }

        message = string.Empty;
        return false;
    }

    private bool IsCausedByAbortedRequest(Exception e, HttpContext context)
    {
        var isAffectedException = e is OperationCanceledException or EndOfStreamException;
        var isRequestAborted = context.RequestAborted.IsCancellationRequested ||
                               SigtermUtil.GetCancellationToken().IsCancellationRequested;
        return isAffectedException && isRequestAborted;
    }

    private static string GetRequestFilePath(HttpContext context)
    {
        return context.Items["DavItem"] is DavItem davItem
            ? davItem.Path
            : context.Request.Path;
    }

    private static bool IsDavItemRequest(HttpContext context)
    {
        return context.Items["DavItem"] is DavItem;
    }
}