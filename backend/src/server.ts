import 'dotenv/config';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import express,{type Request,type Response,type NextFunction} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {pool,audit,isUniqueViolation} from './db.js';
import {ApiError} from './errors.js';
import {login,logout,session,requireAdmin} from './auth.js';
import {registerActiveKey,currentKey} from './crypto/keyManager.js';
import {listRaffles,getRaffle,createRaffle,listParticipants,registerParticipant,lockRaffle,getCommitment,drawRaffle,getResult} from './raffles.js';
import {verifyCertificate} from '@veridraw/protocol';
import {makeDemoCertificate} from './demo.js';
const app=express();
const port=Number(process.env.PORT??5000);
const allowed=(process.env.FRONTEND_ORIGIN??'http://127.0.0.1:5173').split(',').map(x=>x.trim());
app.disable('x-powered-by');if(process.env.NODE_ENV==='production')app.set('trust proxy',1);
app.use(helmet());
app.use(cors({origin:(origin,cb)=>{if(!origin||allowed.includes(origin))cb(null,true);else cb(new Error('Disallowed origin'));},credentials:true}));
app.use(express.json({limit:'2mb'}));
app.use('/api',rateLimit({windowMs:60_000,limit:120,standardHeaders:'draft-7',legacyHeaders:false}));
app.use((req,res,next)=>{
 if(['POST','PATCH','PUT','DELETE'].includes(req.method) && req.header('origin') && !allowed.includes(req.header('origin')!)) return res.status(403).json({error:'Untrusted origin'});
 next();
});
const run=(fn:(req:Request,res:Response)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>{Promise.resolve().then(()=>fn(req,res)).catch(next)};
const uuid=z.string().uuid();
const entry=z.object({id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),name:z.string().min(1).max(80)}).strict();
const makeRaffle=z.object({title:z.string().trim().min(3).max(120),description:z.string().max(1000).default(''),drawAt:z.string().datetime({offset:true})}).strict();
const credential=z.object({email:z.string().email().max(254),password:z.string().min(1).max(256)}).strict();
app.get('/api/health',(_req,res)=>res.json({ok:true,app:'VeriDraw',phase:5,mode:'REFERENCE_IMPLEMENTATION'}));
app.post('/api/auth/login',rateLimit({windowMs:15*60_000,limit:10,standardHeaders:'draft-7',legacyHeaders:false}),run(async(req,res)=>{const v=credential.parse(req.body);res.json(await login(v.email,v.password,res))}));
app.get('/api/auth/me',run(async(req,res)=>{const s=await session(req);res.json(s?{loggedIn:true,email:s.email,csrf:s.csrf_token}:{loggedIn:false})}));
app.post('/api/auth/logout',requireAdmin,run(async(req,res)=>{await logout(req,res);res.json({ok:true})}));
app.get('/api/keys/current',run(async(_req,res)=>res.json(await currentKey())));
app.post('/api/keys/current/revoke',requireAdmin,run(async(_req,res)=>{
 const k=await currentKey();await pool.query('UPDATE vrf_keys SET revoked_at=SYSUTCDATETIME() WHERE key_id=$1 AND revoked_at IS NULL',[k.keyId]);
 await audit('organizer','key.revoked',null,{keyId:k.keyId});res.json({ok:true,keyId:k.keyId,warning:'Existing proofs remain verifiable; new draws with this key are blocked.'});
}));
app.get('/api/raffles',run(async(_req,res)=>res.json(await listRaffles())));
app.post('/api/raffles',requireAdmin,run(async(req,res)=>{const v=makeRaffle.parse(req.body);res.status(201).json(await createRaffle(v.title,v.description,Date.parse(v.drawAt)))}));
app.get('/api/raffles/:id',run(async(req,res)=>res.json(await getRaffle(uuid.parse(req.params.id)))));
app.get('/api/raffles/:id/participants',run(async(req,res)=>res.json(await listParticipants(uuid.parse(req.params.id)))));
app.post('/api/raffles/:id/participants',rateLimit({windowMs:60_000,limit:15,standardHeaders:'draft-7',legacyHeaders:false}),run(async(req,res)=>{
 const v=entry.parse(req.body);res.status(201).json(await registerParticipant(uuid.parse(req.params.id),v.name,v.id));
}));
app.post('/api/raffles/:id/lock',requireAdmin,run(async(req,res)=>res.json(await lockRaffle(uuid.parse(req.params.id)))));
app.get('/api/raffles/:id/commitment',run(async(req,res)=>res.json(await getCommitment(uuid.parse(req.params.id)))));
app.post('/api/raffles/:id/draw',requireAdmin,run(async(req,res)=>res.json(await drawRaffle(uuid.parse(req.params.id)))));
app.get('/api/raffles/:id/result',run(async(req,res)=>res.json(await getResult(uuid.parse(req.params.id)))));
app.get('/api/raffles/:id/certificate',run(async(req,res)=>{
 const cert=await getResult(uuid.parse(req.params.id));res.set('Content-Disposition',`attachment; filename="veridraw-${cert.raffleId}.json"`);res.type('json').send(JSON.stringify(cert,null,2));
}));
app.post('/api/verify',run(async(req,res)=>res.json(await verifyCertificate(req.body))));
if(process.env.ENABLE_DEMO==='true') app.post('/api/demo/draw',run(async(_req,res)=>res.json(await makeDemoCertificate())));
app.get('/api/admin/audit',requireAdmin,run(async(_req,res)=>{
 const q=await pool.query('SELECT TOP (100) actor,action,raffle_id,details,created_at FROM audit_logs ORDER BY id DESC');res.json(q.rows.map(x=>({...x,details:JSON.parse(x.details)})));
}));
// One-origin deployment: React and API share cookies and eliminate cross-site session issues.
const frontendDist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../frontend/dist');
app.use(express.static(frontendDist,{index:false}));
app.get(/^\/(?!api\/).*/,(_req,res)=>res.sendFile(path.join(frontendDist,'index.html')));
app.use((_req,res)=>res.status(404).json({error:'Unknown route'}));
app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{
 if(err instanceof ApiError)return res.status(err.status).json({error:err.message});
 if(err instanceof z.ZodError)return res.status(400).json({error:'Invalid input',issues:err.issues.map(x=>({path:x.path,message:x.message}))});
 if(isUniqueViolation(err))return res.status(409).json({error:'Duplicate record'});
 console.error('Server error:',err instanceof Error?err.message:err);res.status(500).json({error:'Internal server error'});
});
async function start(){
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
 if(process.env.NODE_ENV==='production' && (!process.env.FRONTEND_ORIGIN?.startsWith('https://')||process.env.ENABLE_DEMO==='true'))throw new Error('Production requires HTTPS FRONTEND_ORIGIN and disabled demo mode');
 await pool.query('SELECT 1');await registerActiveKey();
 const server=app.listen(port,process.env.HOST??'0.0.0.0',()=>console.log(`VeriDraw API available on :${port}`));
 process.on('SIGTERM',()=>{server.close();void pool.end()});
}
start().catch(err=>{console.error('Startup failed:',err instanceof Error?err.message:err);process.exit(1)});
