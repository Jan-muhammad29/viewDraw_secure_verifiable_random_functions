import {publicKeyFromSeed} from '@collectorcrypt/ecvrf';
import {bytesToHex,computeKeyId,hexToBytesStrict,SUITE} from '@veridraw/protocol';
import {pool} from '../db.js';
import {ApiError} from '../errors.js';
export function currentSeed():Uint8Array{
 const hex=process.env.VRF_PRIVATE_KEY_HEX;
 if(!hex)throw new Error('Set VRF_PRIVATE_KEY_HEX as 32 cryptographically random bytes');
 return hexToBytesStrict(hex,32);
}
export async function currentKey(){
 const pk=bytesToHex(publicKeyFromSeed(currentSeed()));
 return {publicKeyHex:pk,keyId:await computeKeyId(pk),suite:SUITE};
}
export async function registerActiveKey(){
 const k=await currentKey();
 await pool.query('IF NOT EXISTS (SELECT 1 FROM vrf_keys WITH (UPDLOCK,HOLDLOCK) WHERE key_id=$1) INSERT INTO vrf_keys(key_id,public_key_hex,suite) VALUES ($1,$2,$3)',[k.keyId,k.publicKeyHex,k.suite]);
 return k;
}
export async function ensureKeyActive(id:string){
 const result=await pool.query('SELECT key_id,revoked_at FROM vrf_keys WHERE key_id=$1',[id]);
 if(!result.rows[0] || result.rows[0].revoked_at)throw new ApiError(409,'Key revoked or missing');
 const active=await currentKey();
 if(id!==active.keyId)throw new ApiError(409,'Raffle key does not match configured private key');
 return active;
}
