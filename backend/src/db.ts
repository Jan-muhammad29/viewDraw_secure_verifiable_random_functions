import sql from 'mssql';

/** Only SQL login mode (TCP/Tedious) is enabled; Windows integrated authentication is not silently assumed. */
const server=process.env.SQL_SERVER;
const database=process.env.SQL_DATABASE??'VeriDraw';
const user=process.env.SQL_USER;
const password=process.env.SQL_PASSWORD;
if(!server||!user||!password) throw new Error('Set SQL_SERVER, SQL_USER, SQL_PASSWORD in backend/.env');
const port=Number(process.env.SQL_PORT??1433);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid SQL_PORT');
const options:sql.config={server,port,database,user,password,pool:{max:10,min:0,idleTimeoutMillis:30000},
  options:{encrypt:process.env.SQL_ENCRYPT!=='false',trustServerCertificate:process.env.SQL_TRUST_SERVER_CERTIFICATE==='true',
    appName:'VeriDraw'}};
let pending:Promise<sql.ConnectionPool>|undefined;
export function connection(){
  if(!pending){pending=new sql.ConnectionPool(options).connect().catch(err=>{pending=undefined;throw err});}
  return pending;
}
/** Narrow compatibility layer: binds values via mssql Request.input(), NEVER interpolates input into SQL. */
export type DbResult<T=Record<string,any>>={rows:T[];rowCount:number};
export type DbQuery={query<T=Record<string,any>>(statement:string,params?:unknown[]):Promise<DbResult<T>>};
function bind(statement:string,params:unknown[],target:sql.ConnectionPool|sql.Transaction){
  const request=new sql.Request(target);
  const used=new Set<number>();
  const query=statement.replace(/\$(\d+)/g,(_all,s)=>{
    const n=Number(s);
    if(!Number.isInteger(n)||n<1||n>params.length)throw new Error(`Missing SQL argument $${s}`);
    used.add(n);return `@p${n}`;
  });
  for(const n of used){
    const value=params[n-1];
    if(value===undefined)throw new Error(`Undefined SQL argument $${n}`);
    const name=`p${n}`;
    if(value instanceof Date) request.input(name,sql.DateTime2(3),value);
    else if(typeof value==='string') request.input(name,sql.NVarChar(value.length>4000?sql.MAX:Math.max(1,value.length)),value);
    else if(typeof value==='number' && Number.isInteger(value) && Math.abs(value)>2147483647) request.input(name,sql.BigInt,value);
    else request.input(name,value??null);
  }
  return {query,request};
}
async function execute<T>(target:sql.ConnectionPool|sql.Transaction,statement:string,params:unknown[]=[]):Promise<DbResult<T>>{
  const {query,request}=bind(statement,params,target);
  const result=await request.query(query);
  return {rows:(result.recordset??[]) as T[],rowCount:result.rowsAffected?.[0]??0};
}
export const pool:DbQuery & {end():Promise<void>}={
  query:async<T=Record<string,any>>(statement:string,params:unknown[]=[])=>execute<T>(await connection(),statement,params),
  end:async()=>{if(pending){const p=await pending;await p.close();pending=undefined;}}
};
export async function tx<T>(fn:(db:DbQuery)=>Promise<T>):Promise<T>{
  const transaction=new sql.Transaction(await connection());
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try{
    const result=await fn({query:<T=Record<string,any>>(text:string,params:unknown[]=[])=>execute<T>(transaction,text,params)});
    await transaction.commit();return result;
  }catch(e){try{await transaction.rollback();}catch{}throw e;}
}
export function isUniqueViolation(error:unknown):boolean {
 const e=error as {number?:number;originalError?:{info?:{number?:number}}};
 const n=e?.number??e?.originalError?.info?.number;
 return n===2601||n===2627;
}
export async function audit(actor:string,action:string,raffleId:string|null=null,details:object={}){
 await pool.query('INSERT INTO audit_logs(actor,action,raffle_id,details) VALUES($1,$2,$3,$4)',[actor,action,raffleId,JSON.stringify(details)]);
}
