export type PreAuthStep = "ENROLLMENT" | "TOTP";

export function routeForPreAuthStep(step: PreAuthStep): string {
  return step === "ENROLLMENT" ? "/2fa/enroll" : "/2fa/verify";
}
