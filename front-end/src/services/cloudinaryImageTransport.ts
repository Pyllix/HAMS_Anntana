import { ImageUploadError } from "./imageUploadError";
import { allowedImageUploadEndpoint } from "./imageUrlPolicy";
import {
  uploadMultipartFormImage,
  type MultipartFormImageTransport,
} from "./multipartFormImageTransport";

export interface LegacyCloudinaryUploadInstructions {
  readonly url: string;
  readonly method: string;
  readonly fields: Readonly<Record<string, string>>;
}

export function legacyCloudinaryTransport(
  instructions: LegacyCloudinaryUploadInstructions,
): MultipartFormImageTransport {
  if (instructions.method !== "POST") {
    throw new ImageUploadError(
      "UPLOAD_INSTRUCTIONS_INVALID",
      "คำสั่งอัปโหลดรูปไม่ถูกต้อง",
    );
  }
  const endpoint = allowedImageUploadEndpoint(instructions.url);
  const parsed = new URL(endpoint);
  if (
    parsed.hostname !== "api.cloudinary.com" ||
    !/^\/v1_1\/[^/]+\/image\/upload$/.test(parsed.pathname) ||
    !instructions.fields ||
    typeof instructions.fields !== "object" ||
    Object.values(instructions.fields).some(
      (value) => typeof value !== "string",
    )
  ) {
    throw new ImageUploadError(
      "UPLOAD_INSTRUCTIONS_INVALID",
      "คำสั่งอัปโหลดรูปไม่ถูกต้อง",
    );
  }
  return {
    kind: "multipart-form-v1",
    endpoint,
    method: "POST",
    fields: instructions.fields,
    expiresAt: "",
  };
}

export async function uploadToLegacyCloudinary(
  file: File,
  instructions: LegacyCloudinaryUploadInstructions,
  options: {
    readonly signal?: AbortSignal;
    readonly fetchImpl: typeof fetch;
  },
): Promise<{
  readonly publicId: string;
  readonly version: number;
  readonly signature: string;
}> {
  const transport = legacyCloudinaryTransport(instructions);
  const proof = await uploadMultipartFormImage(file, transport, options);
  const publicId = proof.public_id;
  const version = proof.version;
  const signature = proof.signature;
  if (
    typeof publicId !== "string" ||
    publicId !== transport.fields.public_id ||
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    typeof signature !== "string"
  ) {
    throw new ImageUploadError(
      "UPLOAD_EVIDENCE_INVALID",
      "ระบบตรวจสอบผลอัปโหลดไม่ได้",
    );
  }
  return { publicId, version, signature };
}
