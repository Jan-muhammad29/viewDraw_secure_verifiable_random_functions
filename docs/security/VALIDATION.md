# Validation ledger — Phases 1–5

## Completed in this artifact-generation environment
- Node.js v22.16.0 present.
- `npm run test:protocol`: **7 PASS / 0 FAIL** (length-prefix separation, roster determinism, duplicates, input binding, index bounds).
- `node --check shared/src/protocol.js`, `node --check shared/src/verify.js`, `node --check verifier-cli/verify.mjs`: passed.
- RFC B.3 Examples 16, 17, 18 seed/key/input/proof/beta test data embedded in test file, lengths confirmed: seed 32 bytes; PK 32; proof 80; beta 64.

## Not run here (blocked by npm registry access)
- `npm install` and package integrity verification.
- RFC 9381 library conformance suite (`npm run test:crypto`).
- Frontend and Express runtime integration.
- Browser ECVRF verification, TypeScript compile, production build.

**The cryptographic integration is NOT yet validated in this environment.** The full-stack source for Phases 2–5 has been authored but must not be certified as operational until npm-driven cryptographic, database, and cloud tests pass. Treat the package as a candidate, not a security-audited primitive.

## Member 1 validation checklist (fill after running)
| Check | Status | Expected |
|---|---|---|
| `npm install` | PENDING | package resolves, integrity preserved |
| RFC 9381 B.3 Example 16 | PENDING | byte-for-byte proof and beta |
| RFC 9381 B.3 Example 17 | PENDING | byte-for-byte proof and beta |
| RFC 9381 B.3 Example 18 | PENDING | byte-for-byte proof and beta |
| Modified alpha | PENDING | false |
| Modified PK | PENDING | false |
| Modified proof | PENDING | false |
| Altered certificate output | PENDING | invalid |
| Altered winner/roster | PENDING | invalid |
| Browser independent verification | PENDING | valid with same certificate |
| CLI independent verification | PENDING | valid with same certificate |
| Typecheck + frontend/backend build | PENDING | no errors |

Record the date, machine, Node/npm version, package-lock hash and test console output here when the tests have actually run.
