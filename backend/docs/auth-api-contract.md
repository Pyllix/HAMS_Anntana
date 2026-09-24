# Auth API Contract — HAMS

> Version: 2026-09-25  
> Status: **Active — canonical reference for all 2FA and session work**  
> Scope: Backend observable behaviour + Frontend consumption rules.  
> Ticket: [01-be-auth-contract](./../.scratch/two-factor-authentication/issues/01-be-auth-contract.md)

---

## 1 Glossary

| Term | Meaning |
|---|---|
| **Session Cookie** | The `better-auth.session_token` (or equivalent) `Secure; HttpOnly; SameSite` cookie managed by BetterAuth. Never appears in JSON. |
| **CSRF Token** | A per-session CSRF proof required on every state-changing request (`POST`, `PATCH`, `DELETE`). |
| **Enrollment** | The act of binding a TOTP authenticator app and acknowledging Recovery Codes. Until complete, an account in a mandatory-2FA Role is in a constrained **pre-auth** state. |
| **Pre-auth state** | A transient server-side flag (no normal Session Cookie issued). Only the enrollment flow endpoints are reachable; all Business API calls are rejected. |
| **Step-up** | A short-lived (5 min) elevation for the current ADMIN Session, granted by re-entering a fresh TOTP. Allows batch admin operations. |
| **Trusted Browser** | A 14-day absolute-expiry server-side credential tied to `userId` + `browserToken` cookie. Bypasses TOTP at sign-in only; does not extend Session lifetime. |
| **Mandatory-2FA Roles** | `ADMIN`, `PARCEL_STAFF`, `ASSET_CENTER_STAFF` |
| **Non-mandatory Roles** | All others (`DEPARTMENT_STAFF`, `MANAGER`, `MAINTENANCE_STAFF`, …) |

---

## 2 Transport Rules

### 2.1 Cookie

All session credentials are in cookies. The Frontend **must**:

- Send `credentials: 'include'` (fetch) or `withCredentials: true` (axios) on every authenticated request.
- Never read, store, or forward the Session Token via `localStorage`, `sessionStorage`, or `Authorization` header.
- Restore login state by calling `GET /auth/session` on app mount; do not persist state in browser storage.

BetterAuth sets the Session Cookie with:

| Attribute | Value |
|---|---|
| `HttpOnly` | Yes — JavaScript cannot read it |
| `Secure` | Yes — HTTPS only |
| `SameSite` | `Strict` for same-domain; `Lax` for Vercel `/api` proxy (review per deployment) |
| `Domain` | **Not set** (host-only) — do not set a shared parent domain |
| `Max-Age` | Controlled server-side; cookie lifetime >= server Session lifetime |

### 2.2 CSRF Protection

State-changing requests (`POST`, `PATCH`, `PUT`, `DELETE`) require a CSRF proof header:

```
X-CSRF-Token: <token>
```

Obtain the current CSRF token from:

```
GET /auth/csrf
Response 200: { "csrfToken": "<token>" }
```

The token is tied to the current Session. Fetch a fresh token after sign-in. Include it in every mutation until sign-out.

CORS is restricted to exact frontend origins specified in `trustedOrigins`. Cross-origin credentialed requests from unlisted origins are rejected.

Personalized/authenticated responses include `Cache-Control: no-store`. The Vercel `/api` proxy must not cache these responses.

### 2.3 Activity for Session Idle Timer

The Backend session idle timer is refreshed **only** by:
- Requests authenticated via the Session Cookie that carry a deliberate user action header:

```
X-User-Activity: 1
```

Routes that **do not** count as user activity and must omit this header:
- Background polling (notifications, status checks)
- Auto-refresh requests initiated by the system

The Frontend is responsible for adding `X-User-Activity: 1` to requests that originate from genuine user interactions (clicks, form submissions, explicit data loads).

---

## 3 State Machine: Account Authentication States

