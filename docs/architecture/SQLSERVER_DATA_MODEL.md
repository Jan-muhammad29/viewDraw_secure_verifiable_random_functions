# Microsoft SQL Server data model & migration notes

The SQL Server 2019+/Azure SQL migration is `backend/db/schema.sql`. It creates `dbo.admins`, `dbo.sessions`, `dbo.vrf_keys`, `dbo.raffles`, `dbo.participants`, `dbo.draw_results`, and `dbo.audit_logs` idempotently. Existing PostgreSQL data is **not migrated**.

- UUID (`uuid`) -> `UNIQUEIDENTIFIER`.
- PostgreSQL `TIMESTAMPTZ` -> SQL Server `DATETIME2(3)` with UTC convention and `SYSUTCDATETIME()`.
- PostgreSQL `JSONB` -> `NVARCHAR(MAX)` guarded by `ISJSON()` checks; JSON is parsed in the API when read.
- PostgreSQL `SERIAL`/identity -> `BIGINT IDENTITY(1,1)`.
- PostgreSQL `$1` placeholders -> bound parameters `@p1` through the `backend/src/db.ts` request layer.
- `FOR UPDATE` -> `WITH (UPDLOCK,HOLDLOCK)` inside serializable transactions.
- `RETURNING *` -> `OUTPUT INSERTED.*` on atomic draw claim.
- `ON CONFLICT DO NOTHING` -> concurrency-safe `IF NOT EXISTS` with lock hints.
- Uniqueness errors are SQL Server codes 2601/2627 (not PostgreSQL 23505).

The raffle state machine, proof fields, commitment hash and winner-index algorithm remain unchanged by the database driver migration. All private ECVRF seeds stay outside the database. The application maintains **one draw_result per raffle** by a primary key on `raffle_id`.
