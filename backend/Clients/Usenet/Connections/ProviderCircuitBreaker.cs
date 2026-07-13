using Serilog;

namespace NzbWebDAV.Clients.Usenet.Connections;

/// <summary>
/// Tracks consecutive connection failures for an NNTP provider and temporarily
/// disables it when a failure threshold is reached, preventing a single
/// misbehaving provider from blocking the entire download pipeline.
/// <para>
/// After tripping, the provider enters a cooldown period during which it is
/// skipped and additional failures are ignored (latched). When the cooldown
/// expires, traffic flows again. If failures continue and again reach the
/// threshold, the breaker re-trips with a doubled cooldown (up to a cap).
/// A success fully resets the failure counter and cooldown ladder.
/// </para>
/// </summary>
public class ProviderCircuitBreaker
{
    private const int FailureThreshold = 3;
    private static readonly TimeSpan InitialCooldown = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan MaxCooldown = TimeSpan.FromMinutes(5);

    private readonly string _providerName;
    private readonly object _lock = new();

    private int _consecutiveFailures;
    private long _trippedUntilMs;
    private TimeSpan _currentCooldown = InitialCooldown;

    public ProviderCircuitBreaker(string providerName)
    {
        _providerName = providerName;
    }

    public bool IsTripped
    {
        get
        {
            var trippedUntil = Volatile.Read(ref _trippedUntilMs);
            if (trippedUntil == 0) return false;
            return Environment.TickCount64 < trippedUntil;
        }
    }

    /// <summary>TickCount64 deadline while latched open; 0 when not tripped. For tests.</summary>
    internal long TrippedUntilMs => Volatile.Read(ref _trippedUntilMs);

    /// <summary>Cooldown that will apply on the next trip. For tests.</summary>
    internal TimeSpan CurrentCooldown
    {
        get
        {
            lock (_lock) return _currentCooldown;
        }
    }

    public void RecordSuccess()
    {
        lock (_lock)
        {
            if (_consecutiveFailures > 0 || _trippedUntilMs > 0)
                Log.Information("Provider {Provider} recovered — circuit breaker reset.", _providerName);

            _consecutiveFailures = 0;
            _trippedUntilMs = 0;
            _currentCooldown = InitialCooldown;
        }
    }

    public void RecordFailure()
    {
        lock (_lock)
        {
            // Already latched open: ignore in-flight failures from the same burst
            // so they cannot extend the window, double the cooldown, or spam logs.
            if (_trippedUntilMs > 0 && Environment.TickCount64 < _trippedUntilMs)
                return;

            // Cooldown expired (or never tripped); clear a stale trip marker so
            // success recovery logging stays accurate.
            if (_trippedUntilMs > 0)
                _trippedUntilMs = 0;

            _consecutiveFailures++;
            if (_consecutiveFailures < FailureThreshold) return;

            var failuresAtTrip = _consecutiveFailures;
            _trippedUntilMs = Environment.TickCount64 + (long)_currentCooldown.TotalMilliseconds;
            Log.Warning(
                "Provider {Provider} tripped after {Failures} consecutive failures. " +
                "Skipping for {Cooldown}s.",
                _providerName, failuresAtTrip, _currentCooldown.TotalSeconds);

            _consecutiveFailures = 0;
            _currentCooldown = TimeSpan.FromMilliseconds(
                Math.Min(_currentCooldown.TotalMilliseconds * 2, MaxCooldown.TotalMilliseconds));
        }
    }
}
