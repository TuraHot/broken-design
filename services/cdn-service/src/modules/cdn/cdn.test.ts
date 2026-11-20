// Tests for the CDN module: access rules, embed_key, Range, caching, downloads.
import { TEST_STORAGE_DIR } from "./cdn.test-env";
import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { AddressInfo } from "net";
import express from "express";
import jwt from "jsonwebtoken";
import { db } from "../../config/db";
import { assertProductionSecrets, env } from "../../config/env";
import { errorHandler } from "../../middlewares/error.middleware";
import { cdnRouter } from "./cdn.routes";
import { uploadRouter } from "../upload/upload.routes";
import { parseRangeSpec, resolveRange } from "./range";
import { contentDisposition } from "./cdn.service";
import {
  assertSafeKey,
  assetKey,
  avatarKey,
  candidateKeys,
  legacyKey,
} from "../../storage/keys";
import { LocalDiskStorage } from "../../storage";
import { Document, NodeIO } from "@gltf-transform/core";
import {
  embedLicenseAndWatermark,
  verifyGlbWatermark,
} from "../../utils/glbWatermark";

// ─── Fixtures ───────────────────────────────────────────────────────────────
function store(content: Buffer, ext: "glb" | "webp"): string {
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  fs.writeFileSync(path.join(TEST_STORAGE_DIR, `${hash}.${ext}`), content);
  return hash;
}

const FULL = Buffer.from("glTF-FULL-0123456789abcdefghijklmnopqrstuvwxyz"); // 46 bytes
const PREVIEW = Buffer.from("glTF-PREVIEW-small");
const POSTER = Buffer.from("RIFF....WEBPposter");
const FULL_HASH = store(FULL, "glb");
const PREVIEW_HASH = store(PREVIEW, "glb");
const POSTER_HASH = store(POSTER, "webp");

const OWNER = "11111111-1111-4111-8111-111111111111";
const BUYER = "22222222-2222-4222-8222-222222222222";
const STRANGER = "33333333-3333-4333-8333-333333333333";
const FREE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAID_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MISSING_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const KEY = "a".repeat(48);

type Row = Record<string, any>;
let models: Record<string, Row>;
let purchases: Row[];
let users: Record<string, Row>;
let downloadIncrements: string[];

function resetDb() {
  const base = {
    owner_id: OWNER,
    file_hash: FULL_HASH,
    poster_hash: POSTER_HASH,
    hidden_at: null,
    deleted_at: null,
    owner_suspended_at: null,
  };
  models = {
    [FREE_ID]: {
      ...base,
      id: FREE_ID,
      title: "Free Robot",
      preview_hash: null,
      price_cents: 0,
    },
    [PAID_ID]: {
      ...base,
      id: PAID_ID,
      title: "รองเท้า Sneaker",
      preview_hash: PREVIEW_HASH,
      price_cents: 500,
    },
  };
  purchases = [
    { user_id: BUYER, model_id: PAID_ID, status: "paid", embed_key: KEY },
  ];
  users = {
    [OWNER]: { suspended_at: null },
    [BUYER]: { suspended_at: null },
    [STRANGER]: { suspended_at: null },
  };
  downloadIncrements = [];
}

(db as any).query = async (sql: string, params: any[] = []) => {
  if (sql.includes("FROM models m")) {
    const m = models[params[0]];
    return { rows: m ? [{ ...m }] : [], rowCount: m ? 1 : 0 };
  }
  if (sql.includes("WHERE (file_hash = $1 OR preview_hash = $1) AND owner_id <> $2")) {
    const matches = Object.values(models)
      .filter((m) => (m.file_hash === params[0] || m.preview_hash === params[0]) && m.owner_id !== params[1])
      .slice(0, 1)
      .map((m) => ({ id: m.id, owner_id: m.owner_id, title: m.title }));
    return { rows: matches, rowCount: matches.length };
  }
  if (sql.includes("FROM models WHERE id = $1")) {
    const m = models[params[0]];
    return {
      rows: m
        ? [
            {
              id: m.id,
              owner_id: m.owner_id,
              title: m.title,
              license: m.license ?? "COMMERCIAL",
              file_hash: m.file_hash,
              file_size: m.file_size ?? FULL.length,
              preview_hash: m.preview_hash,
              poster_hash: m.poster_hash,
              deleted_at: m.deleted_at ?? null,
            },
          ]
        : [],
      rowCount: m ? 1 : 0,
    };
  }
  if (sql.includes("UPDATE models") && sql.includes("SET file_hash = $1")) {
    const m = models[params[4]];
    if (m) {
      m.file_hash = params[0];
      m.file_size = params[1];
      m.preview_hash = params[2];
      m.poster_hash = params[3];
    }
    return { rows: [], rowCount: m ? 1 : 0 };
  }
  if (sql.includes("FROM models ORDER BY created_at DESC")) {
    const rows = Object.values(models).map((m) => ({
      id: m.id,
      owner_id: m.owner_id,
      title: m.title,
    }));
    return { rows, rowCount: rows.length };
  }
  if (sql.includes("INSERT INTO models")) {
    const inserted: Row = {
      id: params[0],
      owner_id: params[1],
      title: params[2],
      description: params[3],
      tags: params[4],
      license: params[5],
      file_hash: params[6],
      file_size: params[7],
      preview_hash: params[8],
      poster_hash: params[9],
      price_cents: params[10],
      currency: params[11],
      hidden_at: null,
      deleted_at: null,
      owner_suspended_at: null,
    };
    models[inserted.id] = inserted;
    return { rows: [{ ...inserted }], rowCount: 1 };
  }
  if (sql.includes("FROM users WHERE id")) {
    const u = users[params[0]];
    return {
      rows: u
        ? [
            {
              id: params[0],
              role: u.role ?? "creator",
              is_seller: u.is_seller ?? true,
              avatar_hash: u.avatar_hash ?? null,
              suspended_at: u.suspended_at ?? null,
              deleted_at: u.deleted_at ?? null,
            },
          ]
        : [],
      rowCount: u ? 1 : 0,
    };
  }
  if (sql.includes("FROM purchases WHERE embed_key")) {
    const rows = purchases.filter(
      (p) => p.embed_key === params[0] && p.status === "paid",
    );
    return { rows, rowCount: rows.length };
  }
  if (sql.includes("FROM users u")) {
    const u = users[params[0]];
    if (!u) return { rows: [], rowCount: 0 };
    const match = purchases.find(
      (p) =>
        p.user_id === params[0] &&
        p.model_id === params[1] &&
        p.status === "paid",
    );
    return {
      rows: [
        {
          ...u,
          purchased: Boolean(match),
          purchase_id: match?.id ?? null,
          license_type: match?.license_type ?? null,
        },
      ],
      rowCount: 1,
    };
  }
  if (sql.includes("UPDATE purchases SET watermark_hash")) {
    const p = purchases.find((item) => item.id === params[1]);
    if (p) p.watermark_hash = params[0];
    return { rows: [], rowCount: p ? 1 : 0 };
  }
  if (sql.includes("UPDATE models SET download_count")) {
    downloadIncrements.push(params[0]);
    return { rows: [], rowCount: 1 };
  }
  throw new Error(`Unexpected SQL in test: ${sql}`);
};

