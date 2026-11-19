'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Crop, Check, X, RotateCcw, Maximize2, Square, RectangleVertical, RectangleHorizontal } from 'lucide-react';

interface CropRect {
  x: number;      // 0 - 100 (%)
  y: number;      // 0 - 100 (%)
  width: number;  // 0 - 100 (%)
  height: number; // 0 - 100 (%)
}

interface CropPosterModalProps {
  imageUrl: string;
  onConfirm: (croppedBlob: Blob) => void;
  onClose: () => void;
  modelTitle?: string;
}

type AspectRatio = 'free' | '1:1' | '4:5' | '16:9';

export default function CropPosterModal({
  imageUrl,
  onConfirm,
  onClose,
  modelTitle,
}: CropPosterModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Initial crop box (80% size centered)
  const [crop, setCrop] = useState<CropRect>({ x: 10, y: 10, width: 80, height: 80 });
  const [aspect, setAspect] = useState<AspectRatio>('free');
  const [isProcessing, setIsProcessing] = useState(false);

  // Dragging state
  const dragRef = useRef<{
    action: 'move' | 'create' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';
    startX: number;
    startY: number;
    initialCrop: CropRect;
  } | null>(null);

  // Handle preset aspect ratio
  const applyAspect = useCallback((ratio: AspectRatio) => {
    setAspect(ratio);
    if (!imgRef.current) return;
    const { naturalWidth, naturalHeight } = imgRef.current;
    if (!naturalWidth || !naturalHeight) return;

    if (ratio === 'free') return;

    let targetRatio = 1;
    if (ratio === '1:1') targetRatio = 1;
    else if (ratio === '4:5') targetRatio = 4 / 5;
    else if (ratio === '16:9') targetRatio = 16 / 9;

    // Convert target ratio into percent units accounting for image natural aspect
    const imageAspect = naturalWidth / naturalHeight;
    // widthPercent / heightPercent = targetRatio / imageAspect
    const ratioMultiplier = targetRatio / imageAspect;

    setCrop((prev) => {
      let newW = prev.width;
      let newH = newW / ratioMultiplier;

      if (newH > 90) {
        newH = 90;
        newW = newH * ratioMultiplier;
      }
      if (newW > 90) {
        newW = 90;
        newH = newW / ratioMultiplier;
      }

      const newX = Math.max(0, Math.min(100 - newW, (100 - newW) / 2));
      const newY = Math.max(0, Math.min(100 - newH, (100 - newH) / 2));

      return { x: newX, y: newY, width: newW, height: newH };
    });
  }, []);

  const handlePointerDown = (
    e: React.PointerEvent,
    action: 'move' | 'create' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const container = containerRef.current;
    if (!container) return;

    dragRef.current = {
      action,
      startX: e.clientX,
      startY: e.clientY,
      initialCrop: { ...crop },
    };
  };

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const clickY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    // Start drawing a new box from click point
    dragRef.current = {
      action: 'create',
      startX: e.clientX,
      startY: e.clientY,
      initialCrop: { x: clickX, y: clickY, width: 0, height: 0 },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
    const { action, initialCrop } = dragRef.current;

    setCrop((prev) => {
      let { x, y, width, height } = initialCrop;

      if (action === 'move') {
        const nextX = Math.max(0, Math.min(100 - width, x + dx));
        const nextY = Math.max(0, Math.min(100 - height, y + dy));
        return { x: nextX, y: nextY, width, height };
      }

      if (action === 'create') {
        let curX = ((e.clientX - rect.left) / rect.width) * 100;
        let curY = ((e.clientY - rect.top) / rect.height) * 100;
        curX = Math.max(0, Math.min(100, curX));
        curY = Math.max(0, Math.min(100, curY));

        const left = Math.min(initialCrop.x, curX);
        const top = Math.min(initialCrop.y, curY);
        const w = Math.max(4, Math.abs(curX - initialCrop.x));
        const h = Math.max(4, Math.abs(curY - initialCrop.y));
        return { x: left, y: top, width: w, height: h };
      }

      // Handle corner and edge resizing
      let minSize = 4;
      if (action.includes('e')) {
        width = Math.max(minSize, Math.min(100 - x, initialCrop.width + dx));
      }
      if (action.includes('s')) {
        height = Math.max(minSize, Math.min(100 - y, initialCrop.height + dy));
      }
      if (action.includes('w')) {
        const candidateWidth = initialCrop.width - dx;
        if (candidateWidth >= minSize && initialCrop.x + dx >= 0) {
          x = initialCrop.x + dx;
          width = candidateWidth;
        }
      }
      if (action.includes('n')) {
        const candidateHeight = initialCrop.height - dy;
        if (candidateHeight >= minSize && initialCrop.y + dy >= 0) {
          y = initialCrop.y + dy;
          height = candidateHeight;
        }
      }

      return { x, y, width, height };
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleFullImage = () => {
    setCrop({ x: 0, y: 0, width: 100, height: 100 });
    setAspect('free');
  };

  const handleConfirm = () => {
    if (!imgRef.current) return;
    setIsProcessing(true);

    const img = imgRef.current;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    const sx = Math.max(0, Math.min(nw, (crop.x / 100) * nw));
    const sy = Math.max(0, Math.min(nh, (crop.y / 100) * nh));
    const sw = Math.max(1, Math.min(nw - sx, (crop.width / 100) * nw));
    const sh = Math.max(1, Math.min(nh - sy, (crop.height / 100) * nh));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setIsProcessing(false);
      return;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        setIsProcessing(false);
        if (blob) {
          onConfirm(blob);
        }
      },
      'image/webp',
      0.9
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      onPointerUp={handlePointerUp}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-white/20 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Crop className="h-5 w-5 text-hud" />
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                Select Poster Area / ครอบตัดภาพโปสเตอร์
              </h2>
              <p className="text-[11px] text-white/50">
                ลากหรือปรับกรอบเพื่อเลือกส่วนของโมเดลที่ต้องการใช้เป็นรูปโปสเตอร์
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar: Aspect ratio presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.02] px-5 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase text-white/40 mr-1">Aspect:</span>
            <button
              type="button"
              onClick={() => applyAspect('free')}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                aspect === 'free' ? 'bg-white text-black font-medium' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              Free
            </button>
            <button
              type="button"
              onClick={() => applyAspect('1:1')}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${
                aspect === '1:1' ? 'bg-white text-black font-medium' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <Square className="h-3 w-3" /> 1:1
            </button>
            <button
              type="button"
              onClick={() => applyAspect('4:5')}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${
                aspect === '4:5' ? 'bg-white text-black font-medium' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <RectangleVertical className="h-3 w-3" /> 4:5
            </button>
            <button
              type="button"
              onClick={() => applyAspect('16:9')}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${
                aspect === '16:9' ? 'bg-white text-black font-medium' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <RectangleHorizontal className="h-3 w-3" /> 16:9
            </button>
          </div>

          <button
            type="button"
            onClick={handleFullImage}
            className="inline-flex items-center gap-1 rounded bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Maximize2 className="h-3 w-3" /> Full Frame
          </button>
        </div>

        {/* Crop Canvas Display Area */}
        <div className="relative flex-1 overflow-auto bg-black p-4 flex items-center justify-center min-h-[320px] max-h-[55vh] select-none">
          <div
            ref={containerRef}
            onPointerDown={handleContainerPointerDown}
            onPointerMove={handlePointerMove}
            className="relative inline-block cursor-crosshair overflow-hidden rounded-lg shadow-inner"
            style={{ touchAction: 'none' }}
          >
            {/* The source snapshot */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Snapshot to crop"
              className="block max-h-[50vh] max-w-full object-contain pointer-events-none"
              draggable={false}
            />

            {/* Dark Mask Top */}
            <div
              className="absolute left-0 right-0 top-0 bg-black/65 pointer-events-none"
              style={{ height: `${crop.y}%` }}
            />
            {/* Dark Mask Bottom */}
            <div
              className="absolute left-0 right-0 bottom-0 bg-black/65 pointer-events-none"
              style={{ height: `${Math.max(0, 100 - (crop.y + crop.height))}%` }}
            />
            {/* Dark Mask Left */}
            <div
              className="absolute left-0 bg-black/65 pointer-events-none"
              style={{
                top: `${crop.y}%`,
                height: `${crop.height}%`,
                width: `${crop.x}%`,
              }}
            />
            {/* Dark Mask Right */}
            <div
              className="absolute right-0 bg-black/65 pointer-events-none"
              style={{
                top: `${crop.y}%`,
                height: `${crop.height}%`,
                width: `${Math.max(0, 100 - (crop.x + crop.width))}%`,
              }}
            />

            {/* The Crop Box Overlay */}
            <div
              onPointerDown={(e) => handlePointerDown(e, 'move')}
              className="absolute cursor-move border-2 border-hud shadow-lg"
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.width}%`,
                height: `${crop.height}%`,
              }}
            >
              {/* Rule of thirds grid lines */}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
                <div className="border-b border-r border-white/60" />
                <div className="border-b border-r border-white/60" />
                <div className="border-b border-white/60" />
                <div className="border-b border-r border-white/60" />
                <div className="border-b border-r border-white/60" />
                <div className="border-b border-white/60" />
                <div className="border-r border-white/60" />
                <div className="border-r border-white/60" />
                <div />
              </div>

              {/* Corner Handles */}
              <div
                onPointerDown={(e) => handlePointerDown(e, 'nw')}
                className="absolute -left-1.5 -top-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-black bg-white shadow"
              />
              <div
                onPointerDown={(e) => handlePointerDown(e, 'ne')}
                className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 cursor-nesw-resize rounded-sm border border-black bg-white shadow"
              />
              <div
                onPointerDown={(e) => handlePointerDown(e, 'se')}
                className="absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-black bg-white shadow"
              />
              <div
                onPointerDown={(e) => handlePointerDown(e, 'sw')}
                className="absolute -left-1.5 -bottom-1.5 h-3.5 w-3.5 cursor-nesw-resize rounded-sm border border-black bg-white shadow"
              />

              {/* Edge Handles */}
              <div
                onPointerDown={(e) => handlePointerDown(e, 'n')}
                className="absolute left-1/2 -top-1.5 h-3 w-6 -translate-x-1/2 cursor-ns-resize rounded-full border border-black bg-white/80 shadow"
              />
              <div
                onPointerDown={(e) => handlePointerDown(e, 's')}
                className="absolute left-1/2 -bottom-1.5 h-3 w-6 -translate-x-1/2 cursor-ns-resize rounded-full border border-black bg-white/80 shadow"
              />
              <div
                onPointerDown={(e) => handlePointerDown(e, 'w')}
                className="absolute top-1/2 -left-1.5 h-6 w-3 -translate-y-1/2 cursor-ew-resize rounded-full border border-black bg-white/80 shadow"
              />
              <div
                onPointerDown={(e) => handlePointerDown(e, 'e')}
                className="absolute top-1/2 -right-1.5 h-6 w-3 -translate-y-1/2 cursor-ew-resize rounded-full border border-black bg-white/80 shadow"
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-white/10 bg-zinc-900 px-5 py-3">
          <span className="text-xs text-white/50 font-mono">
            Size: {Math.round(crop.width)}% × {Math.round(crop.height)}%
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50 transition-colors shadow-lg"
            >
              <Check className="h-4 w-4" />
              {isProcessing ? 'Processing…' : 'Crop & Save Poster'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
