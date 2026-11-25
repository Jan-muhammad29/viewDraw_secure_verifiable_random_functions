import {useEffect,useMemo,useState} from 'react';
import {verifyCertificate,verifyBeaconOnline,type DrawCertificate,type VerificationResult} from '@veridraw/protocol';
import './styles.css';
const API=import.meta.env.VITE_API_BASE??'';
type Raffle={id:string;title:string;description:string;status:'OPEN'|'LOCKED'|'DRAWING'|'DRAWN';keyId:string;beaconRound:string;roundAt:string;lockDeadline:string;lockedAt:string|null;rosterHashHex:string|null;commitmentHashHex:string|null;participantCount:number;createdAt:string};
type Participant={id:string;name:string};
type Self={loggedIn:boolean;email?:string;csrf?:string};
const short=(s?:string|null,n=30)=>!s?'—':s.length<=n?s:s.slice(0,Math.round(n/2))+'…'+s.slice(-Math.round(n/3));
const nice=(s?:string|null)=>s?new Date(s).toLocaleString():'—';
const status=(s:Raffle['status'])=>s==='OPEN'?'OPEN FOR ENTRIES':s==='LOCKED'?'ROSTER LOCKED':s==='DRAWN'?'DRAW COMPLETE':'DRAW IN PROGRESS';
const save=(file:string,body:unknown)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(body,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=file;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
async function request<T>(url:string,method='GET',body?:unknown,csrf?:string):Promise<T>{
 const res=await fetch(`${API}${url}`,{method,credentials:'include',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(csrf?{'x-csrf-token':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await res.json().catch(()=>({error:`HTTP ${res.status}`}));
 if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);
 return data as T;
}
export default function App(){
 const [view,setView]=useState<'overview'|'verify'|'security'>('overview');
 const [raffles,setRaffles]=useState<Raffle[]>([]);
 const [selected,setSelected]=useState('');
 const [members,setMembers]=useState<Participant[]>([]);
 const [cert,setCert]=useState<DrawCertificate|null>(null);
 const [checks,setChecks]=useState<VerificationResult|null>(null);
 const [beaconCheck,setBeaconCheck]=useState<'idle'|'checking'|'valid'|'invalid'>('idle');
 const [user,setUser]=useState<Self>({loggedIn:false});
 const [loginEmail,setLoginEmail]=useState('organizer@example.test');const [loginPass,setLoginPass]=useState('');
 const [title,setTitle]=useState('Campus Fair Raffle');const [description,setDescription]=useState('One randomly selected winner with a verifiable ECVRF proof.');
 const [drawAt,setDrawAt]=useState('');const [memberName,setMemberName]=useState('');const [memberId,setMemberId]=useState('');
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [error,setError]=useState('');
 const [commitment,setCommitment]=useState<Record<string,unknown>|null>(null);
 const current=useMemo(()=>raffles.find(r=>r.id===selected),[raffles,selected]);
 async function refresh(){const list=await request<Raffle[]>('/api/raffles');setRaffles(list);setSelected(prev=>prev&&list.some(x=>x.id===prev)?prev:list[0]?.id??'');}
 useEffect(()=>{void Promise.all([refresh(),request<Self>('/api/auth/me').then(setUser)]).catch(e=>setNotice(e instanceof Error?e.message:'API unavailable'))},[]);
 useEffect(()=>{if(!selected){setMembers([]);setCommitment(null);return}
  void Promise.all([request<Participant[]>(`/api/raffles/${selected}/participants`).then(setMembers),
   request<DrawCertificate>(`/api/raffles/${selected}/result`).then(setCert).catch(()=>setCert(null)),
   request<Record<string,unknown>>(`/api/raffles/${selected}/commitment`).then(setCommitment).catch(()=>setCommitment(null))]).catch(()=>{});
  setChecks(null);setBeaconCheck('idle');
 },[selected,raffles.map(x=>x.id+':'+x.status+':'+x.participantCount).join('|')]);
 async function doAction(fn:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Unexpected failure')}finally{setBusy(false)}}
 const login=()=>doAction(async()=>{const r=await request<{email:string;csrf:string}>('/api/auth/login','POST',{email:loginEmail,password:loginPass});setUser({loggedIn:true,...r});setLoginPass('');setNotice('Organizer session active')});
 const logout=()=>doAction(async()=>{await request('/api/auth/logout','POST',{},user.csrf);setUser({loggedIn:false});setNotice('Signed out')});
 const create=()=>doAction(async()=>{
  if(!drawAt)throw new Error('Choose a future draw time');
  const r=await request<Raffle>('/api/raffles','POST',{title,description,drawAt:new Date(drawAt).toISOString()},user.csrf);
  await refresh();setSelected(r.id);setNotice('Raffle created. Add entries, then lock the roster before the deadline.');
 });
 const register=()=>doAction(async()=>{
  if(!selected)throw new Error('Choose raffle');
  await request(`/api/raffles/${selected}/participants`,'POST',{id:memberId.trim().toLowerCase(),name:memberName.trim()});
  setMemberId('');setMemberName('');await refresh();setMembers(await request(`/api/raffles/${selected}/participants`));setNotice('Participant registered');
 });
 const lock=()=>doAction(async()=>{const c=await request<Record<string,unknown>>(`/api/raffles/${selected}/lock`,'POST',{},user.csrf);setCommitment(c);await refresh();setNotice('Roster frozen. Publish the commitment hash outside this server BEFORE the beacon round.');});
 const draw=()=>doAction(async()=>{const c=await request<DrawCertificate>(`/api/raffles/${selected}/draw`,'POST',{},user.csrf);setCert(c);setChecks(null);await refresh();setNotice('Draw committed. Verify the proof without trusting the backend.');});
 const demo=()=>doAction(async()=>{const c=await request<DrawCertificate>('/api/demo/draw','POST');setCert(c);setChecks(null);setSelected('');setView('verify');setNotice('Demo certificate loaded: this is NOT a committed fair raffle.');});
 const verify=()=>doAction(async()=>{if(!cert)throw new Error('Load a certificate first');setChecks(await verifyCertificate(cert));setBeaconCheck('idle')});
 const online=()=>doAction(async()=>{if(!cert)throw new Error('Load a certificate');setBeaconCheck('checking');try{await verifyBeaconOnline(cert.beacon);setBeaconCheck('valid');setNotice('Independent drand BLS beacon verification passed.')}catch(e){setBeaconCheck('invalid');throw e}});
 const loadCertificate=(file:File)=>doAction(async()=>{if(file.size>2*1024*1024)throw new Error('JSON file too large');const c=JSON.parse(await file.text()) as DrawCertificate;setCert(c);setChecks(null);setBeaconCheck('idle');setView('verify');setNotice('Certificate loaded; verify it locally.')});
 return <div className="appShell">
  <aside className="sidebar">
   <div className="brand"><div className="brandIcon">V</div><div><strong>VeriDraw</strong><small>VERIFIABLE RAFFLE</small></div></div>
   <p className="sideCaption">WORKSPACE</p>
   <nav><button className={view==='overview'?'navActive':''} onClick={()=>setView('overview')}>▦ <span>Raffle workspace</span></button><button className={view==='verify'?'navActive':''} onClick={()=>setView('verify')}>◇ <span>Proof verification</span></button><button className={view==='security'?'navActive':''} onClick={()=>setView('security')}>⬡ <span>Security model</span></button></nav>
   <div className="sideBottom"><span className="glowDot"/> RFC 9381 · ECVRF <p>All verifiers compute locally. A server cannot simply declare a fake proof valid.</p><div className="sideFoot">CS-3002 INFORMATION SECURITY</div></div>
  </aside>
  <main className="mainArea">
   <header className="header"><div><span className="tinyCaps">CRYPTOGRAPHIC RAFFLE MANAGEMENT</span><h1>{view==='overview'?'Raffle workspace':view==='verify'?'Independent verification':'Security & trust model'}</h1></div><div className="headerRight"><span className="environment">● REFERENCE BUILD</span><span className="avatar">{user.loggedIn?'A':'P'}</span></div></header>
   {error&&<div className="alert error" role="alert"><b>Request failed.</b> {error}<button onClick={()=>setError('')}>×</button></div>}
   {notice&&<div className="alert info" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
   {view==='overview'&&<>
     <section className="intro"><div><span className="tinyCaps cyan">PROVABLY REPRODUCIBLE</span><h2>Every draw leaves<br/><em>verifiable evidence.</em></h2><p>Register a roster, lock a commitment before the future beacon, and publish a cryptographic proof for everyone to check.</p></div><div className="introGlyph"><span>β</span><small>VRF OUTPUT</small></div></section>
     <section className="stats"><div><span>RAFFLES CREATED</span><strong>{raffles.length}</strong><small>Registered in database</small></div><div><span>TOTAL ENTRIES</span><strong>{raffles.reduce((n,r)=>n+r.participantCount,0)}</strong><small>Across all raffles</small></div><div><span>COMPLETED DRAWS</span><strong>{raffles.filter(x=>x.status==='DRAWN').length}</strong><small>With public proof</small></div></section>
     <div className="sectionHead"><h3>Active raffles</h3><span>Pick one to manage it</span></div>
     <div className="layout"><section className="panel"><div className="raffleList">{raffles.length?raffles.map(r=><button key={r.id} onClick={()=>setSelected(r.id)} className={'raffleItem '+(selected===r.id?'selected':'')}><div><b>{r.title}</b><small>{r.participantCount} entries · {nice(r.roundAt)}</small></div><span className={'status '+r.status.toLowerCase()}>{r.status}</span></button>):<p className="muted">No raffles created. Sign in to create the first one.</p>}</div></section>
       <section className="panel"><div className="cardTitle"><h3>Organizer access</h3><span className="softChip">{user.loggedIn?'SIGNED IN':'LOCKED'}</span></div>{user.loggedIn?<><p className="muted">Authenticated as {user.email}</p><button className="btn subtle" onClick={logout} disabled={busy}>Sign out</button></>:<><div className="field"><label>Email</label><input value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} type="email" autoComplete="username"/></div><div className="field"><label>Password</label><input type="password" value={loginPass} onChange={e=>setLoginPass(e.target.value)} autoComplete="current-password"/></div><button className="btn primary full" onClick={login} disabled={busy}>Secure organizer login</button></>}</section>
     </div>
     {user.loggedIn&&<section className="panel createPanel"><div className="cardTitle"><h3>Create a new raffle</h3><span className="softChip">ORGANIZER</span></div><div className="formGrid"><div className="field"><label>Raffle name</label><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120}/></div><div className="field"><label>Target draw time (local time)</label><input type="datetime-local" value={drawAt} onChange={e=>setDrawAt(e.target.value)}/></div><div className="field wide"><label>Description</label><input value={description} onChange={e=>setDescription(e.target.value)} maxLength={1000}/></div></div><p className="hint">Draw time must be at least two minutes ahead. The participant list must be locked at least 30 seconds before its assigned quicknet round.</p><button className="btn primary" onClick={create} disabled={busy}>+ Create raffle</button></section>}
     {current&&<section className="panel detail"><div className="cardTitle"><div><span className="tinyCaps">SELECTED RAFFLE</span><h3>{current.title}</h3></div><span className={'status '+current.status.toLowerCase()}>{status(current.status)}</span></div><p className="muted">{current.description}</p><div className="metaGrid"><div><span>PUBLIC KEY ID</span><code title={current.keyId}>{short(current.keyId,26)}</code></div><div><span>BEACON ROUND</span><b>{current.beaconRound}</b></div><div><span>BEACON TIME</span><b>{nice(current.roundAt)}</b></div><div><span>LOCK DEADLINE</span><b>{nice(current.lockDeadline)}</b></div></div>
       {current.status==='OPEN'&&<div className="entryForm"><h4>Register a participant</h4><div className="formGrid"><div className="field"><label>Participant ID (lowercase)</label><input value={memberId} maxLength={64} onChange={e=>setMemberId(e.target.value)} placeholder="e.g. member-007"/></div><div className="field"><label>Display name</label><input value={memberName} maxLength={80} onChange={e=>setMemberName(e.target.value)} placeholder="Participant name"/></div></div><button className="btn subtle" onClick={register} disabled={busy||!memberId||!memberName}>Register entry</button></div>}
       <div className="participants"><div className="cardTitle"><h4>Eligible participants</h4><small>{members.length} records</small></div><div className="entryTable">{members.length?members.map((m,i)=><div className="entry" key={m.id}><span>{String(i+1).padStart(2,'0')}</span><b>{m.name}</b><code>{m.id}</code></div>):<p className="muted">No entries yet.</p>}</div></div>
       {current.status==='OPEN'&&user.loggedIn&&<button className="btn primary" disabled={busy||!members.length} onClick={lock}>Freeze roster & generate commitment</button>}
       {commitment&&<div className="commitBox"><div className="cardTitle"><h4>Public commitment</h4><button className="textBtn" onClick={()=>save(`commitment-${current.id}.json`,commitment)}>Download JSON ↓</button></div><p>SHA-256: <code>{String(commitment.commitmentHashHex??current.commitmentHashHex)}</code></p><small>Publish this outside VeriDraw before the beacon is released. A server-hosted timestamp is not an independent witness.</small></div>}
       {current.status==='LOCKED'&&user.loggedIn&&<button className="btn primary" onClick={draw} disabled={busy}>Execute scheduled ECVRF draw</button>}
       {current.status==='DRAWING'&&<p className="hint">Draw is processing. Refresh to view the final result.</p>}
       {current.status==='DRAWN'&&<div className="winner"><span>WINNING PARTICIPANT</span><strong>{members.find(x=>x.id===cert?.winnerId)?.name||cert?.winnerId||'Loading certificate…'}</strong><button className="btn primary" onClick={()=>setView('verify')}>Verify result ↗</button></div>}
     </section>}
   </>}
   {view==='verify'&&<>
     <section className="intro compact"><div><span className="tinyCaps cyan">VERIFY, DON'T TRUST</span><h2>Check every proof<br/><em>independently.</em></h2><p>Verification runs in your browser with public data. Upload anyone's certificate and reproduce the winner without calling the organizer's verification service.</p></div><div className="introGlyph"><span>π</span><small>VRF PROOF</small></div></section>
     <section className="panel verifierActions"><div className="cardTitle"><h3>Certificate tools</h3><span className="softChip">PUBLIC ACCESS</span></div><div className="buttonRow"><label className="btn subtle upload">↑ Upload JSON certificate<input type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)void loadCertificate(f)}}/></label><button className="btn subtle" disabled={busy} onClick={demo}>Generate local test case</button><button className="btn subtle" disabled={!cert} onClick={()=>save(`veridraw-${cert?.raffleId}.json`,cert)}>Download certificate ↓</button></div></section>
     <div className="layout"><section className="panel"><div className="cardTitle"><h3>Cryptographic evidence</h3><span className="softChip">{cert?.mode??'NO CERTIFICATE'}</span></div>{cert?<div className="evidence">{[['Raffle ID',cert.raffleId],['Winner ID',cert.winnerId],['Public key',cert.publicKeyHex],['VRF proof π',cert.proofHex],['VRF output β',cert.betaHex],['Roster commitment',cert.rosterHashHex],['Protocol input α',cert.alphaHex]].map(([k,v])=><div className="evidenceRow" key={k}><span>{k}</span><code title={v}>{short(v,40)}</code></div>)}</div>:<p className="muted">Select a completed raffle, upload a certificate, or generate a demonstration.</p>}<button className="btn primary full" disabled={busy||!cert} onClick={verify}>Run independent verification</button></section>
       <section className="panel"><div className="cardTitle"><h3>Verification checks</h3><span className={'softChip '+(checks?.valid?'passed':'')}>{checks?(checks.valid?'PASSED':'FAILED'):'NOT RUN'}</span></div>{checks?<><div className="checklist">{checks.checks.map((c,i)=><div key={i} className="checkItem"><span className={c.valid?'tick':'cross'}>{c.valid?'✓':'×'}</span><div><b>{c.name}</b><small>{c.detail}</small></div></div>)}</div><p className="hint">{checks.fairnessStatus}</p></>:<p className="muted">Public-key verification will check the exact ECVRF proof, the SHA-256 roster, input binding, and the winning index.</p>}{cert?.mode==='COMMITTED_BEACON'&&<><div className="line"/><button className="btn subtle full" disabled={busy} onClick={online}>Verify drand BLS signature online</button><p className="hint">External beacon: {beaconCheck.toUpperCase()}. Pre-publication of the commitment still needs independent timestamp evidence.</p></>}</section></div>
   </>}
   {view==='security'&&<><section className="intro compact"><div><span className="tinyCaps cyan">SECURITY IN DEPTH</span><h2>Every guarantee<br/><em>has a boundary.</em></h2><p>ECVRF proves a correct output for a key and input. It does not magically prove that the organizer registered everyone or published the roster in time.</p></div><div className="introGlyph"><span>⚑</span><small>THREAT MODEL</small></div></section><div className="securityGrid">{[
     ['01','PROOF INTEGRITY','A modified proof, public key, input, VRF output, or winner is rejected by independently repeated calculations.'],
     ['02','ROSTER INTEGRITY','The roster is canonically sorted, hashed, and frozen before the announced future beacon round.'],
     ['03','BEACON AUTHENTICITY','drand BLS signature verification is required separately; checking a beacon hash is not enough.'],
     ['04','ADMIN BOUNDARIES','Organizer actions require a session, CSRF token, controlled origins, and rate limits.'],
     ['05','KEY MANAGEMENT','The private ECVRF key stays on the backend as a secret; public keys remain accessible for historic verification.'],
     ['06','FAIRNESS LIMITATION','A publicly timestamped commitment is essential to establish advance publication. Organizer suppression is still possible.']
   ].map(([n,h,p])=><section className="panel securityCard" key={n}><span className="tinyCaps cyan">{n} / SECURITY CONTROL</span><h3>{h}</h3><p>{p}</p></section>)}</div></>}
   <footer className="footer"><span>VeriDraw / CS-3002 · Reference implementation</span><span>RFC 9381 ECVRF-EDWARDS25519-SHA512-TAI</span></footer>
  </main>
 </div>;
}
