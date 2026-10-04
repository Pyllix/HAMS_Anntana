# Employee Photo cache options from primary documentation

Research date: 2026-10-03. Scope: find a delivery option without contacting Cloudinary Support. The research itself changed no implementation/provider settings; the user subsequently approved the recommended no-store policy on 2026-10-04, recorded in [G2 verification](image-read-g2-verification.md) and [ADR 0005](adr/0005-employee-photo-cache-and-isolated-fe-handoff.md).

## What G2 actually established

The existing [G2 verification](image-read-g2-verification.md) recorded successful authenticated download bytes with `Cache-Control: public, max-age=2592000`, and a fresh request after expiry returning 401. It did not measure unauthorized reuse from a shared cache. HAMS's grant JSON has its own `private, no-store` header; that header does not govern the separate Cloudinary image response.

Three requirements must be distinguished: fresh requests must enforce expiry; the HAMS browser flow should avoid persisting photos; every possible delivery response should prevent shared caching. Passing one does not prove the other two.

## Cloudinary options

Cloudinary documents `private_download_url` as an expiring authenticated API request, outside its CDN cache. Its documented options include `expires_at`, `attachment`, delivery type, and transformation; no response `Cache-Control` option is listed. CDN bypass does not establish browser-cache behavior. Cloudinary cautions that this route consumes twice the delivery bandwidth. Authenticated delivery protects originals and derivatives. Ordinary signed delivery URLs should not replace the current expiring API grant: they do not supply this expiry contract. Token/cookie access supports time limits but requires Advanced or higher, provider activation, and a separately provisioned encryption key; cookies additionally require CNAME. It does not meet the present requirement to avoid contacting Cloudinary. [Media access control](https://cloudinary.com/documentation/control_access_to_media#providing_time_limited_access_to_private_media_assets), [premium access setup](https://cloudinary.com/documentation/control_access_to_media#token_based_and_cookie_based_access_premium_features).

The Upload API lists supported `headers` values without `Cache-Control`. The documented `GET|POST /asset/download` accepts immutable `asset_id`, signatures, `expires_at`, and `attachment`; it returns bytes and reuses the existing download permission logic. Its parameter list also lacks a cache-policy option. `attachment` controls download disposition, rather than promising cache prevention. Testing it is useful, but a disposition change alone is insufficient evidence. [Upload API reference](https://cloudinary.com/documentation/image_upload_api_reference#upload), [download by asset ID](https://cloudinary.com/documentation/image_upload_api_reference#download_by_asset_id).

This is a finding about the reviewed documentation, not proof that no account-specific capability exists. Do not add invented `cache_control`, `no_store`, or `fl_no_cache` parameters.

## Browser-controlled direct retrieval

The Fetch Standard defines `cache: 'no-store'` as bypassing the browser HTTP cache and preventing its update. It automatically adds request `Cache-Control: no-cache`, which does not prohibit storage by intermediaries. Cross-origin Blob retrieval requires a valid CORS response; `credentials: 'omit'` permits `Access-Control-Allow-Origin: *` and avoids sending application cookies. An explicit request `Cache-Control: no-store` needs CORS preflight permission because the header is not safelisted. Server-side fetch success cannot prove browser CORS success. [Fetch cache mode](https://fetch.spec.whatwg.org/#concept-request-cache-mode), [HTTP network/cache fetch](https://fetch.spec.whatwg.org/#http-network-or-cache-fetch), [CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol).

RFC 9111 distinguishes these directives: `public` permits storage subject to other rules; `private` prohibits shared-cache storage while permitting private caching; `no-store` prohibits storage in compliant caches; `no-cache` requires validation before reuse. Explicit request `no-store` applies to the request and its response, but does not remove an existing stored response. Thus browser cache mode plus an explicit request header can strengthen the controlled HAMS fetch path without changing Cloudinary's response. It cannot impose that policy on someone opening a copied signed URL without the header. [RFC 9111 cache directives](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2).

Proposed HAMS flow: obtain the existing grant, fetch Cloudinary directly, validate the successful image response, display a Blob URL, and discard references on replacement, logout, lost permission, or unmount. Pair each Blob URL with `URL.revokeObjectURL`; revocation prevents future dereferencing, but does not erase pixels already displayed. Do not store the Blob or grant in persistent application storage. [File API Blob URL lifecycle](https://w3c.github.io/FileAPI/#creating-revoking).

## Why POST deserves a probe, but does not establish no-store

A POST cannot be answered from a cached POST response. POST responses are only cacheable with explicit freshness and matching `Content-Location`; such a cached response can later satisfy GET/HEAD. Therefore the documented POST route may reduce cache reuse, but POST is not equivalent to a universal storage prohibition. Measure actual status, response headers, expiry, and CORS. It also needs a trusted `asset_id` and a request-instructions contract instead of the current URL-only grant. [RFC 9110 POST semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3).

## Isolated provider and browser probe

On 2026-10-03, two diagnostic runs used synthetic JPEG uploads in the configured test-only cloud, after checking that it differed from the application cloud. Each upload used the production authenticated Employee Photo normalization policy and trusted provider verification. Each run deleted only its allocated test object; both confirmed cleanup and exited successfully. This was a diagnostic experiment, not a rerun of the complete provider contract suite.

| Probe | Result |
| --- | --- |
| Existing signed GET, `attachment=false` | 200; `public, max-age=2592000` |
| Existing GET with Fetch cache mode or explicit request `no-store` | 200; provider response header remained `public, max-age=2592000` |
| Signed GET, `attachment=true` | 200; same cache header; only disposition changed to attachment |
| Documented asset-ID GET and POST | 200; same `public` 30-day header |
| Repeated asset-ID POST after its 15-second expiry | 401; `no-cache` |
| OPTIONS for existing GET with requested `Cache-Control` header | 200; allowed GET and `Cache-Control`; origin was allowed |
| Actual Edge fetch with cache mode and explicit `Cache-Control: no-store` | 200; browser network event confirmed the request header; JPEG Blob decoded successfully |
| Same Edge page, same grant, default-cache fetch after expiry | 401 from network, rather than reuse of the prior successful response |

The Edge test used a fresh isolated browser context, blocked service workers, and a temporary local origin. The signed URL was passed in memory; no credential, URL, or object ID was logged. The image used a Blob URL that was revoked after decoding. Browser storage remained empty. Network events reported no disk-cache or service-worker response for the measured requests. This establishes feasibility for this tested Edge/account path, not every browser, intermediary, production origin, or the actual HAMS logout lifecycle. No production frontend code or provider setting was changed.

## Accepted policy and implementation boundary

Use the existing expiring GET grant with a direct browser fetch using `cache: 'no-store'` and explicit request `Cache-Control: no-store`. The isolated Edge probe established that the tested account permits this CORS path. This preserves direct browser-to-provider delivery and avoids replacing the existing object locator contract. The frontend integration should validate the provider URL, use a bounded request/abort timeout, check status and image content type, and display the returned Blob rather than assigning the signed URL directly to an image element. A failed CORS check must not silently fall back to direct signed-URL display.

```ts
// Delivery pattern only; lifecycle/error handling still belongs in the shared helper.
const response = await fetch(grant.url, {
  cache: 'no-store',
  headers: { 'Cache-Control': 'no-store' },
  credentials: 'omit',
  referrerPolicy: 'no-referrer',
  redirect: 'error',
  signal,
});
if (!response.ok) throw new Error('Photo could not be loaded');
const blob = await response.blob();
const displayUrl = URL.createObjectURL(blob);
// Display displayUrl, then revoke it when its owning view/session is discarded.
```

When integrating this into Tickets 06/07, verify the actual application origin/browser path, expired grants, logout/remount behavior, canceled requests, stale async results, and Blob cleanup. Clear the displayed image before revocation on logout/account switch; prevent a request started in an old session from repopulating the new session. Reuse an in-memory display within its session/revision without polling downloads. A provider-side header probe alone cannot close those checks. This research does not authorize the deferred wait-disposal flow or bypass the Ticket 05 gate for frontend work.

On 2026-10-04, the user approved this scoped no-store retrieval policy and completion of Ticket 05 for isolated FE development/acceptance. G2/Ticket 03 is complete on its existing Backend/provider evidence plus that decision; helper implementation/UI lifecycle acceptance remain 06/07. Cloudinary's response header is not relabeled as private/no-store, copied-grant access remains outside the helper directive, and G4 stays a production release blocker. A requirement for provider `private, no-store` responses for every consumer would need a separately approved delivery architecture, not this client policy.
