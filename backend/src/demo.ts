import { generateKeyPair, proveVRF, vrfProofToHash } from '@collectorcrypt/ecvrf';
import { bytesToHex, canonicalRoster, computeKeyId, computeRosterHashHex,
  encodeAlphaHex, hexToBytesStrict, selectWinnerIndex, PROTOCOL_VERSION, SUITE,
  type DrawCertificate } from '@veridraw/protocol';

// Ephemeral key: changes on every restart. Not a real lottery and not secure key storage.
const DEMO_KEYS = generateKeyPair();
const participants = canonicalRoster([
  { id: 'p-003', name: 'Sara' }, { id: 'p-001', name: 'Ali' },
  { id: 'p-005', name: 'Hamza' }, { id: 'p-002', name: 'Ahmed' },
  { id: 'p-004', name: 'Fatima' }
]);
export async function makeDemoCertificate(): Promise<DrawCertificate> {
  const publicKeyHex = bytesToHex(DEMO_KEYS.pk);
  const keyId = await computeKeyId(publicKeyHex);
  const rosterHashHex = await computeRosterHashHex(participants);
  const beacon = {
    source: 'DEMO_FIXED_NOT_RANDOM', round: 'phase1', valueHex: '22'.repeat(32)
  };
  const raffleId = 'phase1-demo';
  const alphaHex = encodeAlphaHex({raffleId, keyId, rosterHashHex, beacon});
  const {proof} = proveVRF(DEMO_KEYS.sk, hexToBytesStrict(alphaHex));
  const proofHex = bytesToHex(proof);
  const betaHex = bytesToHex(vrfProofToHash(proof));
  const winnerIndex = await selectWinnerIndex(betaHex, participants.length);
  return {
    version: PROTOCOL_VERSION, suite: SUITE, mode: 'DEMO_NOT_FAIR', raffleId,
    keyId, publicKeyHex, participants, rosterHashHex, beacon, alphaHex,
    proofHex, betaHex, winnerIndex, winnerId: participants[winnerIndex].id,
    generatedAt: new Date().toISOString()
  };
}