```
                         +-----------------------------------------+
                         |              UNAUTHENTICATED             |
                         |  (no Session Cookie / cookie expired)   |
                         +------------------+-----------------------+
                                            |
                                            | POST /auth/sign-in (password OK)
                                            v
                    +------Non-mandatory Role?------+
                    | Yes                           | No (mandatory 2FA role)
                    v                               v
         +----------------------+     +------------------------------+
         |   AUTHENTICATED      |     |         PRE-AUTH             |
         |  (full Session)      |     |  (no full Session issued)    |
         |                      |     |  only enrollment endpoints   |
         +----------------------+     |  reachable                   |
                                      +------------+-----------------+
                                                   |
                                                   | TOTP Enrollment + RC ack
                                                   | POST /auth/2fa/enable  &
                                                   | POST /auth/2fa/verify-setup &
                                                   | POST /auth/2fa/acknowledge-recovery-codes
                                                   v
                                      +------------------------------+
                                      |  ENROLLED / TOTP REQUIRED   |
                                      |  (must verify TOTP or        |
                                      |   Recovery Code this session)|
                                      +------------+-----------------+
                                                   |
                                                   | Browser trusted?
                          +-----------+-----------+-----------+
                          | Yes                               | No
                          v                                   v
             +----------------------+       +----------------------------+
             |   AUTHENTICATED      |       |  POST /auth/2fa/verify-   |
             |  (full Session)      |       |  totp  OR                 |
             +----------------------+       |  POST /auth/2fa/verify-   |
                                            |  recovery-code            |
                                            +------------+--------------+
                                                         | verified
                                                         v
                                            +----------------------------+
                                            |   AUTHENTICATED           |
                                            |  (full Session issued)    |
                                            |  Optional: trust browser  |
                                            +----------------------------+
```

---

## 4 Endpoint Reference

### 4.1 Sign-in

```
POST /auth/sign-in
Content-Type: application/json
Body: { "email": string, "password": string }
```

**Responses:**

| HTTP | Body | Meaning |
|---|---|---|
| `200` | `{ "requiresTwoFactor": false, "user": { "id", "email", "name", "role" } }` | Non-mandatory Role — full Session Cookie set |
| `200` | `{ "requiresTwoFactor": true, "twoFactorRedirect": "/2fa/verify" }` | Mandatory Role + not trusted browser — pre-auth state; no full Session Cookie |
| `200` | `{ "requiresTwoFactor": false, "user": { ... }, "trustedBrowser": true }` | Mandatory Role + valid Trusted Browser — TOTP skipped, full Session set |
| `401` | `{ "code": "INVALID_CREDENTIALS", "message": "..." }` | Wrong email or password |
| `403` | `{ "code": "EMAIL_NOT_VERIFIED", "message": "..." }` | Email not yet verified |
| `429` | `{ "code": "SIGN_IN_RATE_LIMITED", "message": "..." }` | Too many sign-in attempts |

> The Session Token **never** appears in the JSON body or `Authorization` header.

### 4.2 Get Session

```
GET /auth/session
```

| HTTP | Body | Meaning |
|---|---|---|
| `200` | `{ "session": { "id", "expiresAt", "userId" }, "user": { "id", "email", "role", "enrollmentComplete": bool } }` | Valid Session |
| `200` | `{ "session": null }` | No active Session (unauthenticated) |

> `enrollmentComplete: false` means the account is in pre-auth / enrollment state.
> Frontend uses this field to decide whether to show the enrollment screen.

### 4.3 Sign-out

```
POST /auth/sign-out
X-CSRF-Token: <token>
```

| HTTP | Body | Meaning |
|---|---|---|
| `200` | `{ "message": "Signed out successfully" }` | Session revoked server-side; Session Cookie cleared |
| `401` | `{ "code": "NOT_AUTHENTICATED" }` | No active Session |

### 4.4 CSRF Token

```
GET /auth/csrf
```

| HTTP | Body | Meaning |
|---|---|---|
| `200` | `{ "csrfToken": string }` | Always returns a token (new or existing for current session) |

### 4.5 2FA Enrollment — Enable & QR

```
POST /auth/2fa/enable
X-CSRF-Token: <token>
Body: { "password": string }
```

| HTTP | Body | Meaning |
|---|---|---|
| `200` | `{ "totpURI": string }` | TOTP URI for QR code; Secret is embedded in URI, never returned separately |
| `400` | `{ "code": "INVALID_PASSWORD" }` | Password wrong |
| `403` | `{ "code": "NOT_IN_PRE_AUTH_OR_STEP_UP" }` | Called outside enrollment or step-up window |
| `403` | `{ "code": "ALREADY_ENROLLED" }` | Cannot re-enroll without first resetting |

> The TOTP Secret Key is **only** in the `otpauth://` URI. It is never returned as a plain field.
> `ADMIN` who created the account must never receive this secret.

### 4.6 2FA Enrollment — Verify & Activate

```
POST /auth/2fa/verify-setup
X-CSRF-Token: <token>
Body: { "code": string }
```

