const LEGACY_AUTH_KEYS = ["token", "userId"];

export function clearLegacyBrowserAuthStorage(): void {
  if (typeof window === "undefined") return;

  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[storageName];
      for (const key of LEGACY_AUTH_KEYS) storage.removeItem(key);
    } catch {
      // Browser storage can be unavailable in restricted browsing contexts.
    }
  }
}
