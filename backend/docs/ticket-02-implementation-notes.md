# Ticket 02 Implementation Notes

## Cookie-based Session Support

### Changes Made

1. **Cookie Parser Middleware** ([main.ts:5](src/main.ts#L5))
   - Added `cookie-parser` to parse incoming cookies
   - Installed dependencies: `cookie-parser` and `@types/cookie-parser`

2. **CORS Configuration** ([main.ts:16-32](src/main.ts#L16-L32))
   - Restricted CORS to explicit `trustedOrigins`
   - Enabled `credentials: true` for cookie support
   - Added `X-CSRF-Token` and `X-User-Activity` to allowed headers

3. **BetterAuth Session Configuration** ([auth.ts:86-95](src/auth.ts#L86-L95))
   - Enabled `cookieCache` with 12-hour `maxAge`
   - Configured secure cookies (HttpOnly, Secure in production, host-only)
   - Set `cookiePrefix: 'better-auth'`

4. **CSRF Protection Plugin** ([auth.ts:127-151](src/auth.ts#L127-L151))
   - Added plugin to check `X-CSRF-Token` header on state-changing requests
   - Returns `403 CSRF_INVALID` if token is missing

5. **CSRF Token Endpoint** ([auth.controller.ts:253-277](src/auth.controller.ts#L253-L277))
   - Added `GET /auth/csrf` endpoint
   - Returns a generated CSRF token (placeholder until BetterAuth native support)

6. **Cache-Control Headers** ([auth.controller.ts:244](src/auth.controller.ts#L244))
   - Added `Cache-Control: no-store` to `GET /auth/session` responses

7. **Integration Tests** ([test/auth-contract.auth-integration.e2e-spec.ts](test/auth-contract.auth-integration.e2e-spec.ts))
   - Enabled cookie assertion test (line 229-236)
   - Enabled CSRF endpoint test (line 286-293)
   - Added cookie-based session lookup test (line 216-223)
   - Added sign-out cookie clearing test (line 229-241)

### BetterAuth Cookie Behavior

BetterAuth automatically manages session cookies through its internal middleware:
- Sets `better-auth.session_token` cookie with `HttpOnly; Secure; SameSite` attributes
- Cookie lifetime matches server session configuration
- Cookies are automatically cleared on sign-out

### Legacy Bearer Token Support (Expand Phase)

The expand phase ended with Ticket 13. Browser authentication now uses Cookie Session only; BetterAuth's Bearer plugin and the Browser's legacy Bearer fallback have been removed.

### CSRF Implementation Note (updated by Ticket 13)

The original placeholder was replaced by a signed double-submit proof. The Backend binds the proof to the current anonymous, pre-auth, or Session Cookie context, compares the request header with the HttpOnly CSRF Cookie, and rejects untrusted Browser Origins. Both Nest routes and direct BetterAuth routes run the verifier.

### Testing Without TEST_DATABASE_URL

The integration tests require `TEST_DATABASE_URL` to be set:
```powershell
$env:TEST_DATABASE_URL = "postgresql://user:pass@localhost:5432/hams_auth_test"
pnpm run test:auth-integration
```

Without this, tests will be skipped by the setup guard.

## Ticket Checklist Status

- [x] Sign-in, Session lookup และ Sign-out รองรับ Cookie แบบ Secure, HttpOnly, host-only และ SameSite ที่กำหนดชัดตามสภาพแวดล้อม
- [x] API ที่แก้ข้อมูลตรวจ CSRF/Origin ตามสัญญา และ CORS ยอมรับเฉพาะ Frontend Origin ที่ระบุชัด
- [x] Response ที่มีข้อมูล Session หรือข้อมูลเฉพาะบัญชีใช้ no-store; Sign-out เพิกถอน Session และล้าง Cookie
- [x] ช่วง expand ยังให้ Client เก่าทำงานได้ตามแผนย้าย แต่ไม่ถือว่าพร้อม Production จน ticket 13 ปิด token แบบเดิม
- [x] ทดสอบ Cookie attributes, คำขอข้าม Origin, CSRF, Sign-out และ Session lookup ผ่าน HTTP จริง

## Ticket 13 Follow-up

- Validate the Browser cookie proxy and CSRF behavior on Preview before production release (Ticket 14).
- Keep the CSRF signing secret private and rotate it through the normal authentication-secret rotation process.
