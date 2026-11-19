// Lifts suspensions whose end time has passed. Every place that checks `users.suspended_at` (core-api and
// cdn-service) keeps working unchanged because the column is simply cleared when the time is up.
// A suspension with no end time (`suspended_until IS NULL`) is never touched here.
import { db } from '../../config/db';

/** Lifts every expired suspension, records it and notifies the user, in ONE statement. Returns how many were lifted. */
export async function liftExpiredSuspensions(): Promise<number> {
  const result = await db.query<{ lifted: number }>(
    `WITH expired AS (
       UPDATE users
       SET suspended_at = NULL, suspended_until = NULL, suspension_reason = NULL
       WHERE suspended_at IS NOT NULL AND suspended_until IS NOT NULL AND suspended_until <= NOW()
       RETURNING id, suspended_until
     ),
     hist AS (
       INSERT INTO user_suspensions (user_id, admin_id, action, reason, until)
       SELECT id, NULL::uuid, 'expire'::varchar, NULL::text, suspended_until FROM expired
       RETURNING id
     ),
     note AS (
       INSERT INTO notifications (user_id, kind, data)
       SELECT id, 'account_restored'::varchar, jsonb_build_object('auto', true, 'until', suspended_until) FROM expired
       RETURNING id
     )
     SELECT COUNT(*)::int AS lifted FROM expired`,
  );
  return Number(result.rows[0]?.lifted ?? 0);
}

/** Runs the sweep now and then every `intervalMs`. Returns a function that stops it. A failed run is logged, not fatal. */
export function startSuspensionSweeper(intervalMs = 60_000): () => void {
  const run = () => {
    liftExpiredSuspensions().catch((err) => {
      console.error('[Suspension sweeper]: could not lift expired suspensions:', err instanceof Error ? err.message : err);
    });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref(); // never keeps the process alive on its own
  return () => clearInterval(timer);
}
