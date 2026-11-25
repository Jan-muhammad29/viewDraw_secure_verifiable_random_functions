# VeriDraw – Microsoft SQL Server edition (Windows / SSMS)

This is the SQL Server conversion of the Phase 1–5 VeriDraw project. **No PostgreSQL is used.** React, Express, ECVRF, drand, public certificate verification, and the team workstreams are retained. SQL Server 2019+/2022/Express (TCP/IP) or Azure SQL is supported by the `mssql` (Tedious) client. This starter uses **SQL authentication**; Windows Integrated authentication is not enabled by default.

## Before starting

- Node.js 22+, VS Code, SSMS and **SQL Server Database Engine** installed (SSMS on its own is NOT a database server).
- A running local SQL Server service, e.g. SQL Server 2022 Express/Developer. For this version, allow SQL Server Authentication (Mixed Mode) and enable TCP/IP in SQL Server Configuration Manager. Restart SQL Server service after changing authentication or TCP/IP settings.
- Your SQL Server TCP port, often 1433 if you assigned it statically; SQL Server Express named instances often use dynamic ports. **The TCP port in `SQL_PORT` must match the actual instance port.**
- Existing data in a PostgreSQL deployment is **not migrated**: this project creates a new SQL Server database. Export/import is a separate task.

## A. Set up the database using SSMS (recommended; no Docker)

1. Start SSMS. Connect with a SQL Server sysadmin login to the Database Engine (usually `localhost` or `localhost\SQLEXPRESS` in SSMS).
2. Choose **New Query** and run:

```sql
USE master;
GO
IF DB_ID(N'VeriDraw') IS NULL CREATE DATABASE VeriDraw;
GO
IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'veridraw_app')
    CREATE LOGIN veridraw_app WITH PASSWORD = 'REPLACE_WITH_A_UNIQUE_STRONG_PASSWORD!';
GO
USE VeriDraw;
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'veridraw_app')
    CREATE USER veridraw_app FOR LOGIN veridraw_app;
GO
ALTER ROLE db_owner ADD MEMBER veridraw_app;
GO
```

Replace the password string first. The `db_owner` role is convenient for **local development and schema migration only**. A production application should use a restricted runtime database principal, and schema migrations should be run using a separate migration principal.

3. In SSMS > SQL Server Configuration Manager, ensure TCP/IP is enabled. If your instance is `SQLEXPRESS`, look in TCP/IP Properties > IP Addresses > `IPAll`. Use a fixed TCP port (e.g. `1433` if available), clear TCP Dynamic Ports, restart the SQL Server service, and set the same `SQL_PORT` in the `.env` file. SSMS connecting via shared memory does not prove TCP/IP is enabled.
4. Optionally use Windows PowerShell to test TCP: `Test-NetConnection 127.0.0.1 -Port 1433`. A `TcpTestSucceeded : True` result only proves network access, not SQL login permissions.

### Optional: Docker instead of an installed SQL Server

Docker SQL Server needs **significantly more free memory than SQLite**. It is not recommended on a constrained laptop if SQL Server Express is already installed.

Copy a root `.env` file with `MSSQL_SA_PASSWORD=<long-strong-sql-password>` (only used by Docker Compose; do not commit), and run:

```powershell
docker compose up -d db
```

Use `SQL_USER=sa` and the same password in `backend/.env`, then run `npm.cmd run db:wait`, `npm.cmd run db:create`, and the migration. Microsoft SQL Server Docker setup is documented at https://learn.microsoft.com/sql/linux/install-upgrade/quickstart-install-docker.

## B. Configure the application

Extract the ZIP into e.g. `C:\Projects\VeriDraw_SQLServer` (avoid OneDrive-synced `node_modules`). Open that folder in VS Code.

From the **repository root** in Windows PowerShell:

```powershell
node --version
npm.cmd --version
npm.cmd install
Copy-Item backend/.env.example backend/.env
npm.cmd run keys:generate
```

Now open `backend/.env` in VS Code and edit:

```dotenv
SQL_SERVER=127.0.0.1
SQL_PORT=1433
SQL_DATABASE=VeriDraw
SQL_USER=veridraw_app
SQL_PASSWORD=THE_SAME_PASSWORD_YOU_CREATED_IN_SSMS
SQL_ENCRYPT=true
SQL_TRUST_SERVER_CERTIFICATE=true
VRF_PRIVATE_KEY_HEX=PASTE_YOUR_RANDOM_64_CHARACTER_HEX_SEED
ADMIN_EMAIL=organizer@example.test
ADMIN_PASSWORD=CHOOSE_ANOTHER_STRONG_UNIQUE_PASSWORD
FRONTEND_ORIGIN=http://127.0.0.1:5173
PORT=5000
NODE_ENV=development
ENABLE_DEMO=true
```

Do not type uppercase placeholder strings verbatim. Use the real SQL password, a securely generated random key, and a separate admin password at least 14 characters long. `SQL_TRUST_SERVER_CERTIFICATE=true` is **only for a local self-signed SQL Server certificate**. For Azure SQL / a production database, set it to `false` and require properly trusted TLS. If you use another SQL TCP port, change `SQL_PORT` accordingly.

No `DATABASE_URL`, `PGSSL`, PostgreSQL container, or `pg` package is required.

## C. Initialize, test, and build

From the project root:

```powershell
npm.cmd run db:migrate
npm.cmd run db:admin
npm.cmd run test:protocol
npm.cmd run test:sqlserver
npm.cmd run test:crypto
npm.cmd run typecheck
npm.cmd run build
```

