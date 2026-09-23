# 04 — Auto-Cascade Borrow Cancellation When Loaned Asset Marked Lost

**What to build:**
When an administrator or parcel staff member updates an asset's physical status directly to `LOST` while the asset is actively on loan or awaiting handover (`availabilityStatus` is `BORROWED` or `RESERVED`), the system permits the update. In an atomic database transaction, the system sets the asset status to `LOST`, sets availability to `UNAVAILABLE`, and automatically cancels the active `BorrowTransaction` (marking it `CANCELLED`, recording a descriptive cancellation reason indicating automated cancellation due to lost status update, setting `cancelled_by_user_id` to the acting user, and recording `cancelled_at`).

**Blocked by:** 03 — Guard Direct Status Edits & Disposal Against Borrowed Assets

**Status:** completed

- [x] Direct status update to `LOST` on an asset with availability `BORROWED` or `RESERVED` succeeds
- [x] Asset's physical status transitions to `LOST` and availability status transitions to `UNAVAILABLE`
- [x] Active `BorrowTransaction` for that asset transitions to `CANCELLED` status
- [x] `BorrowTransaction` record is populated with automated `cancel_reason`, acting user ID in `cancelled_by_user_id`, and current timestamp in `cancelled_at`
- [x] All database mutations execute atomically within a single database transaction (if any step fails, entire change rolls back)
- [x] Unit and integration tests verify the end-to-end auto-cascade cancellation and audit trail preservation
