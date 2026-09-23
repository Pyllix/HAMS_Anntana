# 01 — Block Repair Intake for Borrowed or Reserved Assets

**What to build:**
When an online repair request is submitted for an asset, the system checks whether the asset is actively on loan or awaiting handover (`availabilityStatus` is `BORROWED` or `RESERVED`). If so, the request is immediately rejected with an HTTP 400 Bad Request explaining that equipment on loan must be returned through the Asset Center via the damage return procedure before a repair ticket can be created. Submitting repair requests for assets in normal available condition or unborrowed damaged condition continues to succeed as normal.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Submitting a repair request for an asset with `availabilityStatus` = `BORROWED` throws HTTP 400 Bad Request with an instructive Thai/English message
- [x] Submitting a repair request for an asset with `availabilityStatus` = `RESERVED` throws HTTP 400 Bad Request
- [x] Submitting a repair request for an asset with `availabilityStatus` = `AVAILABLE` or `UNAVAILABLE` (non-borrowed damaged equipment) succeeds and transitions the asset to `UNDER_REPAIR` and `UNAVAILABLE`
- [x] Unit and integration tests cover both rejection of borrowed/reserved equipment and successful intake of available/unborrowed equipment
