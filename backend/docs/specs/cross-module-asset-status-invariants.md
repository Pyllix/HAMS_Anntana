# Specification: Cross-Module Asset Status Invariants and Auto-Cascade Rules

## Problem Statement

Hospital staff and administrators frequently encounter data inconsistencies and runtime exceptions when assets transition across different operational workflows (Borrowing, Repairs, Asset Management, and Disposal). 

Currently, modules update an asset's physical status (`AssetStatus`) and availability status (`AvailabilityStatus`) independently without checking if the asset is actively engaged in another operational process. This causes critical failures:
1. When equipment that is currently borrowed by a department is reported for repair, the repair module unconditionally overrides its availability to "Unavailable", which subsequently breaks the borrow module's return and verification workflows (causing optimistic locking exceptions and preventing staff from completing asset returns).
2. When an ongoing repair ticket is completed or cancelled, the repair module resets the asset to "Available", erroneously making the equipment available for others to borrow even though the physical item has not been returned by its original borrower.
3. When equipment is lost while on loan, administrators and parcel staff lack a coherent, non-destructive way to mark it lost without leaving orphan borrow records in progress or corrupting the availability status.
4. Equipment that is currently dismantled under active repair can still be transferred to other departments or disposed of directly, leaving repair work orders stranded in the technician's backlog.

Hospital staff need clear, dependable system safeguards that preserve data integrity across all four operational boundaries without burdening users with convoluted manual steps when handling lost equipment.

## Solution

A unified cross-module invariant enforcement and cascade coordination strategy that safeguards asset lifecycle integrity:
1. **Pre-workflow Rejection**: Strict rejection of repair requests (`POST /repairs`) on assets that are currently on loan or reserved (`BORROWED` or `RESERVED`). Damaged equipment on loan must be formally returned through the Asset Center's damage return flow (`Return - Damaged`) before being ticketed for repair.
2. **Direct Status Edit Protection with Selective Cascade**:
   - Status transitions to "Disposal", "Wait Disposal", "Damaged", or "Under Repair", as well as direct disposal records, are strictly rejected if the asset is currently on loan or reserved.
   - Authorized staff (Admin and Parcel Staff) are permitted to directly mark an active loan as "Lost" (`LOST`). The system automatically cascades this change by cancelling the active borrow transaction with a descriptive audit reason and setting the asset's availability to "Unavailable".
3. **Repair Lifecycle Safeguards**:
   - Department asset transfers are prohibited while an asset is actively undergoing maintenance (`UNDER_REPAIR`).
   - If an asset under repair is marked "Lost", the system automatically cancels the active repair job with an audit reason and marks the asset "Unavailable", preventing orphaned repair tickets.
4. **Uninhibited Metadata Maintenance**: General asset property edits (such as updating serial numbers, model names, acquisition costs, or remarks) remain unblocked across all workflows.

## User Stories

1. As an Asset Center Staff member, I want the system to reject online repair requests on equipment currently marked as `BORROWED`, so that borrowers are required to bring damaged equipment back to the center rather than creating orphaned repair tickets.
2. As an Asset Center Staff member, I want the system to reject online repair requests on equipment currently marked as `RESERVED`, so that equipment awaiting handover is not unexpectedly routed into the repair queue.
3. As a Department Staff borrower, I want clear and instructive error messages when attempting to submit a repair request for an asset currently in my department's loan possession, so that I know to return the item to the Asset Center via the damage return procedure.
4. As an Administrator, I want to update an asset's physical status directly to `LOST` even if it is currently marked as `BORROWED`, so that real-world equipment losses can be recorded immediately without unnecessary bureaucratic friction.
5. As an Administrator, I want the system to automatically cancel any active loan transaction when an asset is marked as `LOST`, so that the borrower's record is reconciled with a clear explanation and the loan does not remain stuck in an unreturnable state.
6. As an Asset Center Staff member, I want the system to record who marked an asset as `LOST` and when the active loan was cancelled, so that the transaction maintains an undeniable audit trail for asset loss accountability.
7. As a Parcel Staff member, I want the system to block direct status updates to `DAMAGED` while an asset is `BORROWED`, so that damaged physical items must be processed and verified at the return desk rather than altered in the database.
8. As a Parcel Staff member, I want the system to block direct status updates to `WAIT_DISPOSAL` while an asset is `BORROWED`, so that equipment cannot be earmarked for disposal until it is physically returned from the borrowing department.
9. As a Parcel Staff member, I want the system to block creating a disposal record for equipment that is currently `BORROWED`, so that hospital property cannot be written off while held by an active borrower.
10. As a Parcel Staff member, I want the system to block creating a disposal record for equipment that is currently `RESERVED`, so that reservations must be resolved or cancelled before writing off equipment.
11. As a Department Staff member, I want to edit general asset details (such as serial number, model, photo, or purchase documentation notes) on an asset that is currently on loan, so that clerical corrections are never impeded by operational status.
12. As a Maintenance Head, I want the system to prevent department transfers on assets with status `UNDER_REPAIR`, so that the asset's owning department cannot change while technicians are disassembling or servicing the equipment.
13. As a Maintenance Staff technician, I want active repair tickets to be automatically cancelled with an audit note if an administrator marks the equipment as `LOST`, so that my workload metrics and active repair queue remain accurate without requiring manual ticket cleanup.
14. As an Asset Center Staff member, I want asset availability to remain locked to `UNAVAILABLE` when an asset under repair is marked as `LOST`, so that lost items cannot inadvertently appear in search results as available for borrowing.
15. As a System Auditor, I want every auto-cancelled loan transaction to reflect the exact initiating user and timestamp, so that hospital inventory audits can trace the lifecycle transition of lost property accurately.

