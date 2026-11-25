-- Run in SSMS using an account with CREATE DATABASE permission.
USE master;
GO
IF DB_ID(N'VeriDraw') IS NULL
    CREATE DATABASE VeriDraw;
GO
-- Switch to VeriDraw then run db:migrate from the project root.
