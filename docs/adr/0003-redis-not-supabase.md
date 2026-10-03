# Redis, not Supabase

Every other TEKGUYZ demo uses Supabase. This one uses a small Upstash Redis
store from the Vercel Marketplace instead. It holds the call limits and each
Visitor's Call Notes, and every entry expires by itself after 7 days, so there
is no cleanup job. A Visitor reaches only their own Call Notes, through a
random ID in a cookie.

*Why:* a free Supabase account holds two active projects. On 2026-10-03 two of
the three accounts were full, and the last free slot (the `tekguyz-command`
account) is kept for the store demo, which needs a real database. This app's
data is small and lives only 7 days, which fits a store with built-in expiry.

## Considered Options

- **Take the last free Supabase slot.** Rejected: it would leave no slot for
  the store demo in the same Big job (tekguyz/tekguyz-one#17).
- **Keep calls only in the Visitor's browser, as FancyFam does.** Rejected: the
  call limits need a server store anyway, and one store is simpler than two.
