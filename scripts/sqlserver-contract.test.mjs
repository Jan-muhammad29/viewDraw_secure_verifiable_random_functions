import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=async path=>readFile(new URL(path,root),'utf8');
test('SQL Server tables and constraints exist',async()=>{
 const s=await read('backend/db/schema.sql');
 for(const name of ['admins','sessions','vrf_keys','raffles','participants','draw_results','audit_logs'])
   assert.match(s,new RegExp(`CREATE TABLE dbo\\.${name}\\b`));
 assert.match(s,/UNIQUEIDENTIFIER/);assert.match(s,/DATETIME2\(3\)/);
 assert.match(s,/ISJSON\(certificate\)/);assert.match(s,/UNIQUE\(raffle_id,participant_code\)/);
});
test('SQL Server-specific locking and claim semantics',async()=>{
 const s=await read('backend/src/raffles.ts');
 assert.match(s,/WITH \(UPDLOCK,HOLDLOCK\)/);
 assert.match(s,/OUTPUT INSERTED\.\*/);
 assert.match(s,/SYSUTCDATETIME\(\)/);
 assert.doesNotMatch(s,/FOR UPDATE|RETURNING \*|ON CONFLICT/);
});
test('driver and environment use SQL Server and not pg',async()=>{
 const p=JSON.parse(await read('backend/package.json'));
 assert.ok(p.dependencies.mssql);
 assert.equal(p.dependencies.pg,undefined);
 const env=await read('backend/.env.example');
 for(const key of ['SQL_SERVER','SQL_PORT','SQL_DATABASE','SQL_USER','SQL_PASSWORD','SQL_ENCRYPT'])assert.match(env,new RegExp('^'+key+'=', 'm'));
 const d=await read('backend/src/db.ts');assert.match(d,/request\.input/);
 assert.match(d,/SERIALIZABLE/);assert.doesNotMatch(d,/from 'pg'/);
});
test('SQL Server migration and CI are configured',async()=>{
 const migration=await read('backend/scripts/migrate.mjs');
 const ci=await read('.github/workflows/ci.yml');
 assert.match(migration,/\.batch\(script\)/);
 assert.match(ci,/mcr\.microsoft\.com\/mssql\/server:2022-latest/);
 assert.match(ci,/db:migrate/);
});
