# Logs and crash dumps

## Container logs

```bash
docker compose logs --tail=200 -f nzbdav
docker compose logs --tail=200 -f nzbdav_rclone
```

When a process exits, the entrypoint logs the exit code. Values above `128` encode a fatal signal (`128+N`) — e.g. `139` is SIGSEGV, `132` is SIGILL.

The admin UI also offers a live log viewer.

## Stream traces (development)

Local backends started with `scripts/run-backend.sh` enable `STREAM_TRACE_EVENTS`. Dump a session with `./scripts/dump-stream-trace.sh` — see [Contributing](../community/contributing.md).

## .NET crash dumps (opt-in)

Minidumps are **off** by default (large; may contain article data). To capture on the next backend crash:

```yaml
environment:
  - DOTNET_DbgEnableMiniDump=1
  - DOTNET_DbgMiniDumpType=2
  - DOTNET_DbgMiniDumpName=/config/dump.%p
```

Analyze with `dotnet-dump`, then remove the env vars and dump files.

## Rclone mount failures

Verify `/dev/fuse`, sidecar start order, WebDAV credentials, and `user_allow_other` if `--allow-other` is rejected. RC Test Conn needs `--rc*` flags and matching host/user/pass.
