# Deployment runbook — VeriDraw SQL Server edition

## Local development
1. Connect to your local SQL Server Database Engine using SSMS. SQL Server TCP/IP must be enabled, using SQL authentication and a known port (usually 1433 when configured manually).
2. Create an empty `VeriDraw` database and map your SQL login to it (see [SQLSERVER_SETUP_GUIDE.md](../SQLSERVER_SETUP_GUIDE.md)).
3. Run `npm install`, copy `backend/.env.example` to `backend/.env`, set SQL credentials/admin credentials, generate VRF key, then run `db:migrate` and `db:admin`.
4. Run crypto/protocol tests, typecheck, build and the two dev servers.

## Public hosting (Phase 5)
1. Create a durable managed Microsoft SQL Server instance, such as Azure SQL Database. Local SQL Server Express on a student laptop is not publicly reachable by Render.
2. Use a *dedicated* database login. Do not use the server's administrator login in production. Prefer a least-privilege runtime account and a separate migration account. Back up the DB and maintain a recovery strategy.
3. Keep TLS enabled (`SQL_ENCRYPT=true`) and **validate the server certificate** (`SQL_TRUST_SERVER_CERTIFICATE=false`). Ensure outbound TCP connectivity from the app provider and restrict SQL Server inbound firewall rules appropriately.
4. Push verified source to GitHub. Use `render.yaml` to deploy the compiled React and Express app to one HTTPS origin. Supply all SQL secrets, `VRF_PRIVATE_KEY_HEX`, and `FRONTEND_ORIGIN=https://<actual-domain>` using Render secret environment variables. Set `NODE_ENV=production` and `ENABLE_DEMO=false`.
5. Run `npm run db:migrate` using migration permissions, create the organizer in a secure bootstrap run (use `db:admin`, avoid leaving the bootstrap password in long-lived app environment), then test `/api/health`, login, registration, lock, draw and verifier.
6. Store an externally witnessed commitment before the selected future beacon round. Preserve security test evidence and measured benchmarks; update the submitted PDF and PPTX.

## CI
`.github/workflows/ci.yml` launches a SQL Server 2022 service, waits for connectivity, creates the database, runs migrations, seeds CI administrator, runs unit/crypto suites, builds, and performs an API smoke test. The CI password is a **test-only** value and must not be reused.

## Known limits
A valid ECVRF proof does not establish honest input selection, independent timestamping, or inclusion of all eligible participants. Automatic scheduled execution is not implemented; the organizer clicks Execute Draw after the beacon round. This ZIP is not a live public deployment. A hosted SQL Server may require a paid provider. SQL Server Express is an available local option, not a mandatory production architecture.
