import type { AxiosInstance } from "axios";
import { apiClient } from "./apiClient";
import {
  cacheEmployeePhotoGrant,
  clearEmployeePhotoGrantCache,
  deleteEmployeePhotoGrant,
  getCachedEmployeePhotoGrant,
  pruneExpiredEmployeePhotoGrants,
  type EmployeePhotoGrant,
  type EmployeePhotoIdentity,
} from "./employeePhotoGrantCache";

export { clearEmployeePhotoGrantCache };
export type { EmployeePhotoGrant };

export type ImagePurpose = "ASSET_IMAGE" | "EMPLOYEE_PHOTO";
export type ImageUploadStage = "uploading" | "verifying";

export const IMAGE_SOURCE_MAX_BYTES = 10_000_000;
export const IMAGE_SOURCE_MAX_PIXELS = 25_000_000;
export const IMAGE_SOURCE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";
export const IMAGE_SOURCE_FORMAT_LABEL = "JPG, PNG, WebP, HEIC/HEIF";

const SOURCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export class ImageUploadError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ImageUploadError";
    this.code = code;
  }
}

export interface ImageUploadIntent {
  uploadId: string;
  purpose: ImagePurpose;
  creationContextToken: string | null;
  attachmentWindowSeconds: number;
  acceptedSourceMimeTypes: readonly string[];
  uploadInstructions: {
    url: string;
    method: string;
    fields: Record<string, string>;
    expiresAt: string;
  };
}

export interface VerifiedImageUpload {
  uploadId: string;
  purpose: ImagePurpose;
  creationContextToken: string | null;
  attachmentExpiresAt: string | null;
  previewUrl: string | null;
  previewBlob: Blob | null;
  sourceFileName: string;
}

type ImageApi = Pick<AxiosInstance, "get" | "post">;

function acceptedContentType(file: File): string | null {
  const declared = file.type.trim().toLowerCase().split(";", 1)[0];
  if (SOURCE_TYPES.has(declared)) return declared;
  if (declared && declared !== "application/octet-stream") return null;

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? null;
}

export function validateImageSource(file: File): { contentType: string } {
  const contentType = acceptedContentType(file);
  if (!contentType) {
    throw new ImageUploadError(
      "SOURCE_TYPE_NOT_ALLOWED",
      `รองรับไฟล์ ${IMAGE_SOURCE_FORMAT_LABEL} เท่านั้น`,
    );
  }
  if (file.size < 1 || file.size > IMAGE_SOURCE_MAX_BYTES) {
    throw new ImageUploadError(
      "SOURCE_SIZE_LIMIT",
      "ไฟล์รูปต้องมีขนาดไม่เกิน 10 MB",
    );
  }
  return { contentType };
}

function providerUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new ImageUploadError("IMAGE_URL_INVALID", "ที่อยู่รูปจากระบบไม่ถูกต้อง");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ImageUploadError("IMAGE_URL_INVALID", "ที่อยู่รูปจากระบบไม่ถูกต้อง");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    parsed.hash !== "" ||
    !["api.cloudinary.com", "res.cloudinary.com"].includes(parsed.hostname)
  ) {
    throw new ImageUploadError("IMAGE_URL_NOT_ALLOWED", "ระบบส่งที่อยู่รูปที่ไม่อนุญาตมาให้");
  }
  return parsed.toString();
}

function boundedSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parent?.reason);
  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Image request timed out", "TimeoutError")),
    timeoutMs,
  );
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abortFromParent);
    },
  };
}

async function withBoundedApiRequest<T>(
  parent: AbortSignal | undefined,
  request: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const bounded = boundedSignal(parent, 15_000);
  try {
    return await request(bounded.signal);
  } finally {
    bounded.dispose();
  }
}

async function fetchImageBlob(
  urlValue: unknown,
  signal: AbortSignal | undefined,
  fetchImpl: typeof fetch,
): Promise<Blob> {
  const url = providerUrl(urlValue);
  const bounded = boundedSignal(signal, 20_000);
  try {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
        credentials: "omit",
        redirect: "error",
        signal: bounded.signal,
      });
    } catch (error) {
      if (bounded.signal.aborted) throw error;
      throw new ImageUploadError(
        "IMAGE_READ_UNAVAILABLE",
        "โหลดรูปพนักงานไม่สำเร็จ กรุณาลองใหม่ในภายหลัง",
      );
    }

    if (response.url) providerUrl(response.url);
    if (!response.ok) {
      throw new ImageUploadError(
        "IMAGE_READ_UNAVAILABLE",
        "โหลดรูปพนักงานไม่สำเร็จ กรุณาลองใหม่ในภายหลัง",
      );
    }
    const contentType = response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "image/jpeg") {
      throw new ImageUploadError(
        "IMAGE_CONTENT_TYPE_INVALID",
        "รูปพนักงานที่ได้รับไม่ใช่ JPEG ที่ผ่านการปรับขนาดแล้ว",
      );
    }
    return await response.blob();
  } finally {
    bounded.dispose();
  }
}

