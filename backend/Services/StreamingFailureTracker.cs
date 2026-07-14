using System.Collections.Concurrent;

namespace NzbWebDAV.Services;

/// <summary>
/// In-memory per-DavItem count of streaming failures (missing articles).
/// Used by health repair to auto-remove files after repeated failures.
/// </summary>
public class StreamingFailureTracker
{
    private readonly ConcurrentDictionary<Guid, (int Count, DateTimeOffset First)> _failures = new();

    public int RecordFailure(Guid davItemId)
    {
        var now = DateTimeOffset.UtcNow;
        return _failures.AddOrUpdate(
            davItemId,
            _ => (1, now),
            (_, existing) => (existing.Count + 1, existing.First)).Count;
    }

    public int GetCount(Guid davItemId)
        => _failures.TryGetValue(davItemId, out var entry) ? entry.Count : 0;

    public DateTimeOffset? GetFirstFailure(Guid davItemId)
        => _failures.TryGetValue(davItemId, out var entry) ? entry.First : null;

    public void Clear(Guid davItemId)
        => _failures.TryRemove(davItemId, out _);
}
