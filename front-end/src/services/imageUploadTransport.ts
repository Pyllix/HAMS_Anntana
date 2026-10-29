import { uploadToLegacyCloudinary } from "./cloudinaryImageTransport";
import { ImageUploadError } from "./imageUploadError";
import { uploadMultipartFormImage } from "./multipartFormImageTransport";

export interface ImageUploadInstructions {
  readonly transport?: unknown;
  readonly url?: string;
  readonly method?: string;
  readonly fields?: Readonly<Record<string, string>>;
  readonly expiresAt?: string;
}

export async function uploadImageWithInstructions(
  file: File,
  instructions: ImageUploadInstructions,
  options: {
    readonly signal?: AbortSignal;
    readonly fetchImpl: typeof fetch;
  },
): Promise<Readonly<Record<string, unknown>>> {
  if (instructions.transport !== undefined) {
    const proof = await uploadMultipartFormImage(
      file,
      instructions.transport,
      options,
    );
    return { proof };
  }

  if (
    !instructions.url ||
    !instructions.method ||
    !instructions.fields ||
    !instructions.expiresAt
  ) {
    throw new ImageUploadError(
      "UPLOAD_INSTRUCTIONS_INVALID",
      "คำสั่งอัปโหลดรูปไม่ถูกต้อง",
    );
  }
  const evidence = await uploadToLegacyCloudinary(
    file,
    {
      url: instructions.url,
      method: instructions.method,
      fields: instructions.fields,
      expiresAt: instructions.expiresAt,
    },
    options,
  );
  return evidence;
}
