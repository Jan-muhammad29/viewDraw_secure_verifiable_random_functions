export interface Participant { id: string; name: string }
export interface Beacon { source: string; round: string; valueHex: string; signatureHex?: string; chainHash?: string }
export interface Commitment {raffleId:string;keyId:string;rosterHashHex:string;beaconRound:string;lockedAt:string;lockDeadline:string}
export interface DrawCertificate {
  version: string; suite: string; mode: 'DEMO_NOT_FAIR' | 'COMMITTED_BEACON';
  raffleId: string; keyId: string; publicKeyHex: string;
  participants: Participant[]; rosterHashHex: string; beacon: Beacon;
  alphaHex: string; proofHex: string; betaHex: string;
  winnerIndex: number; winnerId: string; generatedAt: string;
  commitment?:Commitment;commitmentHashHex?:string;
}
export interface Check { name: string; valid: boolean; detail: string }
export interface VerificationResult {valid:boolean;checks:Check[];fairnessStatus?:string;recomputedWinnerId?:string;recomputedIndex?:number}
export const PROTOCOL_VERSION:string; export const SUITE:string;
export const DRAND_CHAIN_HASH:string;export const DRAND_GENESIS_MS:number;export const DRAND_PERIOD_MS:number;
export function hexToBytesStrict(hex:string,expectedBytes?:number):Uint8Array;
export function bytesToHex(bytes:Uint8Array):string;
export function canonicalRoster(participants:Participant[]):Participant[];
export function sha256Hex(input:Uint8Array):Promise<string>;
export function computeRosterHashHex(participants:Participant[]):Promise<string>;
export function computeKeyId(pk:string):Promise<string>;
export function encodeAlphaHex(input:{raffleId:string;keyId:string;rosterHashHex:string;beacon:Beacon}):string;
export function selectWinnerIndex(beta:string,count:number):Promise<number>;
export function drandRoundAt(round:number):number;
export function drandRoundForTime(ms:number):number;
export function computeCommitmentHashHex(c:Commitment):Promise<string>;
export function fetchVerifiedDrandRound(round:number):Promise<Beacon>;
export function verifyBeaconOnline(beacon:Beacon):Promise<boolean>;
export function verifyCertificate(cert:DrawCertificate):Promise<VerificationResult>;
