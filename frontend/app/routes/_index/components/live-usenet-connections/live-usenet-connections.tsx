import { useEffect, useState } from "react";
import { receiveMessage } from "~/utils/websocket-util";

const usenetConnectionsTopic = {'cxs': 'state'};

type LiveUsenetConnectionsProps = {
    hasUsenetProviders: boolean,
};

export function LiveUsenetConnections({ hasUsenetProviders }: LiveUsenetConnectionsProps) {
    const [connections, setConnections] = useState<string | null>(null);
    const parts = (connections || "0|0|0|0|1|0").split("|");
    const [_0, _1, _2, live, max, idle] = parts.map(x => Number(x));
    const active = live - idle;

    useEffect(() => {
        if (!hasUsenetProviders) {
            setConnections(null);
            return;
        }

        let ws: WebSocket;
        let disposed = false;
        function connect() {
            ws = new WebSocket(window.location.origin.replace(/^http/, 'ws'));
            ws.onmessage = receiveMessage((_, message) => setConnections(message));
            ws.onopen = () => ws.send(JSON.stringify(usenetConnectionsTopic));
            ws.onerror = () => { ws.close() };
            ws.onclose = onClose;
            return () => { disposed = true; ws.close(); }
        }
        function onClose(e: CloseEvent) {
            if (e.code == 1008) {
                globalThis.location.assign("/login");
                return;
            }
            !disposed && setTimeout(() => connect(), 1000);
            setConnections(null);
        }
        return connect();
    }, [hasUsenetProviders]);

    return (
        <div
            className="stats hidden h-10 overflow-hidden border border-base-content/10 bg-base-200 sm:inline-grid"
            aria-label="Usenet connections"
        >
            <div className="stat flex items-center gap-3 px-3 py-1">
                <div className="stat-title text-[10px] font-semibold leading-none uppercase tracking-wide text-base-content/50">
                    Connections
                </div>
                <span className="h-4 w-px bg-base-content/15" aria-hidden="true" />
                <div className="stat-value font-mono text-sm leading-tight text-base-content/80">
                    {!hasUsenetProviders && "—"}
                    {hasUsenetProviders && connections && `${live}/${max}`}
                    {hasUsenetProviders && !connections && (
                        <span className="loading loading-spinner loading-xs" />
                    )}
                </div>
                <div className="stat-desc text-[10px] leading-none whitespace-nowrap text-base-content/50">
                    {!hasUsenetProviders && "No providers"}
                    {hasUsenetProviders && connections && `${active} active`}
                    {hasUsenetProviders && !connections && "Connecting"}
                </div>
            </div>
        </div>
    );
}
