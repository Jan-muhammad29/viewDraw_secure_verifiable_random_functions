import {encodeFields, sha256Hex, hexToBytesStrict} from './protocol.js';
export const DRAND_CHAIN_HASH = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';
export const DRAND_GENESIS_MS = 1692803367 * 1000;
export const DRAND_PERIOD_MS = 3000;
export function drandRoundAt(round) {
  if (!Number.isSafeInteger(round) || round < 1) throw new Error('Invalid drand round');
  return DRAND_GENESIS_MS + (round - 1) * DRAND_PERIOD_MS;
}
export function drandRoundForTime(timeMs) {
  if (!Number.isFinite(timeMs) || timeMs < DRAND_GENESIS_MS) throw new Error('Invalid timestamp');
  return Math.max(1, Math.ceil((timeMs - DRAND_GENESIS_MS) / DRAND_PERIOD_MS) + 1);
}
export async function computeCommitmentHashHex(c) {
  if(!c || !/^[a-z0-9-]{1,80}$/.test(c.raffleId) || !/^[0-9]+$/.test(String(c.beaconRound))) throw new Error('Invalid commitment');
  hexToBytesStrict(c.rosterHashHex,32);hexToBytesStrict(c.keyId,32);
  for(const k of ['lockedAt','lockDeadline']) if(!Number.isFinite(Date.parse(c[k])) || new Date(c[k]).toISOString() !== c[k]) throw new Error('Invalid commitment date');
  return sha256Hex(encodeFields(['veridraw:commitment:v1',c.raffleId,c.keyId,c.rosterHashHex,String(c.beaconRound),c.lockDeadline,c.lockedAt]));
}
