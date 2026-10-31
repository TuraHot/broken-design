/**
 * ตรวจ Magic Bytes ของไฟล์ .glb:
 * - Bytes 0..3: 'glTF' (0x46546C67 little-endian)
 * - Bytes 4..7: version === 2
 * - Bytes 8..11: total byte length === actualSize
 */
export function validateGlbHeader(headerBuffer: Buffer, actualSize: number): boolean {
  if (headerBuffer.length < 12) return false;
  const magic = headerBuffer.readUInt32LE(0);
  const version = headerBuffer.readUInt32LE(4);
  const declaredLength = headerBuffer.readUInt32LE(8);
  return magic === 0x46546c67 && version === 2 && declaredLength === actualSize;
}

