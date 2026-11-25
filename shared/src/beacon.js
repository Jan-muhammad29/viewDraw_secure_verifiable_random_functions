import {DRAND_CHAIN_HASH} from './commitment.js';
// drand-client performs BLS signature verification, and checks quicknet's pinned chain identity.
// Pure ECVRF proof verification alone CANNOT authenticate external beacon data.
export async function fetchVerifiedDrandRound(round) {
  if(!Number.isSafeInteger(round)||round<1) throw new Error('Invalid round');
  const {HttpCachingChain,HttpChainClient,fetchBeacon} = await import('drand-client');
  const opts={disableBeaconVerification:false,noCache:false,apiVersion:'v2',chainVerificationParams:{chainHash:DRAND_CHAIN_HASH}};
  const chain=new HttpCachingChain(`https://api.drand.sh/v2/chains/${DRAND_CHAIN_HASH}`,opts);
  const client=new HttpChainClient(chain,opts);
  const b=await fetchBeacon(client,round);
  if(b.round!==round || !/^[0-9a-f]{64}$/.test(b.randomness) || !/^[0-9a-f]+$/.test(b.signature)) throw new Error('Malformed or unexpected verified drand response');
  return {source:'DRAND_QUICKNET',round:String(b.round),valueHex:b.randomness,signatureHex:b.signature,chainHash:DRAND_CHAIN_HASH};
}
export async function verifyBeaconOnline(beacon) {
  if(beacon?.source!=='DRAND_QUICKNET' || beacon.chainHash!==DRAND_CHAIN_HASH || !/^[0-9]+$/.test(beacon.round)) throw new Error('Unsupported beacon');
  const trusted=await fetchVerifiedDrandRound(Number(beacon.round));
  if(trusted.valueHex!==beacon.valueHex || trusted.signatureHex!==beacon.signatureHex) throw new Error('Beacon does not match BLS-verified drand value');
  return true;
}
