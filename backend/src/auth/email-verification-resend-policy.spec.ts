import { verificationResendWaitSeconds } from './email-verification-resend-policy';

describe('email verification resend policy', () => {
  const now = new Date('2026-10-24T00:00:00.000Z');
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

  it('allows the first resend and a resend exactly five minutes later', () => {
    expect(verificationResendWaitSeconds([], now)).toBe(0);
    expect(verificationResendWaitSeconds([ago(300)], now)).toBe(0);
  });

  it('waits for the remainder of the five-minute cooldown', () => {
    expect(verificationResendWaitSeconds([ago(60)], now)).toBe(240);
  });

  it('blocks a fourth resend even after the five-minute cooldown', () => {
    expect(
      verificationResendWaitSeconds([ago(1800), ago(1200), ago(600)], now),
    ).toBe(1800);
  });

  it('uses a rolling hour and permits another resend when the oldest leaves it', () => {
    expect(
      verificationResendWaitSeconds([ago(3600), ago(1200), ago(600)], now),
    ).toBe(0);
  });

  it('enforces whichever of the cooldown or hourly quota ends later', () => {
    expect(
      verificationResendWaitSeconds([ago(3590), ago(600), ago(60)], now),
    ).toBe(240);
  });

  it('allows a shared IP to request mail for many accounts without the account cooldown', () => {
    const ipRule = { windowSeconds: 60, maxRequests: 60, cooldownSeconds: 0 };
    expect(
      verificationResendWaitSeconds(Array(59).fill(ago(10)), now, ipRule),
    ).toBe(0);
    expect(
      verificationResendWaitSeconds(Array(60).fill(ago(10)), now, ipRule),
    ).toBe(50);
  });
});