export async function fetchEmployeePhotoBlobFromGrant(
  grant: EmployeePhotoGrant,
  options: {
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
    now?: () => number;
  } = {},
): Promise<Blob | null> {
  if (grant.hasEmployeePhoto === false) return null;
  if (!grant.url || !grant.expiresAt) {
    throw new ImageUploadError("IMAGE_READ_UNAVAILABLE", "ไม่มีสิทธิ์โหลดรูปพนักงานในขณะนี้");
  }
  const expiry = Date.parse(grant.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= (options.now?.() ?? Date.now())) {
    throw new ImageUploadError("IMAGE_GRANT_EXPIRED", "สิทธิ์โหลดรูปหมดอายุแล้ว กรุณาโหลดใหม่");
  }
  return fetchImageBlob(grant.url, options.signal, options.fetchImpl ?? fetch);
}

export async function getEmployeePhotoBlob(
  userId: string,
  options: {
    api?: ImageApi;
    accountId?: string | null;
    photoRevision?: string | null;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
    now?: () => number;
  } = {},
): Promise<Blob | null> {
  const now = options.now?.() ?? Date.now();
  pruneExpiredEmployeePhotoGrants(now);
  const photoIdentity: EmployeePhotoIdentity | null = options.accountId && options.photoRevision
    ? {
      accountId: options.accountId,
      userId,
      photoRevision: options.photoRevision,
    }
    : null;
  let grant = photoIdentity
    ? getCachedEmployeePhotoGrant(photoIdentity)
    : undefined;

  if (!grant) {
    const api = options.api ?? apiClient;
    const response = await withBoundedApiRequest(options.signal, (signal) =>
      api.get<EmployeePhotoGrant>(
        `/users/${encodeURIComponent(userId)}/photo`,
        {
          headers: { "Cache-Control": "no-store" },
          signal,
        },
      ),
    );
    grant = response.data;
    if (
      options.photoRevision &&
      grant.photoRevision !== options.photoRevision
    ) {
      throw new ImageUploadError(
        "IMAGE_REVISION_STALE",
        "รูปพนักงานเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
      );
    }

    const expiresAt = grant.expiresAt ? Date.parse(grant.expiresAt) : Number.NaN;
    if (
      photoIdentity &&
      grant.hasEmployeePhoto !== false &&
      Number.isFinite(expiresAt) &&
      expiresAt > now
    ) {
      cacheEmployeePhotoGrant(
        photoIdentity,
        grant,
        expiresAt,
      );
    }
  }

  try {
    return await fetchEmployeePhotoBlobFromGrant(grant, options);
  } catch (error) {
    if (photoIdentity) {
      deleteEmployeePhotoGrant(photoIdentity);
    }
    throw error;
  }
}

