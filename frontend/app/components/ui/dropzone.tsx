/**
 * Shared image dropzone — drag-and-drop OR click-to-browse, single image, with
 * an inline preview. Presentational + controlled: it never uploads. It hands
 * the picked `File` back via `onFile`; the caller decides what to do (upload
 * immediately, or stash it for a multipart submit). Styling mirrors the
 * brutalist form primitives (border-line / shadow-press / font-mono).
 *
 * `value` may be a `File` (freshly picked) or a `string` URL (an already-stored
 * image, e.g. when editing) — both render as the preview.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useDropzone,
  type Accept,
  type FileRejection,
} from "react-dropzone";
import { assetUrl } from "~/lib/axios";
import { cn } from "~/lib/utils";

/** Same image-only contract as the backend multer config. */
export const IMAGE_ACCEPT: Accept = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — matches backend

const labelClass =
  "font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke";

interface DropzoneProps {
  /** Freshly-picked File, an existing image URL, or nothing. */
  value: File | string | null;
  /** Called with the picked file, or null when the image is removed. */
  onFile: (file: File | null) => void;
  label?: string;
  hint?: string;
  /** Server/validation error to show in red (e.g. from unwrapFieldErrors). */
  error?: string | null;
  /** Show a busy state (e.g. while the caller uploads the file). */
  loading?: boolean;
  disabled?: boolean;
  accept?: Accept;
  maxSize?: number;
  className?: string;
}

export function Dropzone({
  value,
  onFile,
  label,
  hint,
  error,
  loading = false,
  disabled = false,
  accept = IMAGE_ACCEPT,
  maxSize = MAX_IMAGE_BYTES,
  className,
}: DropzoneProps) {
  const [rejected, setRejected] = useState<string | null>(null);

  // Preview src: object URL for a File (revoked on change/unmount), or the
  // stored URL run through assetUrl() so a root-relative /uploads path resolves
  // against the API origin.
  const previewSrc = useMemo(() => {
    if (value instanceof File) return URL.createObjectURL(value);
    if (typeof value === "string" && value) return assetUrl(value);
    return null;
  }, [value]);

  useEffect(() => {
    return () => {
      if (value instanceof File && previewSrc) URL.revokeObjectURL(previewSrc);
    };
  }, [value, previewSrc]);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        const code = rejections[0].errors[0]?.code;
        setRejected(
          code === "file-too-large"
            ? "Image is too large (max 5MB)."
            : code === "file-invalid-type"
              ? "Must be a JPG, PNG or WEBP image."
              : "That file can't be used.",
        );
        return;
      }
      setRejected(null);
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    disabled: disabled || loading,
    noKeyboard: true,
  });

  const shownError = error ?? rejected;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? <span className={labelClass}>{label}</span> : null}

      {previewSrc ? (
        <div className="relative border-2 border-line bg-paper shadow-press">
          <img
            src={previewSrc}
            alt="Selected"
            className="max-h-56 w-full object-contain bg-paper-2"
          />
          <div className="flex items-center justify-between gap-2 border-t-2 border-line px-3 py-2">
            <span className="truncate font-mono text-[0.6875rem] text-smoke">
              {value instanceof File ? value.name : "Current image"}
            </span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={open}
                disabled={disabled || loading}
                className="font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink underline disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejected(null);
                  onFile(null);
                }}
                disabled={disabled || loading}
                className="font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-soldout underline disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-paper/70 font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink">
              Uploading…
            </div>
          ) : null}
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed border-line bg-paper px-4 py-8 text-center shadow-press outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink",
            isDragActive && "border-ink bg-ink/5",
            shownError && "border-soldout",
            (disabled || loading) && "cursor-not-allowed opacity-60",
          )}
        >
          <input {...getInputProps()} />
          <span className="font-mono text-[0.8125rem] font-bold text-ink">
            {loading
              ? "Uploading…"
              : isDragActive
                ? "Drop the image"
                : "Drag an image here, or click to browse"}
          </span>
          <span className="font-mono text-[0.6875rem] text-smoke">
            JPG, PNG or WEBP · up to 5MB
          </span>
        </div>
      )}

      {hint && !shownError ? (
        <span className="font-mono text-[0.6875rem] text-smoke">{hint}</span>
      ) : null}
      {shownError ? (
        <span className="font-mono text-[0.6875rem] leading-snug text-soldout">
          {shownError}
        </span>
      ) : null}
    </div>
  );
}
