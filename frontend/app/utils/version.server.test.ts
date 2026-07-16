import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBuildCommit, parseBuildCommitFromVersion } from "./version.server";

describe("getBuildCommit", () => {
  const originalEnv = process.env.NZBDAV_COMMIT_SHA;
  let tempGitDir: string;

  beforeEach(async () => {
    delete process.env.NZBDAV_COMMIT_SHA;
    tempGitDir = await mkdtemp(join(tmpdir(), "nzbdav-git-"));
  });

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env.NZBDAV_COMMIT_SHA;
    } else {
      process.env.NZBDAV_COMMIT_SHA = originalEnv;
    }
    await rm(tempGitDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("prefers NZBDAV_COMMIT_SHA env over local git", async () => {
    process.env.NZBDAV_COMMIT_SHA = "ABCDEF0123456789abcdef0123456789abcdef01";
    await writeFile(join(tempGitDir, "HEAD"), "ref: refs/heads/main\n");
    await mkdir(join(tempGitDir, "refs", "heads"), { recursive: true });
    await writeFile(
      join(tempGitDir, "refs", "heads", "main"),
      "1111111111111111111111111111111111111111\n",
    );

    await expect(getBuildCommit({ gitDir: tempGitDir })).resolves.toEqual({
      sha: "abcdef0123456789abcdef0123456789abcdef01",
      branch: "main",
      source: "env",
    });
  });

  it("rejects invalid NZBDAV_COMMIT_SHA values", async () => {
    process.env.NZBDAV_COMMIT_SHA = "not-a-sha";
    await expect(getBuildCommit({ gitDir: tempGitDir })).resolves.toBeUndefined();
  });

  it("resolves SHA from refs/heads/main", async () => {
    await writeFile(join(tempGitDir, "HEAD"), "ref: refs/heads/main\n");
    await mkdir(join(tempGitDir, "refs", "heads"), { recursive: true });
    await writeFile(
      join(tempGitDir, "refs", "heads", "main"),
      "abcdef0123456789abcdef0123456789abcdef01\n",
    );

    await expect(getBuildCommit({ gitDir: tempGitDir })).resolves.toEqual({
      sha: "abcdef0123456789abcdef0123456789abcdef01",
      branch: "main",
      source: "git",
    });
  });

  it("resolves SHA from packed-refs when loose ref is missing", async () => {
    await writeFile(join(tempGitDir, "HEAD"), "ref: refs/heads/main\n");
    await writeFile(
      join(tempGitDir, "packed-refs"),
      [
        "# pack-refs with: peeled fully-peeled sorted",
        "abcdef0123456789abcdef0123456789abcdef01 refs/heads/main",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/other",
        "",
      ].join("\n"),
    );

    await expect(getBuildCommit({ gitDir: tempGitDir })).resolves.toEqual({
      sha: "abcdef0123456789abcdef0123456789abcdef01",
      branch: "main",
      source: "git",
    });
  });

  it("returns undefined for detached HEAD", async () => {
    await writeFile(
      join(tempGitDir, "HEAD"),
      "abcdef0123456789abcdef0123456789abcdef01\n",
    );

    await expect(getBuildCommit({ gitDir: tempGitDir })).resolves.toBeUndefined();
  });

  it("returns undefined for non-main branches", async () => {
    await writeFile(join(tempGitDir, "HEAD"), "ref: refs/heads/feature/foo\n");
    await mkdir(join(tempGitDir, "refs", "heads", "feature"), { recursive: true });
    await writeFile(
      join(tempGitDir, "refs", "heads", "feature", "foo"),
      "abcdef0123456789abcdef0123456789abcdef01\n",
    );

    await expect(getBuildCommit({ gitDir: tempGitDir })).resolves.toBeUndefined();
  });

  it("returns undefined when .git is missing", async () => {
    await expect(
      getBuildCommit({ gitDir: join(tempGitDir, "missing") }),
    ).resolves.toBeUndefined();
  });

  it("falls back to a SHA embedded in a main-<sha> version label", async () => {
    await expect(
      getBuildCommit({ gitDir: join(tempGitDir, "missing"), version: "main-E0EEF520" }),
    ).resolves.toEqual({
      sha: "e0eef520",
      branch: "main",
      source: "version",
    });
  });

  it("prefers NZBDAV_COMMIT_SHA over the version-embedded SHA", async () => {
    process.env.NZBDAV_COMMIT_SHA = "abcdef0123456789abcdef0123456789abcdef01";

    await expect(
      getBuildCommit({ gitDir: join(tempGitDir, "missing"), version: "main-e0eef520" }),
    ).resolves.toEqual({
      sha: "abcdef0123456789abcdef0123456789abcdef01",
      branch: "main",
      source: "env",
    });
  });

  it("prefers local git over the version-embedded SHA", async () => {
    await writeFile(join(tempGitDir, "HEAD"), "ref: refs/heads/main\n");
    await mkdir(join(tempGitDir, "refs", "heads"), { recursive: true });
    await writeFile(
      join(tempGitDir, "refs", "heads", "main"),
      "abcdef0123456789abcdef0123456789abcdef01\n",
    );

    await expect(
      getBuildCommit({ gitDir: tempGitDir, version: "main-e0eef520" }),
    ).resolves.toEqual({
      sha: "abcdef0123456789abcdef0123456789abcdef01",
      branch: "main",
      source: "git",
    });
  });

  it("ignores version labels that do not embed a commit SHA", async () => {
    for (const version of ["pre-42", "0.7.20", "main-", "main-xyz", "dev-abc1234"]) {
      await expect(
        getBuildCommit({ gitDir: join(tempGitDir, "missing"), version }),
      ).resolves.toBeUndefined();
    }
  });
});

describe("parseBuildCommitFromVersion", () => {
  it.each([
    ["main-e0eef520", "e0eef520"],
    ["Main-E0EEF520", "e0eef520"],
    ["  main-abcdef0123456789abcdef0123456789abcdef01  ", "abcdef0123456789abcdef0123456789abcdef01"],
  ])("parses %s", (version, expectedSha) => {
    expect(parseBuildCommitFromVersion(version)).toEqual({
      sha: expectedSha,
      branch: "main",
      source: "version",
    });
  });

  it.each([
    [undefined],
    [null],
    [""],
    ["0.7.20"],
    ["pre-42"],
    ["main-"],
    ["main-xyz123"],
    ["main-abc123"], // 6 hex chars — too short
    ["feature-e0eef520"],
  ])("returns undefined for %s", (version) => {
    expect(parseBuildCommitFromVersion(version)).toBeUndefined();
  });
});
