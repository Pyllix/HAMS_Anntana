# Specification: 2FA, Trusted Browser และ Web Session ของ HAMS

> สถานะ: สเปกสำหรับพัฒนา (ยังไม่ได้ติดตั้งฟีเจอร์)
> ขอบเขต: Backend, React frontend และการเตรียมระบบ Production
> มติล่าสุด: การสร้างบัญชี `ADMIN` และการเปลี่ยน Role **ไม่ต้องกรอก TOTP เพิ่ม**

## Problem Statement

ผู้ใช้ HAMS บางกลุ่มเข้าถึงการจัดการบัญชี พัสดุ และครุภัณฑ์ที่มีความสำคัญ แต่ระบบปัจจุบันยืนยันตัวตนด้วยรหัสผ่านอย่างเดียว และส่ง Session Token ให้ JavaScript ใน Browser เก็บไว้ ผู้ใช้กลุ่มนี้ต้องมีชั้นป้องกันเพิ่มตั้งแต่เริ่มใช้งานจริง โดยไม่เพิ่มขั้นตอนกรอกรหัสทุกครั้งที่เข้างานบน Browser ที่เลือกเชื่อถือไว้

ระบบยังต้องรองรับกรณีโทรศัพท์หรือ Authenticator หาย, การใช้เครื่องงานร่วมกันเป็นครั้งคราว, Session ที่เปิดค้าง, การกู้บัญชี `ADMIN` และการเตรียมบัญชีจริงก่อนส่งมอบ โดยไม่เปิดช่องให้บัญชีที่ยังไม่ตั้งค่า 2FA เข้าใช้งานงานปกติหรือให้ผู้ใช้สมัครบัญชีเองนอกกระบวนการของโรงพยาบาล

## Solution

บังคับใช้ TOTP ผ่าน Authenticator App เฉพาะ `ADMIN`, `PARCEL_STAFF` และ `ASSET_CENTER_STAFF` ผู้ใช้กลุ่มนี้ต้องตั้งค่าและยืนยัน 2FA ด้วยตนเองก่อนเข้าสู่ Session ปกติและ Business API ส่วน Role อื่นล็อกอินด้วยขั้นตอนเดิม ผู้ใช้เก็บ Recovery Codes แบบใช้ครั้งเดียวไว้กู้การเข้าถึง และเลือกจำ Browser เป็นเวลา 14 วันได้ด้วยตนเองเพื่อลดการกรอก TOTP เมื่อเริ่ม Session ใหม่บน Browser เดิม

Web Session ของ React เปลี่ยนเป็น Session ฝั่ง Server ที่ส่งผ่าน Cookie แบบ `Secure` และ `HttpOnly`; มีอายุสูงสุด 12 ชั่วโมง และหมดอายุเมื่อไม่มีการใช้งานจริง 60 นาที ระบบเตือนก่อนหมดเวลา 5 นาที งานสำคัญด้าน 2FA และการรีเซ็ตรหัสผ่านโดย `ADMIN` ต้องยืนยัน TOTP เพิ่ม แต่ **การสร้าง `ADMIN` และเปลี่ยน Role ไม่ต้องยืนยัน TOTP ซ้ำ** ทั้งสองรายการยังถูกจำกัดสิทธิ์ฝั่ง Server และตรวจสอบย้อนหลังได้

## User Stories

