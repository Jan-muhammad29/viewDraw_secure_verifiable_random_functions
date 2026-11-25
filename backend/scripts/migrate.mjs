import {readFile} from 'node:fs/promises';
import {sql,settings} from './sql-config.mjs';
const db=new sql.ConnectionPool(settings());
try{
 await db.connect();
 const script=await readFile(new URL('../db/schema.sql',import.meta.url),'utf8');
 await db.request().batch(script);
 console.log('SQL Server schema installed in',process.env.SQL_DATABASE??'VeriDraw');
}finally{await db.close();}
