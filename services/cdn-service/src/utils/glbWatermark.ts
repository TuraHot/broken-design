import crypto from "crypto";
import { NodeIO, Logger } from "@gltf-transform/core";
import { env } from "../config/env";
import { db } from "../config/db";
import { supabase } from "../config/supabase";
import { validateGlbHeader } from "./glbValidator";
import { AppError } from "../middlewares/error.middleware";

export interface WatermarkPayload {
  modelId: string;
  ownerId: string;
  license: string;
  purchaseId?: string;
}

export interface WatermarkMetadata {
  platform: "Lixyte";
  modelId: string;
  ownerId: string;
  license: string;
  purchaseId: string;
  signature: string;
  issuedAt: string;
}

export interface VerifyWatermarkResult {
  isValidMetadata: boolean;
  isValidVertexWatermark: boolean;
  extractedMetadata: WatermarkMetadata | Record<string, any> | null;
  vertexBitMatchRatio: number;
}

export interface ForeignAssetMatch {
  matchedBy: "file_hash" | "metadata" | "vertex_watermark";
  originalModelId: string;
  originalOwnerId: string;
  originalTitle?: string;
  purchaseId?: string;
  vertexBitMatchRatio?: number;
}

const VERTEX_WATERMARK_BITS = 64;
const VERTEX_MATCH_THRESHOLD = 0.85;
const MIN_DB_SCAN_VERTEX_BITS = 24;
const SMALL_MESH_VERTEX_MATCH_THRESHOLD = 0.95;

function createSilentIO(): NodeIO {
  const io = new NodeIO();
  io.setLogger(new Logger(Logger.Verbosity.SILENT));
  return io;
}

/**
 * สร้าง 64-bit prefix (16 hex chars) ที่ผูกกับ modelId และ WATERMARK_SECRET
 * เพื่อให้สามารถตรวจสอบ Vertex Steganography ได้แม้ว่า asset.extras จะถูกลบออกจากการ Export ใหม่
 */