1. As an `ADMIN`, I want to set up my own Authenticator before using HAMS, so that nobody can use my administrative account with a password alone.
2. As a `PARCEL_STAFF` member, I want the same mandatory 2FA protection before accessing parcel work, so that my account is protected from password compromise.
3. As an `ASSET_CENTER_STAFF` member, I want the same mandatory 2FA protection before accessing Asset Center work, so that my account is protected from password compromise.
4. As a user in any other Role, I want to keep the normal sign-in flow, so that 2FA does not add work to roles outside the agreed scope.
5. As a newly created user in a mandatory-2FA Role, I want access only to the setup flow until I finish it, so that an unfinished account cannot access normal HAMS work.
6. As an account owner, I want to scan a QR code or enter a Secret Key and prove a current TOTP, so that only my own Authenticator becomes bound to my account.
7. As an account owner, I want the setup Secret Key hidden from the `ADMIN` who created my account, so that the second factor remains under my control.
8. As an account owner, I want to receive 10 one-time Recovery Codes after setup, so that I can sign in if my Authenticator is temporarily unavailable.
9. As an account owner, I want to see Recovery Codes only once and confirm that I saved them, so that I understand they cannot be retrieved later.
10. As an account owner, I want each Recovery Code to stop working after one successful use, so that a copied code cannot be replayed.
11. As a mandatory-2FA user, I want to sign in with my password and TOTP when my Browser is not trusted, so that my normal work begins only after both checks.
12. As a mandatory-2FA user, I want to choose whether to trust the current Browser for 14 days, so that I do not need to enter TOTP at every shift on a Browser I use regularly.
13. As a user on a shared workstation, I want Browser trust to apply only to my account, so that another user's sign-in cannot inherit my 2FA bypass.
14. As a user signing in on a Browser profile previously trusted by another account, I want to complete my own TOTP check and explicitly choose trust, so that accounts remain separate even when the computer is shared.
15. As a mandatory-2FA user, I want Browser trust to expire 14 days after it was granted, so that repeated logins do not silently extend that period forever.
16. As a user, I want a trusted Browser to skip only TOTP at sign-in, so that it never prolongs or replaces my Web Session.
17. As a user reading a long record, I want a warning before inactivity expiry and a button to continue, so that I can keep working without losing my place.
18. As a user, I want clicks, typing, scrolling, and my own requests for data to count as activity, so that ordinary review work keeps the Session active.
19. As a user, I want automatic polling and a page left open to have no effect on inactivity expiry, so that an unattended workstation does not stay signed in indefinitely.
20. As a user, I want to reopen HAMS after closing a tab or Browser without unnecessary sign-in if my Session is still valid, so that routine interruptions are less disruptive.
21. As a user, I want Sign-out to end the current Session immediately, so that someone using the workstation after me cannot resume it.
22. As a user editing a form when my Session expires, I want the content hidden and the unsaved draft kept only in the current tab for my own re-login, so that work is not lost or shown to another account.
23. As a user changing my own password with the old password, I want my current Session to remain active while other Sessions and Browser trust are revoked, so that I can finish my work securely.
24. As a user whose password is reset by an `ADMIN`, I want all my existing Sessions and Browser trust revoked, so that old access cannot continue.
25. As a user with a working Authenticator, I want to change it only after proving my password and current TOTP, so that another person cannot silently replace my second factor.
26. As a user, I want to create a fresh Recovery Code set only after a new TOTP check, so that someone using my open Session cannot easily take over recovery.
27. As a user who lost both my Authenticator and Recovery Codes, I want another `ADMIN` to verify me outside HAMS and reset my 2FA, so that I can enroll again without an unprotected business Session.
28. As an `ADMIN` assisting recovery, I want to confirm that reset with my own TOTP and record the reason, so that the exceptional action is attributable.
29. As a recovered account owner, I want all old Sessions, Browser trust, Authenticator settings, and Recovery Codes invalidated and an email notification sent, so that I know recovery happened and can set up fresh 2FA.
30. As an `ADMIN`, I want to reset several users' passwords during one five-minute TOTP confirmation window, so that a batch of administrative work does not require a code for every user.
31. As an `ADMIN`, I want to create another `ADMIN` or change a Role without an extra TOTP prompt, so that rare account-management work does not add unnecessary friction.
32. As a system auditor, I want `ADMIN` creation, Role changes, 2FA resets, failed 2FA lockouts, and other sensitive actions recorded, so that misuse can be investigated.
33. As a user whose Role changes, I want all old Sessions and Browser trust revoked, so that my next login follows the new Role's 2FA rules.
34. As a hospital system owner, I want at least two real, active, fully enrolled `ADMIN` accounts before handover, so that one person can assist the other with recovery.
35. As a hospital system owner, I want HAMS to prevent removal, disabling, or demotion of the last active enrolled `ADMIN`, so that routine account management cannot eliminate the final recovery path.
36. As an `ADMIN`, I want to add users through the authorized HAMS flow while public self-sign-up is closed, so that employees and their Roles are controlled by the hospital.
37. As a user whose account was created by an `ADMIN`, I want to be allowed to use the initial password without a forced first-login change, so that onboarding follows the hospital's chosen process.

