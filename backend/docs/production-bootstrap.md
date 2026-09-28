# Production data and first ADMIN accounts

Production bootstrap uses the reference seed and a separate one-time ADMIN bootstrap. The demo seed contains mock organizations, users, assets, inventory and transactions; do not run it against Production.

## Prepare Production

1. Deploy the matching backend version and generated Prisma client.
2. Apply committed migrations with `pnpm exec prisma migrate deploy`.
3. Run `pnpm run prisma:seed`. This idempotently adds required statuses and generic lookup/workflow data only. It does not create demo organizations, sections, users, budgets, inventory or transactions. Load hospital-specific data from its approved source.
4. Configure the Production environment through the deployment secret/configuration store:
   - `NODE_ENV=production`, `DATABASE_URL`, `BETTER_AUTH_SECRET` (at least 32 characters), and `TWO_FACTOR_ENCRYPTION_KEY` (64 hexadecimal characters).
   - HTTPS URLs in `BETTER_AUTH_URL` and `FRONTEND_URL`.
   - SMTP settings. Use `SMTP_SECURE=true` for implicit TLS or `SMTP_REQUIRE_TLS=true` for required STARTTLS. Add SMTP credentials when the provider requires authentication.
   - The two real account owners' `BOOTSTRAP_ADMIN_1_EMAIL`, `BOOTSTRAP_ADMIN_1_USERNAME`, `BOOTSTRAP_ADMIN_1_FIRSTNAME`, `BOOTSTRAP_ADMIN_1_LASTNAME`, `BOOTSTRAP_ADMIN_1_EMPLOYEE_ID`, and the matching `_2_` values. The identities must have different email, username and employee ID values.

Do not configure or store bootstrap passwords. The script generates each initial password from a separate cryptographic random value.

## Test real email delivery without a project domain

For an isolated test database, Brevo SMTP can use an individually verified sender address while the customer's domain is not yet available. In Brevo, add a sender in Settings > Senders, Domains, IPs > Senders and complete the email verification. Activate transactional email sending if the account requires it. In Settings > SMTP & API, copy the SMTP login and create an SMTP key (not an API key).

Set `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=2525`, `SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=true`, `SMTP_USER` to the Brevo SMTP login, `SMTP_PASS` to the SMTP key, and `SMTP_FROM` to the verified sender address. Port 2525 avoids the standard SMTP ports blocked by Render Free. Keep SMTP credentials only in the local ignored `.env` or the deployment secret store. A sender address on a free email domain may be rewritten by Brevo and has limited deliverability; use a domain owned by the customer for the real deployment.

If an earlier bootstrap attempt created an ADMIN but email delivery failed, rerun the command after changing SMTP settings. It resumes the pending credential delivery without generating a new password. Do not change `TWO_FACTOR_ENCRYPTION_KEY` while delivery is pending.

## Provision and verify

Run `pnpm run prisma:bootstrap-admins` once the Production environment is loaded. For each new account, the owner receives an individual email containing the initial password and a separate email-verification message. The owner verifies their email, signs in, then enrolls an authenticator and saves recovery codes. The application does not force a password change. Keep the credential email private and delete it after placing the password in the approved password manager.

The command is safe to rerun. It does not duplicate an existing configured ADMIN, reset its password or change its 2FA state. If credential email delivery fails, a pending encrypted delivery record lets a rerun send the same initial password. The record is removed after successful delivery. Keep `TWO_FACTOR_ENCRYPTION_KEY` unchanged until all pending deliveries are complete. If an existing account has not verified its email, a rerun resends the verification message. Identity conflicts stop the bootstrap for manual resolution.

Run `pnpm run prisma:handover-check` as the release gate. It exits unsuccessfully until both configured accounts are active ADMINs, have verified email and have completed 2FA enrollment. It reports readiness only and does not modify accounts.

`pnpm run prisma:seed:demo` requires an explicit development-only flag and refuses `NODE_ENV=production`. `pnpm run prisma:reset` also refuses Production before running any migration or seed command.
