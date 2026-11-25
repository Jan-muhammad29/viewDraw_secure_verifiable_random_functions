# VeriDraw Threat Model and Security Evaluation (revised)

## Assets, adversaries, and scope

Assets: ECVRF private seed, admin password/session, authoritative SQL Server roster, published precommitment, beacon chain identity, final proof/winner, participant personal data.

Adversaries: (A1) public participant trying to register duplicate IDs, alter winner/proof; (A2) unauthorized browser submitting admin requests; (A3) organizer trying to manipulate the roster, key, timing, or suppress an unfavorable draw; (A4) network adversary tampering with drand beacon responses or REST traffic; (A5) attacker obtaining the organizer's private key or DB access.

Trust boundaries: browser -> HTTPS backend; backend -> persistent database; backend -> signed drand randomness; organizer's statements -> public independent verifier. A compromised organizer is *not* prevented from silently dropping eligible participants before roster locking without external eligibility records.

## Threat matrix

| Threat | Mechanism | Mitigation | Remaining limitation |
|---|---|---|---|
| Proof substitution | Send fake `pi` | `verifyVRF(pk,alpha,pi)` | Requires properly reviewed RFC library |
| Changed winner | Edit `winnerIndex`/`winnerId` | Independently rerun rejection sampling | None for the same public inputs |
| Late roster edit | Append after lock | DB lock + stored canonical commitment | Malicious database operator could replace both unless externally published |
| Input grinding | Change alpha/key/roster to bias outcome | Fix future drand round, key ID, roster before event | A dishonest organizer can refuse to lock or refuse to publish |
| Fake beacon | Replace drand response | `drand-client` BLS check with pinned chain | Offline math alone cannot validate BLS source |
| Unauthorized organizer commands | Guess session/CSRF | Random tokens, HttpOnly cookie, CSRF header, Origin check, rate limits | Phishing/compromised browser possible |
| Replay/double draw | Concurrent POSTs | Status claim atomic UPDATE, unique DB result row | Owner could delete database; backup evidence externally |
| Key theft | Leak env/seed | Cloud secret store, no seed in APIs, rotation/revocation | Compromised host is outside local app defense |
| Participant impersonation | Register someone else's public code | Unique code and rate limiting | **Not solved:** real prize raffle needs identity ownership/authentication |
| Secret leakage from logs | Debug prints | Do not log seed/session token | Log access, cloud environment policies must be audited |

## Attack demos

1. Generate a proof. Flip one hex byte of the proof; independent verification fails.
2. Change `winnerId` only; selection check fails.
3. Change participant name; roster hash check fails.
4. Change alpha, beacon or key; proof/input binding fails.
5. Reuse participant ID after registering; SQL unique constraint returns 409.
6. Send admin POST with no session (401) and session without CSRF (403).
7. Try a second lock or a draw before the fixed future beacon; API returns 409.
8. Change `lockedAt` while holding old commitment hash; commitment check fails. If organizer changes both and republishes post-event, only an independent timestamped commitment proves timing.

## Important limitations (do not overstate)

- A valid ECVRF proves one output is correct *for a given key and input*. It does NOT prove eligibility, informed consent, fairness in roster creation, availability, or non-suppression.
- `computeCommitmentHashHex` is tamper-evident once its value is independently anchored. A value only printed on the organizer's own site is not independent timestamp proof.
- Offline verification checks drand signature `SHA-256` consistency, not BLS authenticity. Use `--online` to query a verified drand client. A full offline BLS verifier with archived trusted chain info is future work.
- This educational app has not undergone an independent cryptographic audit, penetration test, or production threat-model signoff.
- Passwords/sessions and participant identities are reference implementation only. No production-grade email verification, MFA, per-participant account ownership, or deletion/retention portal.
- HTTPS, managed SQL Server, secrets, backup, and monitoring must be configured during real cloud deployment.

## Metrics / reproducibility

`npm run security:bench` measures end-to-end creation/verification and JSON certificate bytes at 10/100/1000 participants. Record actual hardware, Node version, OS, dependency hashes, and timing results. **Do not fabricate results**. The offline protocol tests pass in the authoring runtime; ECVRF tests and deployment remain pending external dependency installation.