const app = express();
app.use("/api", uploadRouter);
app.use("/cdn", cdnRouter);
app.use(errorHandler);
const server = app.listen(0);
const port = (server.address() as AddressInfo).port;
const base = `http://localhost:${port}/cdn`;
const apiBase = `http://localhost:${port}/api`;
after(() => {
  server.close();
  fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
});
beforeEach(resetDb);

const token = (id: string, role = "user") =>
  jwt.sign({ id, email: `${id}@x.com`, role }, "cdn-test-secret");
const get = (p: string, headers: Record<string, string> = {}) =>
  fetch(base + p, { headers });
const errCode = async (res: Response) =>
  ((await res.json()) as any).error?.code;
const waitTick = () => new Promise((r) => setTimeout(r, 50));

// ─── Range parsing ──────────────────────────────────────────────────────────
test("parseRangeSpec / resolveRange", () => {
  assert.deepEqual(parseRangeSpec("bytes=0-9"), {
    kind: "bounded",
    start: 0,
    end: 9,
  });
  assert.deepEqual(parseRangeSpec("bytes=5-"), { kind: "open", start: 5 });
  assert.deepEqual(parseRangeSpec("bytes=-3"), { kind: "suffix", length: 3 });
  assert.equal(parseRangeSpec(undefined), null);
  assert.equal(parseRangeSpec("items=0-1"), null);
  assert.equal(parseRangeSpec("bytes=0-1,4-5"), null);
  assert.equal(parseRangeSpec("bytes=9-2"), null);
  assert.equal(parseRangeSpec("bytes=-"), null);

  assert.deepEqual(resolveRange({ kind: "bounded", start: 0, end: 999 }, 10), {
    start: 0,
    end: 9,
  });
  assert.deepEqual(resolveRange({ kind: "suffix", length: 50 }, 10), {
    start: 0,
    end: 9,
  });
  assert.equal(resolveRange({ kind: "open", start: 10 }, 10), null);
  assert.equal(resolveRange({ kind: "suffix", length: 0 }, 10), null);
});

test("contentDisposition keeps Thai titles via filename*", () => {
  const v = contentDisposition('รองเท้า "x"');
  assert.match(
    v,
    /^attachment; filename="[\x20-\x7e]+\.glb"; filename\*=UTF-8''/,
  );
  assert.ok(v.includes(encodeURIComponent("รองเท้า")));
});

// ─── Free models ────────────────────────────────────────────────────────────
test("free model: hash URL streams with immutable cache, CORS-friendly headers", async () => {
  const res = await get(`/models/${FREE_ID}/${FULL_HASH}.glb`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "model/gltf-binary");
  assert.equal(
    res.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );
  assert.equal(res.headers.get("accept-ranges"), "bytes");
  assert.equal(res.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.equal(res.headers.get("etag"), `"${FULL_HASH}"`);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), FULL);
});

test("free model: preview.glb and file.glb serve the full file without a key", async () => {
  for (const p of ["preview.glb", "file.glb"]) {
    const res = await get(`/models/${FREE_ID}/${p}`);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get("cache-control")!, /^public, max-age=\d+$/);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), FULL);
  }
});

test("If-None-Match → 304", async () => {
  const res = await get(`/models/${FREE_ID}/${FULL_HASH}.glb`, {
    "If-None-Match": `"${FULL_HASH}"`,
  });
  assert.equal(res.status, 304);
});

// ─── Range ──────────────────────────────────────────────────────────────────
test("Range: bounded, open, suffix → 206 with correct bytes", async () => {
  const cases: [string, number, number][] = [
    ["bytes=0-3", 0, 3],
    ["bytes=40-", 40, FULL.length - 1],
    ["bytes=-6", FULL.length - 6, FULL.length - 1],
    ["bytes=10-9999", 10, FULL.length - 1],
  ];
  for (const [range, start, end] of cases) {
    const res = await get(`/models/${FREE_ID}/${FULL_HASH}.glb`, {
      Range: range,
    });
    assert.equal(res.status, 206, range);
    assert.equal(
      res.headers.get("content-range"),
      `bytes ${start}-${end}/${FULL.length}`,
      range,
    );
    assert.equal(
      res.headers.get("content-length"),
      String(end - start + 1),
      range,
    );
    assert.deepEqual(
      Buffer.from(await res.arrayBuffer()),
      FULL.subarray(start, end + 1),
      range,
    );
  }
});

test("Range: unsatisfiable → 416 with bytes */size, not cached", async () => {
  const res = await get(`/models/${FREE_ID}/${FULL_HASH}.glb`, {
    Range: `bytes=${FULL.length}-`,
  });
  assert.equal(res.status, 416);
  assert.equal(res.headers.get("content-range"), `bytes */${FULL.length}`);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(await errCode(res), "RANGE_NOT_SATISFIABLE");
});

test("HEAD returns headers only", async () => {
  const res = await fetch(`${base}/models/${FREE_ID}/${FULL_HASH}.glb`, {
    method: "HEAD",
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-length"), String(FULL.length));
});

// ─── Paid models & embed_key ────────────────────────────────────────────────
test("paid model: preview is public, full file via hash URL is refused", async () => {
  const preview = await get(`/models/${PAID_ID}/preview.glb`);
  assert.equal(preview.status, 200);
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), PREVIEW);

  const byPreviewHash = await get(`/models/${PAID_ID}/${PREVIEW_HASH}.glb`);
  assert.equal(byPreviewHash.status, 200);
  await byPreviewHash.arrayBuffer();

  const leak = await get(`/models/${PAID_ID}/${FULL_HASH}.glb`);
  assert.equal(leak.status, 401);
  assert.equal(await errCode(leak), "KEY_REQUIRED");
  assert.equal(leak.headers.get("cache-control"), "no-store");
});

