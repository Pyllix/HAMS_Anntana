# Local image storage

Customer deployments can store Asset Images and private Employee Photos on the HAMS server. The existing
Cloudinary provider remains the default unless `IMAGE_STORAGE_PROVIDER=local` is
selected. Local mode does not need Cloudinary credentials.

Set `IMAGE_STORAGE_ROOT` and `IMAGE_STORAGE_TEMP_ROOT` to absolute paths outside
the application release directory. The service account that runs HAMS needs
read, write, and delete access to both directories. For example, Ubuntu can use
`/var/lib/hams/images` and `/var/lib/hams/image-temp`; Windows Server can use
`C:/ProgramData/HAMS/images` and `C:/ProgramData/HAMS/image-temp`. These are
examples only; the deploy owner must select paths and permissions for the
customer's server. If the temporary path is omitted, HAMS uses `.staging` under
the image storage root.

The browser sends image bytes to the authenticated HAMS API. HAMS checks the
allocated upload identity, file size, actual file content, and image dimensions,
then normalizes the image to a versioned JPEG in the configured data directory.
Asset images are served from the same HAMS origin at
`/api/images/assets/{publicId}/v{version}.jpg`; the upload route is
`/api/images/uploads/{uploadId}/file`. The customer reverse proxy must forward
both routes to the backend and preserve the request body for the binary upload.

The normalizer accepts JPEG, PNG, static WebP, HEIC, and HEIF. Asset Images are
converted to JPEG quality 80, capped at 1,600 pixels on the long edge without
upscaling, rotated from source orientation where supported, flattened onto
white, converted to sRGB, and stripped of source metadata. Source limits are
10,000,000 bytes and 25,000,000 pixels. Processing runs in one worker at a time,
queues at most three more images, and has a 30-second limit. Files become
readable only after normalization and verification complete. Asset Images use
a versioned same-origin URL. Employee Photos have no public URL: HAMS issues a
short-lived, HMAC-signed same-origin grant and serves the normalized JPEG only
while that grant is valid. Employee Photo responses use
`Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`.
`BETTER_AUTH_SECRET` must remain stable across restarts and contain at least 32
characters in production; the local read grant uses a domain-separated key
derived from it.

## Decoder evidence and deployment limits

The HEIC/HEIF candidate was tested on Windows 11 Pro 25H2 (build 26200.9711),
Node.js v24.16.0, x64. The host registry's `ProductName` still reports
"Windows 10 Pro", but Microsoft's build mapping identifies build 26200 as
Windows 11 version 25H2 ([Microsoft Windows Insider Blog](https://blogs.windows.com/windows-insider/2026/02/17/releasing-windows-11-builds-26100-7918-and-26200-7918-to-the-release-preview-channel/)).
A real 451-by-461-pixel HEIC fixture decoded and normalized with the bundled
`libheif-js` WebAssembly decoder. The HEIC/HEIF fixtures each contain one
opaque primary image; tests compare normalized pixels with decoder output to
check color conversion. They do not cover HEIF rotation/mirroring, alpha, or
multi-image files, so those cases still need suitable fixtures before this
ticket can meet its full image-behavior acceptance. Sharp's native
HEIF path was not available on that test host, so HEIF decoding is isolated
behind the worker normalizer and does not depend on a system codec or CDN. The
tests cover EXIF rotation and mirroring, transparent input, color profiles,
metadata removal, corrupt files, animation, source byte limits, pixel limits,
and a working directory change. The normalizer selects a unique primary image
from a multi-image HEIF input and rejects ambiguous input, but no such fixture
is currently available in the test set.

This records a Windows development-host result. It does not certify Windows
Server or Ubuntu. The exact customer OS, Node runtime, service account
permissions, and packaged decoder must pass the deployment rehearsal in Ticket
07 before customer acceptance. `libheif-js` 1.23.5 declares LGPL-3.0 and ships a
`LICENSE` file; deployment packaging must retain that license with the
dependency.

Employee Photo source files use the same input limits as Asset Images and are
normalized to JPEG capped at 512 pixels on the long edge. Their short-lived
read grant uses `IMAGE_EMPLOYEE_PHOTO_READ_GRANT_SECONDS` (default 300 seconds,
maximum 3,600 seconds). The configured reverse proxy must forward the image
read route to HAMS while preserving its query string.

## Verification status

The local adapter and normalizer tests use real image fixtures and the real
filesystem. HTTP route tests verify private Employee Photo delivery and grant
rejection; frontend upload-service tests verify the same-origin byte request
without session cookies. The full browser-to-database HTTPS flow still needs
to run against the team's integration deployment. During Ticket 06 work,
Docker was unavailable and `TEST_DATABASE_URL` was not configured.
