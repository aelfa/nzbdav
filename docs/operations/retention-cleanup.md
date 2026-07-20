# Retention and cleanup

## Database retention

| Setting / env | Default | Effect |
|---------------|---------|--------|
| History retention days / `DATABASE_HISTORY_RETENTION_DAYS` | 90 | Prune SAB history rows; **does not** delete WebDAV mounts |
| Health-check retention / `DATABASE_HEALTHCHECK_RETENTION_DAYS` | 30 | Prune health result rows |
| `DATABASE_MAINTENANCE_INTERVAL_HOURS` | 6 | Sweep cadence (env) |

Configure in **Settings → Maintenance**.

## NZB blobs

Blobs under `{CONFIG_PATH}/blobs/` remain while referenced by queue, history, or mounted `/content`. When the last reference drops, background cleanup removes them. History retention alone does not make mounts eligible for orphan deletion.

## Orphaned files

**Remove Orphaned Files** (Maintenance) deletes WebDAV files not linked from the library directory. Supports dry run. Schedule optional daily cleanup — set container `TZ`.

## NZB file backups

Optional copies of incoming NZBs (SABnzbd settings) prune by `api.nzb-backup-retention-days`.

[Deletion audit](deletion-audit.md) · [Maintenance](../configuration/maintenance.md)
