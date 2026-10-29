import { createHash } from 'node:crypto';
import type { Pool } from 'pg';

export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 5 * 60;
export const VERIFICATION_RESEND_MAX_PER_HOUR = 3;

interface ResendRule {
  key: string;
  windowSeconds: number;
  maxRequests: number;
  cooldownSeconds: number;
}

export function verificationResendWaitSeconds(
  requestTimes: readonly Date[],
  now: Date,
  rule = {
    windowSeconds: 3600,
    maxRequests: VERIFICATION_RESEND_MAX_PER_HOUR,
    cooldownSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS,
  },
): number {
  const recent = requestTimes
    .map((date) => date.getTime())
    .filter((time) => time > now.getTime() - rule.windowSeconds * 1000)
    .sort((a, b) => a - b);
  const cooldownUntil = recent.length
    ? recent[recent.length - 1] + rule.cooldownSeconds * 1000
    : 0;
  const quotaUntil =
    recent.length >= rule.maxRequests
      ? recent[recent.length - rule.maxRequests] + rule.windowSeconds * 1000
      : 0;
  return Math.max(
    0,
    Math.ceil((Math.max(cooldownUntil, quotaUntil) - now.getTime()) / 1000),
  );
}

// Shared by the HTTP and internal Better Auth resend entry points. Initial
// sign-up mail never calls this policy. Accepted resend attempts consume quota,
// including a later SMTP failure, so mail outages cannot cause retry storms.
export async function reserveVerificationEmailResend(
  pool: Pick<Pool, 'connect'>,
  email: string,
  clientIp: string,
): Promise<number> {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    // Autocommit cleanup avoids holding unrelated row locks while acquiring the
    // per-key advisory locks below. Expiry keeps IP and unknown-account traffic bounded.
    await client.query(
      'DELETE FROM email_verification_resend_limits WHERE expires_at <= CURRENT_TIMESTAMP',
    );
    await client.query('BEGIN');
    inTransaction = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    const users = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = $1 AND "emailVerified" = false AND deleted_at IS NULL',
      [email.trim().toLowerCase()],
    );
    const ipHash = createHash('sha256').update(clientIp).digest('hex');
    const rules: ResendRule[] = [
      {
        key: `ip:${ipHash}`,
        windowSeconds: 60,
        maxRequests: 60,
        cooldownSeconds: 0,
      },
    ];
    if (users.rows[0]) {
      rules.push({
        key: `account:${users.rows[0].id}`,
        windowSeconds: 3600,
        maxRequests: VERIFICATION_RESEND_MAX_PER_HOUR,
        cooldownSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS,
      });
    }
    rules.sort((a, b) => a.key.localeCompare(b.key));
    for (const rule of rules) {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [rule.key],
      );
    }
    const clock = await client.query<{ now: Date }>(
      'SELECT clock_timestamp() AS now',
    );
    const now = clock.rows[0].now;
    const histories: Array<{ rule: ResendRule; recent: Date[]; wait: number }> =
      [];
    let waitSeconds = 0;
    for (const rule of rules) {
      const result = await client.query<{ request_times: Date[] }>(
        'SELECT request_times FROM email_verification_resend_limits WHERE key = $1',
        [rule.key],
      );
      const recent = (result.rows[0]?.request_times ?? []).filter(
        (date) => date.getTime() > now.getTime() - rule.windowSeconds * 1000,
      );
      const wait = verificationResendWaitSeconds(recent, now, rule);
      waitSeconds = Math.max(waitSeconds, wait);
      histories.push({ rule, recent, wait });
    }
    for (const { rule, recent, wait } of histories) {
      // Count rejected account requests toward the IP budget as well, while
      // consuming the account's hourly quota only when the resend is accepted.
      if (waitSeconds === 0 || (rule.key.startsWith('ip:') && wait === 0)) {
        await client.query(
          `INSERT INTO email_verification_resend_limits (key, request_times, expires_at)
           VALUES ($1, $2::timestamptz[], $3)
           ON CONFLICT (key) DO UPDATE
           SET request_times = EXCLUDED.request_times, expires_at = EXCLUDED.expires_at`,
          [
            rule.key,
            [...recent, now],
            new Date(now.getTime() + rule.windowSeconds * 1000),
          ],
        );
      }
    }
    await client.query('COMMIT');
    inTransaction = false;
    return waitSeconds;
  } catch (error) {
    if (inTransaction) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
