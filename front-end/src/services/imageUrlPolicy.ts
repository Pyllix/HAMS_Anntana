import { ImageUploadError } from "./imageUploadError";

function currentOrigin(): string | undefined {
  return typeof window === "undefined" ? undefined : window.location.origin;
}

function resolveImageUrl(
  value: unknown,
  applicationOrigin = currentOrigin(),
): URL {
  if (typeof value !== "string") {
    throw new ImageUploadError(
      "IMAGE_URL_INVALID",
      "ที่อยู่รูปจากระบบไม่ถูกต้อง",
    );
  }
  try {
    if (value.startsWith("/") && !value.startsWith("//")) {
      if (!applicationOrigin)
        throw new Error("Application origin is unavailable");
      return new URL(value, applicationOrigin);
    }
    return new URL(value);
  } catch {
    throw new ImageUploadError(
      "IMAGE_URL_INVALID",
      "ที่อยู่รูปจากระบบไม่ถูกต้อง",
    );
  }
}

function hasSafeOrigin(
  parsed: URL,
  applicationOrigin = currentOrigin(),
): boolean {
  return (
    parsed.origin === applicationOrigin ||
    parsed.hostname === "api.cloudinary.com" ||
    parsed.hostname === "res.cloudinary.com"
  );
}

export function allowedImageUrl(
  value: unknown,
  applicationOrigin = currentOrigin(),
): string {
  const parsed = resolveImageUrl(value, applicationOrigin);
  const isLocalHttp =
    parsed.origin === applicationOrigin &&
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (
    !hasSafeOrigin(parsed, applicationOrigin) ||
    (parsed.protocol !== "https:" && !isLocalHttp) ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    (parsed.port !== "" && parsed.origin !== applicationOrigin) ||
    parsed.hash !== ""
  ) {
    throw new ImageUploadError(
      "IMAGE_URL_NOT_ALLOWED",
      "ระบบส่งที่อยู่รูปที่ไม่อนุญาตมาให้",
    );
  }
  return parsed.toString();
}

export function allowedImageUploadEndpoint(
  value: unknown,
  applicationOrigin = currentOrigin(),
): string {
  const parsed = resolveImageUrl(value, applicationOrigin);
  const isCloudinaryUpload =
    parsed.hostname === "api.cloudinary.com" &&
    /^\/v1_1\/[^/]+\/image\/upload$/.test(parsed.pathname);
  const isSameOrigin = parsed.origin === applicationOrigin;
  const isLocalHttp =
    isSameOrigin &&
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (
    !(isCloudinaryUpload || isSameOrigin) ||
    (parsed.protocol !== "https:" && !isLocalHttp) ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    (parsed.port !== "" && parsed.origin !== applicationOrigin) ||
    parsed.hash !== ""
  ) {
    throw new ImageUploadError(
      "IMAGE_URL_NOT_ALLOWED",
      "ระบบส่งที่อยู่รูปที่ไม่อนุญาตมาให้",
    );
  }
  return parsed.toString();
}
