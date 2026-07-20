# Usenet

Configure NNTP providers, cascade vs pooled routing, and queue-side NNTP pipelining.

## Providers

Add one or more accounts. Each provider supports:

| Control | What it does | Default / notes |
|---------|--------------|-----------------|
| Nickname | Friendly label instead of hostname | optional |
| Storage group | Same label → skip siblings after a clean article miss | optional; only same upstream |
| Host / Port | NNTP endpoint | port often `563` |
| Username / Password | Credentials | prefer SSL |
| Max Connections | Concurrent NNTP connections for this account | ≤ plan limit |
| Pipeline depth | Per-provider override when pipelining on | blank = global `8` |
| Type | Disabled / Pool Connections / Backup Only | Pool |
| Use SSL | TLS for NNTP | on |
| Data Cap | Block-account limit; auto-pauses near ~95% | uncapped |
| Already Used | Seed usage when migrating mid-block | empty |
| Auto-tune | Speed test → recommend connections + pipelining | action |

Persisted as `usenet.providers` JSON.

!!! warning "Cleartext"

    Disabling SSL stores/sends credentials in cleartext on the wire — only for trusted networks.

## Routing and pipelining

| Control | Config key | Default | Effect |
|---------|------------|---------|--------|
| Enable cascade routing | `usenet.cascade.enabled` | off | Prefer providers in drag order; off = shared pool |
| Enable NNTP pipelining | `usenet.pipelining.enabled` | off | Batch first-segment BODY during queue imports/benchmarks |
| Default pipeline depth | `usenet.pipelining.depth` | `8` | Requests in flight per connection (1–64) |

Run Auto-tune before enabling queue pipelining. WebDAV streaming pipelining is a **separate** toggle on [WebDAV](webdav.md).

See [NNTP pipelining](../features/nntp-pipelining.md) and [Multi-provider](../features/multi-provider.md).
