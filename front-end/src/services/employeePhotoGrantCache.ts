export interface EmployeePhotoGrant {
  hasEmployeePhoto?: boolean;
  url: string | null;
  expiresAt: string | null;
  photoRevision?: string | null;
}

export interface EmployeePhotoIdentity {
  accountId: string;
  userId: string;
  photoRevision: string;
}

interface CachedEmployeePhotoGrant {
  accountId: string;
  userId: string;
  photoRevision: string;
  grant: EmployeePhotoGrant;
  expiresAt: number;
}

const employeePhotoGrantCache = new Map<string, CachedEmployeePhotoGrant>();

function employeePhotoGrantKey(identity: EmployeePhotoIdentity): string {
  return JSON.stringify([
    identity.accountId,
    identity.userId,
    identity.photoRevision,
  ]);
}

export function pruneExpiredEmployeePhotoGrants(now: number): void {
  for (const [key, entry] of employeePhotoGrantCache) {
    if (entry.expiresAt <= now) employeePhotoGrantCache.delete(key);
  }
}

export function getCachedEmployeePhotoGrant(
  identity: EmployeePhotoIdentity,
): EmployeePhotoGrant | undefined {
  return employeePhotoGrantCache.get(employeePhotoGrantKey(identity))?.grant;
}

export function cacheEmployeePhotoGrant(
  identity: EmployeePhotoIdentity,
  grant: EmployeePhotoGrant,
  expiresAt: number,
): void {
  for (const [key, entry] of employeePhotoGrantCache) {
    if (
      entry.accountId === identity.accountId &&
      entry.userId === identity.userId &&
      entry.photoRevision !== identity.photoRevision
    ) {
      employeePhotoGrantCache.delete(key);
    }
  }
  employeePhotoGrantCache.set(
    employeePhotoGrantKey(identity),
    { ...identity, grant, expiresAt },
  );
}

export function deleteEmployeePhotoGrant(identity: EmployeePhotoIdentity): void {
  employeePhotoGrantCache.delete(employeePhotoGrantKey(identity));
}

export function clearEmployeePhotoGrantCache(
  accountId?: string | null,
  userId?: string,
): void {
  if (accountId === undefined && userId === undefined) {
    employeePhotoGrantCache.clear();
    return;
  }

  for (const [key, entry] of employeePhotoGrantCache) {
    if (
      (accountId === undefined || entry.accountId === accountId) &&
      (userId === undefined || entry.userId === userId)
    ) {
      employeePhotoGrantCache.delete(key);
    }
  }
}
