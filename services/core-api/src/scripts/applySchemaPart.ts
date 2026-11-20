import fs from "fs";
import path from "path";
import { db } from "../config/db";
import { env } from "../config/env";

/**
 * Runs the NEW part of supabase/schema.sql (section 9 to the end: license-change history, notifications,
 * timed suspensions, hide / restore history, password resets, account deletion columns) on the database in DATABASE_URL, in ONE transaction. Safe to run again: every
 * statement is IF NOT EXISTS. It does not run the seed accounts in section 7, so no account is reset.
 *
 * Run it from services/core-api:   npx.cmd tsx src/scripts/applySchemaPart.ts
 * Add --dry-run to print the SQL and the host it would run on without changing anything.
 */
const START_MARKER = "-- 9. Model license changes by an admin";

async function main() {
  if (!env.databaseUrl) {
    console.error("DATABASE_URL is not configured in .env");
    process.exit(1);
  }

  const schemaPath = path.resolve(__dirname, "../../../../supabase/schema.sql");
  const full = fs.readFileSync(schemaPath, "utf8");
  const start = full.indexOf(START_MARKER);
  if (start < 0) {
    console.error(`Could not find "${START_MARKER}" in ${schemaPath}`);
    process.exit(1);
  }
  const sql = full.slice(start);
  const host = new URL(env.databaseUrl).hostname; // the host only, never the password

  console.log(`Database host: ${host}`);
  if (process.argv.includes("--dry-run")) {
    console.log("--- dry run: nothing was changed. SQL that would run: ---\n" + sql);
    return;
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    const check = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM information_schema.columns
           WHERE table_name = 'users' AND column_name IN ('suspended_until', 'suspension_reason', 'deleted_at', 'deleted_by', 'deleted_reason', 'original_email')) AS user_columns,
         (SELECT COUNT(*)::int FROM information_schema.tables
           WHERE table_name IN ('model_license_changes', 'notifications', 'user_suspensions', 'model_visibility_changes')) AS new_tables,
         (SELECT COUNT(*)::int FROM pg_tables
           WHERE schemaname = 'public' AND rowsecurity
             AND tablename IN ('model_license_changes', 'notifications', 'user_suspensions', 'model_visibility_changes')) AS rls_tables`,
    );
    const { user_columns, new_tables, rls_tables } = check.rows[0];
    console.log(`Done. users columns: ${user_columns}/6, new tables: ${new_tables}/4, row level security on: ${rls_tables}/4`);
    if (user_columns !== 6 || new_tables !== 4 || rls_tables !== 4) process.exitCode = 1;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Failed, nothing was changed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
}

main();
