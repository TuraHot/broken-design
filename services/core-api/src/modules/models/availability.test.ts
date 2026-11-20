import test from 'node:test';
import assert from 'node:assert/strict';
import { isModelUnavailable, MODEL_SELLABLE_SQL, ownerActiveSql } from './availability';

test('ownerActiveSql - requires the owner to be neither suspended nor deleted', () => {
  assert.equal(ownerActiveSql('u'), 'u.suspended_at IS NULL AND u.deleted_at IS NULL');
});

test('MODEL_SELLABLE_SQL - model visible and owner active', () => {
  assert.equal(
    MODEL_SELLABLE_SQL,
    'm.deleted_at IS NULL AND m.hidden_at IS NULL AND o.suspended_at IS NULL AND o.deleted_at IS NULL',
  );
});

test('isModelUnavailable - true for removed, hidden, suspended owner or deleted owner only', () => {
  assert.equal(isModelUnavailable({}), false);
  assert.equal(isModelUnavailable({ deleted_at: null, hidden_at: null, owner_suspended_at: null, owner_deleted_at: null }), false);
  for (const key of ['deleted_at', 'hidden_at', 'owner_suspended_at', 'owner_deleted_at']) {
    assert.equal(isModelUnavailable({ [key]: new Date() }), true, key);
  }
});
