# CS-3002 Assignment Requirement Traceability

| Instructor requirement | Implementation/evidence | Outstanding external action |
|---|---|---|
| Exactly 3 members | `docs/team/WORKSTREAMS.md` | Supply three names / GitHub invitations |
| Cryptographic core / standard libraries | `shared/`, `backend/src/crypto/`, RFC vectors in `backend/tests/` | Install and execute crypto dependency tests |
| Key lifecycle | `backend/src/crypto/keyManager.ts`, `POST /api/keys/current/revoke` | Store seed in host secret manager |
| Threat model | `docs/security/THREAT_MODEL.md` | Review in class |
| Modular architecture, DFD | `docs/architecture/ARCHITECTURE.md` | None |
| Full-stack functional prototype | React, Express, SQL Server | Install, run and capture live screenshots |
| User guidance | Security page, inline warnings, README | Conduct usability evaluation |
| GitHub + README + commits | Repository, CI workflow, docs | Publish repository and team commits |
| Cloud hosting, REST | Render `render.yaml`, Express routes | Cloud account, HTTPS, managed DB and secrets |
| Attack evaluation and mitigations | `backend/tests/attack.test.mjs`, `scripts/smoke.mjs`, threat model | Run against deployed endpoint; record empirical outputs |
| Security vs usability | `scripts/benchmark.mjs`, report discussion | Measure actual timings on target hardware |
| Technical PDF | `docs/report/VeriDraw_Technical_Report.pdf` | Add actual team names/deployment results |
| Presentation PPTX/PDF | `docs/presentation/VeriDraw_Presentation.pptx` | Practice not reading slides |
| Live in-class demonstration | `docs/DEMO_AND_VIVA.md` | Deploy & conduct demonstration |
| Ask next group's question | Q&A in `docs/DEMO_AND_VIVA.md` | Adapt to next group's topic |
| Topic-selection sheet links | Submission checklist in README | Paste GitHub and hosted URLs; no GCR upload |
