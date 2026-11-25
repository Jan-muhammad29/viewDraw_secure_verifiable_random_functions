import crypto from 'node:crypto';
import type {Request,Response,NextFunction} from 'express';
import {pool} from './db.js';
import {ApiError} from './errors.js';
const SECURE=process.env.NODE_ENV==='production';
export const makeHash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
export const makePassword=(password:string,salt:string)=>crypto.scryptSync(password,salt,64).toString('hex');
export const randomToken=()=>crypto.randomBytes(32).toString('hex');
const parseCookie=(req:Request)=>{
  const raw=req.headers.cookie??'';
  for(const x of raw.split(';')){const [k,...v]=x.trim().split('=');if(k==='veridraw_session')return v.join('=')}
  return '';
};
export const clearCookie=(res:Response)=>res.clearCookie('veridraw_session',{httpOnly:true,secure:SECURE,sameSite:'lax',path:'/'});
export async function login(email:string,password:string,res:Response){
 const out=await pool.query('SELECT * FROM admins WHERE email=$1',[email.toLowerCase()]);
 const user=out.rows[0];
 // Equal-cost work for nonexistent users; avoid timing-based account enumeration.
 const hash=makePassword(password,user?.password_salt??'0'.repeat(32));
 if(!user || !crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(user.password_hash,'hex')))throw new ApiError(401,'Invalid credentials');
 const token=randomToken(),csrf=randomToken();
 await pool.query("INSERT INTO sessions(token_hash,admin_id,csrf_token,expires_at) VALUES($1,$2,$3,DATEADD(HOUR,8,SYSUTCDATETIME()))",[makeHash(token),user.id,csrf]);
 res.cookie('veridraw_session',token,{httpOnly:true,secure:SECURE,sameSite:'lax',path:'/',maxAge:8*60*60*1000});
 return {email:user.email,csrf};
}
export async function session(req:Request){
 const token=parseCookie(req);if(!/^[a-f0-9]{64}$/.test(token))return null;
 const r=await pool.query('SELECT s.*,a.email FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=$1 AND s.expires_at>SYSUTCDATETIME()',[makeHash(token)]);
 return r.rows[0]??null;
}
export async function requireAdmin(req:Request,_res:Response,next:NextFunction){
 try{
  const user=await session(req);
  if(!user)throw new ApiError(401,'Login required');
  if(req.method!=='GET'&&req.method!=='HEAD'&&req.header('x-csrf-token')!==user.csrf_token)throw new ApiError(403,'Invalid CSRF token');
  (_res.locals as {admin:typeof user}).admin=user;
  next();
 }catch(e){next(e)}
}
export async function logout(req:Request,res:Response){
 const token=parseCookie(req);
 if(token)await pool.query('DELETE FROM sessions WHERE token_hash=$1',[makeHash(token)]);
 clearCookie(res);
}
