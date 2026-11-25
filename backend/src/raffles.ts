import crypto from 'node:crypto';
import type {DbQuery} from './db.js';
import {proveVRF,vrfProofToHash} from '@collectorcrypt/ecvrf';
import {bytesToHex,canonicalRoster,computeRosterHashHex,computeCommitmentHashHex,
 encodeAlphaHex,hexToBytesStrict,selectWinnerIndex,PROTOCOL_VERSION,SUITE,
 drandRoundForTime,drandRoundAt,fetchVerifiedDrandRound,type DrawCertificate} from '@veridraw/protocol';
import {pool,tx,audit,isUniqueViolation} from './db.js';
import {ApiError,requireRow} from './errors.js';
import {currentKey,currentSeed,ensureKeyActive} from './crypto/keyManager.js';
export const iso=(v:Date|string)=>new Date(v).toISOString();
const clean=(r:Record<string,any>)=>({id:r.id,title:r.title,description:r.description,status:r.status,keyId:r.key_id,
 beaconRound:String(r.beacon_round),roundAt:iso(r.round_at),lockDeadline:iso(r.lock_deadline),lockedAt:r.locked_at?iso(r.locked_at):null,
 rosterHashHex:r.roster_hash,commitmentHashHex:r.commitment_hash,participantCount:Number(r.participant_count??0),createdAt:iso(r.created_at)});
