// Shared client-side helpers for embed code snippets and authenticated/public .glb downloads.
const CDN_SERVICE_URL = process.env.NEXT_PUBLIC_CDN_SERVICE_URL || 'http://localhost:4001';

export const DEFAULT_EMBED_ORIGIN = 'http://localhost:3000';

export function buildVmModelSnippet(opts: {
  origin: string;
  modelId: string;
  cdnBase?: string;
  embedKey?: string;
  multiline?: boolean;
}): string {
  const origin = opts.origin || DEFAULT_EMBED_ORIGIN;
  const cdnBase = opts.cdnBase ?? CDN_SERVICE_URL;
  const key = opts.embedKey?.trim();
  if (opts.multiline) {
    const keyLine = key ? `\n  key="${key}"` : '';
    return `<script type="module" src="${origin}/embed.js"></script>\n<vm-model\n  model-id="${opts.modelId}"\n  cdn-base="${cdnBase}"${keyLine}\n  auto-rotate\n  camera-controls\n></vm-model>`;
  }
  const keyAttr = key ? ` key="${key}"` : '';
  return `<script type="module" src="${origin}/embed.js"></script>\n<vm-model model-id="${opts.modelId}" cdn-base="${cdnBase}"${keyAttr} auto-rotate camera-controls></vm-model>`;
}

export function buildIframeSnippet(opts: {
  origin: string;
  modelId: string;
  embedKey?: string;
}): string {
  const origin = opts.origin || DEFAULT_EMBED_ORIGIN;
  const key = opts.embedKey?.trim();
  const query = key ? `?key=${key}` : '';
  return `<iframe\n  src="${origin}/embed/${opts.modelId}${query}"\n  width="600"\n  height="400"\n  loading="lazy"\n  allow="fullscreen"\n  style="border:0"\n></iframe>`;
}

export function safeGlbFilename(title: string): string {
  const safeName = title.replace(/[^\w\u0E00-\u0E7F-]+/g, '_').replace(/^_+|_+$/g, '') || 'model';
  return `${safeName}.glb`;
}

export class DownloadError extends Error {
  status: number;
  serverMessage?: string;

  constructor(status: number, serverMessage?: string) {
    super(serverMessage || `Download failed (${status})`);
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

export async function downloadModelGlb(modelId: string, title: string, token?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${CDN_SERVICE_URL}/cdn/models/${encodeURIComponent(modelId)}/download`, {
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new DownloadError(res.status, typeof body?.error?.message === 'string' ? body.error.message : undefined);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeGlbFilename(title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revoke slightly so Safari/Firefox finish initiating the blob download before the URL is freed.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
