# Image read/cache verification (G2)

**Status: provider access and expiry verified; Employee Photo cache decision pending.** On 2026-10-03, the focused HAMS HTTP acceptance suite passed 17/17 against an isolated PostgreSQL database with a deterministic storage adapter. The separate real-Cloudinary G2 case then passed 1/1 with exit code 0 (24 other contract cases intentionally filtered out). The test-only cloud name differed from the configured application cloud, the 18 synthetic fixtures were present, and test-scoped teardown completed without an error. This run does not repeat G1 or establish G3 cleanup acceptance.

The live case fetched public Asset bytes, denied unsigned Employee Photo original and derivative URLs, exercised an independently issued default five-minute grant and a 15-second grant, then made a fresh cache-bypassed request after the short grant expired. It logged only response labels, status codes, and `Cache-Control`, without signed URLs, object IDs, or credentials.

| Live check | HTTP status | Observed Cloudinary `Cache-Control` |
| --- | ---: | --- |
| Asset public success | 200 | `public, no-transform, immutable, max-age=2592000` |
| Asset public missing-object error | 404 | `private, no-transform, max-age=0, no-cache` |
| Employee unsigned original | 401 | `private, no-transform, max-age=0, no-cache` |
| Employee unsigned derivative | 401 | `private, no-transform, max-age=0, no-cache` |
| Employee public alias | 404 | `private, no-transform, max-age=0, no-cache` |
| Employee default five-minute grant, before expiry | 200 | `public, max-age=2592000` |
| Employee 15-second grant, before expiry | 200 | `public, max-age=2592000` |
| Same short grant, fresh request after expiry | 401 | `no-cache` |

The successful public Asset response is cacheable for 30 days, not the original desired exact `public, max-age=31536000, immutable` one-year value. **Scoped decision (user, 2026-10-03): accept the observed 30-day Asset byte cache** because Asset images are public and replacement uses a new versioned URL. This does not approve the Employee Photo byte response. Cloudinary describes 30-day caching for uploaded assets on its shared `res.cloudinary.com` distribution and 365-day caching for private CDN/CNAME delivery; the latter is an Advanced-plan option with additional setup/cost. Its documented Upload API `headers` parameter supports `Link`, `Authorization`, and `X-Robots-Tag`, not `Cache-Control`. These sources do not establish an application-level override for the current shared-CDN route. See [Cloudinary caching defaults](https://cloudinary.com/glossary/caching-images), [advanced CDN options](https://cloudinary.com/documentation/advanced_url_delivery_options), and the [Upload API reference](https://cloudinary.com/documentation/image_upload_api_reference).

The signed Employee Photo download also returned `public, max-age=2592000` on success. The test proves a **fresh** request after expiry was denied; it does not prove already delivered bytes are removed from a browser or intermediary cache. Under [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html), `public` permits a shared cache to store a response, subject to the other caching rules; no shared-cache reuse was measured in this run. Cloudinary states that private download requests bypass its CDN and can use twice the bandwidth of CDN delivery, but this does not change the observed response header. See [Cloudinary media access control](https://cloudinary.com/documentation/control_access_to_media).

**Remaining decision before closing G2:** determine whether Cloudinary can return `private` or `no-store` for the signed `image/download` response on this account, or whether a separately scoped delivery change is required. The observed `public` 30-day Employee Photo response is not accepted by the Asset cache decision. Do not relabel the observed headers as one-year Asset caching or private/no-store Employee Photo bytes. HAMS's grant response remains `private, no-store`; it does not control Cloudinary's image-byte response. No account-specific bandwidth charge was measured, and this run did not alter provider settings or application configuration.

### Cloudinary support question

The documented Upload API `headers` option does not list `Cache-Control`, and no account-level setting for the private-download response was found in the public documentation. Ask Cloudinary Support whether `Cache-Control: private, no-store` (or another response policy that prevents shared caching) is available for `https://api.cloudinary.com/v1_1/<cloud>/image/download` when `type=authenticated` and `expires_at` are used. Request the exact supported setting/API parameter, plan requirement, and whether it applies to both success and error responses. Include the observed success `public, max-age=2592000` and fresh post-expiry 401 `no-cache`; do not send a signed URL, API key, secret, employee image, or object ID. The support request has not been submitted from this workspace.
