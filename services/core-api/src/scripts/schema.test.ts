// Guard for supabase/schema.sql: Supabase serves every table of the public schema through its REST API, so a table
// that is created without row level security can be read and changed by anyone who has the anon key. core-api
// connects with the table owner role (not affected by RLS), so turning RLS on with no policy blocks the REST API
// and breaks nothing. Every table from section 9 on must therefore enable it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const schema = fs.readFileSync(path.resolve(__dirname, '../../../../supabase/schema.sql'), 'utf8');
const start = schema.indexOf('-- 9. Model license changes by an admin');

test('schema.sql - section 9 onward exists and creates the admin moderation tables', () => {
  assert.ok(start > 0, 'section 9 marker not found');
  const created = [...schema.slice(start).matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
  // Later sections (for example password_resets) may add more tables after these; they only have to keep RLS on (next test).
  for (const table of ['model_license_changes', 'model_visibility_changes', 'notifications', 'user_suspensions']) {
    assert.ok(created.includes(table), `${table} is missing from section 9 onward`);
  }
});

test('schema.sql - every table created from section 9 on enables row level security', () => {
  const part = schema.slice(start);
  const created = [...part.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
  for (const table of created) {
    assert.match(part, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`), `${table} must enable row level security`);
  }
});
