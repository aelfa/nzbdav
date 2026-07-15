using NzbWebDAV.Clients.RadarrSonarr;
using NzbWebDAV.Clients.RadarrSonarr.BaseModels;
using NzbWebDAV.Services;

namespace NzbWebDAV.Tests.Services;

public class ArrLinkedRepairDecisionTests
{
    private const string LibraryPath = "/media/movies/Some Movie (2020)/Some Movie (2020).mkv";

    [Fact]
    public async Task UnreachableRootFolders_DefersWithoutDelete()
    {
        var clients = new ArrClient[]
        {
            new ScriptedArrClient(
                host: "http://unreachable",
                rootFolders: () => throw new HttpRequestException("connection refused"),
                removeAndSearch: _ => Task.FromResult(false)),
        };

        var decision = await HealthCheckService.DecideArrLinkedRepairAsync(
            clients, LibraryPath, CancellationToken.None);

        Assert.Equal(HealthCheckService.ArrLinkedRepairDecision.DeferUnreachable, decision);
    }

    [Fact]
    public async Task RemoveAndSearchThrows_DefersWithoutDelete()
    {
        var clients = new ArrClient[]
        {
            new ScriptedArrClient(
                host: "http://radarr",
                rootFolders: () => Task.FromResult(new List<ArrRootFolder>
                {
                    new() { Path = "/media/movies" },
                }),
                removeAndSearch: _ => throw new HttpRequestException("timeout")),
        };

        var decision = await HealthCheckService.DecideArrLinkedRepairAsync(
            clients, LibraryPath, CancellationToken.None);

        Assert.Equal(HealthCheckService.ArrLinkedRepairDecision.DeferUnreachable, decision);
    }

    [Fact]
    public async Task EmptyRootFolderPath_DefersWithoutDelete()
    {
        var clients = new ArrClient[]
        {
            new ScriptedArrClient(
                host: "http://radarr",
                rootFolders: () => Task.FromResult(new List<ArrRootFolder>
                {
                    new() { Path = "" },
                }),
                removeAndSearch: _ => Task.FromResult(false)),
        };

        var decision = await HealthCheckService.DecideArrLinkedRepairAsync(
            clients, LibraryPath, CancellationToken.None);

        Assert.Equal(HealthCheckService.ArrLinkedRepairDecision.DeferUnreachable, decision);
    }

    [Fact]
    public async Task ConfirmedOrphan_DeletesEvenIfAnotherInstanceUnreachable()
    {
        var clients = new ArrClient[]
        {
            new ScriptedArrClient(
                host: "http://unreachable",
                rootFolders: () => throw new HttpRequestException("down"),
                removeAndSearch: _ => Task.FromResult(false)),
            new ScriptedArrClient(
                host: "http://radarr",
                rootFolders: () => Task.FromResult(new List<ArrRootFolder>
                {
                    new() { Path = "/media/movies" },
                }),
                removeAndSearch: _ => Task.FromResult(false)),
        };

        var decision = await HealthCheckService.DecideArrLinkedRepairAsync(
            clients, LibraryPath, CancellationToken.None);

        Assert.Equal(HealthCheckService.ArrLinkedRepairDecision.DeleteConfirmedOrphan, decision);
    }

    [Fact]
    public async Task RemoveAndSearchSucceeded_ReturnsRemoveAndSearch()
    {
        var clients = new ArrClient[]
        {
            new ScriptedArrClient(
                host: "http://radarr",
                rootFolders: () => Task.FromResult(new List<ArrRootFolder>
                {
                    new() { Path = "/media/movies" },
                }),
                removeAndSearch: _ => Task.FromResult(true)),
        };

        var decision = await HealthCheckService.DecideArrLinkedRepairAsync(
            clients, LibraryPath, CancellationToken.None);

        Assert.Equal(HealthCheckService.ArrLinkedRepairDecision.RemoveAndSearchSucceeded, decision);
    }

    [Fact]
    public async Task NoMatchingRoot_DeletesAsOrphan()
    {
        var clients = new ArrClient[]
        {
            new ScriptedArrClient(
                host: "http://sonarr",
                rootFolders: () => Task.FromResult(new List<ArrRootFolder>
                {
                    new() { Path = "/media/tv" },
                }),
                removeAndSearch: _ => Task.FromResult(false)),
        };

        var decision = await HealthCheckService.DecideArrLinkedRepairAsync(
            clients, LibraryPath, CancellationToken.None);

        Assert.Equal(HealthCheckService.ArrLinkedRepairDecision.DeleteConfirmedOrphan, decision);
    }

    private sealed class ScriptedArrClient(
        string host,
        Func<Task<List<ArrRootFolder>>> rootFolders,
        Func<string, Task<bool>> removeAndSearch) : ArrClient(host, "test-key")
    {
        public override Task<List<ArrRootFolder>> GetRootFolders() => rootFolders();

        public override Task<bool> RemoveAndSearch(string symlinkOrStrmPath) =>
            removeAndSearch(symlinkOrStrmPath);
    }
}