async function uploadToProvider(
  file: File,
  intent: ImageUploadIntent,
  signal: AbortSignal | undefined,
  fetchImpl: typeof fetch,
): Promise<{ publicId: string; version: number; signature: string }> {
  const targetUrl = providerUrl(intent.uploadInstructions?.url);
  if (intent.uploadInstructions.method !== "POST") {
    throw new ImageUploadError("UPLOAD_INSTRUCTIONS_INVALID", "คำสั่งอัปโหลดรูปไม่ถูกต้อง");
  }
  const fields = intent.uploadInstructions.fields;
  if (!fields || typeof fields !== "object" || Object.values(fields).some((value) => typeof value !== "string")) {
    throw new ImageUploadError("UPLOAD_INSTRUCTIONS_INVALID", "คำสั่งอัปโหลดรูปไม่ถูกต้อง");
  }

  const formData = new FormData();
  Object.entries(fields).forEach(([name, value]) => formData.append(name, value));
  formData.append("file", file, file.name);

  const bounded = boundedSignal(signal, 60_000);
  try {
    let response: Response;
    try {
      response = await fetchImpl(targetUrl, {
        method: intent.uploadInstructions.method,
        body: formData,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: bounded.signal,
      });
    } catch (error) {
      if (bounded.signal.aborted) throw error;
      throw new ImageUploadError(
        "PROVIDER_UPLOAD_FAILED",
        "ส่งรูปไปยังพื้นที่จัดเก็บไม่สำเร็จ กรุณาเลือกไฟล์เดิมเพื่อลองใหม่",
      );
    }
    if (response.url) providerUrl(response.url);
    if (!response.ok) {
      throw new ImageUploadError(
        "PROVIDER_UPLOAD_FAILED",
        "พื้นที่จัดเก็บปฏิเสธรูปนี้ กรุณาตรวจสอบชนิดและขนาดไฟล์",
      );
    }
    let evidence: { public_id?: unknown; version?: unknown; signature?: unknown };
    try {
      evidence = await response.json();
    } catch {
      throw new ImageUploadError("UPLOAD_EVIDENCE_INVALID", "ระบบตรวจสอบผลอัปโหลดไม่ได้");
    }
    if (
      typeof evidence.public_id !== "string" ||
      evidence.public_id !== fields.public_id ||
      typeof evidence.version !== "number" ||
      !Number.isInteger(evidence.version) ||
      typeof evidence.signature !== "string"
    ) {
      throw new ImageUploadError("UPLOAD_EVIDENCE_INVALID", "ระบบตรวจสอบผลอัปโหลดไม่ได้");
    }
    return {
      publicId: evidence.public_id,
      version: evidence.version,
      signature: evidence.signature,
    };
  } finally {
    bounded.dispose();
  }
}

export async function uploadAndVerifyImage(
  file: File,
  purpose: ImagePurpose,
  targetId: string | undefined,
  options: {
    api?: ImageApi;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    onStage?: (stage: ImageUploadStage) => void;
  } = {},
): Promise<VerifiedImageUpload> {
  const source = validateImageSource(file);
  const api = options.api ?? apiClient;
  const fetchImpl = options.fetchImpl ?? fetch;
  const request = {
    purpose,
    sourceContentType: source.contentType,
    sourceSizeBytes: file.size,
    ...(targetId ? { targetId } : {}),
  };
  const { data: intent } = await withBoundedApiRequest(options.signal, (signal) =>
    api.post<ImageUploadIntent>("/images/uploads", request, { signal }),
  );
  if (
    intent.purpose !== purpose ||
    !intent.uploadId ||
    !intent.uploadInstructions?.url ||
    !Array.isArray(intent.acceptedSourceMimeTypes) ||
    !intent.acceptedSourceMimeTypes.includes(source.contentType)
  ) {
    throw new ImageUploadError("UPLOAD_INTENT_INVALID", "ระบบอนุญาตชนิดไฟล์นี้ไม่ได้");
  }

  const evidence = await uploadToProvider(file, intent, options.signal, fetchImpl);
  options.onStage?.("verifying");
  const { data: completion } = await withBoundedApiRequest(options.signal, (signal) =>
    api.post<{
    status: string;
    attachmentExpiresAt?: string | null;
    }>(`/images/uploads/${encodeURIComponent(intent.uploadId)}/complete`, evidence, { signal }),
  );
  if (completion.status !== "VERIFIED_PENDING") {
    throw new ImageUploadError("UPLOAD_NOT_VERIFIED", "ระบบยังตรวจสอบรูปไม่ผ่าน จึงยังบันทึกรูปนี้ไม่ได้");
  }

  const { data: preview } = await withBoundedApiRequest(options.signal, (signal) =>
    api.get<{
    purpose: ImagePurpose;
    status: string;
    url?: string | null;
    expiresAt?: string | null;
    }>(`/images/uploads/${encodeURIComponent(intent.uploadId)}/preview`, {
      headers: { "Cache-Control": "no-store" },
      signal,
    }),
  );
  if (preview.purpose !== purpose || preview.status !== "VERIFIED_PENDING") {
    throw new ImageUploadError("UPLOAD_PREVIEW_NOT_AVAILABLE", "โหลดตัวอย่างรูปที่ตรวจสอบแล้วไม่ได้");
  }

  let previewUrl: string | null = null;
  let previewBlob: Blob | null = null;
  if (purpose === "EMPLOYEE_PHOTO") {
    previewBlob = await fetchEmployeePhotoBlobFromGrant(
      { hasEmployeePhoto: true, url: preview.url ?? null, expiresAt: preview.expiresAt ?? null },
      { signal: options.signal, fetchImpl },
    );
    if (!previewBlob) throw new ImageUploadError("UPLOAD_PREVIEW_NOT_AVAILABLE", "โหลดตัวอย่างรูปที่ตรวจสอบแล้วไม่ได้");
  } else {
    previewUrl = providerUrl(preview.url);
  }

  return {
    uploadId: intent.uploadId,
    purpose,
    creationContextToken: intent.creationContextToken ?? null,
    attachmentExpiresAt: completion.attachmentExpiresAt ?? null,
    previewUrl,
    previewBlob,
    sourceFileName: file.name,
  };
}

