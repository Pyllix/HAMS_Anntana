# Image cleanup verification (G3)

**Status: dedicated-database HTTP acceptance passed; real-provider verification pending.** The HTTP suite uses a real disposable PostgreSQL database and a deterministic storage adapter. It verifies the HAMS lifecycle and recovery decisions, but does not establish Cloudinary deletion or late-upload behavior.

On 2026-10-03, a fresh local Docker PostgreSQL database (`hams_image_upload_test_20261003_fe87ac70`) received all 29 committed migrations through `prisma migrate deploy`. The focused image HTTP acceptance suite passed 17/17 tests with exit code 0, including the database-clock lifecycle, retained-reference, lease/retry, restart recovery, and claim/delete race cases. Jest printed an open-handle warning after the passing summary but exited successfully. No real-provider request was made by this suite. The documented `db push` followed by replayed migrations failed on a separate fresh test database because the current schema already contained `intent_expires_at`; the API test setup instructions now use `prisma migrate deploy`. Both disposable databases created for these checks were removed after the run.

On 2026-10-03, the opt-in Cloudinary flag and separate test-only cloud credentials were not configured in this environment. The synthetic fixture pack exists locally, but the live cleanup contract was not run. No provider deletion response or live request count is claimed here.

The opt-in contract test uploads a synthetic raw alias under a random allocated `hams-contract-*` identity, confirms HAMS image verification rejects it, deletes all bounded namespace/extension candidates, replays the same still-valid signed upload, deletes it again, and repeats deletion to exercise not-found idempotency. Teardown deletes only references captured from that test's upload responses. It refuses to run against the configured application cloud when the names match.

| Measure                                          |                                           Expected bound | Real-provider observation           |
| ------------------------------------------------ | -------------------------------------------------------: | ----------------------------------- |
| Admin API delete requests per allocated identity | At most 9 per sweep; raw extension IDs share one request | Not observed                        |
| Default sweep budget                             |           18 requests, so at most 2 candidate identities | Configuration only; no provider run |
| Raw replay/recovery exercise                     |                           One identity, 3 cleanup passes | Not observed                        |
| Not-found response behavior                      |                         Successful idempotent completion | Not observed                        |

For the opt-in run, use the separate test-only Cloudinary account and synthetic fixture pack described in [image-uploads-api.md](image-uploads-api.md), then set `RUN_CLOUDINARY_CONTRACTS=true` and `CLOUDINARY_CONTRACT_*`. Record the emitted `[image-cleanup-g3-budget]` output and update the observations above. The passed database-clock acceptance test covers HAMS expiry, settlement horizon, leases, retry after outage, soft-deleted references, restart recovery, and the claim/delete boundary without waiting an hour.

The measured number of Admin API requests is not a physical-deletion SLA. Cleanup cannot run while a free service is asleep; durable database work resumes when the backend starts again. Do not infer missing-object response semantics or raw-resource alias behavior from unit tests alone.
