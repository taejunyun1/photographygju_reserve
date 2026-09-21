import type { StudentReportPayload, StudentReportPhoto } from "./types";

type StoredPhoto = Omit<StudentReportPhoto, "file"> & { dataUrl?: string };
export type StoredReportDraft = {
  key: string;
  revision?: number;
  fields: Omit<StudentReportPayload, "photos">;
  photos: StoredPhoto[];
  updatedAt: string;
};

const DB_NAME = "gju-report-drafts";
const STORE_NAME = "drafts";
const FALLBACK_PREFIX = "gju-report-draft:";

function storageKey(userId: string, reservationId: string) {
  return `${userId}:${reservationId}`;
}

function canUseIndexedDb() {
  return typeof globalThis !== "undefined" && "indexedDB" in globalThis && Boolean(globalThis.indexedDB);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("보고서 임시 저장소를 열 수 없습니다."));
  });
}

async function fileToDataUrl(file: File) {
  if (typeof FileReader === "undefined") return "";
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("사진을 임시 저장하지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

async function serialisePhotos(photos: readonly StudentReportPhoto[]) {
  return Promise.all(photos.map(async ({ file, ...photo }) => ({
    ...photo,
    dataUrl: photo.dataUrl?.startsWith("data:") ? photo.dataUrl : (file ? await fileToDataUrl(file) : "")
  })));
}

export async function saveReportDraftLocal(userId: string, reservationId: string, payload: StudentReportPayload, revision = 0) {
  const key = storageKey(userId, reservationId);
  const { photos = [], ...fields } = payload;
  const value: StoredReportDraft = {
    key,
    revision,
    fields,
    photos: await serialisePhotos(photos),
    updatedAt: new Date().toISOString()
  };
  if (canUseIndexedDb()) {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("보고서 임시 저장에 실패했습니다."));
    });
    db.close();
    return value;
  }
  globalThis.localStorage?.setItem(`${FALLBACK_PREFIX}${key}`, JSON.stringify(value));
  return value;
}

export async function loadReportDraftLocal(userId: string, reservationId: string): Promise<StoredReportDraft | null> {
  const key = storageKey(userId, reservationId);
  if (canUseIndexedDb()) {
    const db = await openDb();
    const value = await new Promise<StoredReportDraft | null>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as StoredReportDraft | undefined) || null);
      request.onerror = () => reject(request.error || new Error("보고서 임시 저장을 불러오지 못했습니다."));
    });
    db.close();
    return value;
  }
  try {
    const raw = globalThis.localStorage?.getItem(`${FALLBACK_PREFIX}${key}`);
    return raw ? JSON.parse(raw) as StoredReportDraft : null;
  } catch {
    return null;
  }
}

export async function removeReportDraftLocal(userId: string, reservationId: string) {
  const key = storageKey(userId, reservationId);
  if (canUseIndexedDb()) {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("보고서 임시 저장을 삭제하지 못했습니다."));
    });
    db.close();
  }
  globalThis.localStorage?.removeItem(`${FALLBACK_PREFIX}${key}`);
}

export async function dataUrlToFile(dataUrl: string, name = "report-photo.jpg") {
  if (!dataUrl?.startsWith("data:")) return undefined;
  const [header, encoded] = dataUrl.split(",", 2);
  if (!header || !encoded) return undefined;
  const mimeType = header.match(/^data:([^;]+)/i)?.[1] || "image/jpeg";
  if (!globalThis.atob) return undefined;
  const binary = globalThis.atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new File([bytes], name, { type: mimeType });
}
