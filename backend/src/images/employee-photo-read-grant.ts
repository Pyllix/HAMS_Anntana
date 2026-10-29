import { EMPLOYEE_PHOTO_PUBLIC_ID_PATTERN } from './image-identities';

export const EMPLOYEE_PHOTO_VERSION_PATH_PATTERN = /^v([1-9]\d*)\.jpg$/;
export const EMPLOYEE_PHOTO_EXPIRY_PATTERN = /^\d{1,12}$/;
export const EMPLOYEE_PHOTO_SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface EmployeePhotoReadGrantFields {
  readonly publicId: string;
  readonly version: number;
  readonly expiresAtSeconds: number;
  readonly signature: string;
}

export function buildEmployeePhotoReadGrantUrl(
  grant: EmployeePhotoReadGrantFields,
): string {
  return (
    `/api/images/employees/${encodeURIComponent(grant.publicId)}` +
    `/v${grant.version}.jpg?expiresAt=${grant.expiresAtSeconds}` +
    `&signature=${grant.signature}`
  );
}

export function parseEmployeePhotoReadGrantUrl(
  url: string,
): EmployeePhotoReadGrantFields | null {
  if (!url.startsWith('/') || url.startsWith('//')) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url, 'https://hams.invalid');
  } catch {
    return null;
  }
  if (parsedUrl.origin !== 'https://hams.invalid' || parsedUrl.hash) {
    return null;
  }

  const pathSegments = parsedUrl.pathname.split('/');
  if (
    pathSegments.length !== 6 ||
    pathSegments[1] !== 'api' ||
    pathSegments[2] !== 'images' ||
    pathSegments[3] !== 'employees'
  ) {
    return null;
  }

  let publicId: string;
  try {
    publicId = decodeURIComponent(pathSegments[4]);
  } catch {
    return null;
  }
  if (!EMPLOYEE_PHOTO_PUBLIC_ID_PATTERN.test(publicId)) return null;

  const versionMatch = EMPLOYEE_PHOTO_VERSION_PATH_PATTERN.exec(
    pathSegments[5],
  );
  if (!versionMatch) return null;
  const version = Number(versionMatch[1]);
  if (!Number.isSafeInteger(version)) return null;

  const queryEntries = [...parsedUrl.searchParams.entries()];
  const expiryValues = parsedUrl.searchParams.getAll('expiresAt');
  const signatureValues = parsedUrl.searchParams.getAll('signature');
  if (
    queryEntries.length !== 2 ||
    expiryValues.length !== 1 ||
    signatureValues.length !== 1 ||
    !EMPLOYEE_PHOTO_EXPIRY_PATTERN.test(expiryValues[0]) ||
    !EMPLOYEE_PHOTO_SIGNATURE_PATTERN.test(signatureValues[0])
  ) {
    return null;
  }

  const expiresAtSeconds = Number(expiryValues[0]);
  if (!Number.isSafeInteger(expiresAtSeconds)) return null;

  return {
    publicId,
    version,
    expiresAtSeconds,
    signature: signatureValues[0],
  };
}