| HTTP | Body | Meaning |
|---|---|---|
| `200` | `{ "recoveryCodes": string[] }` | 10 one-time codes shown **once only** |
| `400` | `{ "code": "INVALID_TOTP_CODE" }` | Wrong code |
| `423` | `{ "code": "TOTP_LOCKED", "retryAfterSeconds": number }` | 5 consecutive failures — 10-min lockout |

> Recovery Codes are returned **exactly once**, hashed on server, never retrievable later.

### 4.7 2FA Enrollment — Acknowledge Recovery Codes

```
POST /auth/2fa/acknowledge-recovery-codes
X-CSRF-Token: <token>
Body: { "acknowledged": true }
```

| HTTP | Body | Meaning |
|---|---|---|
| `200` | `{ "enrollmentComplete": true }` | Enrollment gate lifted; full Session Cookie issued now |
| `400` | `{ "code": "RECOVERY_CODES_NOT_SHOWN" }` | Acknowledge called before codes were shown |

> Full Session is only issued **after** this endpoint completes successfully.

### 4.8 TOTP Verification (Login — Mandatory Roles)

```
POST /auth/2fa/verify-totp
X-CSRF-Token: <token>
Body: { "code": string, "trustBrowser": boolean }
```

| HTTP | Body | Meaning |
|---|---|---|
| `200` | `{ "user": { ... }, "browserTrusted": bool }` | TOTP accepted; full Session Cookie set; if `trustBrowser=true` sets 14-day absolute trust cookie |
| `400` | `{ "code": "INVALID_TOTP_CODE", "attemptsRemaining": number }` | Wrong code |
| `423` | `{ "code": "TOTP_LOCKED", "retryAfterSeconds": number }` | Lockout after 5 failures |
| `403` | `{ "code": "NOT_IN_TOTP_VERIFICATION_STATE" }` | Called outside the right state |

> `trustBrowser` must default to `false` on the Frontend; the checkbox must **not** be pre-checked.
> The trust cookie is an absolute 14-day expiry, not sliding.

### 4.9 Recovery Code Verification

```
POST /auth/2fa/verify-recovery-code
X-CSRF-Token: <token>
Body: { "code": string }
```

| HTTP | Body | Meaning |
|---|---|---|
| `200` | `{ "user": { ... }, "codesRemaining": number }` | Recovery code accepted; full Session set; code marked used |
| `400` | `{ "code": "INVALID_RECOVERY_CODE", "attemptsRemaining": number }` | Wrong or already-used code |
| `423` | `{ "code": "TOTP_LOCKED", "retryAfterSeconds": number }` | Shared counter with TOTP — 5 consecutive failures |
| `410` | `{ "code": "ALL_RECOVERY_CODES_USED" }` | All 10 codes consumed; must contact ADMIN |

### 4.10 Step-up (ADMIN only)

```
POST /auth/2fa/step-up
X-CSRF-Token: <token>
Body: { "code": string }
```

| HTTP | Body | Meaning |
|---|---|---|
| `200` | `{ "stepUpExpiresAt": ISO8601 }` | 5-min elevation granted on current ADMIN Session |
| `400` | `{ "code": "INVALID_TOTP_CODE", "attemptsRemaining": number }` | Wrong code |
| `423` | `{ "code": "TOTP_LOCKED", "retryAfterSeconds": number }` | Lockout |
| `403` | `{ "code": "NOT_ADMIN" }` | Non-ADMIN calling step-up |

> Step-up expires at the earlier of 5 min, Sign-out, Session revocation, or ADMIN changing own password/2FA.
> Step-up belongs only to the current ADMIN Session — never transferable.

### 4.11 Send Verification Email (Resend)

```
POST /auth/send-verification-email
Body: { "email": string, "callbackURL"?: string }
```

| HTTP | Body | Meaning |
|---|---|---|
| `200` | `{ "status": true, "message": "..." }` | Email queued |
| `400` | `{ "code": "EMAIL_ALREADY_VERIFIED" }` | Already verified |
| `400` | `{ "code": "USER_NOT_FOUND" }` | No account with that email |

### 4.12 Change Password (Self-Service)

```
POST /auth/change-password
X-CSRF-Token: <token>
Body: { "currentPassword": string, "newPassword": string }
```

| HTTP | Body | Meaning |
|---|---|---|
| `200` | `{ "message": "Password changed successfully" }` | Current Session kept; all other Sessions + all Trusted Browser tokens for this account revoked |
| `400` | `{ "code": "INVALID_CURRENT_PASSWORD" }` | Wrong current password |
| `400` | `{ "code": "PASSWORD_POLICY_VIOLATION", "message": "..." }` | Weak new password |