export function buildImageAttachmentFields<T extends Record<string, unknown>>(
  payload: T,
  upload: Pick<VerifiedImageUpload, "uploadId" | "creationContextToken"> | null,
  creating: boolean,
): Record<string, unknown> {
  const { imageUrl: _legacyImageUrl, ...metadata } = payload;
  if (!upload) return metadata;
  if (!upload.uploadId) {
    throw new ImageUploadError("UPLOAD_NOT_VERIFIED", "รูปยังไม่พร้อมบันทึก");
  }
  if (creating && !upload.creationContextToken) {
    throw new ImageUploadError("UPLOAD_CREATION_CONTEXT_MISSING", "รูปนี้ไม่พร้อมแนบกับรายการใหม่ กรุณาเลือกไฟล์อีกครั้ง");
  }
  return {
    ...metadata,
    imageUploadId: upload.uploadId,
    ...(creating ? { imageCreationContextToken: upload.creationContextToken } : {}),
  };
}

export class ImageSaveOutcomeUnknownError extends Error {
  readonly code = "IMAGE_SAVE_OUTCOME_UNKNOWN";

  constructor() {
    super("ผลการบันทึกรูปยังยืนยันไม่ได้ กรุณาอย่าปิดฟอร์มและลองตรวจสอบอีกครั้ง");
    this.name = "ImageSaveOutcomeUnknownError";
  }
}