export function computeModelVertexPrefixHex(
  modelId: string,
  secret: string = env.watermarkSecret,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`broken-design:vertex:${modelId.trim()}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * สร้าง HMAC-SHA256 Signature (64 hex chars = 256 bits) จาก payload ด้วย WATERMARK_SECRET
 * - 16 ตัวอักษรแรก (64 บิตแรก): ผูกกับ modelId สำหรับฝังและตรวจสอบในพิกัด Vertex 64 จุดแรก
 * - 48 ตัวอักษรหลัง (192 บิต): ผูกกับข้อมูลชุดเต็ม (modelId, ownerId, license, purchaseId)
 */
export function computeWatermarkSignature(
  payload: WatermarkPayload,
  secret: string = env.watermarkSecret,
): string {
  const purchaseId = (payload.purchaseId || "original").trim();
  const vertexPrefixHex = computeModelVertexPrefixHex(payload.modelId, secret);
  const canonicalPayload = JSON.stringify({
    platform: "Lixyte",
    modelId: payload.modelId.trim(),
    ownerId: payload.ownerId.trim(),
    license: payload.license.trim(),
    purchaseId,
  });

  const payloadMacHex = crypto
    .createHmac("sha256", secret)
    .update(canonicalPayload)
    .digest("hex")
    .slice(0, 48);

  return `${vertexPrefixHex}${payloadMacHex}`;
}

/**
 * แปลงค่า hex ของ signature (อย่างน้อย 16 ตัวอักษรแรก = 8 ไบต์) เป็นอาเรย์บิต 64 บิต (0 หรือ 1)
 */
function signatureHexTo64Bits(signatureHex: string): number[] {
  const cleanHex = signatureHex.trim().slice(0, 16).padEnd(16, "0");
  const buf = Buffer.from(cleanHex, "hex");
  const bits: number[] = [];
  for (let byteIdx = 0; byteIdx < 8; byteIdx++) {
    const byte = buf[byteIdx] ?? 0;
    for (let bitOffset = 7; bitOffset >= 0; bitOffset--) {
      bits.push((byte >> bitOffset) & 1);
    }
  }
  return bits;
}

/**
 * ปรับค่าพิกัดแกน X ให้ทศนิยมหลักที่ 4 (Math.round(x * 10000)) เป็นเลขคู่ (0) หรือคี่ (1)
 * โดยรองรับ Float32 round-trip ของ glTF POSITION accessor
 */
function encodeBitInCoordinateX(x: number, targetBit: number): number {
  const baseScaled = Math.round(x * 10000);
  const desiredBit = targetBit & 1;

  for (let step = 0; step <= 16; step++) {
    const offsets = step === 0 ? [0] : [step, -step];
    for (const delta of offsets) {
      const candidateScaled = baseScaled + delta;
      if ((Math.abs(candidateScaled) & 1) !== desiredBit) continue;
      const candidateFloat32 = Math.fround(candidateScaled / 10000);
      const roundTripScaled = Math.round(candidateFloat32 * 10000);
      if ((Math.abs(roundTripScaled) & 1) === desiredBit) {
        return candidateFloat32;
      }
    }
  }

  return Math.fround(baseScaled / 10000);
}

function extractBitFromCoordinateX(x: number): number {
  const scaled = Math.round(x * 10000);
  return Math.abs(scaled) & 1;
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a.trim(), "utf8");
  const bufB = Buffer.from(b.trim(), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * ฝัง License Metadata (Layer 1) และ Vertex Steganography (Layer 2) ลงในไฟล์ .glb
 */
export async function embedLicenseAndWatermark(
  glbBuffer: Buffer,
  payload: WatermarkPayload,
): Promise<{ buffer: Buffer; signature: string }> {
  if (
    !Buffer.isBuffer(glbBuffer) ||
    !validateGlbHeader(glbBuffer, glbBuffer.length)
  ) {
    throw new AppError(
      400,
      "INVALID_GLB",
      "Provided buffer is not a valid Binary glTF (GLB v2)",
    );
  }

  const purchaseId = (payload.purchaseId || "original").trim();
  const normalizedPayload: WatermarkPayload = {
    modelId: payload.modelId.trim(),
    ownerId: payload.ownerId.trim(),
    license: payload.license.trim(),
    purchaseId,
  };

  const signature = computeWatermarkSignature(normalizedPayload);
  const issuedAt = new Date().toISOString();

  const io = createSilentIO();
  const document = await io.readBinary(new Uint8Array(glbBuffer));
  const root = document.getRoot();

  // ─── Layer 1: Metadata Signature (asset.extras & asset.copyright) ──────────
  const watermarkMetadata: WatermarkMetadata = {
    platform: "Lixyte",
    modelId: normalizedPayload.modelId,
    ownerId: normalizedPayload.ownerId,
    license: normalizedPayload.license,
    purchaseId,
    signature,
    issuedAt,
  };

  const asset = root.getAsset();
  asset.copyright = `© Lixyte | Model ${normalizedPayload.modelId} | Owner ${normalizedPayload.ownerId} | License: ${normalizedPayload.license}`;
  const existingAssetExtras =
    asset.extras && typeof asset.extras === "object"
      ? (asset.extras as Record<string, unknown>)
      : {};
  asset.extras = {
    ...existingAssetExtras,
    ...watermarkMetadata,
  };

  // Also mirror into root extras for tools that inspect top-level glTF extras
  const existingRootExtras = root.getExtras();
  root.setExtras({
    ...existingRootExtras,
    ...watermarkMetadata,
  });

  // ─── Layer 2: Vertex Steganography (first mesh POSITION accessor, 64 pts) ──
  const meshes = root.listMeshes();
  if (meshes.length > 0) {
    const firstMesh = meshes[0];
    const primitives = firstMesh.listPrimitives();
    for (const primitive of primitives) {
      const positionAccessor = primitive.getAttribute("POSITION");
      if (positionAccessor && positionAccessor.getCount() > 0) {
        const bits = signatureHexTo64Bits(signature);
        const count = Math.min(
          VERTEX_WATERMARK_BITS,
          positionAccessor.getCount(),
        );
        const vertex: [number, number, number] = [0, 0, 0];

        for (let i = 0; i < count; i++) {
          positionAccessor.getElement(i, vertex);
          vertex[0] = encodeBitInCoordinateX(vertex[0], bits[i]);
          positionAccessor.setElement(i, vertex);
        }
        break;
      }
    }
  }

  const outputUint8 = await io.writeBinary(document);
  const outputBuffer = Buffer.from(
    outputUint8.buffer,
    outputUint8.byteOffset,
    outputUint8.byteLength,
  );

  return {
    buffer: outputBuffer,
    signature,
  };
}

interface CandidateModelRow {
  id: string;
  owner_id: string;
  title?: string | null;
}

async function findModelOwnership(
  modelId: string,
): Promise<CandidateModelRow | null> {
  try {
    const res = await db.query(
      `SELECT id, owner_id, title FROM models WHERE id = $1 LIMIT 1`,
      [modelId],
    );
    if (res.rows[0]) {
      return res.rows[0] as CandidateModelRow;
    }
  } catch {
    if (supabase) {
      try {
        const { data } = await supabase
          .from("models")
          .select("id, owner_id, title")
          .eq("id", modelId)
          .maybeSingle();
        if (data) return data as CandidateModelRow;
      } catch {
        // Ignore DB lookup errors cleanly
      }
    }
  }
  return null;
}

async function listCandidateModelsForWatermarkScan(): Promise<
  CandidateModelRow[]
> {
  try {
    const res = await db.query(
      `SELECT id, owner_id, title FROM models ORDER BY created_at DESC LIMIT 2000`,
    );
    return res.rows.map((r: any) => ({
      id: String(r.id),
      owner_id: String(r.owner_id),
      title: r.title ? String(r.title) : null,
    }));
  } catch {
    if (supabase) {
      try {
        const { data } = await supabase
          .from("models")
          .select("id, owner_id, title")
          .order("created_at", { ascending: false })
          .limit(2000);
        if (data) {
          return data.map((r: any) => ({
            id: String(r.id),
            owner_id: String(r.owner_id),
            title: r.title ? String(r.title) : null,
          }));
        }
      } catch {
        // Ignore DB lookup errors during offline verification
      }
    }
  }
  return [];
}

/**
 * ค้นหา modelId จากฐานข้อมูลเมื่อไฟล์ถูกตัดหรือปลอม asset.extras และไม่ได้ระบุ expectedModelId
 */
async function findMatchingModelByVertexBits(
  extractedBits: number[],
  preferForeignOwnerId?: string,
): Promise<{
  modelId: string;
  ownerId: string;
  title?: string;
  matchRatio: number;
} | null> {
  if (extractedBits.length < MIN_DB_SCAN_VERTEX_BITS) return null;

  const threshold =
    extractedBits.length >= 48
      ? VERTEX_MATCH_THRESHOLD
      : SMALL_MESH_VERTEX_MATCH_THRESHOLD;

  const candidates = await listCandidateModelsForWatermarkScan();
  let bestAnyMatch: {
    modelId: string;
    ownerId: string;
    title?: string;
    matchRatio: number;
  } | null = null;
  let bestForeignMatch: {
    modelId: string;
    ownerId: string;
    title?: string;
    matchRatio: number;
  } | null = null;

  for (const candidate of candidates) {
    const expectedBits = signatureHexTo64Bits(
      computeModelVertexPrefixHex(candidate.id),
    );
    let matched = 0;
    for (let i = 0; i < extractedBits.length; i++) {
      if (extractedBits[i] === expectedBits[i]) matched++;
    }
    const ratio = matched / extractedBits.length;
    if (ratio < threshold) continue;

    const matchObj = {
      modelId: candidate.id,
      ownerId: candidate.owner_id,
      title: candidate.title || undefined,
      matchRatio: ratio,
    };

    if (!bestAnyMatch || ratio > bestAnyMatch.matchRatio) {
      bestAnyMatch = matchObj;
    }
    if (
      preferForeignOwnerId &&
      candidate.owner_id !== preferForeignOwnerId &&
      (!bestForeignMatch || ratio > bestForeignMatch.matchRatio)
    ) {
      bestForeignMatch = matchObj;
    }
  }

  return preferForeignOwnerId ? (bestForeignMatch ?? bestAnyMatch) : bestAnyMatch;
}

/**
 * ตรวจสอบลายน้ำทั้งจาก Metadata (asset.extras) และพิกัดจุดยอด 3 มิติ (Vertex Steganography)
 */
export async function verifyGlbWatermark(
  glbBuffer: Buffer,
  expectedModelId?: string,
  opts?: { preferForeignOwnerId?: string },
): Promise<VerifyWatermarkResult> {
  if (
    !Buffer.isBuffer(glbBuffer) ||
    !validateGlbHeader(glbBuffer, glbBuffer.length)
  ) {
    throw new AppError(
      400,
      "INVALID_GLB",
      "Provided file is not a valid Binary glTF (GLB v2)",
    );
  }

  const io = createSilentIO();
  const document = await io.readBinary(new Uint8Array(glbBuffer));
  const root = document.getRoot();

  // ─── 1. Extract & Verify Layer 1 (asset.extras) ────────────────────────────
  const asset = root.getAsset();
  const rawAssetExtras =
    asset.extras &&
    typeof asset.extras === "object" &&
    Object.keys(asset.extras).length > 0
      ? (asset.extras as Record<string, any>)
      : null;
  const rawRootExtras =
    root.getExtras() && Object.keys(root.getExtras()).length > 0
      ? (root.getExtras() as Record<string, any>)
      : null;

  const candidateExtras = rawAssetExtras?.signature
    ? rawAssetExtras
    : rawRootExtras?.signature
      ? rawRootExtras
      : rawAssetExtras || rawRootExtras;

  let isValidMetadata = false;
  let extractedMetadata: Record<string, any> | null = candidateExtras
    ? { ...candidateExtras }
    : null;

  if (
    candidateExtras &&
    typeof candidateExtras.modelId === "string" &&
    typeof candidateExtras.ownerId === "string" &&
    typeof candidateExtras.license === "string" &&
    typeof candidateExtras.signature === "string"
  ) {
    const expectedSig = computeWatermarkSignature({
      modelId: candidateExtras.modelId,
      ownerId: candidateExtras.ownerId,
      license: candidateExtras.license,
      purchaseId:
        typeof candidateExtras.purchaseId === "string"
          ? candidateExtras.purchaseId
          : "original",
    });

    const sigMatches = timingSafeHexEqual(
      candidateExtras.signature,
      expectedSig,
    );
    const modelMatches =
      !expectedModelId ||
      candidateExtras.modelId.trim() === expectedModelId.trim();
    isValidMetadata = sigMatches && modelMatches;
  }

  // ─── 2. Extract & Verify Layer 2 (Vertex Steganography) ────────────────────
  const extractedBits: number[] = [];
  const meshes = root.listMeshes();
  if (meshes.length > 0) {
    const primitives = meshes[0].listPrimitives();
    for (const primitive of primitives) {
      const positionAccessor = primitive.getAttribute("POSITION");
      if (positionAccessor && positionAccessor.getCount() > 0) {
        const count = Math.min(
          VERTEX_WATERMARK_BITS,
          positionAccessor.getCount(),
        );
        const vertex: [number, number, number] = [0, 0, 0];
        for (let i = 0; i < count; i++) {
          positionAccessor.getElement(i, vertex);
          extractedBits.push(extractBitFromCoordinateX(vertex[0]));
        }
        break;
      }
    }
  }

  let vertexBitMatchRatio = 0;
  let isValidVertexWatermark = false;

  if (extractedBits.length > 0) {
    // Only trust an explicit expectedModelId or cryptographically valid metadata;
    // stripped or tampered metadata always falls back to a DB vertex scan.
    let referenceHex: string | null = null;

    if (expectedModelId && expectedModelId.trim() !== "") {
      referenceHex = computeModelVertexPrefixHex(expectedModelId.trim());
    } else if (
      isValidMetadata &&
      typeof candidateExtras?.signature === "string"
    ) {
      referenceHex = candidateExtras.signature;
    }

    if (referenceHex) {
      const expectedBits = signatureHexTo64Bits(referenceHex);
      let matched = 0;
      for (let i = 0; i < extractedBits.length; i++) {
        if (extractedBits[i] === expectedBits[i]) {
          matched++;
        }
      }
      vertexBitMatchRatio = Number((matched / extractedBits.length).toFixed(4));
      isValidVertexWatermark = vertexBitMatchRatio >= VERTEX_MATCH_THRESHOLD;
    } else {
      const dbMatch = await findMatchingModelByVertexBits(
        extractedBits,
        opts?.preferForeignOwnerId,
      );
      if (dbMatch) {
        vertexBitMatchRatio = Number(dbMatch.matchRatio.toFixed(4));
        isValidVertexWatermark = true;
        extractedMetadata = {
          ...(extractedMetadata || {}),
          recoveredModelId: dbMatch.modelId,
          recoveredOwnerId: dbMatch.ownerId,
          ...(dbMatch.title ? { recoveredTitle: dbMatch.title } : {}),
        };
      }
    }
  }

  return {
    isValidMetadata,
    isValidVertexWatermark,
    extractedMetadata,
    vertexBitMatchRatio,
  };
}

/**
 * ตรวจจับว่าไฟล์ .glb ที่กำลังอัปโหลดเป็นโมเดลหรือพรีวิวที่มีอยู่แล้วของผู้สร้างคนอื่นบนแพลตฟอร์มหรือไม่
 * ตรวจครบ 3 ชั้น: 1) SHA-256 hash ตรงกับโมเดล/พรีวิวเดิม 2) Metadata Watermark 3) Vertex Steganography
 */
export async function detectForeignPlatformAsset(
  glbBuffer: Buffer,
  uploaderId: string,
): Promise<ForeignAssetMatch | null> {
  // Check 1: Exact SHA-256 hash match (catches unwatermarked legacy files or unwatermarked previews)
  const rawHash = crypto.createHash("sha256").update(glbBuffer).digest("hex");
  let hashMatch: CandidateModelRow | null = null;
  try {
    const res = await db.query(
      `SELECT id, owner_id, title
       FROM models
       WHERE (file_hash = $1 OR preview_hash = $1) AND owner_id <> $2
       LIMIT 1`,
      [rawHash, uploaderId],
    );
    hashMatch = (res.rows[0] as CandidateModelRow | undefined) ?? null;
  } catch {
    if (supabase) {
      try {
        const { data } = await supabase
          .from("models")
          .select("id, owner_id, title")
          .or(`file_hash.eq.${rawHash},preview_hash.eq.${rawHash}`)
          .neq("owner_id", uploaderId)
          .limit(1);
        hashMatch = (data?.[0] as CandidateModelRow | undefined) ?? null;
      } catch {
        // Ignore DB lookup errors cleanly
      }
    }
  }

  if (hashMatch) {
    return {
      matchedBy: "file_hash",
      originalModelId: String(hashMatch.id),
      originalOwnerId: String(hashMatch.owner_id),
      originalTitle: hashMatch.title ? String(hashMatch.title) : undefined,
    };
  }

  // Check 2: Layer 1 metadata watermark & Layer 2 vertex steganography
  const verification = await verifyGlbWatermark(glbBuffer, undefined, {
    preferForeignOwnerId: uploaderId,
  });

  if (verification.isValidMetadata && verification.extractedMetadata) {
    const metaModelId = String(
      verification.extractedMetadata.modelId || "",
    ).trim();
    const metaOwnerId = String(
      verification.extractedMetadata.ownerId || "",
    ).trim();
    const dbRow = metaModelId ? await findModelOwnership(metaModelId) : null;
    const effectiveOwnerId = dbRow?.owner_id
      ? String(dbRow.owner_id)
      : metaOwnerId;

    if (effectiveOwnerId && effectiveOwnerId !== uploaderId) {
      return {
        matchedBy: "metadata",
        originalModelId: metaModelId,
        originalOwnerId: effectiveOwnerId,
        originalTitle: dbRow?.title ? String(dbRow.title) : undefined,
        purchaseId:
          typeof verification.extractedMetadata.purchaseId === "string"
            ? verification.extractedMetadata.purchaseId
            : undefined,
        vertexBitMatchRatio: verification.vertexBitMatchRatio,
      };
    }
    return null;
  }

  const recoveredMeta = verification.extractedMetadata as Record<
    string,
    any
  > | null;

  if (verification.isValidVertexWatermark && recoveredMeta?.recoveredModelId) {
    const recoveredModelId = String(recoveredMeta.recoveredModelId).trim();
    const recoveredOwnerId = String(
      recoveredMeta.recoveredOwnerId || "",
    ).trim();
    if (recoveredOwnerId && recoveredOwnerId !== uploaderId) {
      return {
        matchedBy: "vertex_watermark",
        originalModelId: recoveredModelId,
        originalOwnerId: recoveredOwnerId,
        originalTitle:
          typeof recoveredMeta.recoveredTitle === "string"
            ? recoveredMeta.recoveredTitle
            : undefined,
        vertexBitMatchRatio: verification.vertexBitMatchRatio,
      };
    }
  }

  return null;
}
