using System.Text;
using NzbWebDAV.Streams;

namespace NzbWebDAV.Tests.Streams;

public class BasicStreamTests
{
    [Fact]
    public async Task LimitedLengthStream_StopsAtConfiguredLength()
    {
        await using var stream = new LimitedLengthStream(
            new MemoryStream(Encoding.ASCII.GetBytes("abcdefgh")), 5);

        using var destination = new MemoryStream();
        await stream.CopyToAsync(destination);

        Assert.Equal("abcde", Encoding.ASCII.GetString(destination.ToArray()));
        Assert.Equal(0, await stream.ReadAsync(new byte[1]));
    }

    [Fact]
    public async Task CombinedStream_ConcatenatesEmptyAndNonEmptyStreams()
    {
        var streams = new[]
        {
            Task.FromResult<Stream>(new MemoryStream(Encoding.ASCII.GetBytes("abc"))),
            Task.FromResult<Stream>(new MemoryStream()),
            Task.FromResult<Stream>(new MemoryStream(Encoding.ASCII.GetBytes("def")))
        };
        await using var stream = new CombinedStream(streams);

        using var destination = new MemoryStream();
        await stream.CopyToAsync(destination);

        Assert.Equal("abcdef", Encoding.ASCII.GetString(destination.ToArray()));
        Assert.Equal(6, stream.Position);
    }

    [Theory]
    [InlineData("", true)]
    [InlineData("x", false)]
    [InlineData("payload", false)]
    public async Task ProbingStream_ReportsEmptinessWithoutConsumingData(
        string content, bool expectedEmpty)
    {
        await using var stream = new ProbingStream(
            new MemoryStream(Encoding.UTF8.GetBytes(content)));

        Assert.Equal(expectedEmpty, await stream.IsEmptyAsync());
        Assert.Equal(expectedEmpty, await stream.IsEmptyAsync());

        using var destination = new MemoryStream();
        await stream.CopyToAsync(destination);
        Assert.Equal(content, Encoding.UTF8.GetString(destination.ToArray()));
    }

    [Fact]
    public async Task CancellableStream_RejectsReadsAfterCancellation()
    {
        using var cts = new CancellationTokenSource();
        await using var stream = new CancellableStream(
            new MemoryStream(new byte[] { 1, 2, 3 }), cts.Token);
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            async () => await stream.ReadAsync(new byte[1]));
    }
}
