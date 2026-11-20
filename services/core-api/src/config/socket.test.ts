// Tests for the account-deleted rules of the websocket: the handshake and disconnectUser
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { env } from './env';
import { disconnectUser, initSocketServer, resolveSocketUserId } from './socket';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function token(id = USER_ID) {
  return jwt.sign({ id, email: `${id}@example.com`, role: 'user' }, env.jwtSecret, { algorithm: 'HS256' });
}

async function withUsersRow(rows: unknown[], run: () => Promise<void>) {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) =>
    sql.includes('SELECT deleted_at FROM users WHERE id = $1') ? { rowCount: rows.length, rows } : { rowCount: 0, rows: [] };
  try {
    await run();
  } finally {
    db.query = originalQuery;
  }
}

test('resolveSocketUserId - an existing, active account gets its user id', async () => {
  await withUsersRow([{ deleted_at: null }], async () => {
    assert.equal(await resolveSocketUserId(token()), USER_ID);
  });
});

test('resolveSocketUserId - a deleted account, a missing row, a bad token and no token are all guests', async () => {
  await withUsersRow([{ deleted_at: new Date() }], async () => {
    assert.equal(await resolveSocketUserId(token()), undefined);
  });
  await withUsersRow([], async () => {
    assert.equal(await resolveSocketUserId(token()), undefined);
  });
  await withUsersRow([{ deleted_at: null }], async () => {
    assert.equal(await resolveSocketUserId('not-a-jwt'), undefined);
    assert.equal(await resolveSocketUserId(undefined), undefined);
  });
});

test('resolveSocketUserId - a database error is a guest, never a user', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async () => {
    throw new Error('db down');
  };
  try {
    assert.equal(await resolveSocketUserId(token()), undefined);
  } finally {
    db.query = originalQuery;
  }
});

test('disconnectUser - closes every socket in the user room', () => {
  const server = http.createServer();
  const io = initSocketServer(server);
  const calls: { room: string; close: unknown }[] = [];
  (io as any).in = (room: string) => ({ disconnectSockets: (close: unknown) => calls.push({ room, close }) });
  try {
    disconnectUser(USER_ID);
    assert.deepEqual(calls, [{ room: `user:${USER_ID}`, close: true }]);
  } finally {
    io.close();
  }
});
