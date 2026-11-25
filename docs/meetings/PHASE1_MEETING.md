# Kickoff meeting agenda (all three members)

1. Confirm topic selected in instructor's topic sheet, assign the three names and student IDs.
2. Every member reads README, crypto protocol, threat model and API contract.
3. Member 3 creates a GitHub repo and invites other members.
4. Member 1 runs RFC 9381 compatibility suite first: this is a go/no-go gate.
5. Member 2 tests browser verification, certificate download and offline CLI.
6. Member 3 runs typecheck, build, CI and API smoke test.
7. At next merge review, show proof and beta from a real RFC test vector, a positive certificate, tampered negative certificate, and full test log.

### Definition of Phase 1 done
All three can clone/start the code; the three RFC vectors and negative tests pass; the generated JSON can be verified offline; API + browser demo works; integration checks pass; README is accurate; no private key is committed.
