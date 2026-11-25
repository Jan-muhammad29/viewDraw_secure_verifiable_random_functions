# VeriDraw SQL Server conversion summary

This folder is the full Phase 1–5 VeriDraw repository with its persistence layer replaced by Microsoft SQL Server. It is **not** a patch to apply to a running PostgreSQL database; existing PostgreSQL rows are not migrated.

## Updated backend files

- `backend/src/db.ts`: `mssql`/Tedious connection pool, secure positional argument binding via named parameters, SERIALIZABLE transactions, SQL Server unique-error mapping.
- `backend/src/raffles.ts`: T-SQL `TOP`, `WITH (UPDLOCK,HOLDLOCK)`, `SYSUTCDATETIME()`, atomic `OUTPUT INSERTED.*` draw claim, JSON text parsing for roster and certificates.
- `backend/src/auth.ts`: UTC session expiry with `DATEADD`.
- `backend/src/crypto/keyManager.ts`: concurrency-safe key-record registration without PostgreSQL ON CONFLICT.
- `backend/src/server.ts`: T-SQL audit query and JSON decoding, SQL Server error handling.
- `backend/db/schema.sql`: idempotent SQL Server 2019+ DDL with JSON constraints and unique result row per raffle.
- `backend/scripts/*.mjs`: SQL Server migration, administrator bootstrap, optional database creation and connection wait.
- `.github/workflows/ci.yml`: SQL Server 2022 container, migration, integration smoke stage.
- `render.yaml`: separate externally reachable SQL Server / Azure SQL configuration.
- `SQLSERVER_SETUP_GUIDE.md`: Windows + SSMS instructions, authentication, TCP/IP, TLS, and cloud deployment caveats.
- Reports and presentation reissued to reflect SQL Server.

## Local test evidence

- `npm run test:protocol`: **7 passed**.
- `npm run test:sqlserver`: **4 passed** (source/contract checks, not a real SQL connection).
- Backend `.ts` syntax checked with Node 22 experimental strip-types parser.
- **Not run:** `npm install`, `test:crypto`, TypeScript typecheck, build, SQL Server migration against an actual instance, smoke test and live public deployment. The artifact authoring environment cannot connect to npm registry and has no SQL Server engine. Verify these before university submission.

## Security and operational caveats

Use separate production application and migration logins; keep `SQL_TRUST_SERVER_CERTIFICATE=false` against a trusted TLS endpoint in production. Keep secret seeds and passwords out of Git. SQL Server Express/Developer and Azure SQL differ in network/firewall/deployment setup. The original raffle fairness trust assumptions have not changed: external precommitment witnessing is required for a stronger public fairness claim.
