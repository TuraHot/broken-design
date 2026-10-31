import { Readable } from 'stream';

export interface ByteRange {
  start: number;
  end: number;
}

export interface StorageAdapter {
  put(hashKey: string, tempFilePath: string): Promise<void>;
  getStream(hashKey: string, range?: ByteRange): Promise<{ stream: Readable; size: number }>;
  delete(hashKey: string): Promise<void>;
}

