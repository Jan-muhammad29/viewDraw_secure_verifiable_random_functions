// Local development helper: requires CREATE DATABASE permission (e.g., SQL login with dbcreator).
import {sql,settings} from './sql-config.mjs';
const name=process.env.SQL_DATABASE??'VeriDraw';
if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name))throw new Error('SQL_DATABASE must be alphanumeric/underscore');
const db=new sql.ConnectionPool(settings('master'));
try{
 await db.connect();
 const statement=`IF DB_ID(N'${name}') IS NULL EXEC(N'CREATE DATABASE [${name}]')`;
 await db.request().batch(statement);
 console.log('SQL Server database ready:',name);
}finally{await db.close();}
