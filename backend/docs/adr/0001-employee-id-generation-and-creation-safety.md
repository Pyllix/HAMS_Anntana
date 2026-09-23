# 0001: Auto-Generated Employee ID and Creation Safety Strategy

## Status
Accepted

## Context
Previously, `employeeId` was optionally passed from the client during user creation without enforcing strict sequence formatting, leading to inconsistent codes and potential uniqueness collisions. Additionally, the user creation process called Better-Auth's `signUpEmail` before executing a subsequent Prisma profile update. When the profile update failed (e.g. invalid `sectionId` or database constraints), Prisma threw an unhandled error resulting in an HTTP 500 status code while leaving an orphaned, partially populated user in the database (with `null` fields).

## Decision
1. **Auto-Generate `employeeId`**: Standardize `employeeId` to format `GOV-YYNNNN`, where `YY` is the 2-digit Thai Buddhist Year (`(year + 543) % 100`) and `NNNN` is a 4-digit sequential integer (0001–9999) that resets each Buddhist year. Clients no longer supply `employeeId` upon creation, and it is immutable on update.
2. **Fail-Fast Pre-validation**: Validate `email`, `userName`, and `sectionId` existence before invoking Better-Auth, returning clear HTTP 400 or 409 responses rather than 500.
3. **Compensating Rollback**: If an unexpected error occurs during profile creation after Better-Auth has committed, immediately delete the created `account` and `user` records to guarantee database integrity.
