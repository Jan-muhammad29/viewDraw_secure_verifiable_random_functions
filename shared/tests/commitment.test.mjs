import test from 'node:test';import assert from 'node:assert/strict';
import {drandRoundAt,drandRoundForTime,computeCommitmentHashHex} from '../src/commitment.js';
const c={raffleId:'r1',keyId:'aa'.repeat(32),rosterHashHex:'bb'.repeat(32),beaconRound:'60000000',lockedAt:'2026-11-01T10:00:00.000Z',lockDeadline:'2026-11-02T10:00:00.000Z'};
test('round arithmetic is deterministic',()=>{for(const r of [1,100,100000,30000000]){assert.equal(drandRoundForTime(drandRoundAt(r)),r);}});
test('commitment hashes are stable but detect changes',async()=>{const a=await computeCommitmentHashHex(c);assert.equal(a.length,64);assert.equal(await computeCommitmentHashHex(c),a);assert.notEqual(await computeCommitmentHashHex({...c,beaconRound:'60000001'}),a)});
