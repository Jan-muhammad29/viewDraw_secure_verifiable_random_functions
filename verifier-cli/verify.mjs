import {readFile} from 'node:fs/promises';
import {verifyCertificate,verifyBeaconOnline} from '../shared/src/index.js';
const args=process.argv.slice(2);
if(!args[0]){console.error('Usage: node verifier-cli/verify.mjs certificate.json [--online]');process.exit(2)}
try {
 const certificate=JSON.parse(await readFile(args[0],'utf8'));
 const result=await verifyCertificate(certificate);
 for(const c of result.checks) console.log(`${c.valid?'PASS':'FAIL'} ${c.name}: ${c.detail}`);
 console.log('Fairness note:',result.fairnessStatus);
 if(!result.valid)process.exitCode=1;
 else if(args.includes('--online') && certificate.mode==='COMMITTED_BEACON'){
  await verifyBeaconOnline(certificate.beacon);
  console.log('PASS drand beacon BLS verification (pinned quicknet chain)');
  console.log('NOTE: verify commitment publication time using independently timestamped evidence.');
 }
 else if(certificate.mode==='COMMITTED_BEACON')console.log('NOTE: --online enables independent drand BLS verification.');
} catch(e){console.error('FAIL',e instanceof Error?e.message:'Unknown error');process.exitCode=1}