## Implementation Decisions

### Identity and enrollment

- Apply mandatory 2FA only to `ADMIN`, `PARCEL_STAFF`, and `ASSET_CENTER_STAFF`. No other Role is required to enroll.
- After password verification, an unenrolled account in scope may enter only a constrained enrollment state. Do not issue a normal usable Session or allow any Business API until the owner has verified a TOTP and acknowledged saving Recovery Codes. The same boundary must apply to direct BetterAuth routes as well as HAMS routes.
- TOTP uses six digits, a 30-second period, and accepts the previous, current, or next time step (`window = 1`). Encrypt TOTP Secret Keys at rest. Never expose the secret to the account-creating `ADMIN`.
- Generate 10 Recovery Codes after successful enrollment, show them once, require acknowledgment, store only one-way hashes, and consume each code atomically on use.
- Count consecutive invalid TOTP and Recovery Code attempts together. After five failures, block 2FA verification for that account for 10 minutes and audit the lockout; successful verification clears the counter. Do not permanently disable the account for this reason.
- Mandatory-2FA Roles cannot switch 2FA off. Replacing an Authenticator requires the current password and current TOTP; a reset returns the account to the enrollment gate.

### Trusted Browser and Session

- Offer Browser trust only as an explicit, initially unchecked choice following successful 2FA. Its lifetime is an absolute 14 days from grant, not a sliding period. It bypasses TOTP only on later sign-ins, not the password or Session expiration.
- Bind trust to the account and Browser profile. Permit only one trusted account per Browser profile at a time; a different account's sign-in revokes the old trust and requires that new account's own TOTP before it can choose trust. Shared workstations are not categorically banned from this option.
- For the React client, use a server-managed BetterAuth Web Session in a `Secure`, `HttpOnly`, host-only Cookie with an explicit `SameSite` setting appropriate to the deployment. Do not return the Session Token in sign-in JSON or store it in browser `localStorage`. Use HTTPS, a concrete frontend-origin allowlist, and CSRF protection for state-changing requests. Authenticated/personalized responses use `Cache-Control: no-store`.
- A Web Session ends at the earlier of 12 hours after sign-in or 60 minutes after the last genuine user activity. User clicks, typing, scrolling, and user-initiated data requests count; background polling and simply leaving a page open do not. Display a warning five minutes before inactivity expiry and allow an explicit continue action, without moving the 12-hour cap.
- Closing a tab or Browser does not sign out. Reopening may resume only a still-valid server Session. Explicit Sign-out revokes the current Session and clears its Cookie. Different devices may hold independent Sessions; signing in on a new device does not revoke older Sessions by itself.
- On Session expiry during an edit, block submission and hide protected content until reauthentication. Retain an unsaved draft only in the same live tab for the same account; clear it if a different account signs in. Warn before refresh/close where the Browser permits. Do not promise draft recovery after refresh or tab close, and prevent existing draft storage from leaking data across accounts.

### Sensitive account actions