test("paid model: file.glb needs a valid embed_key", async () => {
  const noKey = await get(`/models/${PAID_ID}/file.glb`);
  assert.equal(noKey.status, 401);
  assert.equal(await errCode(noKey), "KEY_REQUIRED");

  const badKey = await get(`/models/${PAID_ID}/file.glb?key=${"b".repeat(48)}`);
  assert.equal(badKey.status, 403);
  assert.equal(await errCode(badKey), "INVALID_KEY");

  const malformed = await get(
    `/models/${PAID_ID}/file.glb?key=${encodeURIComponent("' OR 1=1 --")}`,
  );
  assert.equal(malformed.status, 403);
  await malformed.arrayBuffer();

  const ok = await get(`/models/${PAID_ID}/file.glb?key=${KEY}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await ok.arrayBuffer()), FULL);
});

test("paid model: a key bought for another model is rejected", async () => {
  purchases[0].model_id = FREE_ID;
  const res = await get(`/models/${PAID_ID}/file.glb?key=${KEY}`);
  assert.equal(res.status, 403);
  await res.arrayBuffer();
});

test("paid model: regenerated key → old key stops working immediately", async () => {
  purchases[0].embed_key = "c".repeat(48);
  const old = await get(`/models/${PAID_ID}/file.glb?key=${KEY}`);
  assert.equal(old.status, 403);
  await old.arrayBuffer();
  const fresh = await get(`/models/${PAID_ID}/file.glb?key=${"c".repeat(48)}`);
  assert.equal(fresh.status, 200);
  await fresh.arrayBuffer();
});

test("paid model: pending purchase key is rejected", async () => {
  purchases[0].status = "pending";
  const res = await get(`/models/${PAID_ID}/file.glb?key=${KEY}`);
  assert.equal(res.status, 403);
  await res.arrayBuffer();
});

// ─── Hidden / suspended / deleted ───────────────────────────────────────────
test("hidden model or suspended owner → 403 everywhere, buyers included", async () => {
  for (const flag of ["hidden_at", "owner_suspended_at"]) {
    resetDb();
    models[PAID_ID][flag] = new Date();
    models[FREE_ID][flag] = new Date();
    const paths = [
      `/models/${PAID_ID}/file.glb?key=${KEY}`,
      `/models/${PAID_ID}/preview.glb`,
      `/models/${PAID_ID}/poster.webp`,
      `/models/${FREE_ID}/${FULL_HASH}.glb`,
    ];
    for (const p of paths) {
      const res = await get(p);
      assert.equal(res.status, 403, `${flag} ${p}`);
      assert.equal(await errCode(res), "MODEL_UNAVAILABLE");
    }
    const dl = await get(`/models/${PAID_ID}/download`, {
      Authorization: `Bearer ${token(BUYER)}`,
    });
    assert.equal(dl.status, 403, `${flag} download`);
    await dl.arrayBuffer();
  }
});

test("soft-deleted model: public URLs 404, buyers keep streaming", async () => {
  models[PAID_ID].deleted_at = new Date();
  const pub = await get(`/models/${PAID_ID}/preview.glb`);
  assert.equal(pub.status, 404);
  await pub.arrayBuffer();
  const buyer = await get(`/models/${PAID_ID}/file.glb?key=${KEY}`);
  assert.equal(buyer.status, 200);
  await buyer.arrayBuffer();
});

test("unknown / malformed ids and hashes → 404", async () => {
  for (const p of [
    `/models/${MISSING_ID}/preview.glb`,
    "/models/not-a-uuid/preview.glb",
    `/models/${FREE_ID}/${"0".repeat(64)}.glb`,
    `/models/${FREE_ID}/xyz.glb`,
  ]) {
    const res = await get(p);
    assert.equal(res.status, 404, p);
    await res.arrayBuffer();
  }
});

// ─── Poster ─────────────────────────────────────────────────────────────────
test("poster.webp streams the poster; missing poster → 404", async () => {
  const res = await get(`/models/${FREE_ID}/poster.webp`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/webp");
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), POSTER);

  models[FREE_ID].poster_hash = null;
  const none = await get(`/models/${FREE_ID}/poster.webp`);
  assert.equal(none.status, 404);
  assert.equal(await errCode(none), "POSTER_NOT_FOUND");
});

// ─── Download ───────────────────────────────────────────────────────────────
test("download free model: anyone, attachment, counts once", async () => {
  const res = await get(`/models/${FREE_ID}/download`);
  assert.equal(res.status, 200);
  assert.match(
    res.headers.get("content-disposition")!,
    /^attachment; filename="Free_Robot\.glb"/,
  );
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), FULL);
  await waitTick();
  assert.deepEqual(downloadIncrements, [FREE_ID]);
});

test("download paid model: login + purchase required, and owner is blocked with 403 OWN_MODEL regardless of JWT role", async () => {
  const anon = await get(`/models/${PAID_ID}/download`);
  assert.equal(anon.status, 401);
  assert.equal(await errCode(anon), "LOGIN_REQUIRED");

  const badToken = await get(`/models/${PAID_ID}/download`, {
    Authorization: "Bearer nope",
  });
  assert.equal(badToken.status, 401);
  await badToken.arrayBuffer();

  const stranger = await get(`/models/${PAID_ID}/download`, {
    Authorization: `Bearer ${token(STRANGER)}`,
  });
  assert.equal(stranger.status, 403);
  assert.equal(await errCode(stranger), "PURCHASE_REQUIRED");

  // Buyer downloads successfully
  const buyerRes = await get(`/models/${PAID_ID}/download`, {
    Authorization: `Bearer ${token(BUYER)}`,
  });
  assert.equal(buyerRes.status, 200);
  assert.deepEqual(Buffer.from(await buyerRes.arrayBuffer()), FULL);
  await waitTick();
  assert.equal(downloadIncrements.length, 1);

  // Owner is blocked even with a stale 'user' role in JWT
  for (const role of ["user", "creator"]) {
    const ownerRes = await get(`/models/${PAID_ID}/download`, {
      Authorization: `Bearer ${token(OWNER, role)}`,
    });
    assert.equal(ownerRes.status, 403, role);
    assert.equal(await errCode(ownerRes), "OWN_MODEL", role);
  }
});

test("download: suspended downloader is blocked", async () => {
  users[BUYER].suspended_at = new Date();
  const res = await get(`/models/${PAID_ID}/download`, {
    Authorization: `Bearer ${token(BUYER)}`,
  });
  assert.equal(res.status, 403);
  assert.equal(await errCode(res), "ACCOUNT_SUSPENDED");
});

test("download: a downloader whose account an admin deleted is refused with 401 ACCOUNT_DELETED", async () => {
  users[BUYER].deleted_at = new Date();
  const res = await get(`/models/${PAID_ID}/download`, {
    Authorization: `Bearer ${token(BUYER)}`,
  });
  assert.equal(res.status, 401);
  assert.equal(await errCode(res), "ACCOUNT_DELETED");
  assert.deepEqual(downloadIncrements, []);
});

test("upload: a token of a deleted account is refused before anything is read or stored", async () => {
  users[OWNER].deleted_at = new Date();
  const res = await fetch(`${apiBase}/models`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token(OWNER, "creator")}` },
  });
  assert.equal(res.status, 401);
  assert.equal(await errCode(res), "ACCOUNT_DELETED");
});

