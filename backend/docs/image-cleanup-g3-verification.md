# Image cleanup verification (G3)

**Status: G3 passed — 2026-10-04.** Dedicated-database HTTP acceptance verifies the HAMS lifecycle and recovery decisions using a deterministic storage adapter. The separate live Cloudinary contract now establishes the bounded provider deletion/replay behavior below. These suites verify different parts of the contract; the HTTP fake is not real-provider evidence.

On 2026-10-03, a fresh local Docker PostgreSQL database (`hams_image_upload_test_20261003_fe87ac70`) received all 29 committed migrations through `prisma migrate deploy`. The focused image HTTP acceptance suite passed 17/17 tests with exit code 0, including the database-clock lifecycle, retained-reference, lease/retry, restart recovery, and claim/delete race cases. Jest printed an open-handle warning after the passing summary but exited successfully. No real-provider request was made by this suite. The documented `db push` followed by replayed migrations failed on a separate fresh test database because the current schema already contained `intent_expires_at`; the API test setup instructions now use `prisma migrate deploy`. Both disposable databases created for these checks were removed after the run.

The initial G3 audit did not have opt-in Cloudinary credentials. A separate test-only cloud was subsequently configured. On 2026-10-04, the focused live case passed 1/1 with exit code 0 in 49.721 seconds; 24 unrelated provider cases were intentionally filtered, not claimed as passing. The guard checked that the test cloud differed from the application cloud. Only the allocated synthetic identity was uploaded/deleted, and manifest-scoped teardown completed without an error. No whole-account listing or deletion was performed.

During the same audit, two fresh disposable PostgreSQL containers received all 29 migrations. Image HTTP acceptance passed 17/17 in both. The first asset-status regression run failed 5/18 because its old ImageAttachmentService stub lacked the payload-validation method. The test now uses the real attachment service with its storage/clock dependencies; the final asset-status run passed 18/18, exit 0. No production service behavior was changed for this repair. Both temporary database containers were removed. Current Backend build, TypeScript, the touched test's ESLint check, and 450/450 unit tests passed; the unit run printed its existing open-handle warning before exiting 0.

The opt-in contract test uploads a synthetic raw alias under a random allocated `hams-contract-*` identity, confirms HAMS image verification rejects it, deletes all bounded namespace/extension candidates, replays the same still-valid signed upload, deletes it again, and repeats deletion to exercise not-found idempotency. Teardown deletes only references captured from that test's upload responses. It refuses to run against the configured application cloud when the names match.

| Measure                                          |                                           Expected bound | Real-provider observation           |
| ------------------------------------------------ | -------------------------------------------------------: | ----------------------------------- |
| Admin API delete requests per allocated identity | At most 9 per sweep; raw extension IDs share one request | Observed 9 per pass; 27 across 3 passes |
| Default sweep budget                             |           18 requests, so at most 2 candidate identities | Scheduler configuration/HTTP tests; live adapter observed 9 per identity |
| Raw replay/recovery exercise                     |                           One identity, 3 cleanup passes | Passed: unreported alias, replay after deletion, repeated cleanup |
| Not-found response behavior                      |                         Successful idempotent completion | Repeated cleanup completed successfully |

The emitted sanitized observation was `[image-cleanup-g3-budget] {"allocatedIdentities":1,"deleteRequests":27,"maxRequestsPerIdentity":9}`. This counts the three cleanup passes inside the case, excluding the separate exact-object teardown request. It is a request count, not a measured billing/credit charge. The passed database-clock acceptance test covers HAMS expiry, settlement horizon, leases, retry after outage, soft-deleted references, restart recovery, and the claim/delete boundary without waiting an hour.

Reproduction uses the separate test-only account and synthetic pack from [image-uploads-api.md](image-uploads-api.md):

```powershell
$env:RUN_CLOUDINARY_CONTRACTS = 'true'
$env:CLOUDINARY_CONTRACT_FIXTURE_DIR = (Resolve-Path ./test/fixtures/cloudinary-contract).Path
node -r dotenv/config ./node_modules/jest/bin/jest.js --config ./test/jest-e2e.json --runInBand test/cloudinary-image-storage.contract.e2e-spec.ts -t 'reconciles an unreported raw alias and a replay under the allocated identity'
```

The measured number of Admin API requests is not a physical-deletion SLA. Cleanup cannot run while a free service is asleep; durable database work resumes when the backend starts again. The live case uses a raw alias and a replay while its signature is valid, combined with controlled-clock DB recovery tests; it does not simulate every provider outage or arbitrarily long in-flight upload. These bounds do not promise erasure of already downloaded/CDN/browser copies.
