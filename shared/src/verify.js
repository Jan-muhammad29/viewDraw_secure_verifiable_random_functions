import { verifyVRF, vrfProofToHash } from '@collectorcrypt/ecvrf';
import {
  PROTOCOL_VERSION, SUITE, bytesToHex, hexToBytesStrict, computeRosterHashHex,
  canonicalRoster, computeKeyId, encodeAlphaHex, selectWinnerIndex, sha256Hex
} from './protocol.js';
import {computeCommitmentHashHex,drandRoundAt,DRAND_CHAIN_HASH} from './commitment.js';
// No secret and no HTTP request in basic verification. Online beacon verification is separate.
export async function verifyCertificate(certificate) {
  const checks=[];
  const pass=(name)=>checks.push({name,valid:true,detail:'Passed'});
  const fail=(name,detail)=>checks.push({name,valid:false,detail});
  if (!certificate || typeof certificate !== 'object') return {valid:false,checks:[{name:'Format',valid:false,detail:'Invalid certificate object'}]};
  try {
    if(certificate.version!==PROTOCOL_VERSION||certificate.suite!==SUITE||!['DEMO_NOT_FAIR','COMMITTED_BEACON'].includes(certificate.mode)) throw new Error('Wrong version, suite, or mode');
    pass('Protocol and suite');
    const roster=canonicalRoster(certificate.participants);
    if(roster.some((p,i)=>p.id!==certificate.participants[i]?.id||p.name!==certificate.participants[i]?.name))throw new Error('Roster not sorted canonically');
    if(await computeRosterHashHex(roster)!==certificate.rosterHashHex)throw new Error('Roster hash mismatch');
    pass('Canonical roster and SHA-256 commitment');
    if(await computeKeyId(certificate.publicKeyHex)!==certificate.keyId)throw new Error('Public key ID mismatch');
    pass('Public key ID');
    if(encodeAlphaHex(certificate)!==certificate.alphaHex)throw new Error('VRF input differs from visible metadata');
    pass('Exact VRF input encoding');
    const proof=hexToBytesStrict(certificate.proofHex,80),pk=hexToBytesStrict(certificate.publicKeyHex,32),alpha=hexToBytesStrict(certificate.alphaHex);
    if(!verifyVRF(pk,alpha,proof))throw new Error('RFC 9381 proof invalid');
    pass('ECVRF proof');
    const beta=bytesToHex(vrfProofToHash(proof));
    if(beta!==certificate.betaHex)throw new Error('Published output differs');
    pass('ECVRF output');
    const index=await selectWinnerIndex(beta,roster.length);
    if(index!==certificate.winnerIndex||certificate.winnerId!==roster[index].id)throw new Error('Published winner differs from recomputation');
    pass('Unbiased selection and winner');
    if(certificate.mode==='COMMITTED_BEACON') {
      const c=certificate.commitment;
      if(!c || c.raffleId!==certificate.raffleId||c.keyId!==certificate.keyId||c.rosterHashHex!==certificate.rosterHashHex||String(c.beaconRound)!==certificate.beacon.round)throw new Error('Commitment fields differ');
      const committedHash=await computeCommitmentHashHex(c);
      if(committedHash!==certificate.commitmentHashHex)throw new Error('Published commitment hash differs');
      if(certificate.beacon.source!=='DRAND_QUICKNET'||certificate.beacon.chainHash!==DRAND_CHAIN_HASH||!(/^[0-9a-f]+$/.test(certificate.beacon.signatureHex??'')))throw new Error('Invalid drand beacon identity');
      const roundAt=drandRoundAt(Number(c.beaconRound));
      if(Date.parse(c.lockDeadline)>roundAt-30_000 || Date.parse(c.lockedAt)>Date.parse(c.lockDeadline))throw new Error('Claimed commitment timing is invalid');
      const digest=await sha256Hex(hexToBytesStrict(certificate.beacon.signatureHex));
      if(digest!==certificate.beacon.valueHex)throw new Error('Beacon value not SHA-256(signature)');
      pass('Self-consistent frozen commitment and claimed chronology');
      pass('Beacon hash consistency (BLS authenticity needs online check)');
    }
    return {valid:true,checks,recomputedWinnerId:roster[index].id,recomputedIndex:index,
      fairnessStatus:certificate.mode==='COMMITTED_BEACON'
        ? 'CRYPTOGRAPHICALLY_VALID; externally timestamped precommitment and independent drand BLS verification are separate checks.'
        : 'CRYPTOGRAPHICALLY_VALID_ONLY: demonstration input and key are not precommitted.'};
  } catch(e) {fail('Verification stopped',e instanceof Error?e.message:'Invalid certificate');return {valid:false,checks,fairnessStatus:'UNVERIFIED'};}
}
