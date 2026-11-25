import crypto from 'node:crypto';
import {sql,settings} from './sql-config.mjs';
if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<14)
  throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 14 characters)');
const salt=crypto.randomBytes(16).toString('hex');
const hash=crypto.scryptSync(process.env.ADMIN_PASSWORD,salt,64).toString('hex');
const db=new sql.ConnectionPool(settings());
try{
 await db.connect();
 await db.request()
  .input('id',sql.UniqueIdentifier,crypto.randomUUID())
  .input('email',sql.NVarChar(320),process.env.ADMIN_EMAIL.toLowerCase())
  .input('salt',sql.Char(32),salt)
  .input('hash',sql.Char(128),hash)
  .query(`UPDATE dbo.admins WITH (UPDLOCK, SERIALIZABLE)
            SET password_salt=@salt,password_hash=@hash WHERE email=@email;
          IF @@ROWCOUNT=0 INSERT INTO dbo.admins(id,email,password_salt,password_hash)
            VALUES(@id,@email,@salt,@hash);`);
 console.log('Admin created or password rotated:',process.env.ADMIN_EMAIL);
}finally{await db.close();}
