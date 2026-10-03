# Image read/cache verification (G2)

**Status: pending real-provider verification.** On 2026-10-03, the focused HTTP acceptance suite passed 17/17 with exit code 0 against a fresh isolated PostgreSQL database. Its G2 cases exercise HAMS authentication, authorization, expiry, no-photo behavior, response shape, and `private, no-store` with a deterministic storage adapter. That does not prove Cloudinary's access controls or byte-response headers.

On 2026-10-03, the opt-in Cloudinary test flag and test-only cloud name/API credentials were not configured in this environment. The synthetic fixture pack is present locally, but the live suite was not run. No Cloudinary response headers or test-account capabilities are claimed here.

The opt-in live test now checks anonymous public Asset bytes and errors, unsigned Employee Photo original and derivative denial, an authenticated download before expiry, an independently requested default five-minute grant, and a 15-second grant followed by a fresh cache-bypassed request after expiry. It records only response label, HTTP status, and the actual `Cache-Control` value; it does not print URLs, object IDs, or credentials.

| Live check                                   | Observed status | Actual `Cache-Control` |
| -------------------------------------------- | --------------- | ---------------------- |
| Asset public success                         | Not observed    | Not observed           |
| Asset public error                           | Not observed    | Not observed           |
| Employee unsigned original/derivative errors | Not observed    | Not observed           |
| Employee valid five-minute grant success     | Not observed    | Not observed           |
| Employee short-grant success before expiry   | Not observed    | Not observed           |
| Fresh short-grant request after expiry       | Not observed    | Not observed           |

Run the opt-in suite only with a separate test-only Cloudinary account and the synthetic fixture pack described in [image-uploads-api.md](image-uploads-api.md). It refuses to use the configured application cloud when the names match and deletes only its test-prefixed objects. Save the emitted `[image-read-g2-cache]` observation in this table after the run. Do not infer a result from a cached browser image or from the HAMS grant endpoint's headers.

Cloudinary documents that authenticated assets can be served through private download URLs and that private download delivery bypasses the CDN and can use twice the bandwidth of CDN delivery. The application therefore keeps Employee Photos restricted and uses short-lived provider grants; this is a delivery-cost trade-off that still needs validation against the configured account's plan and observed responses. See [Cloudinary Media Access Control](https://cloudinary.com/documentation/control_access_to_media).

The long-lived public Asset cache policy remains an intent. In particular, `public, max-age=31536000, immutable` is not recorded as an observed or enforceable provider value until this live check supplies evidence. One-day Employee Photo browser caching is not approved by this verification record.
