import styles from "./provider-scoreboard.module.css";
import type { OverviewWindow, ProviderCircuitState, ProviderRow } from "~/clients/backend-client.server";
import { formatBytes, formatNumber, formatPercent } from "../../utils/format";

export type ProviderScoreboardProps = {
    providers: ProviderRow[],
    window: OverviewWindow,
}

export function ProviderScoreboard({ providers, window }: ProviderScoreboardProps) {
    const total = providers.reduce((s, p) => s + p.articles, 0);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>Providers</h3>
                <div className={styles.sub}>Per-provider fetches, {window === "all" ? "all time" : `last ${window}`}</div>
            </div>

            {providers.length === 0 ? (
                <div className={styles.empty}>No providers configured.</div>
            ) : (
                <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Provider</th>
                            <th className={styles.sparkCol}>Activity</th>
                            <th className={styles.numCol}>Articles</th>
                            <th className={styles.numCol}>Read</th>
                            <th className={styles.numCol}>Share</th>
                            <th className={styles.numCol}>Errors</th>
                            <th className={styles.numCol}>Retries</th>
                            <th className={styles.numCol}>Avg ms</th>
                        </tr>
                    </thead>
                    <tbody>
                        {providers.map(p => {
                            const share = total > 0 ? (p.articles / total) * 100 : 0;
                            const circuitState = p.circuitState ?? "closed";
                            return (
                                <tr key={p.provider}>
                                    <td>
                                        <div
                                            className={styles.providerCell}
                                            title={buildProviderTooltip(p, circuitState)}>
                                            <span className={`${styles.dot} ${dotClass(circuitState)}`} />
                                            <span className={styles.providerName}>{p.nickname?.trim() || p.provider}</span>
                                            {circuitState !== "closed" && (
                                                <span className={`${styles.circuitBadge} ${badgeClass(circuitState)}`}>
                                                    {circuitLabel(circuitState, p.cooldownRemainingSeconds)}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className={styles.sparkCol}>
                                        <Sparkline values={p.spark} />
                                    </td>
                                    <td className={styles.numCol}>{formatNumber(p.articles)}</td>
                                    <td className={styles.numCol}>{formatBytes(p.bytesFetched)}</td>
                                    <td className={styles.numCol}>
                                        <div className={styles.shareBar}>
                                            <div className={styles.shareFill} style={{ width: `${share.toFixed(1)}%` }} />
                                            <span className={styles.shareText}>{formatPercent(share, 0)}</span>
                                        </div>
                                    </td>
                                    <td className={`${styles.numCol} ${p.errorRate > 0.05 ? styles.warn : ""}`}>
                                        {formatNumber(p.errors)}
                                        {p.errorRate > 0 && <span className={styles.errorRate}> ({formatPercent(p.errorRate * 100, 1)})</span>}
                                    </td>
                                    <td className={styles.numCol}>{formatNumber(p.retries)}</td>
                                    <td className={styles.numCol}>{p.avgDurationMs.toFixed(0)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            )}
        </div>
    );
}

function dotClass(state: ProviderCircuitState) {
    switch (state) {
        case "open": return styles.dotOpen;
        case "halfOpen": return styles.dotHalfOpen;
        default: return styles.dotClosed;
    }
}

function badgeClass(state: ProviderCircuitState) {
    switch (state) {
        case "open": return styles.badgeOpen;
        case "halfOpen": return styles.badgeHalfOpen;
        default: return styles.badgeClosed;
    }
}

function circuitLabel(state: ProviderCircuitState, cooldownRemainingSeconds?: number | null) {
    if (state === "open") {
        return cooldownRemainingSeconds != null && cooldownRemainingSeconds > 0
            ? `Tripped · ${cooldownRemainingSeconds}s`
            : "Tripped";
    }
    if (state === "halfOpen") return "Probing";
    return "Healthy";
}

function buildProviderTooltip(p: ProviderRow, state: ProviderCircuitState) {
    const lines = [p.nickname?.trim() || p.provider];
    if (state === "open") {
        lines.push("Circuit open — provider temporarily skipped after repeated failures.");
        if (p.cooldownRemainingSeconds != null && p.cooldownRemainingSeconds > 0)
            lines.push(`Retry in about ${p.cooldownRemainingSeconds}s.`);
    } else if (state === "halfOpen") {
        lines.push("Circuit half-open — one probe request may test recovery.");
    } else {
        lines.push("Circuit closed — provider is healthy.");
    }
    if (p.lastFailureReason) lines.push(`Last trip: ${p.lastFailureReason}`);
    if ((p.tripCount ?? 0) > 0) lines.push(`Trips (lifetime): ${p.tripCount}`);
    if ((p.failureCount ?? 0) > 0) lines.push(`Recorded failures: ${p.failureCount}`);
    if ((p.articleMissCount ?? 0) > 0) lines.push(`Article misses: ${p.articleMissCount}`);
    return lines.join("\n");
}

function Sparkline({ values }: { values: number[] }) {
    if (values.length === 0) return <div className={styles.sparkEmpty} />;
    const w = 110;
    const h = 22;
    const max = Math.max(1, ...values);
    const step = values.length > 1 ? w / (values.length - 1) : 0;
    const y = (v: number) => h - (v / max) * (h - 4) - 2;
    const path = values
        .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`)
        .join(" ");
    const area = `${path} L${((values.length - 1) * step).toFixed(1)},${h} L0,${h} Z`;
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className={styles.spark} preserveAspectRatio="none">
            <path d={area} className={styles.sparkArea} />
            <path d={path} className={styles.sparkLine} />
        </svg>
    );
}
