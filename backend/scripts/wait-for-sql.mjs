import {sql,settings} from './sql-config.mjs';
const cfg=settings('master');
for(let n=0;n<45;n++){
 const connection=new sql.ConnectionPool({...cfg,connectionTimeout:3000});
 try{await connection.connect();await connection.request().query('SELECT 1 AS ready');console.log('SQL Server is ready');await connection.close();process.exit(0);}
 catch(e){await connection.close().catch(()=>{});if(n===44){console.error('SQL Server was not ready:',e.message);process.exit(1);}await new Promise(r=>setTimeout(r,2000));}
}
