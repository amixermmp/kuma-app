import { createClient } from '@supabase/supabase-js'

// Next.js patches the global fetch() to participate in its Data Cache.
// Supabase-js uses fetch() internally for every query — without forcing
// cache:'no-store' here, Next.js can silently cache PostgREST responses
// (even on routes marked force-dynamic), causing stale reads that never
// reflect newly-written data. This bit us in /api/cron/line-notify: the
// cron kept resending fixed routine/document items using a cached response
// from an earlier request, while direct scripts (outside Next.js) always
// saw fresh data.
function noStoreFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: 'no-store' })
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: noStoreFetch },
  })
}
