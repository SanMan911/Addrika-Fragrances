'use client';

import { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../app/admin/layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * ImageDropUploader — drag/drop OR click-to-pick a JPG/PNG/WEBP/GIF.
 * Uploads to /api/admin/products/upload-image and calls `onUploaded(url)`
 * with the public asset URL. Pass `initial` to show the current image.
 *
 * Kept intentionally slim so we can drop it into the ProductFormModal +
 * the per-size gallery without duplicating logic.
 */
export default function ImageDropUploader({
  initial = '',
  onUploaded,
  label = 'Drop an image or click to browse',
  testid = 'image-dropzone',
  compact = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [current, setCurrent] = useState(initial || '');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      toast.error('Please pick an image (JPG, PNG, WEBP or GIF).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image too large — max 8 MB.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authFetch(`${API_URL}/api/admin/products/upload-image`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setCurrent(data.url);
      onUploaded?.(data.url);
      toast.success('Image uploaded.');
    } catch (e) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) upload(file);
  };

  const clear = () => {
    setCurrent('');
    onUploaded?.('');
  };

  return (
    <div
      className={`relative rounded-lg border-2 border-dashed transition-colors ${
        dragging ? 'border-amber-400 bg-amber-500/10' : 'border-slate-600 bg-slate-800/40'
      } ${compact ? 'p-2' : 'p-3'}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      data-testid={testid}
    >
      {current ? (
        <div className="flex items-center gap-3">
          {/* Product image preview — a plain <img> is intentional here so we don't
              re-optimise every hero shot via <next/image> in the admin form. */}
          <img
            src={current}
            alt="preview"
            className={`rounded-lg object-cover ${compact ? 'w-12 h-12' : 'w-20 h-20'} bg-slate-700`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 truncate">{current}</p>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-1"
                data-testid={`${testid}-replace`}
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                Replace
              </button>
              <button
                type="button"
                onClick={clear}
                className="text-xs px-2 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-100 flex items-center gap-1"
                data-testid={`${testid}-clear`}
              >
                <X size={12} /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`w-full flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-amber-300 ${
            compact ? 'py-3 text-xs' : 'py-6 text-sm'
          }`}
          data-testid={`${testid}-empty`}
        >
          {uploading ? (
            <><Loader2 size={compact ? 16 : 22} className="animate-spin" /> Uploading…</>
          ) : (
            <>
              <ImageIcon size={compact ? 18 : 26} />
              <span>{label}</span>
              <span className="text-[10px] text-slate-500">JPG · PNG · WEBP · GIF · max 8 MB</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
    </div>
  );
}
