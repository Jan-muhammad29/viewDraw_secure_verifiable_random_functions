# VeriDraw — ECVRF-based publicly verifiable raffle

**CS-3002 Information Security | Topic 15 | Phases 1–5 reference implementation**

VeriDraw is a React + TypeScript, Express + TypeScript, and Microsoft SQL Server application implementing **RFC 9381 `ECVRF-EDWARDS25519-SHA512-TAI`**. It registers eligible participants, locks a canonical roster, commits to a future drand Quicknet round, runs a unique ECVRF draw, and exports a certificate that can be checked by an independent browser/CLI verifier. The repository includes tests, CI, containerized development database, deployment template, academic report, and presentation.

> **Important honesty and trust statement.** Cryptographically valid does not mean intrinsically fair. Proving input/output correspondence does not prove a participant's eligibility, prepublication of the roster, or resistance to selective draw suppression. A public commitment must be timestamped **outside VeriDraw before the beacon is revealed**. Use the online verifier to check drand's BLS signature; otherwise basic certificate verification does not authenticate beacon origin. The project is an educational **reference implementation**, not a certified real-money lottery or independently audited production service.

## Project status

| Phase | What is included | Verification |
|---|---|---|
| 1 | RFC test-vector tests, shared protocol, CLI verifier | Protocol tests executable offline; full ECVRF tests require `npm install` |
| 2 | Microsoft SQL Server schema, organizer login, sessions, CSRF, keys, create and register APIs | CI integration smoke checks defined |
| 3 | Lock roster, precommit future Quicknet round, draw, independent verification, React UI | Certificate and attack tests defined |
| 4 | Threat model, tampering tests, benchmark script, review notes | Execute after dependencies are installed |
| 5 | Render single-origin deployment blueprint, CI, report PDF, presentation PPTX, demo guide | **Cloud deployment not performed**: requires user's GitHub/cloud/database account and secrets |

## Prerequisites

Node.js 22+, npm, SSMS + SQL Server Database Engine, VS Code, Internet for initial dependency installation and drand draws. Windows PowerShell instructions follow; on Linux/macOS replace `npm.cmd` with `npm` and `Copy-Item` with `cp`.

## Quickstart — Microsoft SQL Server / SSMS (Windows)

See the complete [SQLSERVER_SETUP_GUIDE.md](SQLSERVER_SETUP_GUIDE.md). This version does not require PostgreSQL. Use your installed SQL Server Database Engine + SSMS; Docker is optional.

1. Use SSMS to create `VeriDraw` and the SQL-authenticated `veridraw_app` login. Enable SQL Server TCP/IP and determine its port, commonly 1433 when set as a static port.
2. From the project root, run `npm.cmd install`, `Copy-Item backend/.env.example backend/.env`, and `npm.cmd run keys:generate`.
3. Configure `backend/.env`: SQL_SERVER, SQL_PORT, SQL_DATABASE, SQL_USER, SQL_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD, and a private VRF seed.
4. Run `npm.cmd run db:migrate`, `npm.cmd run db:admin`, `npm.cmd run test:protocol`, `npm.cmd run test:crypto`, `npm.cmd run typecheck`, and `npm.cmd run build`.
5. Start the two development terminals: `npm.cmd run dev:backend` and `npm.cmd run dev:frontend`; open http://127.0.0.1:5173.
6. Optional Docker SQL Server uses `MSSQL_SA_PASSWORD` in a local root `.env`. Run `docker compose up -d db`, `npm.cmd run db:wait` and `npm.cmd run db:create` before migrations.
7. For public deployment, provision a **managed, externally reachable SQL Server/Azure SQL database**, enable TLS verification, and configure Render secrets. Local SQL Server cannot be accessed from a remote host via `localhost`.

## Scripts

| Command | Behavior |
|---|---|
| `npm run test:sqlserver` | Checks T-SQL schema, locks, driver and CI contracts (static tests only) |
| `npm run test:protocol` | Length prefixes, hashes, deterministic winner sampling, commitment arithmetic |
| `npm run test:crypto` | RFC 9381 Ed25519/SHA512/TAI vectors, invalid proofs, manipulated certificates |
| `npm run test:smoke` | Run integration test against a running database-backed API |
| `npm run security:bench` | Benchmarks roster preparation / proving / public verification at 10/100/1000 users |
| `npm run db:migrate` | Creates Microsoft SQL Server schema idempotently |
| `npm run db:admin` | Creates admin / resets password from environment variables |
| `npm run keys:generate` | Generates random 32-byte seed, **prints secret to terminal** for secure storage |
| `npm run build` | Compiles backend TS and builds React production bundle |
| `npm start` | Starts compiled backend (serves frontend bundle on same origin) |
| `npm run verify -- ./path/to/certificate.json --online` | Local ECVRF/roster/winner check; optional remote BLS beacon check |

