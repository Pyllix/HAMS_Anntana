import { ImageUploadError } from "./imageUploadError";

function currentOrigin(): string | undefined {
  return typeof window === "undefined" ? undefined : window.location.origin;
}

function resolveImageUrl(value: unknown, applicationOrigin = currentOrigin()): URL {
  if (typeof value !== "string") {
    throw new ImageUploadError("IMAGE_URL_INVALID", "ที่อยู่รูปจากระบบไม่ถูกต้อง");
  }
  try {
    if (value.startsWith("/") && !value.startsWith("//")) {
      if (!applicationOrigin) throw new Error("Application origin is unavailable");
      return new URL(value, applicationOrigin);
    }
    return new URL(value);
  } catch {
    throw new ImageUploadError("IMAGE_URL_INVALID", "ที่อยู่รูปจากระบบไม่ถูกต้อง");
  }
}

function hasAllowedAddress(parsed: URL, applicationOrigin = currentOrigin()): boolean {
  const sameOrigin = parsed.origin === applicationOrigin;
  const knownProvider =
    parsed.hostname === "api.cloudinary.com" ||
    parsed.hostname === "res.cloudinary.com";
  const isLocalHttp =
    sameOrigin &&
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  return (
    (sameOrigin || knownProvider) &&
    (parsed.protocol === "https:" || isLocalHttp) &&
    parsed.username === "" &&
    parsed.password === "" &&
    (parsed.port === "" || sameOrigin) &&
    parsed.hash === ""
  );
}

function rejectDisallowedImageUrl(): never {
  throw new ImageUploadError("IMAGE_URL_NOT_ALLOWED", "ระบบส่งที่อยู่รูปที่ไม่อนุญาตมาให้");
}

export function allowedImageUrl(value: unknown, applicationOrigin = currentOrigin()): string {
  const parsed = resolveImageUrl(value, applicationOrigin);
  if (!hasAllowedAddress(parsed, applicationOrigin)) rejectDisallowedImageUrl();
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
  if (
    !(isCloudinaryUpload || isSameOrigin) ||
    !hasAllowedAddress(parsed, applicationOrigin)
  ) {
    rejectDisallowedImageUrl();
  }
  return parsed.toString();
}