---

## 5 Pre-auth / Enrollment State Restrictions

When an account is in pre-auth state (mandatory-2FA Role, not yet enrolled, or enrollment incomplete):

| Operation | Allowed? |
|---|---|
| `POST /auth/2fa/enable` | Yes |
| `POST /auth/2fa/verify-setup` | Yes |
| `POST /auth/2fa/acknowledge-recovery-codes` | Yes |
| `GET /auth/session` | Yes (returns `enrollmentComplete: false`) |
| `POST /auth/sign-out` | Yes (clears pre-auth state) |
| Any Business API endpoint | No — `403 { "code": "ENROLLMENT_REQUIRED" }` |
| Direct BetterAuth admin routes | No — must verify ADMIN RBAC and HAMS rules server-side |

When `requiresTwoFactor: true` was returned (TOTP verification state):

| Operation | Allowed? |
|---|---|
| `POST /auth/2fa/verify-totp` | Yes |
| `POST /auth/2fa/verify-recovery-code` | Yes |
| Any Business API endpoint | No — `403 { "code": "TOTP_VERIFICATION_REQUIRED" }` |

---

## 6 Error Code Registry

All error responses follow:

```json
{
  "code": "MACHINE_READABLE_CODE",
  "message": "Human-readable description",
  "statusCode": 400
}
```

| Code | HTTP | Trigger |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password at sign-in |
| `EMAIL_NOT_VERIFIED` | 403 | Email not confirmed before sign-in |
| `ENROLLMENT_REQUIRED` | 403 | Business API called before enrollment complete |
| `TOTP_VERIFICATION_REQUIRED` | 403 | Business API called before TOTP verified this session |
| `INVALID_TOTP_CODE` | 400 | Wrong 6-digit TOTP code |
| `INVALID_RECOVERY_CODE` | 400 | Wrong or already-used recovery code |
| `ALL_RECOVERY_CODES_USED` | 410 | All 10 recovery codes consumed |
| `TOTP_LOCKED` | 423 | 5 consecutive 2FA failures — 10 min lockout |
| `ALREADY_ENROLLED` | 403 | Re-enroll attempted without prior reset |
| `RECOVERY_CODES_NOT_SHOWN` | 400 | Acknowledge called before codes were issued |
| `INVALID_PASSWORD` | 400 | Wrong password when enabling/changing 2FA |
| `INVALID_CURRENT_PASSWORD` | 400 | Wrong current password in change-password |
| `PASSWORD_POLICY_VIOLATION` | 400 | New password too weak |
| `NOT_AUTHENTICATED` | 401 | Request requires Session; none present |
| `SESSION_EXPIRED` | 401 | Session expired (idle 60 min or 12 h absolute) |
| `STEP_UP_REQUIRED` | 403 | Sensitive action needs fresh TOTP step-up |
| `STEP_UP_EXPIRED` | 403 | Step-up window (5 min) passed |
| `NOT_ADMIN` | 403 | Non-ADMIN calling ADMIN-only endpoint |
| `NOT_IN_PRE_AUTH_OR_STEP_UP` | 403 | 2FA enable called outside valid window |
| `NOT_IN_TOTP_VERIFICATION_STATE` | 403 | TOTP verify called outside sign-in flow |
| `CSRF_INVALID` | 403 | Missing or wrong CSRF token |
| `SIGN_IN_RATE_LIMITED` | 429 | Too many sign-in attempts |
| `EMAIL_ALREADY_VERIFIED` | 400 | Resend verification to already-verified account |
| `USER_NOT_FOUND` | 400 | Resend verification — no matching account |
| `LAST_ADMIN_PROTECTED` | 403 | Attempt to delete/disable/demote last active enrolled ADMIN |
| `PUBLIC_SIGNUP_DISABLED` | 403 | POST /api/auth/sign-up/email is disabled |

---

## 7 Session Lifecycle Rules

| Rule | Value |
|---|---|
| Absolute Session lifetime | 12 hours from sign-in |
| Idle expiry | 60 minutes of no genuine user activity |
| Idle timer refresh | `X-User-Activity: 1` header on authenticated request |
| Idle timer reset does NOT extend | 12-hour absolute cap |
| Tab/browser close | Does **not** sign out |
| Explicit sign-out | Revokes server Session, clears Cookie immediately |
| Simultaneous Sessions | Allowed — each device has its own Session |
| Trusted Browser | 14-day absolute expiry from grant; bypasses TOTP only |

