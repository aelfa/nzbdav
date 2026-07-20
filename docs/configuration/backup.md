# Backup and restore

Logical SQL dumps of databases, schedule/retention, upload/download/restore.

| Control | Config key | Default | Effect |
|---------|------------|---------|--------|
| Enable daily backup | `backup.schedule-enabled` | off | `.sql` under config volume |
| Daily run time | `backup.schedule-time` | midnight | Uses `TZ` |
| Keep newest backups | `backup.retention-count` | `5` | Prune non-preserved; `0` = no prune |

Actions: Create / Upload / Download / Preserve / Restore / Delete.

!!! warning

    Dumps include `db.sqlite`, `metrics.sqlite`, `warden.db` as SQL — **not** `blobs/`. Missing blobs after restore are reported in the UI. Restore replaces settings, queue, history, and WebDAV tree metadata; creates a pre-restore safety backup; server restarts into maintenance.

[Backups and upgrades](../guides/backups-upgrades.md)
