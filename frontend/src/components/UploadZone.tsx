import { useEffect } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { ImagePlus } from "lucide-react";
import { ACCEPT } from "../lib/image";
import { useHealth, useToast } from "../lib/context";
import { cx } from "./ui";

type Props = {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  compact?: boolean;
  title?: string;
  hint?: string;
  disabled?: boolean;
};

export function UploadZone({ onFiles, multiple = false, maxFiles, compact, title, hint, disabled }: Props) {
  const toast = useToast();
  const { health } = useHealth();
  const maxMb = health?.max_file_mb ?? 8;

  const onDropRejected = (rej: FileRejection[]) => {
    const code = rej[0]?.errors[0]?.code;
    toast(
      code === "file-too-large" ? `That image is over ${maxMb} MB.` :
      code === "too-many-files" ? `You can add up to ${maxFiles} photos at a time.` :
      "Only JPG, PNG and WEBP images work here.",
      "error",
    );
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPT,
    multiple,
    maxFiles: multiple ? maxFiles : 1,
    maxSize: maxMb * 1024 * 1024,
    disabled,
    noClick: compact,
    onDropAccepted: onFiles,
    onDropRejected,
  });

  if (compact) {
    return (
      <div {...getRootProps()} className={cx("rounded-full", isDragActive && "ring-2 ring-dog")}>
        <input {...getInputProps()} aria-label="Choose a photo" />
        <button type="button" onClick={open} disabled={disabled} className="inline-flex h-11 items-center gap-2 rounded-full bg-dog px-5 text-sm font-semibold text-night transition hover:brightness-105 disabled:opacity-50">
          <ImagePlus className="size-4" />
          {title ?? "Try another photo"}
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cx(
        "group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[28px] border-2 border-dashed px-6 py-14 text-center transition md:py-20",
        isDragActive ? "border-dog bg-dog/10" : "border-line bg-surface hover:border-dog/60",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input {...getInputProps()} aria-label="Choose a photo" />
      <div className={cx("mb-5 grid size-16 place-items-center rounded-2xl bg-dog text-night transition", isDragActive ? "scale-110 rotate-6" : "group-hover:-rotate-6")}>
        <ImagePlus className="size-7" />
      </div>
      <p className="font-display text-xl font-bold md:text-2xl">{isDragActive ? "Drop it here" : (title ?? "Drop a photo here")}</p>
      <p className="mt-2 text-sm text-muted">{hint ?? `or click to choose one. You can also paste an image. JPG, PNG or WEBP up to ${maxMb} MB.`}</p>
    </div>
  );
}

/** Calls onImage when the user pastes an image anywhere on the page. */
export function usePasteImage(onImage: (f: File) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        const ext = file.type.split("/")[1] || "png";
        onImage(new File([file], `pasted.${ext}`, { type: file.type }));
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [onImage, enabled]);
}
