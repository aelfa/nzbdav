import { describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { disconnectBrowserClients } from "./websocket.server";

describe("disconnectBrowserClients", () => {
    it("clears stale state and reconnects each browser once", () => {
        const close = vi.fn();
        const client = {
            readyState: WebSocket.OPEN,
            close,
        } as unknown as WebSocket;
        const subscriptions = new Map([
            ["ls", new Set([client])],
            ["cxs", new Set([client])],
        ]);
        const lastMessage = new Map([
            ["ls", "live"],
            ["cxs", "connections"],
        ]);

        disconnectBrowserClients(subscriptions, lastMessage);

        expect(lastMessage.size).toBe(0);
        expect(close).toHaveBeenCalledOnce();
        expect(close).toHaveBeenCalledWith(1012, "Backend websocket reconnecting");
    });
});
