# 03 — Guard Direct Status Edits & Disposal Against Borrowed Assets

**What to build:**
When an administrator or parcel staff member updates an asset's physical status directly (via status update or general update) or submits a direct disposal record, the system verifies whether the asset is currently on loan or reserved (`availabilityStatus` is `BORROWED` or `RESERVED`). If the target status is `DISPOSAL`, `WAIT_DISPOSAL`, `DAMAGED`, or `UNDER_REPAIR`, or if creating a disposal record, the action is rejected with an HTTP 400 Bad Request. General non-status property edits (e.g. serial number, model, purchase documentation, image, remark) on borrowed assets continue to succeed without restriction.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Direct status update to `DISPOSAL`, `WAIT_DISPOSAL`, `DAMAGED`, or `UNDER_REPAIR` on an asset with availability `BORROWED` or `RESERVED` throws HTTP 400 Bad Request
- [x] Direct disposal creation on an asset with availability `BORROWED` or `RESERVED` throws HTTP 400 Bad Request
- [x] General asset property update (non-status fields such as `name`, `model`, `serialNo`, `price`, `remark`) on an asset with availability `BORROWED` succeeds and preserves existing availability and borrow transaction states
- [x] Unit and integration tests verify rejection of forbidden status changes and disposal while allowing general metadata edits on borrowed equipment