## Implementation Decisions

### Affected Modules and Interfaces

1. **Repairs Module (`RepairsService`)**
   - **Interface**: `createRequest(dto, user)`
   - **Decision**: Introduce a pre-condition validation checking the target asset's `availabilityStatus`. If the status code equals `BORROWED` or `RESERVED`, reject immediately with an HTTP 400 Bad Request indicating that equipment on loan must be returned through the Asset Center before repair intake.

2. **Asset Management Module (`AssetService`)**
   - **Interface**: `update(id, dto, userId)` and `updateStatus(id, assetStatusId, userId)`
   - **Decision**: 
     - Separate metadata field updates from status transitions. Allow non-status fields regardless of availability.
     - When a status transition is requested for an asset whose `availabilityStatus` is `BORROWED` or `RESERVED`:
       - If the target status is `LOST`: permit the change, set `availabilityStatus` to `UNAVAILABLE`, and execute an atomic auto-cascade within the transaction that updates active `BorrowTransaction` records for this asset to `CANCELLED` (populating `cancel_reason`, `cancelled_by_user_id`, and `cancelled_at`).
       - If the target status is any other status (`DAMAGED`, `WAIT_DISPOSAL`, `DISPOSAL`, `UNDER_REPAIR`): reject immediately with HTTP 400 Bad Request.
     - When a status transition to `LOST` is requested for an asset whose status is `UNDER_REPAIR`:
       - Permit the change, set `availabilityStatus` to `UNAVAILABLE`, and execute an atomic auto-cascade within the transaction that cancels any non-completed, non-cancelled `RepairJob` for this asset (populating `jobStatus` as `CANCELLED` and appending a cancellation reason in the repair solution/remarks).
   - **Interface**: `createDisposal(id, dto, userId)`
   - **Decision**: Enforce an availability guard. If the asset's `availabilityStatus` is `BORROWED` or `RESERVED`, reject immediately with HTTP 400 Bad Request.
   - **Interface**: `createTransfer(id, dto, userId)`
   - **Decision**: Extend existing transfer guards. In addition to rejecting assets with availability `BORROWED` or status `DISPOSAL`, explicitly reject assets with status `UNDER_REPAIR` with an HTTP 400 Bad Request.

### Architectural Decisions
- **Transactional Atomicity**: All status transitions accompanied by auto-cascade cancellations (Borrow cancellation or Repair cancellation) must execute inside a single Prisma database transaction (`$transaction`) to guarantee zero orphan states if any sub-operation fails.
- **Frontend Confirmation Responsibility**: As decided during domain modeling, user confirmations (e.g. "Are you sure you want to mark this borrowed item as lost?") are handled at the presentation layer (UI modal). The backend API processes the authenticated request directly and deterministically.
- **No Schema Alterations Required**: The existing database schema already contains all necessary fields (`cancel_reason`, `cancelled_by_user_id`, `cancelled_at` on `BorrowTransaction`, and `CANCELLED` status code on both `BorrowStatus` and `JobStatus`). No Prisma schema migrations are needed.

## Testing Decisions

### What Makes a Good Test
- Tests must verify observable system boundaries (HTTP response status codes, error messages, and resultant database state) rather than private implementation details.
- Status invariants must be tested against both direct endpoint invocations and subsequent workflow side-effects.

### Modules Under Test
1. **`RepairsService` Unit & Integration Tests**:
   - Verify that calling `createRequest` with an asset in `BORROWED` status throws `BadRequestException`.
   - Verify that calling `createRequest` with an asset in `RESERVED` status throws `BadRequestException`.
   - Verify that calling `createRequest` with an asset in `AVAILABLE` or `UNAVAILABLE` (non-borrowed, e.g. `NORMAL` or `DAMAGED`) succeeds.
2. **`AssetService` Unit & Integration Tests**:
   - Verify that `updateStatus` with target `LOST` on a `BORROWED` asset transitions the asset to `LOST`/`UNAVAILABLE` and cancels the active `BorrowTransaction` with populated `cancel_reason`.
   - Verify that `updateStatus` with target `DAMAGED` or `WAIT_DISPOSAL` on a `BORROWED` asset throws `BadRequestException` and leaves the asset and transaction unchanged.
   - Verify that `createDisposal` on a `BORROWED` asset throws `BadRequestException`.
   - Verify that `createTransfer` on an `UNDER_REPAIR` asset throws `BadRequestException`.
   - Verify that `updateStatus` with target `LOST` on an `UNDER_REPAIR` asset cancels the active `RepairJob` and updates asset status to `LOST`/`UNAVAILABLE`.
   - Verify that updating non-status metadata (e.g. `model`, `price`) on a `BORROWED` asset succeeds without altering borrow state.

### Prior Art
- Refer to existing service test suites in `src/asset/asset.service.spec.ts`, `src/asset-borrow/asset-borrow.service.spec.ts`, and `src/repairs/repairs.service.spec.ts`.

## Out of Scope
- Adding a dedicated "Lost Item Return" screen or interactive modal wizard to the frontend borrow-return UI (handled via existing Admin/Parcel Staff direct asset status update).
- Automated compensation or penalty billing calculations for lost or damaged hospital property.
- Automatic generation of repair tickets upon receiving damaged goods at the desk return (as documented in `CONTEXT.md`, repair tickets after damage return remain a manual intake by Asset Center Staff).

## Further Notes
- Documented in Architecture Decision Record: `docs/adr/0002-cross-module-asset-status-invariants-and-cascade.md`.
- Reflected in domain rules: `CONTEXT.md` under "Validation Rules".
