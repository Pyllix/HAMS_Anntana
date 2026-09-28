# Backend 2FA and Trusted Browser

This document describes the backend flows for tickets 03–05.

## Mandatory enrollment (ticket 03)

Two-factor authentication is mandatory for `ADMIN`, `PARCEL_STAFF`, and `ASSET_CENTER_STAFF`. Other roles retain the password sign-in flow.

After the password is accepted, a mandatory-role user receives only a 10-minute `hams.pre_auth` HttpOnly cookie. The pending BetterAuth session and its cookie headers are encrypted in `pre_auth_challenges`; the cookie value is stored as a SHA-256 hash. No regular session cookie or session token is returned until enrollment completes.

`PreAuthGuard` permits only the current enrollment or TOTP challenge routes. `MandatoryEnrollmentGuard` runs after BetterAuth authentication and also blocks existing mandatory-role sessions that have not completed enrollment. Business API requests return `ENROLLMENT_REQUIRED` or `TOTP_VERIFICATION_REQUIRED`. `GET /auth/session` revokes a legacy un-enrolled session and reports no session.

Enrollment endpoints:

- `POST /auth/2fa/enable` rechecks the password and returns a `totpURI`; the raw secret is not returned separately.
- `POST /auth/2fa/verify-setup` verifies a 6-digit TOTP and returns 10 one-time `backupCodes`.
- `POST /auth/2fa/acknowledge-recovery-codes` completes enrollment and releases the pending session cookie only after acknowledgement.

Authenticator secrets use AES-256-GCM at rest. Recovery codes use SHA-256 hashes. TOTP accepts the current 30-second step and the previous or next step.

## Recovery and lockout (ticket 04)

`POST /auth/2fa/verify-totp` and `POST /auth/2fa/verify-recovery-code` complete a mandatory-role login challenge. Each recovery code is consumed once. The TOTP row is locked inside a database transaction during verification so two simultaneous attempts cannot both use the same code.

TOTP and recovery-code failures share one counter. Five failures lock verification for 10 minutes and return `TOTP_LOCKED` with a retry time. Successful verification clears the counter. A lock that has expired does not require an administrator to clear it. Lockout logs identify the account but never contain the submitted code.

## Trusted Browser (ticket 05)

A user can opt in with `trustBrowser: true` after a successful TOTP or recovery-code verification. The default is false. The server sets the `better-auth.trust_device` cookie as HttpOnly, SameSite=Lax, and Secure in production. Its expiry is fixed at 14 days from grant time; later sign-ins do not extend it.

The browser cookie is a 256-bit random credential. Only its SHA-256 hash is stored in `trusted_devices`. The user agent is stored as a hash for display metadata and is not used to authorize trust. The credential belongs to one user account. If account B signs in with account A's trust cookie, A's credential is revoked, B receives a TOTP challenge, and B can choose trust after verification.

Trust still requires the account password and only skips TOTP. It does not extend or replace the normal BetterAuth session. Password changes, administrator password resets, role changes, and manual revoke delete trust records. Expired credentials are rejected immediately and removed when used or by the cleanup method.

Authenticated browser-management routes are:

- `GET /auth/trusted-browser/check`
- `GET /auth/trusted-browser/list` (returns browser record IDs, never cookie credentials)
- `POST /auth/trusted-browser/revoke` (send a record ID in the `token` field)
- `POST /auth/trusted-browser/revoke-all`

## Encryption key

Set `TWO_FACTOR_ENCRYPTION_KEY` to a private 32-byte key encoded as 64 hexadecimal characters. Generate a new key for each environment, for example:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not commit the generated value. Rotating it requires re-encrypting stored authenticator secrets and pending pre-auth payloads.

## Database and tests

The schema adds `TwoFactorAuth.enrollmentComplete` and the `PreAuthChallenge` model. Migrations are in `prisma/migrations/20260925_add_two_factor_auth_tables` and `prisma/migrations/20260925_complete_2fa_login_flows`.

Database-free regressions are in `src/auth/auth-gates.spec.ts`, `src/auth/pre-auth.service.unit.spec.ts`, `src/auth/two-factor.service.unit.spec.ts`, and `src/auth/trusted-browser.service.unit.spec.ts`. The controller, 2FA service, trusted-browser service, and HTTP contract specs also run against the disposable PostgreSQL test database.

The auth integration setup requires `TEST_DATABASE_URL` to point to a disposable PostgreSQL database whose name contains `test`. It must not point to a shared or production database. The current historical migration chain has unrelated schema drift (including BetterAuth admin fields and legacy enums); `migrate deploy` alone does not reproduce the current full Prisma schema. The end-to-end verification for tickets 03–05 used a fresh local database synchronized from the current Prisma schema. The migration drift needs a separate review before treating a migration-only database as deployable.

## Self-service security and ADMIN Step-up (ticket 07)

- `POST /auth/2fa/replace-authenticator` requires the signed-in user's current password and TOTP. It stores a newly generated secret as an encrypted pending secret and returns its `totpURI` only to that same session.
- `POST /auth/2fa/verify-authenticator-replacement` activates the pending authenticator only after a valid code from it. Until then, the existing authenticator remains active.
- `POST /auth/2fa/regenerate-recovery-codes` requires the current TOTP, atomically replaces all recovery-code hashes, and returns the new plaintext codes once. The response is marked `Cache-Control: no-store`.
- No endpoint disables 2FA. The mandatory roles remain behind the enrollment gate, including after a password change.
- `POST /auth/step-up/totp` is ADMIN-only and requires a fresh TOTP even when the current Browser is trusted. The resulting five-minute grant is attached to the current server Session. Session deletion cascades to the grant; password and 2FA changes clear all of that account's grants. ADMIN-only operations can inject `AdminStepUpService` and call `requireActive(userId, sessionId)`.
- Self-service password change verifies the old password, keeps the current BetterAuth Session, revokes the user's other Sessions and all trusted browsers, clears the current trusted-browser cookie, and clears ADMIN Step-up grants.

The migration `20260926_add_self_service_security` adds the encrypted pending-secret column and Session-bound ADMIN Step-up storage. Prisma schema validation and the backend build passed after this change; tests were not run.
