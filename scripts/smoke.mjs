// Integration test: requires a running API and database, including bootstrapped CI admin.
import assert from 'node:assert/strict';
const host=process.env.SMOKE_API??'http://127.0.0.1:5000';
const admin=process.env.ADMIN_EMAIL??'ci-admin@example.test',password=process.env.ADMIN_PASSWORD??'';
async function call(path,method='GET',body,auth={}){
 const res=await fetch(host+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(auth.cookie?{cookie:auth.cookie}:{}),...(auth.csrf?{'x-csrf-token':auth.csrf}:{})},body:body?JSON.stringify(body):undefined});
 return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')??''};
}
let ready=false;for(let i=0;i<30;i++){try{const r=await call('/api/health');if(r.status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}
assert.equal(ready,true,'API never became healthy');
assert.equal((await call('/api/raffles','POST',{title:'Hacked',drawAt:new Date(Date.now()+180_000).toISOString()})).status,401);
const login=await call('/api/auth/login','POST',{email:admin,password});assert.equal(login.status,200,JSON.stringify(login.data));
const auth={cookie:login.cookie.split(';')[0],csrf:login.data.csrf};
assert.equal((await call('/api/raffles','POST',{title:'Bad CSRF',drawAt:new Date(Date.now()+180_000).toISOString()},{cookie:auth.cookie})).status,403);
const created=await call('/api/raffles','POST',{title:'CI verification raffle',description:'Integration test',drawAt:new Date(Date.now()+180_000).toISOString()},auth);
assert.equal(created.status,201,JSON.stringify(created.data));const id=created.data.id;
assert.equal((await call(`/api/raffles/${id}/participants`,'POST',{id:'member-1',name:'Alice'})).status,201);
assert.equal((await call(`/api/raffles/${id}/participants`,'POST',{id:'member-1',name:'Alice'})).status,409);
assert.equal((await call(`/api/raffles/${id}/lock`,'POST',{},auth)).status,200);
assert.equal((await call(`/api/raffles/${id}/participants`,'POST',{id:'member-2',name:'Bob'})).status,409);
assert.equal((await call(`/api/raffles/${id}/lock`,'POST',{},auth)).status,409);
assert.equal((await call(`/api/raffles/${id}/draw`,'POST',{},auth)).status,409);
const demo=await call('/api/demo/draw','POST',{});assert.equal(demo.status,200,JSON.stringify(demo.data));
const verified=await call('/api/verify','POST',demo.data);assert.equal(verified.data.valid,true,JSON.stringify(verified.data));
const changed={...demo.data,winnerId:'attacker'};assert.equal((await call('/api/verify','POST',changed)).data.valid,false);
console.log('PASS smoke: auth, csrf, create, unique entries, lock, atomic guard, demo VRF, independent proof checking');
