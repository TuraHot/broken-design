// One place for "can this model still be bought or used": the same rule is applied by payments, likes and creator pages.
// An owner stops counting when an admin suspends or deletes the account (deleted accounts keep their row).

/** SQL for an owner that is neither suspended nor deleted; `alias` is the users table alias in the query. */
export function ownerActiveSql(alias: string): string {
  return `${alias}.suspended_at IS NULL AND ${alias}.deleted_at IS NULL`;
}

/** SQL for a model nobody can buy: not removed, not hidden, owner active. Joined as `m` (model) and `o` (owner). */
export const MODEL_SELLABLE_SQL = `m.deleted_at IS NULL AND m.hidden_at IS NULL AND ${ownerActiveSql('o')}`;

/** Row twin of MODEL_SELLABLE_SQL: removed, hidden, or its owner is suspended or deleted by an admin. */
export function isModelUnavailable(row: {
  deleted_at?: unknown;
  hidden_at?: unknown;
  owner_suspended_at?: unknown;
  owner_deleted_at?: unknown;
}): boolean {
  return Boolean(row.deleted_at || row.hidden_at || row.owner_suspended_at || row.owner_deleted_at);
}
