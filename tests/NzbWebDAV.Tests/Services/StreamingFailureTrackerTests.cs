using NzbWebDAV.Services;

namespace NzbWebDAV.Tests.Services;

public class StreamingFailureTrackerTests
{
    [Fact]
    public void RecordFailure_IncrementsCountAndTracksFirst()
    {
        var tracker = new StreamingFailureTracker();
        var id = Guid.NewGuid();

        Assert.Equal(1, tracker.RecordFailure(id));
        var first = tracker.GetFirstFailure(id);
        Assert.NotNull(first);

        Assert.Equal(2, tracker.RecordFailure(id));
        Assert.Equal(3, tracker.RecordFailure(id));
        Assert.Equal(3, tracker.GetCount(id));
        Assert.Equal(first, tracker.GetFirstFailure(id));
    }

    [Fact]
    public void GetCount_ReturnsZeroForUnknownItem()
    {
        var tracker = new StreamingFailureTracker();
        Assert.Equal(0, tracker.GetCount(Guid.NewGuid()));
        Assert.Null(tracker.GetFirstFailure(Guid.NewGuid()));
    }

    [Fact]
    public void Clear_ResetsCount()
    {
        var tracker = new StreamingFailureTracker();
        var id = Guid.NewGuid();
        tracker.RecordFailure(id);
        tracker.RecordFailure(id);

        tracker.Clear(id);

        Assert.Equal(0, tracker.GetCount(id));
        Assert.Null(tracker.GetFirstFailure(id));
    }

    [Fact]
    public void RecordFailure_TracksItemsIndependently()
    {
        var tracker = new StreamingFailureTracker();
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();

        tracker.RecordFailure(a);
        tracker.RecordFailure(a);
        tracker.RecordFailure(b);

        Assert.Equal(2, tracker.GetCount(a));
        Assert.Equal(1, tracker.GetCount(b));
    }
}
