# 0002: Cross-Module Asset Status Invariants and Auto-Cascade Rules

## Status
Accepted

## Context
Previously, asset status updates (`PATCH /assets/:id/status`, `PATCH /assets/:id`), disposal creation (`POST /assets/:id/disposal`), and repair requests (`POST /repairs`) lacked cross-module guards against active workflows (borrowing and repairs). This caused severe state synchronization failures:
1. Creating a repair request on an asset currently borrowed (`BORROWED`) forced its availability status to `UNAVAILABLE`, which caused subsequent desk returns or online return requests in the borrow module to crash due to optimistic lock failures on `availability_status_id: BORROWED`.
2. Completing or cancelling a repair job reset the asset's availability to `AVAILABLE`, creating ghost availability while the asset was still actively loaned to a borrower.
3. Modifying an asset's status directly or creating a disposal record bypassed active borrow transactions and repair jobs, leaving orphaned in-progress transactions and inconsistent availability codes.

## Decision
1. **Block Repair on Borrowed/Reserved Assets**: `POST /repairs` strictly rejects requests for assets whose `availabilityStatus` is `BORROWED` or `RESERVED` (`BadRequestException`). Equipment damaged during loan must be returned to the Asset Center via the damage return flow (`returnCondition: Damage`) before a repair ticket can be opened.
2. **Strict Invariant Guard on Status Edits & Disposal**:
   - For assets in `BORROWED` or `RESERVED` status, direct status updates to `DISPOSAL`, `WAIT_DISPOSAL`, `DAMAGED`, or `UNDER_REPAIR`, as well as `createDisposal`, are strictly blocked (`BadRequestException`).
   - Updating status to `LOST` is explicitly permitted for Admin/Parcel Staff: the system automatically cascades cancellation to active `BorrowTransaction` records (`CANCELLED` with automated `cancel_reason` and `cancelled_at`), updates asset status to `LOST`, and sets availability to `UNAVAILABLE`.
3. **Block Transfer for Under-Repair Assets**: In addition to blocking transfers for `BORROWED` assets, `createTransfer` now also blocks assets currently in `UNDER_REPAIR` to prevent ownership changes while equipment is undergoing active maintenance.
4. **Auto-Cascade on Under-Repair Assets Marked Lost**: If an asset in `UNDER_REPAIR` is marked as `LOST`, the system automatically cancels any active `RepairJob` (`jobStatus: CANCELLED`) with an automated cancellation note and sets availability to `UNAVAILABLE`.
5. **Preserve General Metadata Edits**: Non-status metadata updates (e.g. `serialNo`, `model`, `price`, `remark`) remain permissible at all times regardless of borrow or repair states.