- Require fresh TOTP even on a Trusted Browser before replacing/resetting 2FA, issuing new Recovery Codes, or an `ADMIN` resetting another user's password. For `ADMIN` actions, a successful Step-up belongs only to the current `ADMIN` Session and lasts five minutes, allowing multiple password resets in that period. It ends on Sign-out, Session revocation, or the `ADMIN` changing password/2FA.
- **Do not require Step-up TOTP for creating `ADMIN` or changing any Role.** Enforce `ADMIN` authorization on the server and audit these actions. This is an explicit usability/risk decision, not an assertion that an open `ADMIN` Session is harmless.
- On any Role change, revoke all Sessions and Trusted Browser credentials of the affected account immediately. Its next login must follow the new Role's enrollment/verification rules. Editing profile fields without changing Role does not trigger this specific revocation.
- An `ADMIN` password reset revokes all Sessions and Trusted Browser credentials of the target. A self-service password change requires the old password, keeps only the current Session, and revokes the account's other Sessions and all Browser trust.
- An assisted 2FA reset may be performed only by another `ADMIN` after identity verification outside HAMS and Step-up TOTP. Revoke the target's Sessions and Browser trust, invalidate its old secret and Recovery Codes, record actor/target/time/reason in the audit trail, email the owner, and require fresh enrollment before Business API access. The assisting `ADMIN` must not receive the new secret or Recovery Codes.
- Before handover, establish two real `ADMIN` accounts that are active, email-verified, and enrolled. Thereafter do not enforce a permanent two-`ADMIN` minimum, but reject deletion, disabling, or demotion of the last active enrolled `ADMIN`. A temporarily single available `ADMIN` during another's recovery is permitted.

### Account creation and deployment

- Keep HAMS account creation through the existing `ADMIN`-only user-management flow. Disable BetterAuth's public email self-sign-up route. Review direct BetterAuth admin routes so they cannot bypass HAMS authorization, employee-data requirements, Role policy, or audit requirements.
- Do not force an initial password change for newly created accounts, including the first two `ADMIN` accounts. Mandatory-2FA users still must verify email and complete their own enrollment before ordinary access. Accept and document that the creating `ADMIN` may know a password that its owner chooses not to change.
- Separate production reference-data seeding from mock/demo seeding. Bootstrap the first two real `ADMIN` accounts once with distinct random initial passwords delivered privately, without hardcoding or logging them. Re-running bootstrap must not duplicate accounts or overwrite existing passwords. Verify both email and 2FA enrollment before handover.
- The planned deployment is React on Vercel and API on Render. Route Browser API traffic through the Vercel same-origin `/api` proxy, with its rewrite before SPA fallback, and use a single frontend API base path. Do not cache proxy responses. Validate Cookie, Sign-in/Sign-out, CSRF, and third-party-cookie-blocking behavior on a Preview deployment; reconsider origin/Cookie settings if hosting or domains change.
- Frontend must send Cookie credentials, restore login state from the Session endpoint rather than `localStorage`, and provide enrollment, TOTP, Recovery Code, Trusted Browser, timeout warning, and recovery screens. The existing add-user UI does not need to change solely because public self-sign-up is disabled.

## Testing Decisions

### Test seam and quality bar

- The primary test seam is the observable HTTP authentication/session and user-management boundary, backed by real session persistence where practical. Tests should assert responses, Cookie behavior, authorization, revocation, audit effects, and resulting data—not private helper calls or implementation-specific internals.
- Use a small set of Browser-level tests for flows that HTTP tests cannot adequately demonstrate, especially the timeout warning, protected-content hiding, same-tab draft return, account switching, and frontend Cookie transport. Keep isolated unit tests for TOTP time windows, hashing, and expiry calculations as supporting tests, not substitutes for boundary tests.
- Existing Auth Controller, Users Service, and RBAC end-to-end suites provide prior art. The RBAC suite that replaces the Auth Guard cannot by itself prove the real 2FA/session boundary; add tests that exercise the actual authentication integration.

### Required behavioral coverage

