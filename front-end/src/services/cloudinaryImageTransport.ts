import { ImageUploadError } from './imageUploadError';

export interface CloudinarySignedFormTransport {
  readonly kind: 'multipart-form-v1';
  readonly endpoint: string;
  readonly method: 'POST';
  readonly fields: Readonly<Record<string, string>>;
  readonly expiresAt: string;
}

export function cloudinaryUrl(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ImageUploadError('IMAGE_URL_INVALID', 'ที่อยู่รูปจากระบบไม่ถูกต้อง');
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ImageUploadError('IMAGE_URL_INVALID', 'ที่อยู่รูปจากระบบไม่ถูกต้อง');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.port !== '' ||
    parsed.hash !== '' ||
    !['api.cloudinary.com', 'res.cloudinary.com'].includes(parsed.hostname)
  ) {
    throw new ImageUploadError('IMAGE_URL_NOT_ALLOWED', 'ระบบส่งที่อยู่รูปที่ไม่อนุญาตมาให้');
  }
  return parsed.toString();
}

export function cloudinaryUploadTransport(
  instructions: {
    readonly transport?: CloudinarySignedFormTransport;
    readonly url: string;
    readonly method: string;
    readonly fields: Readonly<Record<string, string>>;
  },
): CloudinarySignedFormTransport {
  const transport = instructions.transport ?? {
    kind: 'multipart-form-v1' as const,
    endpoint: instructions.url,
    method: instructions.method as 'POST',
    fields: instructions.fields,
    expiresAt: '',
  };
  if (transport.kind !== 'multipart-form-v1' || transport.method !== 'POST') {
    throw new ImageUploadError('UPLOAD_INSTRUCTIONS_INVALID', 'คำสั่งอัปโหลดรูปไม่ถูกต้อง');
  }
  cloudinaryUrl(transport.endpoint);
  if (
    !transport.fields ||
    typeof transport.fields !== 'object' ||
    Object.values(transport.fields).some((value) => typeof value !== 'string')
  ) {
    throw new ImageUploadError('UPLOAD_INSTRUCTIONS_INVALID', 'คำสั่งอัปโหลดรูปไม่ถูกต้อง');
  }
  return transport;
}

export async function uploadToCloudinary(
  file: File,
  transport: CloudinarySignedFormTransport,
  options: {
    readonly signal?: AbortSignal;
    readonly fetchImpl: typeof fetch;
  },
): Promise<{
  readonly proof: Readonly<Record<string, unknown>>;
  readonly legacyEvidence: { readonly publicId: string; readonly version: number; readonly signature: string };
}> {
  const endpoint = cloudinaryUrl(transport.endpoint);
  const formData = new FormData();
  Object.entries(transport.fields).forEach(([name, value]) => formData.append(name, value));
  formData.append('file', file, file.name);

  const controller = new AbortController();
  const abortParent = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortParent();
  else options.signal?.addEventListener('abort', abortParent, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Image request timed out', 'TimeoutError')),
    60_000,
  );
  try {
    let response: Response;
    try {
      response = await options.fetchImpl(endpoint, {
        method: transport.method,
        body: formData,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new ImageUploadError(
        'PROVIDER_UPLOAD_FAILED',
        'ส่งรูปไปยังพื้นที่จัดเก็บไม่สำเร็จ กรุณาเลือกไฟล์เดิมเพื่อลองใหม่',
      );
    }
    if (response.url) cloudinaryUrl(response.url);
    if (!response.ok) {
      throw new ImageUploadError(
        'PROVIDER_UPLOAD_FAILED',
        'พื้นที่จัดเก็บปฏิเสธรูปนี้ กรุณาตรวจสอบชนิดและขนาดไฟล์',
      );
    }
    let proof: unknown;
    try {
      proof = await response.json();
    } catch {
      throw new ImageUploadError('UPLOAD_EVIDENCE_INVALID', 'ระบบตรวจสอบผลอัปโหลดไม่ได้');
    }
    if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
      throw new ImageUploadError('UPLOAD_EVIDENCE_INVALID', 'ระบบตรวจสอบผลอัปโหลดไม่ได้');
    }
    const evidence = proof as Readonly<Record<string, unknown>>;
    const publicId = evidence.public_id;
    const version = evidence.version;
    const signature = evidence.signature;
    if (
      typeof publicId !== 'string' ||
      publicId !== transport.fields.public_id ||
      typeof version !== 'number' ||
      !Number.isInteger(version) ||
      typeof signature !== 'string'
    ) {
      throw new ImageUploadError('UPLOAD_EVIDENCE_INVALID', 'ระบบตรวจสอบผลอัปโหลดไม่ได้');
    }
    return {
      proof: evidence,
      legacyEvidence: { publicId, version, signature },
    };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortParent);
  }
}
