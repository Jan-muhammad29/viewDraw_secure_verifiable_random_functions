/** VeriDraw's public protocol rules, version 1.  No private-key operations here. */
export const PROTOCOL_VERSION = 'veridraw-v1';
export const SUITE = 'ECVRF-EDWARDS25519-SHA512-TAI';
const enc = new TextEncoder();
const HEX = /^[0-9a-f]*$/;

export function hexToBytesStrict(value, expectedBytes) {
  if (typeof value !== 'string' || value.length % 2 !== 0 || !HEX.test(value)) {
    throw new Error('Expected an even-length lowercase hex string');
  }
  if (expectedBytes !== undefined && value.length !== expectedBytes * 2) {
    throw new Error(`Expected ${expectedBytes} bytes`);
  }
  return Uint8Array.from(value.match(/.{2}/g)?.map(x => Number.parseInt(x, 16)) ?? []);
}
export function bytesToHex(bytes) { return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join(''); }
export function encodeFields(fields) {
  // Each UTF-8 field is prefixed by an unsigned 32-bit BE byte-length (not a character count).
  if (!Array.isArray(fields) || fields.some(v => typeof v !== 'string')) throw new Error('Fields must be strings');
  const encoded = fields.map(s => enc.encode(s));
  const total = encoded.reduce((n, b) => n + 4 + b.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let pos = 0;
  for (const b of encoded) {
    view.setUint32(pos, b.length, false); pos += 4;
    out.set(b, pos); pos += b.length;
  }
  return out;
}
export function canonicalRoster(participants) {
  if (!Array.isArray(participants) || participants.length < 1 || participants.length > 1_000_000) {
    throw new Error('Roster must contain between 1 and 1,000,000 participants');
  }
  const seen = new Set();
  const out = participants.map(p => {
    if (!p || typeof p.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(p.id)) {
      throw new Error('Invalid participant ID');
    }
    if (typeof p.name !== 'string' || p.name.length < 1 || p.name.length > 80 || p.name !== p.name.normalize('NFC')) {
      throw new Error('Invalid or non-NFC participant name');
    }
    if (seen.has(p.id)) throw new Error('Duplicate participant ID');
    seen.add(p.id);
    return { id: p.id, name: p.name };
  });
  // Never use localeCompare: it can vary by OS/locale. ASCII ID order is byte-stable.
  return out.sort((a, b) => a.id < b.id ? -1 : (a.id > b.id ? 1 : 0));
}
export async function sha256Hex(data) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hash));
}
export async function computeRosterHashHex(participants) {
  const roster = canonicalRoster(participants);
  const fields = ['veridraw:roster:v1', String(roster.length), ...roster.flatMap(p => [p.id, p.name])];
  return sha256Hex(encodeFields(fields));
}
export async function computeKeyId(publicKeyHex) {
  const pk = hexToBytesStrict(publicKeyHex, 32);
  return sha256Hex(encodeFields(['veridraw:keyid:v1', bytesToHex(pk)]));
}
export function encodeAlphaHex({ raffleId, keyId, rosterHashHex, beacon }) {
  if (typeof raffleId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(raffleId)) throw new Error('Invalid raffleId');
  hexToBytesStrict(keyId, 32);
  hexToBytesStrict(rosterHashHex, 32);
  if (!beacon || typeof beacon.source !== 'string' || !/^[A-Z0-9_:-]{1,80}$/.test(beacon.source) ||
      typeof beacon.round !== 'string' || !/^[a-zA-Z0-9._:-]{1,100}$/.test(beacon.round)) throw new Error('Invalid beacon identifier');
  hexToBytesStrict(beacon.valueHex, 32);
  return bytesToHex(encodeFields([
    'veridraw:ecvrf-alpha:v1', PROTOCOL_VERSION, raffleId, keyId, rosterHashHex,
    beacon.source, beacon.round, beacon.valueHex
  ]));
}
export async function selectWinnerIndex(betaHex, count) {
  hexToBytesStrict(betaHex, 64);
  if (!Number.isSafeInteger(count) || count < 1 || count > 1_000_000) throw new Error('Invalid participant count');
  // Uniform integer in [0, count) via SHA-256 counter expansion and 64-bit rejection sampling.
  // This is distinct from the RFC's beta domain, and prevents modulo bias exactly.
  const modulus = 1n << 64n;
  const n = BigInt(count);
  const limit = modulus - (modulus % n);
  for (let counter = 0; counter < 1000; counter++) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encodeFields([
      'veridraw:winner-index:v1', betaHex, String(counter)
    ]));
    const data = new Uint8Array(digest);
    let value = 0n;
    for (let i = 0; i < 8; i++) value = (value << 8n) | BigInt(data[i]);
    if (value < limit) return Number(value % n);
  }
  throw new Error('Rejection sampling failed (unexpected)');
}