1. All three mandatory Roles cannot obtain ordinary Business API access before enrollment or before a required TOTP/Recovery Code check; each other Role follows the password-only path.
2. Enrollment requires a valid TOTP and Recovery Code acknowledgment. Secrets/codes never appear in subsequent API responses, and codes cannot be reused or read back from storage.
3. Invalid TOTP/Recovery Code attempts share the five-attempt counter and 10-minute block; valid verification clears it. Accept only the agreed TOTP time window.
4. Trusted Browser is opt-in, account-specific, and expires after 14 absolute days. Account B cannot reuse account A's trust; B's sign-in removes A's trust in that Browser profile.
5. Session Cookie is `Secure`, `HttpOnly`, host-only, and correctly `SameSite`; sign-in JSON and Browser storage have no Session Token. Unsafe cross-site requests are rejected, and disallowed Origins cannot use credentialed CORS.
6. Server enforcement expires Sessions at 60 idle minutes and 12 absolute hours; polling does not refresh idle time. A deliberate continue action refreshes only idle time. Sign-out revokes immediately; tab closure alone does not.
7. Simultaneous Sessions on different devices remain independent until a specified revocation event. Admin password reset/assisted 2FA reset revoke all target Sessions and trust; self-password change retains only the current Session and revokes trust.
8. Recovery requires a different `ADMIN`, completed Step-up, and a recorded reason; old credentials stop working, the target is returned to enrollment, and a notification is sent. The last usable `ADMIN` cannot be removed, disabled, or demoted.
9. A Step-up window works for multiple password resets within five minutes, does not transfer to another Admin/Session, and ends on its invalidation events. Sensitive 2FA actions still demand TOTP on a Trusted Browser.
10. Creating `ADMIN` and changing Role succeed for an authorized `ADMIN` without extra TOTP, while unauthorized users and direct bypass routes fail. These actions are audited. A Role change revokes only the target account's Sessions/trust and applies the new Role rules on next login.
11. Public self-sign-up is rejected, while authorized account creation still assigns employee data/Role and sends verification email. Bootstrap is idempotent and refuses handover until both initial `ADMIN` accounts are ready.
12. The Browser hides protected content and prevents writes after Session expiry, restores an unsaved draft only to the same account in the same tab, and clears it when a different account signs in.
13. Preview deployment verifies same-origin proxy ordering, no caching of personalized responses, and working Cookies when the Browser blocks third-party Cookies.

## Out of Scope

- Requiring 2FA for Roles outside `ADMIN`, `PARCEL_STAFF`, and `ASSET_CENTER_STAFF`.
- Asking for TOTP again when creating `ADMIN` or changing Role, and adding a new approval or dual-control workflow for those actions.
- Forcing a first-login password change for accounts created by an `ADMIN`.
- A permanent ban on Trusted Browser for shared workstations or a rule that every account on a shared computer must enter TOTP every shift.
- A permanent minimum of two active enrolled `ADMIN` accounts after launch; only the last-one safeguard is enforced then.
- A full emergency procedure for simultaneous loss of access to every `ADMIN` account; that requires separate organizational planning.
- Claiming a particular NIST assurance level or legal certification based only on this feature.

## Further Notes

- This spec consolidates the agreed Task 15 plan and domain notes. If older research notes recommend Step-up for `ADMIN` creation/Role changes, **this spec and the current Task 15 decision take precedence**.
- The 14-day Trusted Browser lifetime, 60-minute inactivity limit, 12-hour absolute Session lifetime, and five-minute Step-up window are HAMS policy choices. They should not be described as exact OWASP-mandated values.
- The deliberate trade-off of omitting Step-up on `ADMIN` creation/Role changes is that someone with access to an already-open `ADMIN` Session could perform those actions without the Authenticator. Session expiry, server-side RBAC, Cookie/CSRF controls, audit, and Role-change revocation reduce—but do not eliminate—that risk.
- Browser-session architecture follows ADR-0003. The older high-level architecture document still describes a token-centric setup and should be updated when this feature is implemented, not treated as the final browser-auth design.
- This document defines behavior and test outcomes, not final endpoint names or a migration implementation. Those are implementation details to settle when building the feature.
