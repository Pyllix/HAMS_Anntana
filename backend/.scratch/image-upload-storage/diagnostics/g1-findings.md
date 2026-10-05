# G1 diagnosis — 2026-10-02

## Authorized implementation follow-up

Production instructions now use `/image/upload` with signed `type` and `backup=false`. Regression assertions failed before the fix and passed afterwards. Accepted HEIF fixtures now require a conventional decodable still container; oversized fixtures exercise HAMS's decimal limit independently of the provider account limit. Raw-only tests assert trusted image verification rejection, not unsupported namespace signing. Test cleanup is sequential with bounded retries after an intermediate parallel cleanup failure. Final verification: live contracts 23/23 (exit 0 including cleanup), adapter units 6/6, authenticated API tests 11/11, TypeScript and targeted lint passed. Final Admin API prefix inspection found zero remaining contract objects. Ticket 01 is complete; Ticket 04/G3 cleanup and later tickets remain outstanding. No commit or push.

## Outcome and scope

The original live suite reported 16 passed / 4 failed. Targeted probes distinguish one production upload-endpoint defect, an incompatible HEIF fixture, a transport/test timeout, and a provider namespace limitation. The initial investigation changed only diagnostics/documentation; the later authorized implementation fixes are recorded below.

All probes used the configured separate test-only Cloudinary environment. Each run deleted its exact allocated/returned test identities and checked its unique `hams-diag-g1-<run>-` prefix through the Admin API. Every cleanup reported zero failures and zero remaining image/raw objects in both relevant delivery types. No credentials or full signed links are recorded here.

## 1. Employee upload endpoint

Current `createUploadInstructions` constructs `/image/${deliveryType}` and does not include a signed `type` field. Consequently Employee Photo requests go to `/image/authenticated`, which returned HTTP 404 even for a normal JPEG. The previous HEIC/HEIF failures did not establish that Cloudinary cannot accept HEIC; their requests used this incorrect endpoint.

The isolated candidate used `/image/upload` for both purposes and included `type=authenticated` in the signed body for Employee Photo (`type=upload` for Asset Image).

| Probe                                                 | Observed result                                    |
| ----------------------------------------------------- | -------------------------------------------------- |
| Current adapter, Employee Photo JPEG                  | HTTP 404; reproducible baseline exits 1            |
| Candidate endpoint + signed type, Employee Photo JPEG | HTTP 200; verified image, JPEG 512×384             |
| Candidate endpoint + signed type, Employee Photo HEIC | HTTP 200; verified image, JPEG 451×461, no upscale |
| Anonymous access to those authenticated images        | HTTP 401                                           |
| Authorized time-limited download                      | HTTP 200; decoded JPEG without EXIF                |
| Change signed `type` from authenticated to upload     | HTTP 401, invalid signature                        |

**Required fix:** use `/image/upload`, include `type: input.deliveryType` before signing, and update the unit test that currently asserts the incorrect endpoint and absence of `type`. Add a live Employee Photo JPEG case independent of HEIC/HEIF, plus type-tampering coverage.

