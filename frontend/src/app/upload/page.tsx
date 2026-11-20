'use client';

import React, { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import {
  Upload,
  Box,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Sparkles,
  Camera,
  Layers,
  DollarSign,
  Tag,
  ArrowRight,
  RefreshCw,
  Check,
  ChevronDown,
  Plus,
  Store,
  X,
} from 'lucide-react';
import { CDN_SERVICE_URL, CORE_API_URL } from '@/lib/api';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';
import { msgText as renderMsg, type Msg } from '@/lib/i18n/msg';
import { tagLabel } from '@/lib/i18n/tag';
import { readSession, readToken, SESSION_UPDATED_EVENT, type Session } from '@/lib/session';
import { GALLERY_TAGS } from '@/lib/types';
import CropPosterModal from '@/components/upload/CropPosterModal';

// Supported licenses
const LICENSES = [
  { value: 'CC0', label: 'upload.lic.cc0', desc: 'upload.lic.cc0d' },
  { value: 'CC-BY', label: 'upload.lic.ccby', desc: 'upload.lic.ccbyd' },
  { value: 'CC-BY-NC', label: 'upload.lic.ccbync', desc: 'upload.lic.ccbyncd' },
  { value: 'COMMERCIAL', label: 'upload.lic.com', desc: 'upload.lic.comd' },
] as const satisfies readonly { value: string; label: MessageKey; desc: MessageKey }[];

const MAX_MODEL_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_PREVIEW_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_POSTER_SIZE = 1 * 1024 * 1024; // 1 MB

export default function UploadPage() {
  const t = useT();
  const msgText = (m: Msg) => renderMsg(m, t);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const syncSession = () => {
      setSession(readSession());
      setAuthReady(true);
    };
    syncSession();
    window.addEventListener('storage', syncSession);
    window.addEventListener(SESSION_UPDATED_EVENT, syncSession);
    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener(SESSION_UPDATED_EVENT, syncSession);
    };
  }, []);

  const canUpload = Boolean(
    session?.user &&
      session.user.role !== 'admin' &&
      (session.user.is_seller || session.user.role === 'creator'),
  );
  // Model-viewer dynamic import for client-side WebGL
  const [modelViewerLoaded, setModelViewerLoaded] = useState(false);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    import('@google/model-viewer')
      .then(() => setModelViewerLoaded(true))
      .catch((err) => console.error('Failed to load @google/model-viewer:', err));
  }, []);

  // Form states
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([...GALLERY_TAGS]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [license, setLicense] = useState<string>('CC0');
  const [isPaid, setIsPaid] = useState(false);
  const [priceUsd, setPriceUsd] = useState('5.00');

  // UI & Submission states
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<Msg | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState<Msg | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<{ id: string; file_hash: string } | null>(null);
  const [capturingPoster, setCapturingPoster] = useState(false);
  const [cropSnapshotUrl, setCropSnapshotUrl] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // Clean up object URLs on change
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl);
      if (cropSnapshotUrl) URL.revokeObjectURL(cropSnapshotUrl);
    };
  }, [fileUrl, posterPreviewUrl, cropSnapshotUrl]);

  // Load available tags dynamically from Core API + default tags
  useEffect(() => {
    async function loadTags() {
      try {
        const res = await fetch(`${CORE_API_URL}/api/models/tags`);
        if (res.ok) {
          const data = (await res.json()) as { tags?: string[] };
          if (Array.isArray(data.tags)) {
            setAvailableTags((prev) => {
              const set = new Set([
                ...prev,
                ...data.tags!.map((t: string) => t.trim().toLowerCase()).filter(Boolean),
              ]);
              return Array.from(set);
            });
          }
        }
      } catch {
        // Core API offline / error fallback
      }
    }
    loadTags();
  }, []);

  // Close tag dropdown on outside click or Escape
  useEffect(() => {
    if (!isTagDropdownOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!tagDropdownRef.current?.contains(e.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsTagDropdownOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isTagDropdownOpen]);

  // Client-side GLB magic bytes validator
  const validateGlbHeaderClient = async (f: File): Promise<boolean> => {
    if (f.size < 12) return false;
    const slice = f.slice(0, 12);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    const version = view.getUint32(4, true);
    // 'glTF' in hex little-endian is 0x46546c67
    return magic === 0x46546c67 && version === 2;
  };

  const handleModelSelect = async (selected: File) => {
    setValidationError(null);
    setSubmitError(null);

    if (!selected.name.toLowerCase().endsWith('.glb')) {
      setValidationError({ key: 'upload.errGlb' });
      return;
    }

    if (selected.size > MAX_MODEL_SIZE) {
      setValidationError({ key: 'upload.errModelBig', vars: { size: (selected.size / (1024 * 1024)).toFixed(1) } });
      return;
    }

    const isValidGlb = await validateGlbHeaderClient(selected);
    if (!isValidGlb) {
      setValidationError({ key: 'upload.errGlbHeader' });
      return;
    }

    setFile(selected);
    const objectUrl = URL.createObjectURL(selected);
    setFileUrl(objectUrl);

    // Auto-fill title from filename if empty
    if (!title) {
      const cleanName = selected.name.replace(/\.glb$/i, '').replace(/[-_]/g, ' ');
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleModelSelect(e.dataTransfer.files[0]);
    }
  };

  // Toggle tag selection from dropdown
  const toggleTag = (tagOption: string) => {
    const norm = tagOption.trim().toLowerCase();
    if (!norm) return;
    if (tags.includes(norm)) {
      setTags(tags.filter((t) => t !== norm));
    } else {
      setTags([...tags, norm]);
    }
  };

  // Add tag (from custom input or key press)
  const handleAddNewTag = (customVal?: string) => {
    const val = (customVal ?? tagsInput).trim().toLowerCase();
    if (!val) return;
    if (!tags.includes(val)) {
      setTags([...tags, val]);
    }
    if (!availableTags.includes(val)) {
      setAvailableTags((prev) => [...prev, val]);
    }
    setTagsInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((x) => x !== tagToRemove));
  };

  // Capture poster snapshot automatically via <model-viewer>.toBlob() and open crop modal
  const handleCapturePoster = async () => {
    if (!viewerRef.current || typeof viewerRef.current.toBlob !== 'function') {
      setValidationError({ key: 'upload.errViewer' });
      return;
    }

    try {
      setCapturingPoster(true);
      const blob: Blob | null = await viewerRef.current.toBlob({
        mimeType: 'image/png',
        idealAspect: true,
      });
      if (!blob) throw new Error(t('upload.errCapture'));

      if (cropSnapshotUrl) URL.revokeObjectURL(cropSnapshotUrl);
      const tempUrl = URL.createObjectURL(blob);
      setCropSnapshotUrl(tempUrl);
      setIsCropModalOpen(true);
    } catch (err: any) {
      setValidationError({ key: 'upload.errCaptureFailed', vars: { reason: err.message } });
    } finally {
      setCapturingPoster(false);
    }
  };

  const handleApplyCroppedPoster = (croppedBlob: Blob) => {
    const posterBlobFile = new File([croppedBlob], `${title || 'model'}-poster.webp`, { type: 'image/webp' });
    setPosterFile(posterBlobFile);
    if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl);
    setPosterPreviewUrl(URL.createObjectURL(posterBlobFile));
    if (cropSnapshotUrl) {
      URL.revokeObjectURL(cropSnapshotUrl);
      setCropSnapshotUrl(null);
    }
    setIsCropModalOpen(false);
  };

  const handleCloseCropModal = () => {
    if (cropSnapshotUrl) {
      URL.revokeObjectURL(cropSnapshotUrl);
      setCropSnapshotUrl(null);
    }
    setIsCropModalOpen(false);
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;
    if (!file) {
      setValidationError({ key: 'upload.errNoFile' });
      return;
    }
    if (!title.trim()) {
      setValidationError({ key: 'upload.errNoTitle' });
      return;
    }

    const token = typeof window !== 'undefined' ? readToken() : null;
    if (!token) {
      setSubmitError({ key: 'upload.needLoginErr' });
      return;
    }
    if (!canUpload) {
      setSubmitError({ key: 'upload.needSellerErr' });
      return;
    }

    try {
      submittingRef.current = true;
      setIsSubmitting(true);
      setSubmitError(null);

      const formData = new FormData();
      formData.append('file', file);
      if (previewFile) formData.append('preview', previewFile);
      if (posterFile) formData.append('poster', posterFile);

      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('tags', JSON.stringify(tags));
      formData.append('license', license);

      const priceCents = isPaid ? Math.round(parseFloat(priceUsd || '0') * 100) : 0;
      formData.append('price_cents', String(priceCents));
      formData.append('currency', 'USD');

      const res = await fetch(`${CDN_SERVICE_URL}/api/models`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || t('upload.errUpload'));
      }

      setUploadSuccess({
        id: data.model?.id || 'unknown',
        file_hash: data.model?.file_hash || 'uploaded',
      });
    } catch (err: any) {
      setSubmitError(
        err instanceof TypeError ? { key: 'upload.errNetwork' } : err?.message ? { text: err.message } : { key: 'upload.errUnexpected' },
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setFileUrl(null);
    setPreviewFile(null);
    setPosterFile(null);
    setPosterPreviewUrl(null);
    if (cropSnapshotUrl) URL.revokeObjectURL(cropSnapshotUrl);
    setCropSnapshotUrl(null);
    setIsCropModalOpen(false);
    setTitle('');
    setDescription('');
    setTags([]);
    setLicense('CC0');
    setIsPaid(false);
    setPriceUsd('5.00');
    setUploadSuccess(null);
    setSubmitError(null);
    setValidationError(null);
  };

  return (
    <main className="min-h-screen bg-canvas pt-24 pb-16 text-ink">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8 border-b border-line pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-ink/5 px-3 py-1 text-xs font-mono tracking-wider text-ink/70 uppercase mb-3">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> {t('upload.badge')}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t('upload.title')}</h1>
          <p className="mt-2 text-sm text-ink/60">
            {t('upload.lead')}
          </p>
        </div>

        {/* Auth & Seller Access Gates / Upload State */}
        {!authReady ? (
          <div className="rounded-lg border border-line bg-ink/5 p-8 text-center text-sm text-ink/60">
            {t('upload.checkingSession')}
          </div>
        ) : !session ? (
          <div className="mx-auto max-w-[800px] rounded-lg border border-line bg-ink/5 p-6 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{t('seller.needLabel')}</p>
            <h2 className="mt-4 font-display text-2xl uppercase tracking-wide text-ink">{t('upload.needTitle')}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              {t('upload.needBody')}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-lg bg-ink px-5 py-2 text-sm font-medium text-canvas transition-colors hover:bg-ink/85"
            >
              {t('seller.needLogin')}
            </Link>
          </div>
        ) : !canUpload ? (
          <div className="mx-auto max-w-[800px] rounded-lg border border-line bg-ink/5 p-6 text-center">
            <Store className="mx-auto h-12 w-12 text-accent" />
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{t('seller.offLabel')}</p>
            <h2 className="mt-2 font-display text-2xl uppercase tracking-wide text-ink">
              {t('seller.offTitle')}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              {t('upload.offBody')}
            </p>
            <Link
              href="/creator"
              className="mt-6 inline-block rounded-lg bg-ink px-5 py-2 text-sm font-medium text-canvas transition-colors hover:bg-ink/85"
            >
              {t('upload.toSellerDash')}
            </Link>
          </div>
        ) : uploadSuccess ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center backdrop-blur">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/20 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-ink">{t('upload.okTitle')}</h2>
            <p className="mt-2 text-sm text-ink/70">
              {t('upload.okBody')}
            </p>
            <div className="mx-auto mt-4 max-w-md rounded-lg border border-line bg-canvas/60 p-3 font-mono text-xs text-ink/80 select-all">
              {uploadSuccess.file_hash}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink/5 px-4 py-2 text-sm font-medium hover:bg-ink/10 transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> {t('upload.another')}
              </button>
              <Link
                href={`/models/${uploadSuccess.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-canvas hover:bg-ink/85 transition-colors"
              >
                {t('upload.viewGallery')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left Column: 3D File Upload & Live Viewer */}
            <div className="space-y-6 lg:col-span-6">
              {/* Dropzone / 3D Preview Card */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative flex min-h-[380px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
                  isDragging
                    ? 'border-accent bg-accent/10'
                    : fileUrl
                    ? 'border-line bg-canvas/60'
                    : 'border-line bg-ink/[0.02] hover:border-ink/30'
                }`}
              >
                {fileUrl ? (
                  <div className="relative h-[380px] w-full">
                    {modelViewerLoaded ? (
                      <model-viewer
                        ref={viewerRef}
                        src={fileUrl}
                        alt={t('upload.viewerAlt')}
                        auto-rotate
                        camera-controls
                        shadow-intensity="1"
                        style={{ width: '100%', height: '100%', backgroundColor: 'rgb(var(--c-canvas))' }}
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-sm text-ink-soft">
                        {t('upload.loadingCanvas')}
                      </div>
                    )}

                    {/* Action buttons overlay inside 3D viewer */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 rounded-lg bg-canvas/80 px-3 py-2 backdrop-blur border border-line">
                      <div className="flex items-center gap-2 truncate text-xs text-ink/80">
                        <FileCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="truncate">{file?.name}</span>
                        <span className="text-ink/40">({(file?.size! / (1024 * 1024)).toFixed(2)} MB)</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCapturePoster}
                          disabled={capturingPoster}
                          title={t('upload.captureTip')}
                          className="inline-flex items-center gap-1 rounded bg-ink/10 px-2 py-1 text-xs text-ink hover:bg-ink/20 transition-colors"
                        >
                          <Camera className="h-3 w-3" />
                          {capturingPoster ? t('upload.capturing') : t('upload.capture')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFile(null);
                            setFileUrl(null);
                          }}
                          className="rounded bg-danger/20 px-2 py-1 text-xs text-danger hover:bg-danger/30 transition-colors"
                        >
                          {t('upload.change')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center p-8 text-center">
                    <input
                      type="file"
                      accept=".glb,model/gltf-binary"
                      className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleModelSelect(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-ink/5 text-ink/80 group-hover:scale-105 transition-transform">
                      <Box className="h-8 w-8 text-accent" />
                    </div>
                    <span className="mt-4 text-base font-medium text-ink">{t('upload.dropTitle')}</span>
                    <span className="mt-1 text-xs text-ink-soft">{t('upload.dropHint')}</span>
                    <div className="mt-4 rounded-md border border-line bg-ink/5 px-3 py-1.5 text-xs text-ink/70">
                      {t('upload.browse')}
                    </div>
                  </label>
                )}
              </div>

              {/* Poster & Preview Model Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Poster Snapshot / Upload */}
                <div className="rounded-xl border border-line bg-ink/[0.02] p-4">
                  <div className="flex items-center justify-between text-xs font-medium text-ink/80 mb-2">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4 text-accent" /> {t('upload.posterCover')}
                    </span>
                    <span className="text-[11px] text-ink/40">&lt; 1 MB</span>
                  </div>

                  {posterPreviewUrl ? (
                    <div className="relative h-28 w-full overflow-hidden rounded-lg border border-line bg-canvas">
                      <img src={posterPreviewUrl} alt={t('upload.posterAlt')} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setPosterFile(null);
                          setPosterPreviewUrl(null);
                        }}
                        className="absolute top-1 right-1 rounded bg-canvas/70 p-1 text-xs text-ink/70 hover:text-ink"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-ink/5 p-2 text-center hover:bg-ink/10 transition-colors">
                      <input
                        type="file"
                        accept="image/webp,image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const p = e.target.files[0];
                            if (p.size > MAX_POSTER_SIZE) {
                              setValidationError({ key: 'upload.errPosterBig' });
                              return;
                            }
                            setPosterFile(p);
                            setPosterPreviewUrl(URL.createObjectURL(p));
                          }
                        }}
                      />
                      <Camera className="h-5 w-5 text-ink/40 mb-1" />
                      <span className="text-xs text-ink/70">{t('upload.posterHint')}</span>
                    </label>
                  )}
                </div>

                {/* Optional Lightweight Preview Model (for Paid assets) */}
                <div className="rounded-xl border border-line bg-ink/[0.02] p-4">
                  <div className="flex items-center justify-between text-xs font-medium text-ink/80 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-emerald-500" /> {t('upload.previewGlb')}
                    </span>
                    <span className="text-[11px] text-ink/40">&lt; 5 MB</span>
                  </div>

                  {previewFile ? (
                    <div className="flex h-28 w-full flex-col justify-center rounded-lg border border-line bg-canvas/60 p-3 text-xs">
                      <span className="truncate font-medium text-ink">{previewFile.name}</span>
                      <span className="text-ink/40">{(previewFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                      <button
                        type="button"
                        onClick={() => setPreviewFile(null)}
                        className="mt-2 text-left text-xs text-danger hover:underline"
                      >
                        {t('upload.removeFile')}
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-ink/5 p-2 text-center hover:bg-ink/10 transition-colors">
                      <input
                        type="file"
                        accept=".glb,model/gltf-binary"
                        className="hidden"
                        onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            const pf = e.target.files[0];
                            if (pf.size > MAX_PREVIEW_SIZE) {
                              setValidationError({ key: 'upload.errPreviewBig' });
                              return;
                            }
                            setPreviewFile(pf);
                          }
                        }}
                      />
                      <Upload className="h-5 w-5 text-ink/40 mb-1" />
                      <span className="text-xs text-ink/70">{t('upload.previewHint1')}</span>
                      <span className="text-[11px] text-ink/40">{t('upload.previewHint2')}</span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Metadata Form */}
            <div className="space-y-5 lg:col-span-6">
              {/* Validation / Submit Alerts */}
              {validationError && (
                <div className="flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{msgText(validationError)}</span>
                </div>
              )}
              {submitError && (
                <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{msgText(submitError)}</span>
                </div>
              )}

              {/* Title Input */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-ink/60 mb-1.5">
                  {t('upload.fTitle')} <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('upload.phTitle')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-line bg-ink/5 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/30 focus:border-ink/50 focus:outline-none"
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-ink/60 mb-1.5">
                  {t('upload.fDescription')}
                </label>
                <textarea
                  rows={3}
                  placeholder={t('upload.phDescription')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-line bg-ink/5 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/30 focus:border-ink/50 focus:outline-none"
                />
              </div>

              {/* Tags Dropdown & Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono uppercase tracking-wider text-ink/60">
                    {t('upload.tagLabel')}
                  </label>
                  <span className="text-[11px] text-ink/40">{t('upload.tagHint')}</span>
                </div>

                {/* Selected Tag Badges */}
                {tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5 rounded-lg border border-line bg-ink/[0.03] p-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-ink/10 px-2.5 py-1 text-xs text-ink"
                      >
                        <Tag className="h-3 w-3 text-accent" />
                        <span className="capitalize">{tagLabel(t, tag)}</span>
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-0.5 text-ink-soft hover:text-ink transition-colors"
                          title={t('upload.tagRemove')}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Dropdown & Input Controls */}
                <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
                  {/* Dropdown Selector */}
                  <div ref={tagDropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTagDropdownOpen((prev) => !prev)}
                      aria-expanded={isTagDropdownOpen}
                      aria-haspopup="listbox"
                      className="flex h-10 w-full items-center justify-between rounded-lg border border-line bg-ink/5 px-3.5 text-sm text-ink hover:border-ink/30 focus:border-ink/50 focus:outline-none transition-colors"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Tag className="h-4 w-4 text-ink/40 shrink-0" />
                        <span className={tags.length === 0 ? 'text-ink/40' : 'text-ink'}>
                          {tags.length === 0
                            ? t('upload.tagChoose')
                            : t(tags.length === 1 ? 'upload.tagSelectedOne' : 'upload.tagSelectedMany', { n: tags.length })}
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-ink/60 transition-transform ${isTagDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isTagDropdownOpen && (
                      <ul
                        role="listbox"
                        className="absolute left-0 top-full z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-canvas/95 p-1.5 shadow-2xl backdrop-blur"
                      >
                        <li className="px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-accent border-b border-line mb-1">
                          {t('upload.tagAvailable', { n: availableTags.length })}
                        </li>
                        {availableTags.map((opt) => {
                          const isSelected = tags.includes(opt);
                          return (
                            <li key={opt}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => toggleTag(opt)}
                                className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                                  isSelected
                                    ? 'bg-ink/15 text-ink font-medium'
                                    : 'text-ink/70 hover:bg-ink/10 hover:text-ink'
                                }`}
                              >
                                <span className="capitalize">{tagLabel(t, opt)}</span>
                                {isSelected && <Check className="h-4 w-4 text-emerald-500" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Custom Tag Add Input */}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder={t('upload.tagNewPlaceholder')}
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          handleAddNewTag();
                        }
                      }}
                      className="h-10 w-full sm:w-44 rounded-lg border border-line bg-ink/5 px-3 text-xs text-ink placeholder:text-ink/30 focus:border-ink/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddNewTag()}
                      disabled={!tagsInput.trim()}
                      className="inline-flex h-10 items-center gap-1 rounded-lg border border-line bg-ink/10 px-3 text-xs font-medium text-ink hover:bg-ink/20 disabled:opacity-40 disabled:hover:bg-ink/10 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('upload.tagAdd')}
                    </button>
                  </div>
                </div>
              </div>

              {/* License Selection */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-ink/60 mb-1.5">
                  {t('upload.fLicense')}
                </label>
                <select
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm text-ink focus:border-ink/50 focus:outline-none"
                >
                  {LICENSES.map((lic) => (
                    <option key={lic.value} value={lic.value}>
                      {t(lic.label)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-ink/40">
                  {t(LICENSES.find((l) => l.value === license)?.desc ?? 'upload.lic.cc0d')}
                </p>
              </div>

              {/* Pricing: Free vs Paid */}
              <div className="rounded-xl border border-line bg-ink/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-ink">{t('upload.pricing')}</span>
                    <p className="text-xs text-ink-soft">{t('upload.pricingHint')}</p>
                  </div>
                  <div className="inline-flex rounded-lg border border-line bg-ink/5 p-1">
                    <button
                      type="button"
                      onClick={() => setIsPaid(false)}
                      className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                        !isPaid ? 'bg-ink text-canvas' : 'text-ink/70 hover:text-ink'
                      }`}
                    >
                      {t('upload.free')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPaid(true)}
                      className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                        isPaid ? 'bg-ink text-canvas' : 'text-ink/70 hover:text-ink'
                      }`}
                    >
                      {t('upload.paid')}
                    </button>
                  </div>
                </div>

                {isPaid && (
                  <div className="mt-3 border-t border-line pt-3">
                    <label className="block text-xs text-ink/60 mb-1">{t('upload.priceUsd')}</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
                      <input
                        type="number"
                        step="0.01"
                        min="0.50"
                        value={priceUsd}
                        onChange={(e) => setPriceUsd(e.target.value)}
                        className="w-full rounded-lg border border-line bg-ink/5 pl-9 pr-3 py-2 text-sm text-ink focus:border-ink/50 focus:outline-none"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-ink/40">
                      {t('upload.priceHint')}
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !file}
                className="w-full rounded-xl bg-ink py-3.5 text-sm font-semibold text-canvas transition-all hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> {t('upload.submitting')}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> {t('upload.submit')}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Crop Poster Selection Modal */}
      {isCropModalOpen && cropSnapshotUrl && (
        <CropPosterModal
          imageUrl={cropSnapshotUrl}
          onConfirm={handleApplyCroppedPoster}
          onClose={handleCloseCropModal}
          modelTitle={title}
        />
      )}
    </main>
  );
}
