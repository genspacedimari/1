import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VIEWPORT = 280; // on-screen crop box size, px
const OUTPUT = 512; // exported square image size, px

interface Props {
  file: File;
  onCancel: () => void;
  /** Resolves with a cropped, square JPEG blob at OUTPUT x OUTPUT. */
  onConfirm: (blob: Blob) => void;
  confirming?: boolean;
}

/**
 * Lets the user reposition and zoom a photo inside a square crop box before
 * it's uploaded as their avatar — so the important part of the photo (a
 * face, for example) doesn't get cut off by a fixed center-crop.
 * Drag to pan, scroll/pinch or use the slider to zoom. No external
 * dependencies — everything is done with plain canvas math.
 */
export function AvatarCropModal({ file, onCancel, onConfirm, confirming }: Props) {
  const imageUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // top-left of image, in viewport px
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl]);

  // Base scale: smallest scale that makes the image fully cover the square
  // viewport (i.e. "object-fit: cover" at zoom = 1).
  const baseScale = naturalSize ? Math.max(VIEWPORT / naturalSize.w, VIEWPORT / naturalSize.h) : 1;
  const displayScale = baseScale * zoom;
  const dispW = naturalSize ? naturalSize.w * displayScale : VIEWPORT;
  const dispH = naturalSize ? naturalSize.h * displayScale : VIEWPORT;

  function clampOffset(x: number, y: number, w = dispW, h = dispH) {
    const minX = Math.min(0, VIEWPORT - w);
    const minY = Math.min(0, VIEWPORT - h);
    return { x: Math.max(minX, Math.min(0, x)), y: Math.max(minY, Math.min(0, y)) };
  }

  const handleImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNaturalSize({ w, h });
    // Center the image inside the viewport at zoom = 1.
    const s = Math.max(VIEWPORT / w, VIEWPORT / h);
    setOffset(clampOffset((VIEWPORT - w * s) / 2, (VIEWPORT - h * s) / 2, w * s, h * s));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setOffset(clampOffset(dragState.current.origX + dx, dragState.current.origY + dy));
  };
  const onPointerUp = () => { dragState.current = null; };

  const handleZoomChange = (newZoom: number) => {
    if (!naturalSize) { setZoom(newZoom); return; }
    // Keep the viewport center anchored to the same point in the image
    // while zooming, instead of jumping to top-left.
    const oldScale = baseScale * zoom;
    const newScale = baseScale * newZoom;
    const cx = VIEWPORT / 2;
    const cy = VIEWPORT / 2;
    const imgX = (cx - offset.x) / oldScale;
    const imgY = (cy - offset.y) / oldScale;
    const newOffset = clampOffset(cx - imgX * newScale, cy - imgY * newScale, naturalSize.w * newScale, naturalSize.h * newScale);
    setZoom(newZoom);
    setOffset(newOffset);
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img || !naturalSize) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const outScale = OUTPUT / VIEWPORT;
    const drawW = dispW * outScale;
    const drawH = dispH * outScale;
    const drawX = offset.x * outScale;
    const drawY = offset.y * outScale;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    canvas.toBlob((blob) => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-5 dark:bg-surface-dark">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">Atur Foto Profil</h3>
          <button onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 dark:hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div
          ref={containerRef}
          className="relative mx-auto touch-none select-none overflow-hidden rounded-2xl bg-muted/30 dark:bg-white/5"
          style={{ width: VIEWPORT, height: VIEWPORT, cursor: dragState.current ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt=""
            draggable={false}
            onLoad={handleImgLoad}
            className="absolute pointer-events-none"
            style={{ width: dispW, height: dispH, left: offset.x, top: offset.y }}
          />
          {/* Round mask overlay so the user sees the same crop shape used everywhere in the app */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-border dark:ring-border-dark" />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomIn size={16} className="shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
        <p className="mt-1 text-center text-xs text-muted-foreground">Geser untuk memposisikan, geser slider untuk zoom</p>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={confirming}>
            Batal
          </Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={confirming || !naturalSize}>
            <Check size={16} /> {confirming ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </div>
    </div>
  );
}
