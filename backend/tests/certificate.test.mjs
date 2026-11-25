import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair, proveVRF, vrfProofToHash, bytesToHex} from '@collectorcrypt/ecvrf';
import {canonicalRoster, computeKeyId, computeRosterHashHex, encodeAlphaHex, hexToBytesStrict, selectWinnerIndex, PROTOCOL_VERSION, SUITE} from '../../shared/src/protocol.js';
import {verifyCertificate} from '../../shared/src/verify.js';
const make = async () => {
  const {sk,pk}=generateKeyPair(),publicKeyHex=bytesToHex(pk);
  const participants=canonicalRoster([{id:'p2',name:'Sam'},{id:'p1',name:'Jane'}]);
  const raffleId='test-draw', keyId=await computeKeyId(publicKeyHex), rosterHashHex=await computeRosterHashHex(participants);
  const beacon={source:'DEMO_FIXED_NOT_RANDOM',round:'phase1',valueHex:'22'.repeat(32)};
  const alphaHex=encodeAlphaHex({raffleId,keyId,rosterHashHex,beacon});
  const proofHex=bytesToHex(proveVRF(sk,hexToBytesStrict(alphaHex)).proof);
  const betaHex=bytesToHex(vrfProofToHash(hexToBytesStrict(proofHex)));
  const winnerIndex=await selectWinnerIndex(betaHex,participants.length);
  return {version:PROTOCOL_VERSION,suite:SUITE,mode:'DEMO_NOT_FAIR',participants,raffleId,keyId,publicKeyHex,rosterHashHex,beacon,alphaHex,proofHex,betaHex,winnerIndex,winnerId:participants[winnerIndex].id,generatedAt:new Date().toISOString()};
};
test('valid public certificate verifies without private key',async()=>{
  const cert=await make();const result=await verifyCertificate(cert);
  assert.equal(result.valid,true,JSON.stringify(result));
  assert.match(result.fairnessStatus,/CRYPTOGRAPHICALLY_VALID_ONLY/);
});
test('modified winner, roster, beta, and alpha fail',async()=>{
  const cert=await make();
  for (const bad of [
    {...cert,winnerId:'attacker'},
    {...cert,participants:[{...cert.participants[0],name:'Evil'},cert.participants[1]]},
    {...cert,betaHex:'00'.repeat(64)},
    {...cert,alphaHex:'00'.repeat(5)}
  ]) assert.equal((await verifyCertificate(bad)).valid,false);
});
test('format and unsupported modes rejected',async()=>{
 const cert=await make();
 assert.equal((await verifyCertificate({...cert,mode:'DELIBERATELY_UNSAFE'})).valid,false);
 assert.equal((await verifyCertificate({...cert,proofHex:'ff'.repeat(80)})).valid,false);
 assert.equal((await verifyCertificate({...cert,publicKeyHex:'ff'.repeat(32)})).valid,false);
});
