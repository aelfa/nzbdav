const GITHUB_LATEST_RELEASE_URL =
  "https://api.github.com/repos/nzbdav/nzbdav/releases/latest";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 5_000;
const RELEASES_FALLBACK_URL = "https://github.com/nzbdav/nzbdav/releases";

export type UpdateAvailable = {
  latestVersion: string;
  releaseUrl: string;
};

type CachedRelease = {
  latestVersion: string;
  releaseUrl: string;
  checkedAt: number;
};

let cache: CachedRelease | null = null;
let inFlight: Promise<CachedRelease | null> | null = null;

/** Reset process-local cache (for tests). */
export function resetUpdateCheckCache(): void {
  cache = null;
  inFlight = null;
}

export function isComparableVersion(version: string | undefined | null): version is string {
  if (!version) return false;
  const trimmed = version.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return false;
  if (trimmed === "0.0.0") return false;
  if (/^pre-/i.test(trimmed)) return false;
  return parseVersionParts(trimmed) !== null;
}

/** Compare dotted semver strings. Returns positive if a > b, negative if a < b, 0 if equal. */
export function compareSemver(a: string, b: string): number {
  const partsA = parseVersionParts(a);
  const partsB = parseVersionParts(b);
  if (!partsA || !partsB) return 0;

  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const left = partsA[i] ?? 0;
    const right = partsB[i] ?? 0;
    if (left !== right) return left - right;
  }
  return 0;
}

function parseVersionParts(version: string): number[] | null {
  const normalized = version.trim().replace(/^v/i, "");
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?$/.exec(normalized);
  if (!match) return null;
  return match.slice(1).filter((p) => p !== undefined).map((p) => Number(p));
}

function isCacheFresh(entry: CachedRelease, now: number): boolean {
  return now - entry.checkedAt < CACHE_TTL_MS;
}

async function fetchLatestRelease(): Promise<CachedRelease | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "nzbdav",
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      tag_name?: string;
      html_url?: string;
    };

    const tag = data.tag_name?.trim();
    if (!tag) return null;

    const latestVersion = tag.replace(/^v/i, "");
    if (!parseVersionParts(latestVersion)) return null;

    return {
      latestVersion,
      releaseUrl: data.html_url?.trim() || RELEASES_FALLBACK_URL,
      checkedAt: Date.now(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getCachedLatestRelease(): Promise<CachedRelease | null> {
  const now = Date.now();
  if (cache && isCacheFresh(cache, now)) {
    return cache;
  }

  if (!inFlight) {
    inFlight = fetchLatestRelease()
      .then((result) => {
        if (result) {
          cache = result;
        }
        return result;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

/**
 * Returns update metadata when a newer stable GitHub release exists than
 * `currentVersion`. Failures and non-comparable versions yield null.
 */
export async function checkForUpdate(
  currentVersion: string | undefined | null,
): Promise<UpdateAvailable | null> {
  if (!isComparableVersion(currentVersion)) {
    return null;
  }

  const latest = await getCachedLatestRelease();
  if (!latest) return null;

  if (compareSemver(latest.latestVersion, currentVersion) <= 0) {
    return null;
  }

  return {
    latestVersion: latest.latestVersion,
    releaseUrl: latest.releaseUrl,
  };
}
