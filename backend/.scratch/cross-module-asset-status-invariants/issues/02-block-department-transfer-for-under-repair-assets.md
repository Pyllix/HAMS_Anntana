# 02 — Block Department Transfer for Under-Repair Assets

**What to build:**
When a department transfer is requested for an asset, the system checks whether the asset is currently undergoing maintenance (`asset_status` is `UNDER_REPAIR`). If so, the request is immediately rejected with an HTTP 400 Bad Request stating that equipment under active maintenance cannot be transferred between departments. This extends existing transfer guards that already block assets that are `BORROWED` or `DISPOSAL`.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Creating an asset transfer for an asset whose status is `UNDER_REPAIR` throws HTTP 400 Bad Request
- [x] Existing transfer guards for `BORROWED` and `DISPOSAL` assets remain intact and functional
- [x] Creating an asset transfer for an eligible asset in normal or idle state continues to succeed and correctly updates the owning section
- [x] Unit and integration tests verify rejection of `UNDER_REPAIR` assets during transfer