### Session expiry during form edit

When a request returns `401 SESSION_EXPIRED`:
- The Frontend must block any further submission.
- Hide protected content immediately.
- Retain the unsaved form draft **only in the current tab** for the same account.
- If a different account signs in, clear the retained draft.

### Warning before idle expiry

Frontend must display a warning at T-5 min before the idle deadline. Provide a button that sends an authenticated request with `X-User-Activity: 1` to extend the idle timer. **This does not change the 12-hour cap.**

---

## 8 Trusted Browser Protocol

1. After successful TOTP or Recovery Code verification, the Backend may set a `better-auth.trust_device` cookie if `trustBrowser: true` was sent.
2. The cookie is `HttpOnly; Secure; SameSite`. Frontend cannot read it.
3. The cookie binds to `userId`. At most one account can be trusted per Browser Profile at any time.
4. If a different account signs in on the same Browser Profile:
   - The old trust cookie is **revoked server-side**.
   - The new account must complete its own TOTP before it can opt into trust.
5. Frontend must **not** pre-check the "Trust this browser" checkbox.
6. Trusted Browser bypasses TOTP at sign-in; it does not extend the Session lifetime or bypass the password.

---

## 9 Revocation Matrix

| Event | Sessions Revoked | Trusted Browsers Revoked |
|---|---|---|
| Explicit sign-out | Current only | None |
| Self-service password change (with old password) | All **other** sessions | All for this account |
| ADMIN-forced password reset | All sessions of target | All for target account |
| ADMIN-assisted 2FA reset | All sessions of target | All for target account |
| Role change on account | All sessions of target | All for target account |
| 2FA reset (self-initiated, via step-up) | All sessions except current | All for this account |

---

## 10 Public Self-Signup Disabled

`POST /api/auth/sign-up/email` is **blocked** server-side.

Response: `403 { "code": "PUBLIC_SIGNUP_DISABLED" }`

Account creation is only possible via `POST /users` (ADMIN-only HAMS route). This must be tested to verify the block, while confirming ADMIN can still create accounts via `POST /users`.

---

## 11 Direct BetterAuth Admin Routes

BetterAuth exposes direct admin routes (e.g. `/api/auth/admin/create-user`, `/api/auth/admin/set-user-password`). These routes **must**:

1. Verify that the caller has `ADMIN` role in HAMS (not rely solely on BetterAuth's own role check).
2. Require HAMS employee data fields for user creation.
3. Enforce audit logging for Role changes.
4. Not bypass `ENROLLMENT_REQUIRED` for the target account.

Tests must confirm that unauthenticated callers and non-ADMIN callers receive `401`/`403` from these routes.

---

## 12 Test Seam & Quality Bar

The primary test seam for this contract is the **observable HTTP boundary**: responses, Cookies, status codes, and authorization outcomes. Tests must not mock the BetterAuth AuthGuard or bypass real session middleware.

### Test configuration

A separate Jest config (`test/jest-auth-integration.json`) runs against a real `TEST_DATABASE_URL` without the mock mapping that stubs `better-auth`. This config is used **only** when `TEST_DATABASE_URL` is set.

Run:

```sh
$env:TEST_DATABASE_URL = "postgres://..."
jest --config ./test/jest-auth-integration.json --runInBand auth-contract.e2e-spec.ts
```

### Coverage required (matches spec Testing Decisions)

1. Non-mandatory roles get a full Session on password-only sign-in; Session Token absent from JSON.
2. Mandatory roles without enrollment cannot reach any Business API endpoint (403 ENROLLMENT_REQUIRED).
3. Mandatory roles complete enrollment (enable -> verify-setup -> acknowledge-recovery-codes) and receive a full Session only after the ack step.
4. Wrong TOTP increments counter; 5 failures lock for 10 min; correct code clears counter.
5. Recovery Code verify works once; second use of same code fails with INVALID_RECOVERY_CODE.
6. Trusted Browser bypasses TOTP on next sign-in; stale server-revoked token does not bypass.
7. Sign-out revokes Session; subsequent authenticated request returns 401.
8. Public self-signup returns 403 PUBLIC_SIGNUP_DISABLED.
9. ADMIN can create users via POST /users; non-ADMIN gets 403.
10. Session Cookie is HttpOnly and does not appear in sign-in JSON body.