test("embed key of a buyer whose account was deleted keeps streaming the model they bought", async () => {
  users[BUYER].deleted_at = new Date();
  const res = await get(`/models/${PAID_ID}/file.glb?key=${KEY}`);
  assert.equal(res.status, 200);
});

test("download: resumed Range chunks do not increment the counter", async () => {
  const res = await get(`/models/${FREE_ID}/download`, { Range: "bytes=10-" });
  assert.equal(res.status, 206);
  await res.arrayBuffer();
  await waitTick();
  assert.deepEqual(downloadIncrements, []);
});

// ─── Multi-Layer GLB Watermarking (Layer 1 Metadata + Layer 2 Vertex Steganography) ──
async function createSampleGlbBuffer(vertexCount = 72): Promise<Buffer> {
  const doc = new Document();
  const buf = doc.createBuffer();
  const positions = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    positions[i * 3] = Math.fround((i - 36) * 0.1234);
    positions[i * 3 + 1] = Math.fround(Math.sin(i) * 0.5);
    positions[i * 3 + 2] = Math.fround(Math.cos(i) * 0.5);
  }
  const positionAccessor = doc
    .createAccessor()
    .setType("VEC3")
    .setArray(positions)
    .setBuffer(buf);
  const prim = doc.createPrimitive().setAttribute("POSITION", positionAccessor);
  const mesh = doc.createMesh("SampleMesh").addPrimitive(prim);
  const node = doc.createNode("SampleNode").setMesh(mesh);
  doc.createScene("SampleScene").addChild(node);

  const io = new NodeIO();
  const u8 = await io.writeBinary(doc);
  return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
}

test("watermark: embedLicenseAndWatermark + verifyGlbWatermark (including stripped asset.extras)", async () => {
  const rawGlb = await createSampleGlbBuffer(72);
  const { buffer: watermarked, signature } = await embedLicenseAndWatermark(
    rawGlb,
    {
      modelId: PAID_ID,
      ownerId: OWNER,
      license: "COMMERCIAL",
      purchaseId: "original",
    },
  );

  assert.equal(signature.length, 64);

  const verified = await verifyGlbWatermark(watermarked, PAID_ID);
  assert.equal(verified.isValidMetadata, true);
  assert.equal(verified.isValidVertexWatermark, true);
  assert.equal(verified.vertexBitMatchRatio, 1);
  assert.equal((verified.extractedMetadata as any)?.platform, "Lixyte");
  assert.equal((verified.extractedMetadata as any)?.modelId, PAID_ID);
  assert.equal((verified.extractedMetadata as any)?.purchaseId, "original");

  // Simulate Blender / 3D editor re-export that strips asset.extras and root.extras
  const io = new NodeIO();
  const doc = await io.readBinary(new Uint8Array(watermarked));
  delete doc.getRoot().getAsset().extras;
  delete doc.getRoot().getAsset().copyright;
  doc.getRoot().setExtras({});
  const strippedU8 = await io.writeBinary(doc);
  const strippedBuffer = Buffer.from(
    strippedU8.buffer,
    strippedU8.byteOffset,
    strippedU8.byteLength,
  );

  const afterStrip = await verifyGlbWatermark(strippedBuffer, PAID_ID);
  assert.equal(afterStrip.isValidMetadata, false);
  assert.equal(afterStrip.isValidVertexWatermark, true);
  assert.equal(afterStrip.vertexBitMatchRatio, 1);
});

test("download paid real GLB: embeds buyer purchaseId + license_type, updates watermark_hash, and verifies via POST /cdn/verify-watermark", async () => {
  const rawGlb = await createSampleGlbBuffer(72);
  const realGlbHash = store(rawGlb, "glb");
  models[PAID_ID].file_hash = realGlbHash;
  models[PAID_ID].license = "COMMERCIAL";

  const purchaseId = "99999999-9999-4999-8999-999999999999";
  purchases[0].id = purchaseId;
  purchases[0].license_type = "CC-BY";

  const dlRes = await get(`/models/${PAID_ID}/download`, {
    Authorization: `Bearer ${token(BUYER)}`,
  });
  assert.equal(dlRes.status, 200);
  const downloadedBuffer = Buffer.from(await dlRes.arrayBuffer());

  // Verify watermark_hash was saved to the purchases record
  assert.ok(
    purchases[0].watermark_hash,
    "watermark_hash should be saved in purchases",
  );
  assert.equal(purchases[0].watermark_hash.length, 64);

  // Verify via POST /cdn/verify-watermark
  const verifyRes = await fetch(
    `${base}/verify-watermark?expectedModelId=${PAID_ID}`,
    {
      method: "POST",
      headers: { "Content-Type": "model/gltf-binary" },
      body: downloadedBuffer,
    },
  );
  assert.equal(verifyRes.status, 200);
  const body = (await verifyRes.json()) as any;
  assert.equal(body.isValidMetadata, true);
  assert.equal(body.isValidVertexWatermark, true);
  assert.equal(body.vertexBitMatchRatio, 1);
  assert.equal(body.extractedMetadata.purchaseId, purchaseId);
  assert.equal(body.extractedMetadata.license, "CC-BY");
  assert.equal(body.extractedMetadata.signature, purchases[0].watermark_hash);
});