export function imageOperationErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { code?: string; message?: unknown } } })
    ?.response?.data;
  const errorCode = (error as { code?: string })?.code;
  switch (data?.code ?? errorCode) {
    case "UPLOAD_EXPIRED":
    case "UPLOAD_NOT_FOUND":
    case "UPLOAD_OBJECT_NOT_FOUND":
      return "รูปที่อัปโหลดหมดอายุหรือใช้ไม่ได้แล้ว กรุณาเลือกและอัปโหลดรูปใหม่";
    case "SOURCE_SIZE_LIMIT":
      return "ไฟล์รูปมีขนาดเกิน 10 MB กรุณาเลือกไฟล์ที่เล็กลง";
    case "SOURCE_TYPE_NOT_ALLOWED":
      return `รองรับไฟล์ ${IMAGE_SOURCE_FORMAT_LABEL} เท่านั้น`;
    case "IMAGE_SAVE_OUTCOME_UNKNOWN":
      return "ผลการบันทึกยังยืนยันไม่ได้ เก็บข้อมูลในฟอร์มไว้แล้ว กรุณาตรวจสอบรายการก่อนส่งซ้ำ";
  }
  if (errorCode === "IMAGE_SAVE_OUTCOME_UNKNOWN") {
    return "ผลการบันทึกยังยืนยันไม่ได้ เก็บข้อมูลในฟอร์มไว้แล้ว กรุณาตรวจสอบรายการก่อนส่งซ้ำ";
  }
  if (Array.isArray(data?.message)) {
    return data.message.filter((item): item is string => typeof item === "string").join(", ") || fallback;
  }
  if (typeof data?.message === "string") return data.message;
  if (error instanceof ImageUploadError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function hasAmbiguousOutcome(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === undefined || status >= 500;
}

async function readUploadOutcome(
  api: ImageApi,
  uploadId: string,
): Promise<{ status?: string; claimedTargetId?: string | null }> {
  const { data } = await withBoundedApiRequest(undefined, (signal) =>
    api.get<{ status?: string; claimedTargetId?: string | null }>(
      `/images/uploads/${encodeURIComponent(uploadId)}`,
      {
        headers: { "Cache-Control": "no-store" },
        signal,
      },
    ),
  );
  return data;
}

export async function saveWithImageRecovery<T>(options: {
  uploadId: string;
  save: () => Promise<T>;
  loadRecord: (id: string) => Promise<T | null>;
  api?: ImageApi;
  recoverBeforeSave?: boolean;
}): Promise<T> {
  const api = options.api ?? apiClient;
  const loadClaimed = async (status: { status?: string; claimedTargetId?: string | null }): Promise<T | null> => {
    if (
      !["CLAIMED", "SUPERSEDED"].includes(status.status ?? "") ||
      !status.claimedTargetId
    ) return null;
    return options.loadRecord(status.claimedTargetId);
  };
  const recover = async (): Promise<T> => {
    let outcome: { status?: string; claimedTargetId?: string | null };
    try {
      outcome = await readUploadOutcome(api, options.uploadId);
    } catch (error) {
      if ((error as { response?: { data?: { code?: string } } })?.response?.data?.code === "UPLOAD_NOT_FOUND") throw error;
      throw new ImageSaveOutcomeUnknownError();
    }
    let recovered: T | null;
    try {
      recovered = await loadClaimed(outcome);
    } catch {
      throw new ImageSaveOutcomeUnknownError();
    }
    if (recovered) return recovered;
    if (outcome.status === "EXPIRED" || outcome.status === "REJECTED") {
      throw new ImageUploadError("UPLOAD_EXPIRED", "รูปที่อัปโหลดหมดอายุหรือใช้ไม่ได้แล้ว กรุณาเลือกรูปใหม่");
    }
    if (outcome.status !== "VERIFIED_PENDING") throw new ImageSaveOutcomeUnknownError();
    try {
      return await options.save();
    } catch (retryError) {
      if (!hasAmbiguousOutcome(retryError)) throw retryError;
      try {
        const latest = await readUploadOutcome(api, options.uploadId);
        const latestRecord = await loadClaimed(latest);
        if (latestRecord) return latestRecord;
      } catch {
        // The original form state remains available for a deliberate retry.
      }
      throw new ImageSaveOutcomeUnknownError();
    }
  };

  if (options.recoverBeforeSave) return recover();
  try {
    return await options.save();
  } catch (error) {
    if (!hasAmbiguousOutcome(error)) throw error;
    return recover();
  }
}

export interface ImageFormSaveOptions<T> {
  creating: boolean;
  targetId?: string;
  payload: Record<string, unknown>;
  upload: Pick<VerifiedImageUpload, "uploadId" | "creationContextToken"> | null;
  create: (payload: Record<string, unknown>) => Promise<T>;
  update: (id: string, payload: Record<string, unknown>) => Promise<T>;
  loadRecord: (id: string) => Promise<T | null>;
  api?: ImageApi;
  recoverBeforeSave?: boolean;
}

export interface ImageFormSaveAttempt<T> {
  readonly hasUpload: boolean;
  readonly save: () => Promise<T>;
  readonly recover: () => Promise<T>;
}

export function createImageSaveAttempt<T>(options: ImageFormSaveOptions<T>): ImageFormSaveAttempt<T> {
  // Keep one exact request in memory while its commit outcome is uncertain.
  const snapshot: ImageFormSaveOptions<T> = {
    ...options,
    payload: structuredClone(options.payload),
    upload: options.upload ? { ...options.upload } : null,
  };
  return {
    hasUpload: snapshot.upload !== null,
    save: () => saveImageAwareForm(snapshot),
    recover: () => saveImageAwareForm({ ...snapshot, recoverBeforeSave: true }),
  };
}

export async function saveImageAwareForm<T>(options: ImageFormSaveOptions<T>): Promise<T> {
  if (!options.creating && !options.targetId) {
    throw new Error("ไม่พบรายการที่ต้องการแก้ไข กรุณาปิดและเปิดฟอร์มอีกครั้ง");
  }
  const payload = buildImageAttachmentFields(
    options.payload,
    options.upload,
    options.creating,
  );
  const save = () => options.creating
    ? options.create(payload)
    : options.update(options.targetId!, payload);

  if (options.upload) {
    return saveWithImageRecovery({
        uploadId: options.upload.uploadId,
        save,
        loadRecord: options.loadRecord,
        api: options.api,
        recoverBeforeSave: options.recoverBeforeSave,
      });
  }
  if (options.recoverBeforeSave) throw new ImageSaveOutcomeUnknownError();
  try {
    return await save();
  } catch (error) {
    if (hasAmbiguousOutcome(error)) throw new ImageSaveOutcomeUnknownError();
    throw error;
  }
}
