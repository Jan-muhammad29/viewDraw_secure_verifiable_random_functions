import {performance} from 'node:perf_hooks';
import {generateKeyPair,proveVRF,vrfProofToHash,bytesToHex} from '@collectorcrypt/ecvrf';
import {canonicalRoster,computeRosterHashHex,selectWinnerIndex,verifyCertificate,encodeAlphaHex,computeKeyId,PROTOCOL_VERSION,SUITE,hexToBytesStrict} from '../shared/src/index.js';
const {sk,pk}=generateKeyPair(),publicKeyHex=bytesToHex(pk),keyId=await computeKeyId(publicKeyHex);
for(const n of [10,100,1000]){
 const t0=performance.now(),participants=canonicalRoster(Array.from({length:n},(_,i)=>({id:`p-${String(i).padStart(6,'0')}`,name:`Member ${i}`}))),rosterHashHex=await computeRosterHashHex(participants);
 const beacon={source:'DEMO_FIXED_NOT_RANDOM',round:'benchmark',valueHex:'33'.repeat(32)};
 const raffleId='benchmark',alphaHex=encodeAlphaHex({raffleId,keyId,rosterHashHex,beacon});
 const proofHex=bytesToHex(proveVRF(sk,hexToBytesStrict(alphaHex)).proof),betaHex=bytesToHex(vrfProofToHash(hexToBytesStrict(proofHex)));
 const winnerIndex=await selectWinnerIndex(betaHex,n);
 const cert={version:PROTOCOL_VERSION,suite:SUITE,mode:'DEMO_NOT_FAIR',raffleId,keyId,publicKeyHex,participants,rosterHashHex,beacon,alphaHex,proofHex,betaHex,winnerIndex,winnerId:participants[winnerIndex].id,generatedAt:new Date().toISOString()};
 const result=await verifyCertificate(cert);
 if(!result.valid)throw new Error('Benchmark certificate invalid '+JSON.stringify(result));
 console.log(JSON.stringify({participants:n,elapsedMs:Number((performance.now()-t0).toFixed(2)),certificateBytes:Buffer.byteLength(JSON.stringify(cert))}));
}