// ─── Storage Keys, Scoped Folder Layout & Legacy Fallback ───────────────────
test("storage keys: assertSafeKey & helpers validate scoped and legacy formats cleanly", () => {
  const validScoped = assetKey(PAID_ID, "model", FULL_HASH);
  assert.equal(validScoped, `${PAID_ID}/model.${FULL_HASH}.glb`);
  assert.equal(assetKey(PAID_ID, "preview", PREVIEW_HASH), `${PAID_ID}/preview.${PREVIEW_HASH}.glb`);
  assert.equal(assetKey(PAID_ID, "poster", POSTER_HASH), `${PAID_ID}/poster.${POSTER_HASH}.webp`);
  assert.equal(legacyKey("poster", POSTER_HASH), `${POSTER_HASH}.webp`);
  assert.deepEqual(candidateKeys(PAID_ID, "model", FULL_HASH), [
    `${PAID_ID}/model.${FULL_HASH}.glb`,
    `${FULL_HASH}.glb`,
  ]);
  assert.equal(assertSafeKey(`/${PAID_ID.toUpperCase()}/MODEL.${FULL_HASH.toUpperCase()}.GLB`), validScoped);

  const invalidKeys = [
    `../${FULL_HASH}.glb`,
    `${PAID_ID}/../${FULL_HASH}.glb`,
    `${PAID_ID}\\model.${FULL_HASH}.glb`,
    `not-a-uuid/model.${FULL_HASH}.glb`,
    `${PAID_ID}/model.short.glb`,
    `${PAID_ID}/other.${FULL_HASH}.glb`,
    `${PAID_ID}/poster.${POSTER_HASH}.glb`,
    `${PAID_ID}/model.${FULL_HASH}.webp`,
    `${PAID_ID}/hero.glb`,
  ];
  for (const bad of invalidKeys) {
    assert.throws(() => assertSafeKey(bad), /Invalid or unsafe storage key/, bad);
  }
});