export async function listRaffles(){
 const r=await pool.query('SELECT TOP (100) r.*,(SELECT count(*) FROM participants p WHERE p.raffle_id=r.id) participant_count FROM raffles r ORDER BY r.created_at DESC');
 return r.rows.map(clean);
}
export async function getRaffle(id:string){
 const r=await pool.query('SELECT r.*,(SELECT count(*) FROM participants p WHERE p.raffle_id=r.id) participant_count FROM raffles r WHERE r.id=$1',[id]);
 return clean(requireRow(r.rows[0],'Raffle not found'));
}
export async function createRaffle(title:string,description:string,scheduledMs:number){
 if(scheduledMs<Date.now()+120_000||scheduledMs>Date.now()+365*24*3600_000)throw new ApiError(400,'Choose draw time between 2 minutes and 365 days in future');
 const k=await currentKey();await ensureKeyActive(k.keyId);
 const round=drandRoundForTime(scheduledMs),at=drandRoundAt(round),deadline=new Date(at-30_000);
 const id=crypto.randomUUID();
 await pool.query('INSERT INTO raffles(id,title,description,key_id,beacon_round,round_at,lock_deadline) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,title,description,k.keyId,round,new Date(at),deadline]);
 await audit('organizer','raffle.created',id,{round,keyId:k.keyId});
 return getRaffle(id);
}
export async function listParticipants(id:string){
 await getRaffle(id);
 const r=await pool.query('SELECT participant_code id,display_name name FROM participants WHERE raffle_id=$1 ORDER BY participant_code',[id]);
 return canonicalRoster(r.rows);
}
export async function registerParticipant(id:string,name:string,code:string){
 if(name!==name.normalize('NFC'))throw new ApiError(400,'Name must be Unicode NFC');
 return tx(async(db:DbQuery)=>{
  const r=await db.query('SELECT status,lock_deadline FROM raffles WITH (UPDLOCK,HOLDLOCK) WHERE id=$1',[id]);
  const raffle=requireRow(r.rows[0],'Raffle not found');
  if(raffle.status!=='OPEN'||Date.now()>=new Date(raffle.lock_deadline).getTime())throw new ApiError(409,'Raffle registration closed');
  try {await db.query('INSERT INTO participants(id,raffle_id,participant_code,display_name) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),id,code,name]);}
  catch(e){if(isUniqueViolation(e))throw new ApiError(409,'Participant code already registered');throw e;}
  return {id:code,name};
 });
}
export async function lockRaffle(id:string){
 const result=await tx(async(db:DbQuery)=>{
  const r=await db.query('SELECT * FROM raffles WITH (UPDLOCK,HOLDLOCK) WHERE id=$1',[id]);
  const raffle=requireRow(r.rows[0],'Raffle not found');
  if(raffle.status!=='OPEN')throw new ApiError(409,'Raffle is not OPEN');
  const now=new Date();if(now.getTime()>new Date(raffle.lock_deadline).getTime())throw new ApiError(409,'Too late to lock before beacon reveal');
  const entries=await db.query('SELECT participant_code id,display_name name FROM participants WHERE raffle_id=$1',[id]);
  const participants=canonicalRoster(entries.rows);const rosterHashHex=await computeRosterHashHex(participants);
  const commitment={raffleId:id,keyId:raffle.key_id,rosterHashHex,beaconRound:String(raffle.beacon_round),lockedAt:now.toISOString(),lockDeadline:iso(raffle.lock_deadline)};
  const hash=await computeCommitmentHashHex(commitment);
  await db.query("UPDATE raffles SET status='LOCKED',locked_at=$2,roster_json=$3,roster_hash=$4,commitment_hash=$5 WHERE id=$1",[id,now,JSON.stringify(participants),rosterHashHex,hash]);
  return {commitment,commitmentHashHex:hash,participants,publicKeyId:raffle.key_id,
    note:'Publish this commitment hash to an independent timestamped channel BEFORE the drand round!'};
 });
 await audit('organizer','raffle.locked',id,{commitmentHash:result.commitmentHashHex});
 return result;
}
export async function getCommitment(id:string){
 const r=await pool.query("SELECT r.*,k.public_key_hex FROM raffles r JOIN vrf_keys k ON r.key_id=k.key_id WHERE r.id=$1",[id]);
 const x=requireRow(r.rows[0]);
 if(!x.locked_at)throw new ApiError(409,'Raffle not yet locked');
 return {commitment:{raffleId:id,keyId:x.key_id,rosterHashHex:x.roster_hash,beaconRound:String(x.beacon_round),
 lockedAt:iso(x.locked_at),lockDeadline:iso(x.lock_deadline)},commitmentHashHex:x.commitment_hash,
 publicKeyHex:x.public_key_hex,participants:JSON.parse(x.roster_json),beaconRoundAt:iso(x.round_at),
 warning:'Server-hosted timestamps alone do not prove precommitment to a dishonest organizer.'};
}
export async function drawRaffle(id:string):Promise<DrawCertificate>{
 // Recover only sufficiently old interrupted claims; the unique result row prevents a second draw.
 await pool.query("UPDATE raffles SET status='LOCKED',claim_at=NULL WHERE id=$1 AND status='DRAWING' AND claim_at < DATEADD(MINUTE,-10,SYSUTCDATETIME()) AND NOT EXISTS(SELECT 1 FROM draw_results d WHERE d.raffle_id=raffles.id)",[id]);
 const claim=await pool.query("UPDATE raffles SET status='DRAWING',claim_at=SYSUTCDATETIME() OUTPUT INSERTED.* WHERE id=$1 AND status='LOCKED' AND round_at<=SYSUTCDATETIME()",[id]);
 if(!claim.rows[0])throw new ApiError(409,'Draw unavailable: must be LOCKED and scheduled beacon round must have arrived');
 const raffle=claim.rows[0];
 try {
  const key=await ensureKeyActive(raffle.key_id);
  const beacon=await fetchVerifiedDrandRound(Number(raffle.beacon_round));
  const roster=canonicalRoster(JSON.parse(raffle.roster_json));
  const commitment=(await getCommitment(id)).commitment;
  const alphaHex=encodeAlphaHex({raffleId:id,keyId:raffle.key_id,rosterHashHex:raffle.roster_hash,beacon});
  const proof=proveVRF(currentSeed(),hexToBytesStrict(alphaHex)).proof;
  const proofHex=bytesToHex(proof),betaHex=bytesToHex(vrfProofToHash(proof));
  const winnerIndex=await selectWinnerIndex(betaHex,roster.length);
  const cert:DrawCertificate={version:PROTOCOL_VERSION,suite:SUITE,mode:'COMMITTED_BEACON',raffleId:id,
    keyId:raffle.key_id,publicKeyHex:key.publicKeyHex,participants:roster,rosterHashHex:raffle.roster_hash,
    commitment,commitmentHashHex:raffle.commitment_hash,beacon,alphaHex,proofHex,betaHex,
    winnerIndex,winnerId:roster[winnerIndex].id,generatedAt:new Date().toISOString()};
  await tx(async db=>{
    const state=await db.query('SELECT status FROM raffles WITH (UPDLOCK,HOLDLOCK) WHERE id=$1',[id]);
    if(state.rows[0]?.status!=='DRAWING')throw new ApiError(409,'Draw claim lost');
    await db.query('INSERT INTO draw_results(raffle_id,certificate,winner_id) VALUES($1,$2,$3)',[id,JSON.stringify(cert),cert.winnerId]);
    await db.query("UPDATE raffles SET status='DRAWN',claim_at=NULL WHERE id=$1",[id]);
  });
  await audit('organizer','raffle.drawn',id,{winnerId:cert.winnerId}).catch(e=>console.warn('Audit append failed after committed draw:',e instanceof Error?e.message:e));
  return cert;
 } catch(e){
  await pool.query("UPDATE raffles SET status='LOCKED',claim_at=NULL WHERE id=$1 AND status='DRAWING' AND NOT EXISTS(SELECT 1 FROM draw_results d WHERE d.raffle_id=raffles.id)",[id]).catch(()=>{});
  throw e;
 }
}
export async function getResult(id:string){
 const r=await pool.query('SELECT certificate FROM draw_results WHERE raffle_id=$1',[id]);
 return JSON.parse(requireRow(r.rows[0],'Draw result not available').certificate) as DrawCertificate;
}
