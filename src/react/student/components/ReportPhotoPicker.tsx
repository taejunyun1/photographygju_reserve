import React, { useState } from "react";

import type { StudentReportPhoto } from "../types";

const MAX_PHOTOS = 5;
const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
const MAX_PROCESSED_BYTES = 3 * 1024 * 1024;

function photoId() {
  return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("사진을 읽을 수 없습니다.")); };
    image.src = url;
  });
}

async function prepareFile(file: File): Promise<File> {
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error("사진 원본은 20MiB 이하만 선택할 수 있습니다.");
  if (!/^image\/(jpeg|png)$/i.test(file.type)) throw new Error("JPG 또는 PNG 사진만 선택할 수 있습니다.");
  const image = await readImage(file);
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error("사진 해상도가 너무 큽니다.");
  const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = globalThis["document"].createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) return file;
  if (blob.size > MAX_PROCESSED_BYTES) {
    const lowerQuality = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.65));
    if (lowerQuality && lowerQuality.size <= MAX_PROCESSED_BYTES) return new File([lowerQuality], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
    throw new Error("사진을 3MiB 이하로 줄이지 못했습니다. 더 작은 사진을 선택해 주세요.");
  }
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
}

export function ReportPhotoPicker({ category, photos, maxPhotos = MAX_PHOTOS, onChange }: { category: string; photos: readonly StudentReportPhoto[]; maxPhotos?: number; onChange: (photos: StudentReportPhoto[]) => void }) {
  const [error, setError] = useState("");
  const limit = Math.max(0, Math.min(MAX_PHOTOS, Number(maxPhotos) || 0));
  const remaining = Math.max(0, limit - photos.length);
  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, remaining);
    event.target.value = "";
    if (!files.length) return;
    setError("");
    try {
      const prepared: StudentReportPhoto[] = [];
      for (const source of files) {
        const file = await prepareFile(source);
        prepared.push({ id: photoId(), clientPhotoId: photoId(), category, mimeType: file.type, size: file.size, status: "local", file, dataUrl: URL.createObjectURL(file) });
      }
      onChange([...photos, ...prepared].slice(0, limit));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "사진을 준비하지 못했습니다.");
    }
  }
  return (
    <div className="report-photo-picker">
      <div className="report-photo-picker__head"><strong>사진 {photos.length} / {limit}</strong><span className="muted">파손이 있으면 해당 사진을 1장 이상 첨부하세요.</span></div>
      <div className="report-photo-picker__grid">
        {photos.map((photo) => (
          <figure key={photo.id} className="report-photo-thumb">
            {photo.dataUrl ? <img src={photo.dataUrl} alt="첨부 미리보기" /> : <span>{photo.status || "업로드"}</span>}
            <button type="button" aria-label="사진 삭제" onClick={() => onChange(photos.filter((item) => item.id !== photo.id))}>삭제</button>
          </figure>
        ))}
        {remaining > 0 ? <label className="report-photo-add"><input type="file" accept="image/jpeg,image/png" capture="environment" multiple onChange={handleFiles} />사진 추가</label> : null}
      </div>
      {error ? <p className="student-react-submit-error" role="alert">{error}</p> : null}
    </div>
  );
}

export { MAX_PHOTOS };