test("scoped storage layout: streams from <model_id>/ folder even without flat files, and falls back to flat legacy keys", async () => {
  const scopedModel = Buffer.from("glTF-SCOPED-FULL-0123456789");
  const scopedPreview = Buffer.from("glTF-SCOPED-PREVIEW");
  const scopedPoster = Buffer.from("RIFF....WEBPscopedPoster");
  const scopedModelHash = crypto.createHash("sha256").update(scopedModel).digest("hex");
  const scopedPreviewHash = crypto.createHash("sha256").update(scopedPreview).digest("hex");
  const scopedPosterHash = crypto.createHash("sha256").update(scopedPoster).digest("hex");

  const SCOPED_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const local = new LocalDiskStorage();
  const tmpDir = fs.mkdtempSync(path.join(TEST_STORAGE_DIR, "tmp-scoped-"));

  const putScoped = async (kind: "model" | "preview" | "poster", hash: string, buf: Buffer) => {
    const tmpFile = path.join(tmpDir, `${kind}.tmp`);
    fs.writeFileSync(tmpFile, buf);
    await local.put(assetKey(SCOPED_ID, kind, hash), tmpFile);
  };

  await putScoped("model", scopedModelHash, scopedModel);
  await putScoped("preview", scopedPreviewHash, scopedPreview);
  await putScoped("poster", scopedPosterHash, scopedPoster);

  models[SCOPED_ID] = {
    id: SCOPED_ID,
    owner_id: OWNER,
    title: "Scoped Cube",
    file_hash: scopedModelHash,
    preview_hash: scopedPreviewHash,
    poster_hash: scopedPosterHash,
    price_cents: 500,
    hidden_at: null,
    deleted_at: null,
    owner_suspended_at: null,
  };
  purchases.push({ user_id: BUYER, model_id: SCOPED_ID, status: "paid", embed_key: "d".repeat(48) });

  const prevRes = await get(`/models/${SCOPED_ID}/preview.glb`);
  assert.equal(prevRes.status, 200);
  assert.deepEqual(Buffer.from(await prevRes.arrayBuffer()), scopedPreview);

  const hashRes = await get(`/models/${SCOPED_ID}/${scopedPreviewHash}.glb`);
  assert.equal(hashRes.status, 200);
  assert.deepEqual(Buffer.from(await hashRes.arrayBuffer()), scopedPreview);

  const fullRes = await get(`/models/${SCOPED_ID}/file.glb?key=${"d".repeat(48)}`);
  assert.equal(fullRes.status, 200);
  assert.deepEqual(Buffer.from(await fullRes.arrayBuffer()), scopedModel);

  const posterRes = await get(`/models/${SCOPED_ID}/poster.webp`);
  assert.equal(posterRes.status, 200);
  assert.deepEqual(Buffer.from(await posterRes.arrayBuffer()), scopedPoster);

  // Verify delete() removes scoped object cleanly (e.g., upload rollback)
  await local.delete(assetKey(SCOPED_ID, "poster", scopedPosterHash));
  const deletedPoster = await get(`/models/${SCOPED_ID}/poster.webp`);
  assert.equal(deletedPoster.status, 404);

  // Verify legacy fallback still serves unmigrated models (PAID_ID only exists flat in fixtures)
  const legacyRes = await get(`/models/${PAID_ID}/preview.glb`);
  assert.equal(legacyRes.status, 200);
  assert.deepEqual(Buffer.from(await legacyRes.arrayBuffer()), PREVIEW);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── User Logo / Avatar ─────────────────────────────────────────────────────
test("user avatar: avatarKey whitelist and GET /cdn/users/:id/avatar.webp streaming", async () => {
  const avatarBytes = Buffer.from("RIFF....WEBPuserAvatarLogo");
  const avatarHash = crypto.createHash("sha256").update(avatarBytes).digest("hex");
  const key = avatarKey(OWNER, avatarHash);
  assert.equal(key, `${OWNER}/avatar.${avatarHash}.webp`);

  assert.throws(() => assertSafeKey(`avatars/bad-uuid/avatar.${avatarHash}.webp`), /Invalid or unsafe storage key/);
  assert.throws(() => assertSafeKey(`${OWNER}/avatar.${avatarHash}.png`), /Invalid or unsafe storage key/);

  const local = new LocalDiskStorage(env.supabaseAvatarBucket);
  const tmpDir = fs.mkdtempSync(path.join(TEST_STORAGE_DIR, "tmp-avatar-"));
  const tmpFile = path.join(tmpDir, "avatar.tmp");
  fs.writeFileSync(tmpFile, avatarBytes);
  await local.put(key, tmpFile);

  // User without avatar_hash -> 404
  const noneRes = await get(`/users/${OWNER}/avatar.webp`);
  assert.equal(noneRes.status, 404);
  assert.equal(await errCode(noneRes), "AVATAR_NOT_FOUND");

  // User with avatar_hash -> 200 WebP with ETag
  users[OWNER].avatar_hash = avatarHash;
  const okRes = await get(`/users/${OWNER}/avatar.webp`);
  assert.equal(okRes.status, 200);
  assert.equal(okRes.headers.get("content-type"), "image/webp");
  assert.equal(okRes.headers.get("etag"), `"${avatarHash}"`);
  assert.deepEqual(Buffer.from(await okRes.arrayBuffer()), avatarBytes);

  // Suspended user -> 404
  users[OWNER].suspended_at = new Date();
  const suspendedRes = await get(`/users/${OWNER}/avatar.webp`);
  assert.equal(suspendedRes.status, 404);
  await suspendedRes.arrayBuffer();

  // Invalid UUID -> 404
  const badIdRes = await get("/users/not-a-uuid/avatar.webp");
  assert.equal(badIdRes.status, 404);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Anti-Reupload Watermark Guard on POST /api/models ──────────────────────
async function postModelUpload(
  uploaderId: string,
  fileBuffer: Buffer,
  opts: { previewBuffer?: Buffer; title?: string; license?: string; priceCents?: number } = {},
) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(fileBuffer)], { type: "model/gltf-binary" }),
    "model.glb",
  );
  if (opts.previewBuffer) {
    form.append(
      "preview",
      new Blob([new Uint8Array(opts.previewBuffer)], { type: "model/gltf-binary" }),
      "preview.glb",
    );
  }
  form.append("title", opts.title ?? "Reupload Attempt");
  form.append("license", opts.license ?? "CC0");
  form.append("price_cents", String(opts.priceCents ?? 0));

  return fetch(`${apiBase}/models`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token(uploaderId, "creator")}` },
    body: form,
  });
}

test("upload guard: blocks unmodified re-upload of another creator's watermarked model (409 WATERMARK_CONFLICT)", async () => {
  const rawGlb = await createSampleGlbBuffer(72);
  const { buffer: watermarked } = await embedLicenseAndWatermark(rawGlb, {
    modelId: PAID_ID,
    ownerId: OWNER,
    license: "COMMERCIAL",
    purchaseId: "original",
  });

  const beforeCount = Object.keys(models).length;
  const res = await postModelUpload(STRANGER, watermarked);
  assert.equal(res.status, 409);
  assert.equal(await errCode(res), "WATERMARK_CONFLICT");
  assert.equal(Object.keys(models).length, beforeCount);
});

test("upload guard: blocks buyer-downloaded paid model from being re-uploaded", async () => {
  const rawGlb = await createSampleGlbBuffer(72);
  const realGlbHash = store(rawGlb, "glb");
  models[PAID_ID].file_hash = realGlbHash;
  models[PAID_ID].license = "COMMERCIAL";
  purchases[0].id = "99999999-9999-4999-8999-999999999999";

  const dlRes = await get(`/models/${PAID_ID}/download`, {
    Authorization: `Bearer ${token(BUYER)}`,
  });
  assert.equal(dlRes.status, 200);
  const buyerCopy = Buffer.from(await dlRes.arrayBuffer());

  const res = await postModelUpload(BUYER, buyerCopy);
  assert.equal(res.status, 409);
  assert.equal(await errCode(res), "WATERMARK_CONFLICT");
});

test("upload guard: blocks re-upload after stripping extras or tampering asset.extras (Layer 2 DB scan)", async () => {
  const rawGlb = await createSampleGlbBuffer(72);
  const { buffer: watermarked } = await embedLicenseAndWatermark(rawGlb, {
    modelId: PAID_ID,
    ownerId: OWNER,
    license: "COMMERCIAL",
    purchaseId: "original",
  });

  const io = new NodeIO();

  // Case A: stripped asset.extras and root.extras (e.g. Blender re-export)
  const strippedDoc = await io.readBinary(new Uint8Array(watermarked));
  delete strippedDoc.getRoot().getAsset().extras;
  delete strippedDoc.getRoot().getAsset().copyright;
  strippedDoc.getRoot().setExtras({});
  const strippedU8 = await io.writeBinary(strippedDoc);
  const strippedRes = await postModelUpload(
    STRANGER,
    Buffer.from(strippedU8.buffer, strippedU8.byteOffset, strippedU8.byteLength),
  );
  assert.equal(strippedRes.status, 409);
  assert.equal(await errCode(strippedRes), "WATERMARK_CONFLICT");

  // Case B: tampered asset.extras pointing to forged modelId/signature
  const tamperedDoc = await io.readBinary(new Uint8Array(watermarked));
  tamperedDoc.getRoot().getAsset().extras = {
    platform: "Lixyte",
    modelId: STRANGER,
    ownerId: STRANGER,
    license: "CC0",
    purchaseId: "original",
    signature: "f".repeat(64),
  };
  const tamperedU8 = await io.writeBinary(tamperedDoc);
  const tamperedRes = await postModelUpload(
    STRANGER,
    Buffer.from(tamperedU8.buffer, tamperedU8.byteOffset, tamperedU8.byteLength),
  );
  assert.equal(tamperedRes.status, 409);
  assert.equal(await errCode(tamperedRes), "WATERMARK_CONFLICT");
});

test("upload guard: blocks unwatermarked legacy file or preview matching foreign file_hash/preview_hash", async () => {
  const legacyMain = await createSampleGlbBuffer(72);
  const legacyPreview = await createSampleGlbBuffer(32);
  models[PAID_ID].file_hash = crypto.createHash("sha256").update(legacyMain).digest("hex");
  models[PAID_ID].preview_hash = crypto.createHash("sha256").update(legacyPreview).digest("hex");

  const mainRes = await postModelUpload(STRANGER, legacyMain);
  assert.equal(mainRes.status, 409);
  assert.equal(await errCode(mainRes), "WATERMARK_CONFLICT");

  const freshOwnMain = await createSampleGlbBuffer(20);
  const previewRes = await postModelUpload(STRANGER, freshOwnMain, {
    previewBuffer: legacyPreview,
    priceCents: 500,
  });
  assert.equal(previewRes.status, 409);
  assert.equal(await errCode(previewRes), "WATERMARK_CONFLICT");
});

async function readStoredAsset(key: string): Promise<Buffer> {
  const local = new LocalDiskStorage();
  const { stream } = await local.getStream(key);
  const chunks: Buffer[] = [];
  for await (const c of stream) {
    chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  }
  return Buffer.concat(chunks);
}

test("upload guard: allows original owner upload and embeds watermark into preview GLB", async () => {
  const mainGlb = await createSampleGlbBuffer(72);
  const previewGlb = await createSampleGlbBuffer(68);
  const res = await postModelUpload(OWNER, mainGlb, {
    previewBuffer: previewGlb,
    title: "Owner Original Paid Asset",
    license: "COMMERCIAL",
    priceCents: 1200,
  });
  assert.equal(res.status, 201);
  const body = (await res.json()) as any;
  assert.ok(body.model?.id);
  assert.ok(body.model?.preview_hash);

  // Verify the stored preview.glb itself carries Layer 1 metadata + Layer 2 vertex watermark
  const previewKey = assetKey(body.model.id, "preview", body.model.preview_hash);
  const storedPreview = await readStoredAsset(previewKey);
  const verifiedPreview = await verifyGlbWatermark(storedPreview, body.model.id);
  assert.equal(verifiedPreview.isValidMetadata, true);
  assert.equal(verifiedPreview.isValidVertexWatermark, true);
  assert.equal(verifiedPreview.vertexBitMatchRatio, 1);
  assert.equal((verifiedPreview.extractedMetadata as any)?.purchaseId, "preview");
  assert.equal((verifiedPreview.extractedMetadata as any)?.ownerId, OWNER);
});

test("patch assets guard: enforces ownership, blocks foreign watermarked replacement, and watermarks owner replacements", async () => {
  const originalMain = await createSampleGlbBuffer(72);
  const strangerMain = await createSampleGlbBuffer(70);
  const { buffer: strangerWatermarked } = await embedLicenseAndWatermark(strangerMain, {
    modelId: FREE_ID,
    ownerId: STRANGER,
    license: "CC0",
    purchaseId: "original",
  });
  models[FREE_ID].owner_id = STRANGER;

  // 1. Non-owner attempt -> 403
  const forbiddenForm = new FormData();
  forbiddenForm.append("file", new Blob([new Uint8Array(originalMain)], { type: "model/gltf-binary" }), "new.glb");
  const forbiddenRes = await fetch(`${apiBase}/models/${PAID_ID}/assets`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token(STRANGER, "creator")}` },
    body: forbiddenForm,
  });
  assert.equal(forbiddenRes.status, 403);

  // 2. Owner attempting to slip in stranger's watermarked model -> 409 WATERMARK_CONFLICT
  const conflictForm = new FormData();
  conflictForm.append("file", new Blob([new Uint8Array(strangerWatermarked)], { type: "model/gltf-binary" }), "stolen.glb");
  const conflictRes = await fetch(`${apiBase}/models/${PAID_ID}/assets`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token(OWNER, "creator")}` },
    body: conflictForm,
  });
  assert.equal(conflictRes.status, 409);
  assert.equal(await errCode(conflictRes), "WATERMARK_CONFLICT");

  // Pre-seed old scoped assets to verify orphan cleanup deletes previous hashes upon replacement
  const local = new LocalDiskStorage();
  const seedDir = fs.mkdtempSync(path.join(TEST_STORAGE_DIR, "seed-patch-"));
  const oldMainKey = assetKey(PAID_ID, "model", models[PAID_ID].file_hash);
  const oldPreviewKey = assetKey(PAID_ID, "preview", models[PAID_ID].preview_hash);
  const seedMainTmp = path.join(seedDir, "old-main.glb");
  const seedPreviewTmp = path.join(seedDir, "old-preview.glb");
  fs.writeFileSync(seedMainTmp, FULL);
  fs.writeFileSync(seedPreviewTmp, PREVIEW);
  await local.put(oldMainKey, seedMainTmp);
  await local.put(oldPreviewKey, seedPreviewTmp);
  const oldMainDiskPath = path.join(TEST_STORAGE_DIR, ...oldMainKey.split("/"));
  const oldPreviewDiskPath = path.join(TEST_STORAGE_DIR, ...oldPreviewKey.split("/"));
  assert.equal(fs.existsSync(oldMainDiskPath), true);
  assert.equal(fs.existsSync(oldPreviewDiskPath), true);

  // 3. Owner replacing with fresh GLBs -> 200 and stored with valid watermarks under model & preview keys
  const newMain = await createSampleGlbBuffer(74);
  const newPreview = await createSampleGlbBuffer(66);
  const okForm = new FormData();
  okForm.append("file", new Blob([new Uint8Array(newMain)], { type: "model/gltf-binary" }), "main.glb");
  okForm.append("preview", new Blob([new Uint8Array(newPreview)], { type: "model/gltf-binary" }), "preview.glb");
  const okRes = await fetch(`${apiBase}/models/${PAID_ID}/assets`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token(OWNER, "creator")}` },
    body: okForm,
  });
  assert.equal(okRes.status, 200);
  const body = (await okRes.json()) as any;
  assert.ok(body.model?.fileHash);
  assert.ok(body.model?.previewHash);

  // Old scoped assets must be removed once DB update succeeds
  assert.equal(fs.existsSync(oldMainDiskPath), false);
  assert.equal(fs.existsSync(oldPreviewDiskPath), false);
  fs.rmSync(seedDir, { recursive: true, force: true });

  const storedMain = await readStoredAsset(assetKey(PAID_ID, "model", body.model.fileHash));
  const verifiedMain = await verifyGlbWatermark(storedMain, PAID_ID);
  assert.equal(verifiedMain.isValidMetadata, true);
  assert.equal(verifiedMain.isValidVertexWatermark, true);
  assert.equal((verifiedMain.extractedMetadata as any)?.purchaseId, "original");

  const storedPreview = await readStoredAsset(assetKey(PAID_ID, "preview", body.model.previewHash));
  const verifiedPreview = await verifyGlbWatermark(storedPreview, PAID_ID);
  assert.equal(verifiedPreview.isValidMetadata, true);
  assert.equal(verifiedPreview.isValidVertexWatermark, true);
  assert.equal((verifiedPreview.extractedMetadata as any)?.purchaseId, "preview");
});

