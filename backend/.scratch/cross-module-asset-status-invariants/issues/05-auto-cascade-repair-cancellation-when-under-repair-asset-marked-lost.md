# 05 — Auto-Cascade Repair Cancellation When Under-Repair Asset Marked Lost

**What to build:**
When an administrator or parcel staff member updates an asset's physical status directly to `LOST` while the asset is actively undergoing maintenance (`asset_status` is `UNDER_REPAIR`), the system permits the update. In an atomic database transaction, the system sets the asset status to `LOST`, sets availability to `UNAVAILABLE`, and automatically cancels any active in-progress `RepairJob` for that asset (setting `jobStatus` to `CANCELLED` and appending an automated cancellation note in the job solution/remark), ensuring technicians' active workload queues remain accurate.

**Blocked by:** 01 — Block Repair Intake for Borrowed or Reserved Assets, 03 — Guard Direct Status Edits & Disposal Against Borrowed Assets

**Status:** ready-for-agent

- [ ] Direct status update to `LOST` on an asset whose status is `UNDER_REPAIR` succeeds
- [ ] Asset's physical status transitions to `LOST` and availability status transitions to `UNAVAILABLE`
- [ ] Active in-progress `RepairJob` on that asset transitions to `CANCELLED` status
- [ ] `RepairJob` record is updated with an automated cancellation note (e.g. "[ยกเลิกอัตโนมัติ] ครุภัณฑ์ถูกปรับสถานะเป็นสูญหาย (LOST)") and `updatedBy` user ID
- [ ] Any pending spare part transactions associated with the cancelled repair job are properly cleaned up or cancelled
- [ ] All database mutations execute atomically within a single database transaction
- [ ] Unit and integration tests verify the end-to-end auto-cascade cancellation of active repair jobs when equipment is lost
