/* SQL Server 2019+ / Azure SQL; execute on the VeriDraw database (not master).
   Idempotent DDL. Use backend/db/00-create-database.sql in SSMS first if needed. */
SET NOCOUNT ON;
IF OBJECT_ID(N'dbo.admins',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.admins (
   id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_admins PRIMARY KEY,
   email NVARCHAR(320) NOT NULL CONSTRAINT UQ_admins_email UNIQUE,
   password_salt CHAR(32) NOT NULL,
   password_hash CHAR(128) NOT NULL,
   created_at DATETIME2(3) NOT NULL CONSTRAINT DF_admins_created DEFAULT SYSUTCDATETIME()
 );
END;
IF OBJECT_ID(N'dbo.sessions',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.sessions (
   token_hash CHAR(64) NOT NULL CONSTRAINT PK_sessions PRIMARY KEY,
   admin_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.admins(id) ON DELETE CASCADE,
   csrf_token CHAR(64) NOT NULL,
   expires_at DATETIME2(3) NOT NULL,
   created_at DATETIME2(3) NOT NULL CONSTRAINT DF_sessions_created DEFAULT SYSUTCDATETIME()
 );
END;
IF OBJECT_ID(N'dbo.vrf_keys',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.vrf_keys (
   key_id CHAR(64) NOT NULL CONSTRAINT PK_vrf_keys PRIMARY KEY,
   public_key_hex CHAR(64) NOT NULL CONSTRAINT UQ_vrf_keys_public UNIQUE,
   suite NVARCHAR(100) NOT NULL,
   revoked_at DATETIME2(3) NULL,
   created_at DATETIME2(3) NOT NULL CONSTRAINT DF_keys_created DEFAULT SYSUTCDATETIME()
 );
END;
IF OBJECT_ID(N'dbo.raffles',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.raffles (
   id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_raffles PRIMARY KEY,
   title NVARCHAR(120) NOT NULL,
   description NVARCHAR(1000) NOT NULL CONSTRAINT DF_raffles_description DEFAULT N'',
   status VARCHAR(12) NOT NULL CONSTRAINT DF_raffles_status DEFAULT 'OPEN',
   key_id CHAR(64) NOT NULL REFERENCES dbo.vrf_keys(key_id),
   beacon_round BIGINT NOT NULL,
   round_at DATETIME2(3) NOT NULL,
   lock_deadline DATETIME2(3) NOT NULL,
   locked_at DATETIME2(3) NULL,
   roster_json NVARCHAR(MAX) NULL,
   roster_hash CHAR(64) NULL,
   commitment_hash CHAR(64) NULL,
   claim_at DATETIME2(3) NULL,
   created_at DATETIME2(3) NOT NULL CONSTRAINT DF_raffles_created DEFAULT SYSUTCDATETIME(),
   CONSTRAINT CK_raffles_status CHECK(status IN ('OPEN','LOCKED','DRAWING','DRAWN')),
   CONSTRAINT CK_raffles_beacon_round CHECK(beacon_round>0),
   CONSTRAINT CK_raffles_roster_json CHECK(roster_json IS NULL OR ISJSON(roster_json)=1)
 );
END;
IF OBJECT_ID(N'dbo.participants',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.participants (
   id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_participants PRIMARY KEY,
   raffle_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.raffles(id) ON DELETE CASCADE,
   participant_code VARCHAR(64) NOT NULL,
   display_name NVARCHAR(80) NOT NULL,
   joined_at DATETIME2(3) NOT NULL CONSTRAINT DF_participants_created DEFAULT SYSUTCDATETIME(),
   CONSTRAINT UQ_participants_raffle_code UNIQUE(raffle_id,participant_code)
 );
END;
IF OBJECT_ID(N'dbo.draw_results',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.draw_results (
   raffle_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_draw_results PRIMARY KEY REFERENCES dbo.raffles(id),
   certificate NVARCHAR(MAX) NOT NULL,
   winner_id VARCHAR(64) NOT NULL,
   created_at DATETIME2(3) NOT NULL CONSTRAINT DF_results_created DEFAULT SYSUTCDATETIME(),
   CONSTRAINT CK_results_certificate CHECK(ISJSON(certificate)=1)
 );
END;
IF OBJECT_ID(N'dbo.audit_logs',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.audit_logs (
   id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_audit PRIMARY KEY,
   actor NVARCHAR(100) NOT NULL,
   action NVARCHAR(120) NOT NULL,
   raffle_id UNIQUEIDENTIFIER NULL,
   details NVARCHAR(MAX) NOT NULL CONSTRAINT DF_audit_details DEFAULT N'{}',
   created_at DATETIME2(3) NOT NULL CONSTRAINT DF_audit_created DEFAULT SYSUTCDATETIME(),
   CONSTRAINT CK_audit_json CHECK(ISJSON(details)=1)
 );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_sessions_exp' AND object_id=OBJECT_ID(N'dbo.sessions'))
 CREATE INDEX idx_sessions_exp ON dbo.sessions(expires_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_raffles_created' AND object_id=OBJECT_ID(N'dbo.raffles'))
 CREATE INDEX idx_raffles_created ON dbo.raffles(created_at DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_participants_raffle' AND object_id=OBJECT_ID(N'dbo.participants'))
 CREATE INDEX idx_participants_raffle ON dbo.participants(raffle_id);
