# Three-member delivery workstreams

The instructor requires exactly three students. Assign names to M1, M2, and M3 before a pull request is opened. Pair reviews are mandatory at integration boundaries.

| Member | Owns | Phases | Deliverables / review gate |
|---|---|---|---|
| M1 Cryptography/security | `shared/`, `verifier-cli/`, `backend/tests/`, `docs/security/` | 1–4 | RFC vectors, key ID, canonical encoding, public verification, tampering tests; review claims about fairness |
| M2 Frontend/UX | `frontend/`, report visuals and slides | 2–5 | React dashboard, user/organizer flows, accessible input/error states, public JSON import/export, demo script |
| M3 Backend/database/deployment | `backend/`, `docker-compose.yml`, `.github/`, `render.yaml` | 2–5 | Auth, SQL and migrations, atomic draw, API, live hosting, README and cloud secrets handling |

## Branches and example commits

- `feat/crypto-ecvrf` -> `test(crypto): pass RFC9381 vectors and tamper cases`
- `feat/frontend-raffle` -> `feat(ui): implement register/lock/verify workflows`
- `feat/backend-db` -> `feat(api): enforce atomic draw and persisted commitments`
- `docs/security-report` -> `docs: map protocol and demonstrate input grinding limitation`
- `release/deployment` -> `ci: add SQL Server integration and cloud deployment`

## Integration contract

M1 maintains `shared/src/index.d.ts`, public certificate and selection rules. M2 consumes those exact types. M3 must not change the immutable protocol input without M1's review; all services must recompute the same roster hash. Each PR includes tests and a short note about threats or misuse.

## Definition of done for the group

- Clean cloned checkout with npm dependencies can run unit, crypto, build, smoke, and benchmark scripts.
- One real hosted URL and one GitHub URL; credentials are not stored in source.
- Public participant independently verifies published certificate and future beacon.
- Outside timestamp of commitment (such as GitHub commit) predates drand event; verified in demo.
- Every member can describe the ECVRF algorithm and fairness limitations without reading the slide text.