// ─── Pack A Security Guards ─────────────────────────────────────────────────
test("download paid real GLB with Range: bytes=0- STILL embeds buyer watermark and returns 206", async () => {
  const rawGlb = await createSampleGlbBuffer(72);
  const realGlbHash = store(rawGlb, "glb");
  models[PAID_ID].file_hash = realGlbHash;
  models[PAID_ID].license = "COMMERCIAL";

  const purchaseId = "88888888-8888-4888-8888-888888888888";
  purchases[0].id = purchaseId;
  purchases[0].license_type = "COMMERCIAL";
  delete purchases[0].watermark_hash;

  const dlRes = await get(`/models/${PAID_ID}/download`, {
    Authorization: `Bearer ${token(BUYER)}`,
    Range: "bytes=0-",
  });
  assert.equal(dlRes.status, 206);
  const rangeBody = Buffer.from(await dlRes.arrayBuffer());
  assert.equal(
    dlRes.headers.get("content-range"),
    `bytes 0-${rangeBody.length - 1}/${rangeBody.length}`,
  );
  assert.ok(purchases[0].watermark_hash, "watermark_hash must be saved even on Range downloads");

  const verified = await verifyGlbWatermark(rangeBody, PAID_ID);
  assert.equal(verified.isValidMetadata, true);
  assert.equal(verified.isValidVertexWatermark, true);
  assert.equal((verified.extractedMetadata as any)?.purchaseId, purchaseId);
});

