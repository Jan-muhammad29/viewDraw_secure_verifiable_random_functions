import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPair,proveVRF,vrfProofToHash,bytesToHex} from '@collectorcrypt/ecvrf';
import {canonicalRoster,computeKeyId,computeRosterHashHex,computeCommitmentHashHex,encodeAlphaHex,hexToBytesStrict,selectWinnerIndex,verifyCertificate,drandRoundAt,PROTOCOL_VERSION,SUITE,DRAND_CHAIN_HASH} from '../../shared/src/index.js';
test('frozen commitment detects altered chronology and roster',async()=>{
 const {sk,pk}=generateKeyPair(),publicKeyHex=bytesToHex(pk),keyId=await computeKeyId(publicKeyHex),participants=canonicalRoster([{id:'p1',name:'Jane'},{id:'p2',name:'Sam'}]);
 const rosterHashHex=await computeRosterHashHex(participants),beaconRound=60000000;
 const roundAt=drandRoundAt(beaconRound);
 const commitment={raffleId:'attack-test',keyId,rosterHashHex,beaconRound:String(beaconRound),lockedAt:new Date(roundAt-200000).toISOString(),lockDeadline:new Date(roundAt-30000).toISOString()};
 const commitmentHashHex=await computeCommitmentHashHex(commitment);
 // Arbitrary signature hash is NOT a BLS-verified beacon; this fixture isolates certificate logic.
 const {sha256Hex}=await import('../../shared/src/protocol.js');
 const signatureHex='11'.repeat(96),beacon={source:'DRAND_QUICKNET',round:String(beaconRound),valueHex:await sha256Hex(hexToBytesStrict(signatureHex)),signatureHex,chainHash:DRAND_CHAIN_HASH};
 const raffleId='attack-test',alphaHex=encodeAlphaHex({raffleId,keyId,rosterHashHex,beacon});
 const proofHex=bytesToHex(proveVRF(sk,hexToBytesStrict(alphaHex)).proof),betaHex=bytesToHex(vrfProofToHash(hexToBytesStrict(proofHex)));
 const winnerIndex=await selectWinnerIndex(betaHex,participants.length);
 const c={version:PROTOCOL_VERSION,suite:SUITE,mode:'COMMITTED_BEACON',raffleId,keyId,publicKeyHex,participants,rosterHashHex,commitment,commitmentHashHex,beacon,alphaHex,proofHex,betaHex,winnerIndex,winnerId:participants[winnerIndex].id,generatedAt:new Date().toISOString()};
 assert.equal((await verifyCertificate(c)).valid,true);
 for(const mutated of [
  {...c,commitment:{...commitment,lockedAt:new Date(roundAt+1000).toISOString()}},
  {...c,commitmentHashHex:'00'.repeat(32)},
  {...c,beacon:{...beacon,valueHex:'00'.repeat(32)}},
  {...c,participants:participants.map((p,i)=>i?{...p,name:'Attacker'}:p)}
 ])assert.equal((await verifyCertificate(mutated)).valid,false);
});
