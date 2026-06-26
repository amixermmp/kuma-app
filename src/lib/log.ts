import { createAdminClient } from '@/lib/supabase/admin'

type ActorType = 'staff' | 'owner' | 'system'

interface LogParams {
  actorType: ActorType
  actorId?: string
  actorName: string
  action: string
  description: string
  metadata?: Record<string, unknown>
}

export async function writeLog(params: LogParams): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('activity_logs').insert({
      actor_type: params.actorType,
      actor_id:   params.actorId ?? null,
      actor_name: params.actorName,
      action:     params.action,
      description: params.description,
      metadata:   params.metadata ?? {},
    })
  } catch (err) {
    // Log failures must never crash the main flow
    console.error('[log] failed to write activity log:', err)
  }
}

// Auto-delete logs older than 90 days (call once per day from any route)
export async function pruneOldLogs(): Promise<void> {
  try {
    const admin = createAdminClient()
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    await admin.from('activity_logs').delete().lt('created_at', cutoff)
  } catch (err) {
    console.error('[log] failed to prune old logs:', err)
  }
}