## Main APIs

- `GET /api/health`, `GET /api/keys/current`
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/raffles`, `POST /api/raffles`, `GET /api/raffles/:id`
- `GET/POST /api/raffles/:id/participants`
- `POST /api/raffles/:id/lock`, `GET /api/raffles/:id/commitment`
- `POST /api/raffles/:id/draw`, `GET /api/raffles/:id/result`, `GET /api/raffles/:id/certificate`
- `POST /api/verify`, `POST /api/keys/current/revoke`, `GET /api/admin/audit`
- `POST /api/demo/draw` if **ENABLE_DEMO=true**, disabled in production.

All administrative mutating endpoints require the HttpOnly session cookie AND `x-csrf-token` obtained from login or `/api/auth/me`. Server validates trusted Origins. Participants can register without a session for class demo; identity ownership must be enforced before real prizes are offered. Public participants and their names become visible in certificates: use consent/test data.

## Raffle protocol (veridraw-v1)

1. Generate ECVRF seed securely. Public key `PK` derives `keyId`; private key remains in backend secret storage. Fix `PK`, `raffleId`, and future drand Quicknet round before the draw.
2. Accept unique, lowercase public participant codes. Sort in ASCII order, then hash the domain-separated length-prefixed canonical participant roster with SHA-256.
3. Lock with one Microsoft SQL Server transaction (uses serializable transactions and UPDLOCK/HOLDLOCK). Record roster, hash, promised beacon round, key ID, and self-reported `lockedAt`. Compute a domain-separated commitment hash. This must be externally timestamped before the round for trustworthy chronology.
4. At or after `roundAt`, drand-client checks the chain identity and BLS signature of the chosen round. Compose `alphaHex` from immutable fields and beacon output.
5. Prove ECVRF using the private key. Hash-derived beta (64 bytes) drives SHA-256/64-bit rejection sampling into a uniform participant index. Draw is finalized atomically and can only happen once.
6. Publish proof, beta, alpha, key, roster, commitment, beacon signature, index, and winner as JSON. The offline verifier recalculates without private keys. `--online` additionally verifies drand BLS authenticity.

### Fairness boundaries

A self-supplied `lockedAt` and a SHA-256 hash inside the server's database do NOT independently prove a prior publication. Before demo draw, publish commitment hash into GitHub commit history, an institution timestamping service, or a trusted external witness; retain proof. The current CLI verifies cryptography and beacon, **not** external timestamp authenticity. The organizer can still refuse to draw if an outcome is unfavorable. This requires an independent watchdog/automated publication channel for stronger fairness. Drawing with an exposed development key is not suitable for actual prize distribution.

## Security and privacy

- Server uses scrypt password hashing, random 256-bit session tokens (only SHA-256 hashes persisted), HttpOnly SameSite=Lax cookies, same-origin hosting, CSRF checks, input validation, basic rate-limits, and Helmets security headers.
- Protect and rotate `VRF_PRIVATE_KEY_HEX` via cloud secrets; revocation blocks future draws but old proofs remain independently verifiable with historical public key.
- No arbitrary file paths from HTTP input, no SQL string interpolation of user values, transaction boundaries around participant insertion/roster freeze/finalization.
- SQL Server SSL depends on `SQL_ENCRYPT=true`/`SQL_TRUST_SERVER_CERTIFICATE=false` and a proper trusted CA; do not disable certificate verification in production.
- Threat model and known shortcomings: [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md).

## Team ownership

1. **Member 1 — Cryptography/security**: `shared/`, cryptography tests, threat model, benchmark, verifier.
2. **Member 2 — Frontend/UX**: `frontend/`, browser verification, visual story, demo.
3. **Member 3 — Backend/DB/DevOps**: `backend/`, Microsoft SQL Server, authentication, CI, hosting.

Assign actual names and GitHub accounts before submission. Use separate feature branches and peer-reviewed pull requests.

## Source references

- [RFC 9381 — Verifiable Random Functions](https://www.rfc-editor.org/rfc/rfc9381.html)
- [@collectorcrypt/ecvrf source](https://github.com/collectorcrypt/cc-vrf/tree/main/packages/ecvrf)
- [drand client](https://github.com/drand/drand-client)
- [drand developer portal](https://drand.love/developer)
- [Render deployment docs](https://render.com/docs/free)

## Submission checklist

Push full source and generated documentation to GitHub, deploy a working instance to a provider with a durable database and protected secrets, verify it from an untrusted browser, and **paste repository URL + hosted URL into the instructor's topic-selection sheet**. The report and presentation are in `docs/report/` and `docs/presentation/`. No GCR submission per the assignment.