Cloudinary documents authenticated uploads using the `type` parameter. The verified REST body behavior above is the decisive evidence for this account: [authenticated assets](https://cloudinary.com/documentation/upload_parameters#authenticated_assets).

## 2. HEIF fixture compatibility

`portrait.heic` is an ordinary HEVC-in-HEIF still image (`heic` major brand, `hvc1` item). Sharp recognizes it as one-page HEIF and the candidate upload normalizes it successfully.

The downloaded `lightning_mini.heif` used for `portrait.heif` has major brand `mif3`. Sharp rejects it as an unsupported image, and Cloudinary's correct upload endpoint returns HTTP 400, `Unsupported video format or file`. The generator accepted this file based only on its ISO-BMFF header and explicitly skipped Sharp validation. That header check was insufficient to establish an accepted, provider-decodable still-image fixture.

A known-good HEVC HEIF container submitted as `portrait.heif` with MIME `image/heif` returned HTTP 200, verified as an authenticated JPEG, blocked anonymous reads (401), and allowed its authorized download (200). This tests the actual HEIF container, not a JPEG with its extension changed. It does not prove support for every HEIF codec or minimized-header variant.

**Required fix:** choose a conventional, independently decodable HEIF still-image sample for the acceptance case; require decoding and single-frame validation in fixture preparation. Retain the `mif3` sample as an unsupported-container rejection case if useful, rather than treating it as a guaranteed accepted input. Document provider-dependent HEIF variants and a stable unsupported-format error.

Primary references: [Cloudinary format support](https://cloudinary.com/documentation/image_format_support), [libheif release notes on minimized/mini-box support](https://github.com/strukturag/libheif/releases).

## 3. Source-byte cap versus timeout

| Input / signed limit                                               | Observed result                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| JPEG 8,101 bytes, signed maximum 1,024 bytes                       | HTTP 400; source-policy rejection                    |
| Valid JPEG plus padding, 10,000,001 bytes, HAMS maximum 10,000,000 | HTTP 400 in 8.7 s; source-policy rejection           |
| Re-encoded valid JPEG 10,178,772 bytes                             | HTTP 400 in 9.9 s; source-policy rejection           |
| Original fixture 19,736,068 bytes                                  | HTTP 400 in 20.3 s: account maximum 10,485,760 bytes |

The first full suite timed out at 60 seconds for the original fixture; that timeout was not reproduced in the isolated request. These probes demonstrate enforcement of HAMS's 10,000,000-byte cap, including below the account's 10,485,760-byte ceiling. There is no evidence here of a production byte-cap defect. The exact cause of the original transport delay remains unproven.

**Required test fix:** use a valid JPEG only slightly above 10,000,000 bytes, so the test reaches the application policy instead of only the account cap. Add an explicit request abort deadline, a slightly longer Jest deadline, and sanitized HTTP/error/timing diagnostics. A timeout must remain a failure, never count as provider rejection. Keep the 19.7 MB case separately if account-limit evidence is needed.

## 4. Resource namespace and raw identities

The same valid signed fields can be submitted to `/raw/upload`. Cloudinary explicitly excludes `resource_type` from the upload signature: [authentication signatures](https://cloudinary.com/documentation/authentication_signatures). Adding `resource_type` to the signature is not a supported fix.

The eval probes showed `upload_options.resource_type`, `upload_options.type`, and `resource_info.resource_type` are all undefined for both image and raw requests. A guard requiring one of these values to equal `image` rejected legitimate image uploads too. A forced JavaScript exception rejected both namespaces, so eval is executed, but it cannot distinguish the request namespaces through these fields. The current source-policy rule still rejected raw animated WebP, GIF, corrupt JPEG, and a JPEG over a signed 1,024-byte cap.

Raw JPEGs are stored unchanged, whereas image uploads receive normalization. The tested controls must therefore be applied at the HAMS acceptance boundary and cleanup boundary:

| Probe                                             | Observed result                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Raw JPEG named `probe.jpg`                        | Stored as allocated key + `.jpg`; HAMS rejects mismatched evidence                                      |
| Raw JPEG named `probe.png`                        | Stored as allocated key + `.png`; HAMS rejects mismatched evidence                                      |
| Raw JPEG named `probe.bin`                        | HTTP 400, extension not allowed                                                                         |
| Raw JPEG with no filename extension               | Stored under exact allocated key; HAMS rejects with `OBJECT_NOT_FOUND` because no expected image exists |
| Raw Employee Photo with signed authenticated type | Raw remains authenticated; anonymous read is 401; HAMS rejects it as an image                           |
| Tamper Employee Photo's signed type to upload     | HTTP 401, invalid signature                                                                             |

**Recommended fix within the existing design:**

1. Bind delivery `type` in the signature as above. This is necessary for Employee Photo privacy even if a client changes the resource endpoint.
2. Continue using the known allocated image lookup and trusted normalization checks before `VERIFIED_PENDING`. A raw response alone must never become a usable image reference. Preserve evidence and resource checks; do not accept provider success as HAMS success.
3. Change the cross-resource contract test to assert HAMS rejection and privacy, rather than assert that Cloudinary's raw endpoint must reject a valid image upload. Add a raw request with no filename extension so the test exercises the resource lookup rather than only an ID mismatch.
4. Implement Ticket 04's already-specified alternate-resource reconciliation. Resolve exact allocated keys and bounded raw aliases (`key` / `key.<accepted extension>`) in the signed delivery type; use trusted provider-returned identities for deletion and protect retained image references. A bounded prefix lookup must stay within a single allocated identity, not scan the whole cloud. Provider-specific alias discovery belongs behind the storage abstraction.

A raw object can temporarily exist on Cloudinary before cleanup, but it cannot be attached through HAMS, and a signed authenticated Employee Photo stays restricted. The existing spec's lifecycle section and Ticket 04 already require alternate-resource reconciliation and allow delayed physical cleanup. This approach retains direct browser-to-Cloudinary uploads and avoids sending image bytes through Render.

If the product instead requires Cloudinary to refuse every wrong resource namespace before storing any bytes, this standard signed-direct-upload path cannot currently prove that requirement. Enforcing the actual upload endpoint would require a server-controlled upload path or a separately verified provider capability. That is a different architecture trade-off, not a reason to remove source validation.

## Reproduction and next implementation sequence

The following commands use `.env.local` internally and require a separate test cloud. The harness overrides request parameters only inside the diagnostic process; it does not patch the production adapter.

```powershell
node -r ts-node/register/transpile-only .scratch/image-upload-storage/diagnostics/cloudinary-g1-probe.cjs baseline-employee
node -r ts-node/register/transpile-only .scratch/image-upload-storage/diagnostics/cloudinary-g1-probe.cjs routes
node -r ts-node/register/transpile-only .scratch/image-upload-storage/diagnostics/cloudinary-g1-probe.cjs namespace
node -r ts-node/register/transpile-only .scratch/image-upload-storage/diagnostics/cloudinary-g1-probe.cjs size
node -r ts-node/register/transpile-only .scratch/image-upload-storage/diagnostics/cloudinary-g1-probe.cjs original-size
node -r ts-node/register/transpile-only .scratch/image-upload-storage/diagnostics/cloudinary-g1-probe.cjs raw-acceptance
node -r ts-node/register/transpile-only .scratch/image-upload-storage/diagnostics/cloudinary-g1-probe.cjs raw-identities
```

`baseline-employee` was run and exited 1 with HTTP 404 in approximately 1.9 seconds plus cleanup. It is the small production-path regression signal; it should turn green after the endpoint/type fix. Other modes are diagnostic comparisons, not replacements for the full G1 acceptance suite.

Apply the endpoint/signed-type fix and its regression tests first, then correct accepted HEIF fixtures and byte-limit test diagnostics, then revise the raw acceptance test to exercise HAMS's actual boundary and record the Ticket 04 handoff. Rerun unit/API suites and the full live G1 suite before considering Ticket 01 complete. Ticket 04 and G3 still gate the final feature handoff.
