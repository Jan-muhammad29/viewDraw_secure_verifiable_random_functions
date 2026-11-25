import sql from 'mssql';
import 'dotenv/config';
export {sql};
export function settings(database=process.env.SQL_DATABASE??'VeriDraw'){
  const server=process.env.SQL_SERVER,user=process.env.SQL_USER,password=process.env.SQL_PASSWORD;
  if(!server||!user||!password)throw new Error('Set SQL_SERVER, SQL_USER and SQL_PASSWORD in backend/.env');
  const port=Number(process.env.SQL_PORT??1433);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid SQL_PORT');
  return {server,port,database,user,password,options:{encrypt:process.env.SQL_ENCRYPT!=='false',
    trustServerCertificate:process.env.SQL_TRUST_SERVER_CERTIFICATE==='true',appName:'VeriDraw CLI'},
    pool:{max:3,min:0}};
}
