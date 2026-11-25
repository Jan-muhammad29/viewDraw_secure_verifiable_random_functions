# HTTP API Contract

Base: `/api`; JSON bodies; error responses `{error:string}`. Admin sessions: `veridraw_session` HttpOnly cookie with `x-csrf-token` on state-changing routes; frontend requests use `credentials:include`. All dates are ISO 8601 with timezone.

| Route | Authentication | Request | Response |
|---|---|---|---|
| `POST /auth/login` | None | `{email,password}` | `{email,csrf}` + cookie |
| `GET /auth/me` | Optional | None | `{loggedIn,email?,csrf?}` |
| `POST /auth/logout` | Admin + CSRF | `{}` | `{ok:true}` |
| `GET /keys/current` | Public | - | `{keyId,publicKeyHex,suite}` |
| `POST /keys/current/revoke` | Admin + CSRF | `{}` | `{ok,keyId,warning}` |
| `POST /raffles` | Admin + CSRF | `{title,description,drawAt:ISO}` | Raffle JSON incl. `beaconRound`, `lockDeadline` |
| `GET /raffles` | Public | - | Array of raffles |
| `GET /raffles/:id` | Public | - | One raffle |
| `GET /raffles/:id/participants` | Public | - | ASCII-sorted `[{id,name}]` |
| `POST /raffles/:id/participants` | Public | `{id,name}` | `{id,name}`; 409 on duplicate/closed |
| `POST /raffles/:id/lock` | Admin + CSRF | `{}` | `{commitment,commitmentHashHex,participants}` |
| `GET /raffles/:id/commitment` | Public | - | Commitment with keys and warning |
| `POST /raffles/:id/draw` | Admin + CSRF | `{}` | `DrawCertificate` after drand round exists |
| `GET /raffles/:id/result` | Public | - | `DrawCertificate` |
| `GET /raffles/:id/certificate` | Public | - | Downloadable JSON |
| `POST /verify` | Public | `DrawCertificate` | `{valid,checks,fairnessStatus}` |
| `GET /admin/audit` | Admin | - | Latest audit entries |

New raffles must target a future Quicknet round at least 2 minutes after creation. Lock deadline is 30 seconds before round. The raffle cannot draw until round has been produced and verified. API 409 means conflict/state transition not allowed.
