# Presentation script and targeted viva preparation

## In-class demonstration (about 6-8 minutes; adapt to your allocation)

1. Member 2: show responsive frontend and public raffle list; explain why public verification matters.
2. Member 3: sign in as organizer; create a raffle with a future Quicknet time, register three to five demo participant codes. Explain scrypt sessions, CSRF, database transactions, unique participant codes.
3. Member 1: show the ECVRF public key and suite. Freeze the roster and **externally timestamp the commitment**; explicitly describe trust implications.
4. During the scheduled round: execute draw (can be pre-prepared if class timing is short), display winner, alpha, beta, proof, and drand signature.
5. Member 2: download JSON; upload from another browser / run `node verifier-cli/verify.mjs cert.json --online` and observe cryptographic checks. Offline math is independent of server.
6. Member 1: modify winner or participant name in a JSON copy; show rejected verification. Explain that server refusal/suppression is not solved by ECVRF.
7. Member 3: show GitHub, deployed URL, tests, and report; disclose demo mode and deployment limitations if any.

## High-value viva questions

**What makes ECVRF distinct from a CSPRNG?** Output is deterministic under secret key and input but publicly verifiable using `PK` + proof.

**Is an Ed25519 signature the same as ECVRF proof?** No; different suite and proof construction; ECVRF uses RFC 9381 Ed25519-based VRF algorithms.

**Why not modulo?** Unconditional modulo of a fixed-range random integer favors low residues when range is not divisible by participant count. Counter-based 64-bit rejection sampling eliminates this bias under hash pseudorandomness assumptions.

**Why domain separation and length prefix?** Prevent ambiguities/collisions among field concatenations and uses of hashes for different protocol operations.

**What if two organizers submit draw simultaneously?** SQL Server CAS-like conditional UPDATE claims status once; UNIQUE result ID prevents duplicate finalization.

**Does VRF prove there was no manipulation of the roster?** No; only hash plus independent early publication can make post-commit edits detectable.

**What if a dishonest organizer refuses to publish?** ECVRF cannot force publication. An external watchdog, rules about refunds/retries, and independent monitoring are required.

**How is drand authenticated?** `drand-client` checks the BLS signature against network identity; offline ECVRF proof verification alone does not establish the beacon is genuine.

**What if a private key is leaked?** Future draws using that key can be forged; revoke and replace key for future raffles. Historical proofs remain mathematically verifiable but confidence in chronology/authorization depends on key-exposure evidence.
