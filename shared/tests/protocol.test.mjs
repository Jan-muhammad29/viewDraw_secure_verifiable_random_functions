import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRoster, encodeFields, bytesToHex, computeRosterHashHex, encodeAlphaHex, selectWinnerIndex, computeKeyId } from '../src/protocol.js';
const participants = [{ id:'p-002',name:'Sara'},{id:'p-001',name:'Ali'}];
test('length-prefix prevents ambiguous field encodings', () => {
  assert.notEqual(bytesToHex(encodeFields(['ab','c'])), bytesToHex(encodeFields(['a','bc'])));
});
test('canonical roster stable under reorder', async () => {
  assert.deepEqual(canonicalRoster(participants).map(x=>x.id), ['p-001','p-002']);
  assert.equal(await computeRosterHashHex(participants), await computeRosterHashHex([...participants].reverse()));
});
test('duplicate participant and invalid names rejected', () => {
  assert.throws(() => canonicalRoster([{id:'p-001',name:'A'},{id:'p-001',name:'B'}]));
  assert.throws(() => canonicalRoster([{id:'p-001',name:'e\u0301'}]));
});
test('alpha binds key, roster, and external input', async () => {
  const keyId = await computeKeyId('11'.repeat(32));
  const rosterHashHex = await computeRosterHashHex(participants);
  const base = {raffleId:'phase1-demo',keyId,rosterHashHex,beacon:{source:'DEMO_FIXED_NOT_RANDOM',round:'phase1',valueHex:'22'.repeat(32)}};
  const first=encodeAlphaHex(base);
  assert.notEqual(first, encodeAlphaHex({...base, beacon:{...base.beacon,round:'phase2'}}));
  assert.notEqual(first, encodeAlphaHex({...base, rosterHashHex:'00'.repeat(32)}));
});
test('unbiased index is deterministic and within bounds', async () => {
  const beta='ab'.repeat(64);
  const first=await selectWinnerIndex(beta,5);
  assert.equal(first,await selectWinnerIndex(beta,5));
  assert.ok(first>=0 && first<5);
  assert.equal(await selectWinnerIndex(beta,1),0);
  await assert.rejects(()=>selectWinnerIndex(beta,0));
});
