# Verification and Test Plan

## Automated commands

1. `npm run test:protocol`: no third-party packages are needed; tests length prefix, roster normalization, alpha, winner mapping, drand round math, frozen commitment hashes.
2. `npm run test:crypto`: runs RFC 9381 vectors (Appendix B.3 Examples 16–18), tampered inputs, proof and public keys, and modified certificate attacks. Requires ECVRF package.
3. `npm run typecheck && npm run build`: checks TypeScript frontend/backend, compiles assets.
4. `npm run db:migrate && npm run db:admin`: initialize SQL Server and admin.
5. Start API `npm start`; run `npm run test:smoke`: tested login, CSRF, duplicate entries, lock, double lock, premature draw, ECVRF demo verification.
6. `npm run security:bench`: timestamp + certificate-size measurements for 10/100/1000 participants.
7. Manual: in browser create/enter/lock, externally timestamp commitment, wait for Quicknet round, draw, upload certificate from an unauthenticated browser, verify with CLI `--online`, compare certificate to externally published commitment hash and timestamp.

## Expected outcomes

- A normal valid certificate produces `valid=true`.
- Altering proof, alpha, beta, public key, roster, beacon value, commitment hash, or winner causes `valid=false`.
- Two concurrent draw calls: exactly one DRAWN result; the other gets a conflict. No duplicated result rows.
- Prior to lock deadline, participant operations are possible; after the lock, registration must be rejected with HTTP 409.
- Endpoint changes should not expose `VRF_PRIVATE_KEY_HEX`, admin password, session token, or DB connection string.

## Current authoring-environment execution

Only the dependency-free protocol unit suite could execute in the artifact-authoring environment because the npm registry DNS lookup failed. This is **not** a statement that the full cloud app passed. CI is configured to run crypto, build, and SQL Server integration checks once connected to GitHub and npm.
