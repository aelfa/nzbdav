using NzbWebDAV.Clients.Usenet.Concurrency;
using NzbWebDAV.Clients.Usenet.Connections;
using UsenetSharp.Concurrency;

namespace NzbWebDAV.Tests.Clients.Usenet;

public class ConcurrencyTests
{
    [Fact]
    public void ProviderCircuitBreaker_TripsAfterThreeFailuresAndResetsOnSuccess()
    {
        var breaker = new ProviderCircuitBreaker("test");

        breaker.RecordFailure();
        breaker.RecordFailure();
        Assert.False(breaker.IsTripped);

        breaker.RecordFailure();
        Assert.True(breaker.IsTripped);

        breaker.RecordSuccess();
        Assert.False(breaker.IsTripped);
    }

    [Fact]
    public async Task PrioritizedSemaphore_BlocksUntilPermitIsReleased()
    {
        using var semaphore = new PrioritizedSemaphore(initialAllowed: 1, maxAllowed: 1);
        await semaphore.WaitAsync(SemaphorePriority.High);
        var waiter = semaphore.WaitAsync(SemaphorePriority.Low);

        Assert.False(waiter.IsCompleted);
        semaphore.Release();
        await waiter.WaitAsync(TimeSpan.FromSeconds(1));
        semaphore.Release();
    }

    [Fact]
    public async Task PrioritizedSemaphore_RemovesCanceledWaiter()
    {
        using var semaphore = new PrioritizedSemaphore(initialAllowed: 0, maxAllowed: 1);
        using var cts = new CancellationTokenSource();
        var waiter = semaphore.WaitAsync(SemaphorePriority.High, cts.Token);

        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => waiter);
        semaphore.Release();
    }

    [Fact]
    public async Task PrioritizedSemaphore_DisposeFaultsQueuedWaiters()
    {
        var semaphore = new PrioritizedSemaphore(initialAllowed: 0, maxAllowed: 1);
        var waiter = semaphore.WaitAsync(SemaphorePriority.High);

        semaphore.Dispose();

        await Assert.ThrowsAsync<ObjectDisposedException>(() => waiter);
    }
}
