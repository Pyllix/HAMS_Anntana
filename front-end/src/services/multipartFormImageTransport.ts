import { ImageUploadError } from "./imageUploadError";
import { allowedImageUploadEndpoint } from "./imageUrlPolicy";

export interface MultipartFormImageTransport {
  readonly kind: "multipart-form-v1";
  readonly endpoint: string;
  readonly method: "POST";
  readonly fields: Readonly<Record<string, string>>;
  readonly expiresAt: string;
}

export function validateMultipartFormImageTransport(
  value: unknown,
): MultipartFormImageTransport {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ImageUploadError(
      "UPLOAD_INSTRUCTIONS_INVALID",
      "คำสั่งอัปโหลดรูปไม่ถูกต้อง",
    );
  }
  const transport = value as Partial<MultipartFormImageTransport>;
  if (
    transport.kind !== "multipart-form-v1" ||
    transport.method !== "POST" ||
    typeof transport.endpoint !== "string" ||
    !transport.fields ||
    typeof transport.fields !== "object" ||
    Array.isArray(transport.fields) ||
    Object.values(transport.fields).some(
      (field) => typeof field !== "string",
    ) ||
    typeof transport.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(transport.expiresAt))
  ) {
    throw new ImageUploadError(
      "UPLOAD_INSTRUCTIONS_INVALID",
      "คำสั่งอัปโหลดรูปไม่ถูกต้อง",
    );
  }
  allowedImageUploadEndpoint(transport.endpoint);
  return transport as MultipartFormImageTransport;
}

export async function uploadMultipartFormImage(
  file: File,
  transportValue: unknown,
  options: {
    readonly signal?: AbortSignal;
    readonly fetchImpl: typeof fetch;
  },
): Promise<Readonly<Record<string, unknown>>> {
  const transport = validateMultipartFormImageTransport(transportValue);
  const endpoint = allowedImageUploadEndpoint(transport.endpoint);
  const formData = new FormData();
  Object.entries(transport.fields).forEach(([name, value]) =>
    formData.append(name, value),
  );
  formData.append("file", file, file.name);

  const controller = new AbortController();
  const abortParent = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortParent();
  else options.signal?.addEventListener("abort", abortParent, { once: true });
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException("Image request timed out", "TimeoutError"),
      ),
    60_000,
  );
  try {
    let response: Response;
    try {
      response = await options.fetchImpl(endpoint, {
        method: transport.method,
        body: formData,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new ImageUploadError(
        "PROVIDER_UPLOAD_FAILED",
        "ส่งรูปไปยังพื้นที่จัดเก็บไม่สำเร็จ กรุณาเลือกไฟล์เดิมเพื่อลองใหม่",
      );
    }
    if (response.url) allowedImageUploadEndpoint(response.url);
    if (!response.ok) {
      throw new ImageUploadError(
        "PROVIDER_UPLOAD_FAILED",
        "พื้นที่จัดเก็บปฏิเสธรูปนี้ กรุณาตรวจสอบชนิดและขนาดไฟล์",
      );
    }
    let proof: unknown;
    try {
      proof = await response.json();
    } catch {
      throw new ImageUploadError(
        "UPLOAD_EVIDENCE_INVALID",
        "ระบบตรวจสอบผลอัปโหลดไม่ได้",
      );
    }
    if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
      throw new ImageUploadError(
        "UPLOAD_EVIDENCE_INVALID",
        "ระบบตรวจสอบผลอัปโหลดไม่ได้",
      );
    }
    return proof as Readonly<Record<string, unknown>>;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortParent);
  }
}