test("upload auth: newly approved creator with stale user JWT can upload, while admin & suspended accounts are blocked", async () => {
  const glb = await createSampleGlbBuffer(72);

  // 1. Newly approved creator in DB holding pre-approval JWT (role='user') -> 201 Created!
  users[OWNER] = { role: "creator", is_seller: true, suspended_at: null };
  const formOk = new FormData();
  formOk.append("file", new Blob([new Uint8Array(glb)], { type: "model/gltf-binary" }), "fresh.glb");
  formOk.append("title", "Fresh Approved Creator Model");
  formOk.append("license", "CC0");
  formOk.append("price_cents", "0");
  const okRes = await fetch(`${apiBase}/models`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token(OWNER, "user")}` },
    body: formOk,
  });
  assert.equal(okRes.status, 201);
  await okRes.arrayBuffer();

  // 2. Admin account in DB -> 403 ADMIN_CANNOT_SELL even if JWT says creator
  users[STRANGER] = { role: "admin", is_seller: true, suspended_at: null };
  const formAdmin = new FormData();
  formAdmin.append("file", new Blob([new Uint8Array(glb)], { type: "model/gltf-binary" }), "a.glb");
  formAdmin.append("title", "Admin Attempt");
  const adminRes = await fetch(`${apiBase}/models`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token(STRANGER, "creator")}` },
    body: formAdmin,
  });
  assert.equal(adminRes.status, 403);
  assert.equal(await errCode(adminRes), "ADMIN_CANNOT_SELL");

  // 3. Suspended creator in DB -> 403 ACCOUNT_SUSPENDED
  users[OWNER] = { role: "creator", is_seller: true, suspended_at: new Date() };
  const formSusp = new FormData();
  formSusp.append("file", new Blob([new Uint8Array(glb)], { type: "model/gltf-binary" }), "s.glb");
  formSusp.append("title", "Suspended Attempt");
  const suspRes = await fetch(`${apiBase}/models`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token(OWNER, "creator")}` },
    body: formSusp,
  });
  assert.equal(suspRes.status, 403);
  assert.equal(await errCode(suspRes), "ACCOUNT_SUSPENDED");
});

test("security: assertProductionSecrets rejects default JWT_SECRET and WATERMARK_SECRET in production", () => {
  assert.throws(() => assertProductionSecrets("production", "dev-secret", "strong-watermark-secret-123456"), /JWT_SECRET/);
  assert.throws(
    () => assertProductionSecrets("production", "strong-jwt-secret-123456", "lixyte-broken-design-watermark-secret-2026"),
    /WATERMARK_SECRET/,
  );
  assert.doesNotThrow(() =>
    assertProductionSecrets("production", "strong-jwt-secret-123456", "strong-watermark-secret-123456"),
  );
  assert.doesNotThrow(() => assertProductionSecrets("development", "dev-secret", ""));
});

test("upload validation: rejects overflowing price_cents and overly long description with 400 BAD_REQUEST", async () => {
  const glb = await createSampleGlbBuffer(72);
  users[OWNER] = { role: "creator", is_seller: true, suspended_at: null };

  // 1. Overflowing price_cents -> 400 BAD_REQUEST
  const formBigPrice = new FormData();
  formBigPrice.append("file", new Blob([new Uint8Array(glb)], { type: "model/gltf-binary" }), "big.glb");
  formBigPrice.append("title", "Too Expensive");
  formBigPrice.append("price_cents", "999999999999");
  const priceRes = await fetch(`${apiBase}/models`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token(OWNER, "creator")}` },
    body: formBigPrice,
  });
  assert.equal(priceRes.status, 400);
  assert.equal(await errCode(priceRes), "BAD_REQUEST");

  // 2. Description > 5000 chars -> 400 BAD_REQUEST
  const formLongDesc = new FormData();
  formLongDesc.append("file", new Blob([new Uint8Array(glb)], { type: "model/gltf-binary" }), "desc.glb");
  formLongDesc.append("title", "Long Description");
  formLongDesc.append("description", "a".repeat(5001));
  const descRes = await fetch(`${apiBase}/models`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token(OWNER, "creator")}` },
    body: formLongDesc,
  });
  assert.equal(descRes.status, 400);
  assert.equal(await errCode(descRes), "BAD_REQUEST");
});