- `db:migrate`: creates SQL Server tables and indexes idempotently.
- `db:admin`: creates/resets the organizer account in SQL Server.
- `test:sqlserver`: dependency-free SQL Server migration and query contract checks (not a live DB test).
- `test:protocol`: dependency-free roster, commitment and winner algorithm checks.
- `test:crypto`: RFC 9381 proof/test-vector checks; do not proceed if these fail.
- `typecheck` and `build`: should finish with no errors before a deployment.

Check the database from SSMS:

```sql
USE VeriDraw;
GO
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA='dbo' AND TABLE_TYPE='BASE TABLE'
ORDER BY TABLE_NAME;
GO
SELECT TOP 5 * FROM dbo.admins;
GO
```

Expected tables: admins, sessions, vrf_keys, raffles, participants, draw_results, audit_logs.

## D. Run the full application

Open two terminals at the **root** of the project:

**Terminal 1:**

```powershell
npm.cmd run dev:backend
```

**Terminal 2:**

```powershell
npm.cmd run dev:frontend
```

Open http://127.0.0.1:5173 in your browser. API status: http://127.0.0.1:5000/api/health.

1. First click the **Proof verification** section and generate + verify a local DEMO_NOT_FAIR certificate.
2. Log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `backend/.env`.
3. Create a raffle with draw time around 10 minutes in the future.
4. Register e.g. member-1/Ali, member-2/Sara, member-3/Hamza.
5. Freeze roster, download commitment and independently timestamp it **before** beacon release.
6. After the scheduled drand round, click Execute Draw (it does not run automatically).
7. Download certificate, verify through browser or `node verifier-cli/verify.mjs <certificate-path> --online`.
8. Change the certificate's `winnerId` in a copy and verify rejection.
9. With backend still running, set test credentials for the smoke test:

```powershell
$env:ADMIN_EMAIL='organizer@example.test'
$env:ADMIN_PASSWORD=Read-Host 'Enter organizer password'
npm.cmd run test:smoke
Remove-Item Env:\ADMIN_PASSWORD
npm.cmd run security:bench
```

## E. SQL Server specific troubleshooting

| Problem | What to check |
|---|---|
| `ESOCKET`, `ECONNREFUSED`, `ETIMEOUT` | SQL Server service running; `SQL_SERVER`, `SQL_PORT`; TCP/IP enabled; Windows firewall. |
| `Login failed for user 'veridraw_app'` (18456) | Mixed Mode authentication enabled; SQL login enabled and mapped to database; correct password. |
| `Cannot open database ... requested by the login` (4060) | Create `VeriDraw` in SSMS and grant the SQL login access; verify database name. |
| `The certificate chain was issued by an authority that is not trusted` | For local self-signed SQL Server only, set `SQL_TRUST_SERVER_CERTIFICATE=true`. Use a trusted TLS certificate for production. |
| `EADDRINUSE:5000` | Another app using backend port; stop it or update backend port and `frontend/vite.config.ts`. |
| Database migration permission denied | Use an account permitted to create tables/indexes, e.g. `db_owner` for local learning. |
| `Cannot find module 'mssql'` | Execute `npm.cmd install` in the repo root, check npm connectivity. |
| `node_modules` changed after replacing the old ZIP | Delete stale `node_modules` and `package-lock.json` if created from the PostgreSQL edition, then `npm.cmd install`. |
| `SQL Server does not exist or access denied` with SSMS working | SSMS may use Shared Memory while Node uses TCP; enable TCP/IP + static SQL_PORT. |

## F. Deployment (Phase 5)

The included `render.yaml` deploys React + Node on Render, but **the database must be an externally reachable durable SQL Server or Azure SQL instance**. A SQL Server on `127.0.0.1` / `localhost` on your laptop is **not reachable from Render**.

1. Use Azure SQL Database or a hosted Microsoft SQL Server, create database `VeriDraw` and a SQL login with correct permissions.
2. Ensure hosting/network/firewall allows outbound TCP 1433 and only approved app egress IPs if feasible. Azure SQL firewall rules and TLS certificate verification are required.
3. Configure Render secrets `SQL_SERVER`, `SQL_PORT`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD`, `VRF_PRIVATE_KEY_HEX`, `FRONTEND_ORIGIN`, `SQL_ENCRYPT=true`, `SQL_TRUST_SERVER_CERTIFICATE=false` and `NODE_ENV=production`, `ENABLE_DEMO=false`.
4. Run migration and secure admin bootstrap as deployment tasks. Never put credentials in GitHub or the report.
5. Run real integration tests, verify independent certificates and publish the actual GitHub and hosted links to your instructor's selection sheet.

The deployed service and external DB may incur charges; the ZIP does **not** create them automatically. Keep the report/presentation in `docs/` updated with actual benchmark numbers, member names, and deployment evidence.

## Team responsibilities

- **Member 1 (Security/Crypto):** `shared/`, ECVRF, verifier and tests.
- **Member 2 (Frontend):** `frontend/`, browser verification UI and presentation.
- **Member 3 (SQL Server/Backend/DevOps):** `backend/`, `backend/db/schema.sql`, `backend/src/db.ts`, migrations, `.github/workflows/ci.yml`, deployment.

## Notes on correctness and fairness

Cryptographic proof verification does not prove the organizer picked participants fairly, and the server's lock timestamp is not an externally trusted timestamp. Release of a future drand beacon and prior independent publication of the commitment are separate requirements for stronger fairness. Do not use this university demonstration to distribute valuable prizes without professional security review.
