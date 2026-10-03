# Image cleanup verification (G3)

**Status: pending real-provider verification.** HTTP acceptance tests use a real disposable PostgreSQL database and a deterministic storage adapter. They verify the HAMS lifecycle and recovery decisions, but do not establish Cloudinary deletion or late-upload behavior.

On 2026-10-03, the opt-in Cloudinary flag, separate test-only cloud credentials, and fixture directory were not configured in this environment. The live cleanup contract was not run. No provider deletion response or live request count is claimed here.

The opt-in contract test uploads a synthetic raw alias under a random allocated `hams-contract-*` identity, confirms HAMS image verification rejects it, deletes all bounded namespace/extension candidates, replays the same still-valid signed upload, deletes it again, and repeats deletion to exercise not-found idempotency. Teardown deletes only references captured from that test's upload responses. It refuses to run against the configured application cloud when the names match.

| Measure                                          |                                           Expected bound | Real-provider observation           |
| ------------------------------------------------ | -------------------------------------------------------: | ----------------------------------- |
| Admin API delete requests per allocated identity | At most 9 per sweep; raw extension IDs share one request | Not observed                        |
| Default sweep budget                             |           18 requests, so at most 2 candidate identities | Configuration only; no provider run |
| Raw replay/recovery exercise                     |                           One identity, 3 cleanup passes | Not observed                        |
| Not-found response behavior                      |                         Successful idempotent completion | Not observed                        |

For the opt-in run, use the separate test-only Cloudinary account and synthetic fixture pack described in [image-uploads-api.md](image-uploads-api.md), then set `RUN_CLOUDINARY_CONTRACTS=true` and `CLOUDINARY_CONTRACT_*`. Record the emitted `[image-cleanup-g3-budget]` output and update the observations above. The database-clock acceptance test separately covers HAMS expiry, settlement horizon, leases, retry after outage, soft-deleted references, restart recovery, and the claim/delete boundary without waiting an hour.

The measured number of Admin API requests is not a physical-deletion SLA. Cleanup cannot run while a free service is asleep; durable database work resumes when the backend starts again. Do not infer missing-object response semantics or raw-resource alias behavior from unit tests alone.
