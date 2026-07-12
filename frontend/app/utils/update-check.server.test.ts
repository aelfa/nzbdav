import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkForUpdate,
  compareSemver,
  isComparableVersion,
  resetUpdateCheckCache,
} from "./update-check.server";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  resetUpdateCheckCache();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-12T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetUpdateCheckCache();
});

describe("compareSemver", () => {
  it.each([
    ["0.7.5", "0.7.5", 0],
    ["0.8.0", "0.7.5", 1],
    ["0.7.4", "0.7.5", -1],
    ["v0.8.0", "0.7.5", 1],
    ["0.7.5", "v0.8.0", -1],
    ["1.0.0", "0.9.9", 1],
    ["0.7", "0.7.0", 0],
  ])("compares %s and %s", (a, b, expectedSign) => {
    const result = compareSemver(a, b);
    if (expectedSign === 0) expect(result).toBe(0);
    else if (expectedSign > 0) expect(result).toBeGreaterThan(0);
    else expect(result).toBeLessThan(0);
  });
});

describe("isComparableVersion", () => {
  it.each([
    [undefined, false],
    [null, false],
    ["", false],
    ["unknown", false],
    ["Unknown", false],
    ["0.0.0", false],
    ["pre-123", false],
    ["PRE-1", false],
    ["0.7.5", true],
    ["v0.7.5", true],
  ])("treats %s as comparable=%s", (version, expected) => {
    expect(isComparableVersion(version)).toBe(expected);
  });
});

describe("checkForUpdate", () => {
  it("returns null for non-comparable versions without fetching", async () => {
    await expect(checkForUpdate("pre-42")).resolves.toBeNull();
    await expect(checkForUpdate("unknown")).resolves.toBeNull();
    await expect(checkForUpdate("0.0.0")).resolves.toBeNull();
    await expect(checkForUpdate(undefined)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns update metadata when latest is newer", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        tag_name: "v0.8.0",
        html_url: "https://github.com/nzbdav/nzbdav/releases/tag/v0.8.0",
      }),
    );

    await expect(checkForUpdate("0.7.5")).resolves.toEqual({
      latestVersion: "0.8.0",
      releaseUrl: "https://github.com/nzbdav/nzbdav/releases/tag/v0.8.0",
    });
  });

  it("returns null when current version is up to date", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        tag_name: "v0.7.5",
        html_url: "https://github.com/nzbdav/nzbdav/releases/tag/v0.7.5",
      }),
    );

    await expect(checkForUpdate("0.7.5")).resolves.toBeNull();
  });

  it("returns null when current version is newer than latest", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        tag_name: "v0.7.5",
        html_url: "https://github.com/nzbdav/nzbdav/releases/tag/v0.7.5",
      }),
    );

    await expect(checkForUpdate("0.8.0")).resolves.toBeNull();
  });

  it("falls back to releases page when html_url is missing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tag_name: "v0.9.0" }));

    await expect(checkForUpdate("0.7.5")).resolves.toEqual({
      latestVersion: "0.9.0",
      releaseUrl: "https://github.com/nzbdav/nzbdav/releases",
    });
  });

  it("returns null when fetch fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(checkForUpdate("0.7.5")).resolves.toBeNull();
  });

  it("returns null when GitHub responds with an error status", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "rate limited" }, 403));
    await expect(checkForUpdate("0.7.5")).resolves.toBeNull();
  });

  it("reuses the cached release within the TTL", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        tag_name: "v0.8.0",
        html_url: "https://github.com/nzbdav/nzbdav/releases/tag/v0.8.0",
      }),
    );

    await checkForUpdate("0.7.5");
    await checkForUpdate("0.7.5");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches after the cache TTL expires", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          tag_name: "v0.8.0",
          html_url: "https://github.com/nzbdav/nzbdav/releases/tag/v0.8.0",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          tag_name: "v0.9.0",
          html_url: "https://github.com/nzbdav/nzbdav/releases/tag/v0.9.0",
        }),
      );

    await expect(checkForUpdate("0.7.5")).resolves.toMatchObject({
      latestVersion: "0.8.0",
    });

    vi.advanceTimersByTime(60 * 60 * 1000);

    await expect(checkForUpdate("0.7.5")).resolves.toMatchObject({
      latestVersion: "0.9.0",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
