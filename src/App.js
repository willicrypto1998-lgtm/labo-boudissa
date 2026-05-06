/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getDatabase, ref, push, set, onValue, update, get, query, orderByChild, limitToLast
} from "firebase/database";

// ══════════════════════════════════════════════════════════
//  🔥 FIREBASE
// ══════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyAHDjSdu91JLDWP7xr3sL-KH4xBEtWQBz8",
  authDomain: "labo-boudissa.firebaseapp.com",
  databaseURL: "https://labo-boudissa-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "labo-boudissa",
  storageBucket: "labo-boudissa.firebasestorage.app",
  messagingSenderId: "752456253225",
  appId: "1:752456253225:web:294ea129e059274f0ac138"
};

let db = null;
let fbOK = false;
try {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  fbOK = true;
} catch(e) { fbOK = false; }

const todayKey = () => new Date().toISOString().slice(0,10).replace(/-/g,"");
const nowStr   = () => new Date().toLocaleTimeString("fr-DZ",{hour:"2-digit",minute:"2-digit"});
const dateStr  = () => new Date().toLocaleDateString("fr-DZ",{day:"2-digit",month:"2-digit",year:"numeric"});

// ══════════════════════════════════════════════════════════
//  💾 SESSION & CONFIG
// ══════════════════════════════════════════════════════════
const SESSION_KEY = "boudissa_v2_session";
const saveSession = u => localStorage.setItem(SESSION_KEY, JSON.stringify(u));
const loadSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } };
const clearSession = () => localStorage.removeItem(SESSION_KEY);

// ══════════════════════════════════════════════════════════
//  ACCOUNTS
// ══════════════════════════════════════════════════════════
const ACCOUNTS = {
  boudissa: { pwd:"Boudissa2026", role:"admin",   nom:"Dr. Boudissa",  icon:"👨‍⚕️" },
  tech1:    { pwd:"Tech2026",     role:"tech",    nom:"Technicien",    icon:"🔬" },
  accueil:  { pwd:"Accueil2026",  role:"accueil", nom:"Accueil",       icon:"🏥" },
};

// ══════════════════════════════════════════════════════════
//  LOCAL FALLBACK
// ══════════════════════════════════════════════════════════
const LOCAL = {
  queue:[], counter:0, listeners:[],
  notify(){ this.listeners.forEach(fn=>fn([...this.queue])); },
  sub(fn){ this.listeners.push(fn); fn([...this.queue]); return ()=>{ this.listeners=this.listeners.filter(l=>l!==fn); }; }
};

// ══════════════════════════════════════════════════════════
//  FIREBASE API
// ══════════════════════════════════════════════════════════
async function apiAdd(data) {
  LOCAL.counter++;
  const seq  = String(LOCAL.counter).padStart(4,"0");
  const code = todayKey() + seq;
  const ticket = {
    id: Date.now().toString(), code, ...data,
    status:"waiting", time:nowStr(), date:dateStr(),
    createdAt:Date.now(), results:null, hasResults:false,
    resultDate:null, techName:null, notes:""
  };
  if(!fbOK){ LOCAL.queue.push(ticket); LOCAL.notify(); return ticket; }
  const r = push(ref(db,`days/${todayKey()}/queue`));
  ticket.id = r.key;
  await set(r, ticket);
  // Save to patient archive
  if(data.phone){
    await set(ref(db,`patients/${data.phone.replace(/\s/g,"")}/lastVisit`), { code, date:dateStr(), analyses:data.analyses });
  }
  return ticket;
}

async function apiUpdate(id, data) {
  if(!fbOK){ const t=LOCAL.queue.find(t=>t.id===id); if(t){Object.assign(t,data);LOCAL.notify();} return; }
  await update(ref(db,`days/${todayKey()}/queue/${id}`), data);
}

async function apiCallNext(queue) {
  const cur = queue.find(t=>t.status==="called");
  if(cur) await apiUpdate(cur.id,{status:"done"});
  const nxt = queue.find(t=>t.status==="waiting");
  if(nxt) await apiUpdate(nxt.id,{status:"called",calledAt:Date.now()});
}

async function apiSaveResults(id, results, notes, techName) {
  await apiUpdate(id, {
    results, notes, techName,
    hasResults:true,
    resultDate:Date.now(),
    status:"done"
  });
}

function subQueue(cb) {
  if(!fbOK) return LOCAL.sub(cb);
  onValue(ref(db,`days/${todayKey()}/queue`), snap=>{
    const d = snap.val();
    const q = d ? Object.entries(d).map(([id,v])=>({...v,id})).sort((a,b)=>a.createdAt-b.createdAt) : [];
    cb(q);
  });
  return ()=>{};
}

function useQueue(){
  const [q,setQ]=useState([]);
  useEffect(()=>{ return subQueue(setQ); },[]);
  return q;
}

function useNetwork(){
  const [on,setOn]=useState(navigator.onLine);
  useEffect(()=>{ window.addEventListener("online",()=>setOn(true)); window.addEventListener("offline",()=>setOn(false)); },[]);
  return on;
}

// ══════════════════════════════════════════════════════════
//  BARCODE (Code 128)
// ══════════════════════════════════════════════════════════
function barcodeSVG(code, w=2, h=56) {
  const T={' ':0,'!':1,'"':2,'#':3,'$':4,'%':5,'&':6,"'":7,'(':8,')':9,'*':10,'+':11,',':12,'-':13,'.':14,'/':15,'0':16,'1':17,'2':18,'3':19,'4':20,'5':21,'6':22,'7':23,'8':24,'9':25,':':26,';':27,'<':28,'=':29,'>':30,'?':31,'@':32,'A':33,'B':34,'C':35,'D':36,'E':37,'F':38,'G':39,'H':40,'I':41,'J':42,'K':43,'L':44,'M':45,'N':46,'O':47,'P':48,'Q':49,'R':50,'S':51,'T':52,'U':53,'V':54,'W':55,'X':56,'Y':57,'Z':58};
  const P=["11011001100","11001101100","11001100110","10010011000","10010001100","10001001100","10011001000","10011000100","10001100100","11001001000","11001000100","11000100100","10110011100","10011011100","10011001110","10111001100","10011101100","10011100110","11001110010","11001011100","11001001110","11011100100","11001110100","11101101110","11101001100","11100101100","11100100110","11101100100","11100110100","11100110010","11011011000","11011000110","11000110110","10100011000","10001011000","10001000110","10110001000","10001101000","10001100010","11010001000","11000101000","11000100010","10110111000","10110001110","10001101110","10111011000","10111000110","10001110110","11101110110","11010001110","11000101110","11011101000","11011100010","11011101110","11101011000","11101000110","11100010110","11101101000","11101100010","11100011010","11101111010","11001000010","11110001010","10100110000","10100001100","10010110000","10010000110","10000101100","10000100110","10110010000","10110000100","10011010000","10011000010","10000110100","10000110010","11000010010","11001010000","11110111010","11000010100","10001111010","10100111100","10010111100","10010011110","10111100100","10011110100","10011110010","11110100100","11110010100","11110010010","11011011110","11011110110","11110110110","10101111000","10100011110","10001011110","10111101000","10111100010","11110101000","11110100010","10111011110","10111101110","11101011110","11110101110","11010000100","11010010000","11010011100","11000111010"];
  let codes=[104], check=104;
  const str=code.slice(-8);
  for(let i=0;i<str.length;i++){ const v=T[str[i].toUpperCase()]??16; codes.push(v); check+=v*(i+1); }
  codes.push(check%103); codes.push(106);
  const bars=codes.map(c=>P[c]||"10101010").join("")+"11";
  const width=bars.length*w+20;
  let rects=""; let x=10;
  for(let i=0;i<bars.length;i++){ if(bars[i]==="1") rects+=`<rect x="${x}" y="0" width="${w}" height="${h}" fill="#1a1a2e"/>`; x+=w; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h+18}" viewBox="0 0 ${width} ${h+18}"><rect width="${width}" height="${h+18}" fill="white"/>${rects}<text x="${width/2}" y="${h+14}" text-anchor="middle" font-family="monospace" font-size="9" fill="#1a1a2e" font-weight="bold">${code}</text></svg>`;
}

// ══════════════════════════════════════════════════════════
//  PDF RESULTS GENERATOR
// ══════════════════════════════════════════════════════════
function printResults(ticket) {
  const barcodeHtml = barcodeSVG(ticket.code, 1.5, 40);
  const resultsHtml = ticket.results?.map(r =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px">${r.name}</td>
     <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;font-weight:700;color:#0d2340">${r.value}</td>
     <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;color:#666">${r.ref||""}</td></tr>`
  ).join("") || `<tr><td colspan="3" style="padding:12px;text-align:center;color:#666">${ticket.notes||"Résultats à saisir"}</td></tr>`;

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Résultats — ${ticket.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;background:white;color:#1a1a2e;-webkit-print-color-adjust:exact}
  .page{max-width:800px;margin:0 auto;padding:32px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:3px solid #0d2340}
  .logo-area h1{font-size:22px;font-weight:700;color:#0d2340;letter-spacing:-.01em}
  .logo-area p{font-size:11px;color:#666;margin-top:3px}
  .labo-info{text-align:right;font-size:11px;color:#555;line-height:1.6}
  .patient-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  .field label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#666;display:block;margin-bottom:3px}
  .field span{font-size:13px;font-weight:600;color:#1a1a2e}
  .results-table{width:100%;border-collapse:collapse;margin-bottom:20px}
  .results-table th{padding:10px 12px;background:#0d2340;color:white;font-size:11px;text-align:left;font-weight:600;letter-spacing:.05em;text-transform:uppercase}
  .stamp{display:flex;justify-content:flex-end;margin-top:32px}
  .stamp-box{border:2px solid #0d2340;border-radius:8px;padding:16px 24px;text-align:center;min-width:180px}
  .stamp-box p{font-size:11px;color:#666;margin-bottom:4px}
  .stamp-box .name{font-size:14px;font-weight:700;color:#0d2340}
  .barcode-section{text-align:center;margin-bottom:20px}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#999;text-align:center;line-height:1.6}
  @media print{.no-print{display:none}body{padding:0}.page{padding:20px}}
</style></head><body>
<div class="page">
  <div class="header">
    <div class="logo-area">
      <h1>🧬 Laboratoire d'Analyses Médicales</h1>
      <p style="font-size:16px;font-weight:700;color:#1e6fc4;margin-top:4px">BOUDISSA</p>
      <p>Analyses biologiques · Microbiologie · Biochimie</p>
    </div>
    <div class="labo-info">
      <strong>Boumerdès, Algérie</strong><br>
      Tél : 024 79 85 35<br>
      Dim – Jeu : 07h00 – 17h00<br>
      <div style="margin-top:8px">${barcodeHtml}</div>
    </div>
  </div>

  <div class="patient-card">
    <div class="field"><label>Patient</label><span>${ticket.name}</span></div>
    <div class="field"><label>Âge</label><span>${ticket.age||"—"} ans</span></div>
    <div class="field"><label>Téléphone</label><span>${ticket.phone||"—"}</span></div>
    <div class="field"><label>N° Dossier</label><span>${ticket.code}</span></div>
    <div class="field"><label>Date</label><span>${ticket.date||dateStr()}</span></div>
    <div class="field"><label>Résultats le</label><span>${ticket.resultDate ? new Date(ticket.resultDate).toLocaleDateString("fr-DZ") : dateStr()}</span></div>
  </div>

  <table class="results-table">
    <thead><tr>
      <th>Analyse</th><th>Résultat</th><th>Valeurs de référence</th>
    </tr></thead>
    <tbody>${resultsHtml}</tbody>
  </table>

  ${ticket.notes ? `<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:12px"><strong>Observations :</strong> ${ticket.notes}</div>` : ""}

  <div class="stamp">
    <div class="stamp-box">
      <p>Validé par</p>
      <div class="name">${ticket.techName||"Dr. Boudissa"}</div>
      <div style="margin-top:8px;height:50px;border-bottom:1px dashed #ccc"></div>
      <p style="margin-top:6px">Cachet et signature</p>
    </div>
  </div>

  <div class="footer">
    Ce document est confidentiel et destiné uniquement au patient mentionné ci-dessus.<br>
    Laboratoire Boudissa · Boumerdès · Tél : 024 79 85 35 · Agréé par le Ministère de la Santé
  </div>
</div>
<script>window.onload=()=>window.print();<\/script>
</body></html>`);
}

// ══════════════════════════════════════════════════════════
//  STYLES — $10,000 PREMIUM DESIGN
// ══════════════════════════════════════════════════════════
const S = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --ink:#0d1117;--ink-90:rgba(13,17,23,.9);--ink-50:rgba(13,17,23,.5);--ink-20:rgba(13,17,23,.2);--ink-08:rgba(13,17,23,.08);
  --page:#f6f8fa;--surface:#ffffff;--surface-2:#f0f4f8;
  --azure:#0066ff;--azure-l:#e8f0ff;--azure-d:#0047cc;
  --teal:#00c2b5;--teal-l:#e0faf8;--teal-d:#008f85;
  --jade:#00c47a;--jade-l:#e0faf0;
  --amber:#f5a623;--amber-l:#fff4df;
  --rose:#ff4466;--rose-l:#fff0f3;
  --violet:#7c3aed;--violet-l:#f3f0ff;
  --mono: 'JetBrains Mono', monospace;
  --serif: 'Instrument Serif', serif;
  --sans: 'DM Sans', sans-serif;
  --ease: cubic-bezier(.16,1,.3,1);
  --ease-spring: cubic-bezier(.34,1.56,.64,1);
  --r:12px; --r-lg:20px; --r-xl:28px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04);
  --shadow-md: 0 4px 16px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04);
  --shadow-lg: 0 20px 60px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.06);
  --shadow-xl: 0 40px 100px rgba(0,0,0,.16), 0 16px 40px rgba(0,0,0,.08);
}

html,body{height:100%;font-family:var(--sans);background:var(--page);color:var(--ink);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-thumb{background:var(--ink-20);border-radius:2px}
::-webkit-scrollbar-track{background:transparent}

/* ── ANIMATIONS ── */
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:none;opacity:1}}
@keyframes slideRight{from{transform:translateX(-24px);opacity:0}to{transform:none;opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(0,194,181,.3)}50%{box-shadow:0 0 0 12px rgba(0,194,181,0)}}
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes numberUp{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}

/* ── LANG BAR ── */
.langbar{
  position:fixed;top:0;left:0;right:0;z-index:1000;
  background:var(--ink);
  padding:0 20px;height:38px;
  display:flex;align-items:center;justify-content:space-between;
}
.langbar-brand{
  display:flex;align-items:center;gap:8px;
  font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.35);
}
.langbar-dot{width:6px;height:6px;border-radius:50%;background:var(--teal);animation:pulse 2s infinite}
.langbar-btns{display:flex;gap:4px}
.lb{padding:4px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:transparent;color:rgba(255,255,255,.4);font:600 11px var(--sans);cursor:pointer;transition:all .2s;letter-spacing:.04em}
.lb.on{background:rgba(0,194,181,.15);border-color:var(--teal);color:var(--teal)}

/* ── LOGIN ── */
.login-bg{
  min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;padding-top:60px;
  background:
    radial-gradient(circle at 20% 50%, rgba(0,102,255,.06) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(0,194,181,.06) 0%, transparent 40%),
    radial-gradient(circle at 50% 100%, rgba(124,58,237,.04) 0%, transparent 40%),
    var(--page);
}
.login-card{
  background:var(--surface);border:1px solid var(--ink-08);border-radius:var(--r-xl);
  padding:48px 40px;width:100%;max-width:420px;
  box-shadow:var(--shadow-xl);
  animation:fadeUp .5s var(--ease) both;
}
.login-badge{
  display:inline-flex;align-items:center;gap:6px;
  background:var(--teal-l);border:1px solid rgba(0,194,181,.2);
  border-radius:100px;padding:5px 14px;
  font-size:11px;font-weight:600;color:var(--teal-d);
  letter-spacing:.06em;text-transform:uppercase;margin-bottom:20px;
}
.login-title{font-family:var(--serif);font-size:2rem;color:var(--ink);line-height:1.1;margin-bottom:6px}
.login-title em{font-style:italic;color:var(--azure)}
.login-sub{font-size:13px;color:var(--ink-50);margin-bottom:32px;line-height:1.5}
.role-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:24px}
.role-card{
  border:1.5px solid var(--ink-08);background:var(--surface-2);
  border-radius:var(--r);padding:14px 8px;text-align:center;cursor:pointer;transition:all .25s var(--ease);
}
.role-card:hover{border-color:var(--azure);background:var(--azure-l);transform:translateY(-2px)}
.role-card.on{border-color:var(--azure);background:var(--azure-l);box-shadow:0 0 0 3px rgba(0,102,255,.1)}
.role-icon{font-size:22px;margin-bottom:6px}
.role-name{font-size:11px;font-weight:700;color:var(--ink);letter-spacing:.03em}
.input-wrap{position:relative;margin-bottom:16px}
.input-wrap label{display:block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-50);margin-bottom:6px}
.input-wrap input{
  width:100%;padding:12px 16px;border-radius:var(--r);
  border:1.5px solid var(--ink-08);background:var(--surface-2);
  font:500 14px var(--sans);color:var(--ink);outline:none;transition:all .2s;
}
.input-wrap input:focus{border-color:var(--azure);background:var(--surface);box-shadow:0 0 0 3px rgba(0,102,255,.08)}
.login-cta{
  width:100%;padding:14px;border-radius:var(--r);border:none;
  background:var(--ink);color:white;
  font:700 14px var(--sans);letter-spacing:.03em;cursor:pointer;transition:all .25s var(--ease);
  display:flex;align-items:center;justify-content:center;gap:8px;
}
.login-cta:hover{background:var(--azure);transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,102,255,.3)}
.login-err{background:var(--rose-l);border:1px solid rgba(255,68,102,.2);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--rose);margin-top:12px;text-align:center}

/* ── MAIN SHELL ── */
.app{min-height:100vh;padding-top:38px;display:flex;flex-direction:column}

/* ── TOP HEADER ── */
.tophead{
  background:var(--surface);border-bottom:1px solid var(--ink-08);
  padding:0 24px;height:56px;position:sticky;top:38px;z-index:100;
  display:flex;align-items:center;justify-content:space-between;
  box-shadow:var(--shadow-sm);
}
.tophead-left{display:flex;align-items:center;gap:16px}
.tophead-logo{
  display:flex;align-items:center;gap:10px;
  font-family:var(--serif);font-size:18px;color:var(--ink);
}
.tophead-logo-mark{
  width:36px;height:36px;background:linear-gradient(135deg,var(--azure),var(--teal));
  border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;
  flex-shrink:0;
}
.tophead-sep{width:1px;height:20px;background:var(--ink-08)}
.tophead-nav{display:flex;gap:4px}
.nav-tab{
  padding:6px 14px;border-radius:8px;border:none;background:transparent;
  font:600 12px var(--sans);color:var(--ink-50);cursor:pointer;transition:all .2s;
  display:flex;align-items:center;gap:6px;
}
.nav-tab:hover{background:var(--surface-2);color:var(--ink)}
.nav-tab.on{background:var(--azure-l);color:var(--azure)}
.tophead-right{display:flex;align-items:center;gap:10px}
.status-badge{
  display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:100px;
  font-size:11px;font-weight:700;
}
.status-badge.online{background:var(--jade-l);color:var(--jade)}
.status-badge.offline{background:var(--rose-l);color:var(--rose)}
.status-dot{width:6px;height:6px;border-radius:50%}
.online .status-dot{background:var(--jade);animation:pulse 2s infinite}
.offline .status-dot{background:var(--rose)}
.user-badge{
  display:flex;align-items:center;gap:8px;padding:5px 12px 5px 6px;
  border-radius:100px;background:var(--surface-2);border:1px solid var(--ink-08);cursor:pointer;
}
.user-avatar{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--azure),var(--teal));display:flex;align-items:center;justify-content:center;font-size:12px}
.user-name{font-size:12px;font-weight:600;color:var(--ink)}
.logout-btn{width:28px;height:28px;border-radius:8px;border:1px solid var(--ink-08);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;transition:all .2s}
.logout-btn:hover{background:var(--rose-l);border-color:var(--rose);color:var(--rose)}

/* ── TICKER ── */
.ticker{
  background:var(--ink);overflow:hidden;height:32px;display:flex;align-items:center;
}
.ticker-inner{display:flex;gap:0;animation:ticker 30s linear infinite;white-space:nowrap}
.ticker-item{
  padding:0 32px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:rgba(255,255,255,.5);display:flex;align-items:center;gap:8px;
}
.ticker-item strong{color:var(--teal)}
.ticker-sep{color:rgba(255,255,255,.15)}

/* ── STATS ROW ── */
.stats-grid{
  display:grid;grid-template-columns:repeat(4,1fr);gap:1px;
  background:var(--ink-08);border-bottom:1px solid var(--ink-08);
  margin-bottom:0;
}
.stat-card{
  background:var(--surface);padding:18px 20px;
  transition:background .2s;
}
.stat-card:hover{background:var(--surface-2)}
.stat-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-50);margin-bottom:6px}
.stat-value{font:800 28px var(--serif);color:var(--ink);line-height:1;animation:numberUp .4s var(--ease)}
.stat-sub{font-size:11px;color:var(--ink-50);margin-top:4px;display:flex;align-items:center;gap:4px}
.stat-trend{padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700}
.trend-up{background:var(--jade-l);color:var(--jade)}
.trend-dn{background:var(--rose-l);color:var(--rose)}

/* ── CALLED BAR ── */
.called-bar{
  background:linear-gradient(135deg,#fff8ed,#fff3d6);
  border-bottom:2px solid var(--amber);
  padding:12px 24px;display:flex;align-items:center;justify-content:space-between;
  animation:fadeIn .3s;
}
.called-info{display:flex;align-items:center;gap:14px}
.called-num{
  font-family:var(--mono);font-size:18px;font-weight:600;
  background:var(--amber);color:white;padding:4px 10px;border-radius:6px;letter-spacing:.05em;
}
.called-name{font-size:15px;font-weight:700;color:var(--ink)}
.called-analyses{font-size:12px;color:var(--ink-50);margin-top:2px}
.called-actions{display:flex;gap:8px;align-items:center}
.delay-chip{
  padding:5px 12px;border-radius:8px;border:1.5px solid rgba(245,166,35,.3);
  background:rgba(245,166,35,.08);color:var(--amber);
  font:700 11px var(--sans);cursor:pointer;transition:all .2s;
}
.delay-chip:hover{background:var(--amber);color:white;border-color:var(--amber)}
.done-chip{
  padding:6px 16px;border-radius:8px;border:none;
  background:var(--jade);color:white;font:700 12px var(--sans);cursor:pointer;transition:all .2s;
}
.done-chip:hover{background:var(--jade-d,#00a666)}
.results-chip{
  padding:5px 12px;border-radius:8px;border:1.5px solid rgba(0,102,255,.2);
  background:var(--azure-l);color:var(--azure);font:700 11px var(--sans);cursor:pointer;transition:all .2s;
}
.results-chip:hover{background:var(--azure);color:white}

/* ── MAIN CONTENT ── */
.main-content{flex:1;display:grid;grid-template-columns:340px 1fr;gap:0;min-height:0}
@media(max-width:900px){.main-content{grid-template-columns:1fr}}

/* ── LEFT PANEL ── */
.left-panel{
  border-right:1px solid var(--ink-08);background:var(--surface);
  overflow-y:auto;padding-bottom:80px;
}
.panel-head{
  padding:16px 20px 12px;position:sticky;top:0;background:var(--surface);
  z-index:10;border-bottom:1px solid var(--ink-08);
}
.panel-title{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-50);margin-bottom:10px}
.add-toggle{
  width:100%;padding:10px 14px;border-radius:var(--r);border:1.5px dashed var(--ink-20);
  background:transparent;font:600 13px var(--sans);color:var(--ink-50);cursor:pointer;
  transition:all .2s;display:flex;align-items:center;gap:8px;
}
.add-toggle:hover{border-color:var(--azure);color:var(--azure);background:var(--azure-l)}
.add-toggle.open{border-style:solid;border-color:var(--azure);color:var(--azure);background:var(--azure-l)}

/* ── ADD FORM ── */
.add-form{padding:16px 20px;border-bottom:1px solid var(--ink-08);animation:fadeUp .2s var(--ease)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.field{display:flex;flex-direction:column;gap:4px}
.field label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-50)}
.field input,.field textarea,.field select{
  padding:9px 12px;border-radius:9px;border:1.5px solid var(--ink-08);
  background:var(--surface-2);font:500 13px var(--sans);color:var(--ink);outline:none;transition:all .2s;
}
.field input:focus,.field textarea:focus{border-color:var(--azure);background:var(--surface);box-shadow:0 0 0 3px rgba(0,102,255,.06)}
.field textarea{resize:vertical;min-height:64px}
.submit-btn{
  width:100%;padding:11px;border-radius:var(--r);border:none;
  background:var(--ink);color:white;font:700 13px var(--sans);cursor:pointer;transition:all .2s;
  display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;
}
.submit-btn:hover{background:var(--azure);box-shadow:0 4px 16px rgba(0,102,255,.25)}

/* ── TICKET POPUP ── */
.ticket-popup{
  margin:14px 20px;background:var(--ink);border-radius:var(--r-lg);padding:20px;
  animation:fadeUp .3s var(--ease);
}
.ticket-popup-code{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.15em;color:rgba(255,255,255,.4);margin-bottom:4px}
.ticket-popup-num{font:800 40px var(--serif);color:white;line-height:1;letter-spacing:-.01em}
.ticket-popup-name{font-size:12px;color:rgba(255,255,255,.5);margin-top:4px;margin-bottom:14px}
.ticket-barcode{background:white;border-radius:8px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:12px}
.ticket-barcode-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-50)}
.ticket-actions{display:flex;gap:8px}
.ticket-actions button{flex:1;padding:9px;border-radius:9px;border:none;font:700 12px var(--sans);cursor:pointer;transition:all .2s}
.btn-wa{background:#25D366;color:white}.btn-wa:hover{background:#20ba5a}
.btn-print{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.1)!important}
.btn-print:hover{background:rgba(255,255,255,.2)}

/* ── QUEUE LIST ── */
.queue-list{padding:12px}
.queue-empty{text-align:center;padding:48px 20px;color:var(--ink-50)}
.queue-empty-icon{font-size:36px;margin-bottom:12px;display:block}
.queue-empty-text{font-size:13px;font-weight:600}
.q-item{
  border-radius:var(--r);border:1px solid var(--ink-08);background:var(--surface);
  margin-bottom:8px;overflow:hidden;transition:all .25s var(--ease);
  box-shadow:var(--shadow-sm);
}
.q-item:hover{border-color:var(--ink-20);box-shadow:var(--shadow-md);transform:translateY(-1px)}
.q-item.called{border-color:var(--amber);box-shadow:0 0 0 3px rgba(245,166,35,.1),var(--shadow-md);animation:glow 2s ease-in-out infinite}
.q-item.done,.q-item.skipped{opacity:.35}
.q-main{display:flex;align-items:center;gap:10px;padding:12px 14px}
.q-seq{
  width:36px;height:36px;border-radius:8px;
  background:var(--surface-2);border:1px solid var(--ink-08);
  font:700 13px var(--mono);color:var(--ink-50);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;letter-spacing:.05em;
}
.q-item.called .q-seq{background:var(--amber);border-color:var(--amber);color:white}
.q-body{flex:1;min-width:0}
.q-name{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.q-meta{font-size:11px;color:var(--ink-50);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.q-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}
.q-tag{padding:2px 7px;border-radius:5px;font-size:10px;font-weight:600}
.q-tag.waiting{background:var(--azure-l);color:var(--azure)}
.q-tag.called{background:var(--amber-l);color:var(--amber)}
.q-tag.done{background:var(--jade-l);color:var(--jade)}
.q-tag.results{background:var(--violet-l);color:var(--violet)}
.q-btns{display:flex;gap:4px;flex-shrink:0}
.q-btn{
  width:30px;height:30px;border-radius:7px;border:1px solid var(--ink-08);
  background:var(--surface-2);font-size:13px;cursor:pointer;transition:all .2s;
  display:flex;align-items:center;justify-content:center;
}
.q-btn:hover{background:var(--azure-l);border-color:var(--azure);transform:scale(1.05)}
.q-btn.danger:hover{background:var(--rose-l);border-color:var(--rose)}

/* ── RIGHT PANEL ── */
.right-panel{overflow-y:auto;padding:24px;padding-bottom:80px;background:var(--page)}

/* ── ANALYTICS ── */
.analytics-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.analytics-card{
  background:var(--surface);border:1px solid var(--ink-08);border-radius:var(--r-lg);padding:20px;
  box-shadow:var(--shadow-sm);
}
.analytics-card-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-50);margin-bottom:14px}
.bar-chart{display:flex;flex-direction:column;gap:8px}
.bar-row{display:grid;grid-template-columns:80px 1fr 40px;gap:8px;align-items:center}
.bar-label{font-size:11px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-track{height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden}
.bar-fill{height:100%;border-radius:3px;transition:width 1s var(--ease)}
.bar-count{font:600 11px var(--mono);color:var(--ink-50);text-align:right}
.chart-area{height:100px;display:flex;align-items:flex-end;gap:6px;padding-top:10px}
.chart-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.chart-bar{width:100%;border-radius:4px 4px 0 0;transition:height 1s var(--ease);min-height:4px}
.chart-xlabel{font-size:9px;color:var(--ink-50);font-weight:600}

/* ── ARCHIVE TABLE ── */
.archive-table{width:100%;border-collapse:collapse}
.archive-table th{padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-50);border-bottom:1px solid var(--ink-08)}
.archive-table td{padding:11px 12px;border-bottom:1px solid var(--ink-08);font-size:12px;vertical-align:middle}
.archive-table tr:last-child td{border-bottom:none}
.archive-table tr:hover td{background:var(--surface-2)}
.archive-code{font-family:var(--mono);font-size:11px;font-weight:600;color:var(--ink-50)}
.archive-status{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700}

/* ── RESULTS PANEL (modal) ── */
.modal-bg{position:fixed;inset:0;z-index:500;background:rgba(13,17,23,.5);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .2s}
.modal-box{
  background:var(--surface);border-radius:var(--r-xl) var(--r-xl) 0 0;
  width:100%;max-width:640px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;
  animation:slideUp .35s var(--ease);box-shadow:var(--shadow-xl);
}
.modal-handle{width:40px;height:4px;background:var(--ink-08);border-radius:2px;margin:14px auto 0}
.modal-head{padding:16px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--ink-08)}
.modal-title{font-size:15px;font-weight:700;color:var(--ink)}
.modal-subtitle{font-size:12px;color:var(--ink-50);margin-top:2px}
.modal-close{width:32px;height:32px;border-radius:8px;border:1px solid var(--ink-08);background:var(--surface-2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .2s}
.modal-close:hover{background:var(--rose-l);border-color:var(--rose)}
.modal-body{flex:1;overflow-y:auto;padding:20px 24px}

.analyses-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
.analyse-box{background:var(--surface-2);border:1px solid var(--ink-08);border-radius:var(--r);padding:12px}
.analyse-name{font-size:11px;font-weight:700;color:var(--ink);margin-bottom:6px}
.analyse-row{display:flex;gap:6px;align-items:center}
.analyse-input{
  flex:1;background:transparent;border:none;border-bottom:1.5px solid var(--ink-08);
  font:700 14px var(--mono);color:var(--ink);outline:none;padding:2px 0;transition:border-color .2s;
}
.analyse-input:focus{border-color:var(--azure)}
.analyse-unit{font-size:10px;color:var(--ink-50);flex-shrink:0}
.notes-field{width:100%;padding:10px 12px;border-radius:var(--r);border:1.5px solid var(--ink-08);background:var(--surface-2);font:500 13px var(--sans);color:var(--ink);outline:none;resize:vertical;min-height:72px;transition:all .2s}
.notes-field:focus{border-color:var(--azure);background:var(--surface)}
.save-btn{
  width:100%;padding:13px;border-radius:var(--r);border:none;
  background:linear-gradient(135deg,var(--azure),var(--teal));color:white;
  font:700 14px var(--sans);cursor:pointer;transition:all .25s;margin-top:14px;
  display:flex;align-items:center;justify-content:center;gap:8px;
}
.save-btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,102,255,.3)}
.save-btn.saved{background:var(--jade)}

/* ── PATIENT VIEW ── */
.pt-shell{min-height:100vh;padding-top:38px;background:var(--page)}
.pt-hero{
  background:var(--ink);padding:48px 24px 56px;text-align:center;position:relative;overflow:hidden;
}
.pt-hero::before{
  content:'';position:absolute;inset:0;
  background:
    radial-gradient(circle at 30% 50%, rgba(0,194,181,.15) 0%, transparent 50%),
    radial-gradient(circle at 70% 30%, rgba(0,102,255,.1) 0%, transparent 40%);
  pointer-events:none;
}
.pt-hero-badge{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(0,194,181,.1);border:1px solid rgba(0,194,181,.2);
  border-radius:100px;padding:5px 14px;
  font-size:10px;font-weight:700;color:var(--teal);
  letter-spacing:.1em;text-transform:uppercase;margin-bottom:16px;position:relative;z-index:1;
}
.pt-hero-name{font-family:var(--serif);font-size:2.2rem;color:white;position:relative;z-index:1;line-height:1.1;margin-bottom:4px}
.pt-hero-sub{font-size:12px;color:rgba(255,255,255,.4);position:relative;z-index:1;letter-spacing:.04em}

.pt-body{background:var(--surface);border-radius:var(--r-xl) var(--r-xl) 0 0;margin-top:-20px;padding:28px 20px 60px;min-height:60vh;position:relative;z-index:2}

.pt-entry-card{
  max-width:400px;margin:0 auto;
  background:var(--page);border:1px solid var(--ink-08);border-radius:var(--r-xl);
  padding:28px 24px;box-shadow:var(--shadow-md);
}
.pt-entry-title{font-family:var(--serif);font-size:1.5rem;color:var(--ink);margin-bottom:6px}
.pt-entry-sub{font-size:13px;color:var(--ink-50);margin-bottom:22px;line-height:1.5}
.pt-code-input{
  width:100%;padding:16px;border-radius:var(--r);border:1.5px solid var(--ink-08);
  background:var(--surface);font:700 24px var(--mono);text-align:center;
  letter-spacing:.2em;color:var(--ink);outline:none;transition:all .2s;margin-bottom:12px;
  text-transform:uppercase;
}
.pt-code-input:focus{border-color:var(--azure);box-shadow:0 0 0 4px rgba(0,102,255,.08)}
.pt-submit{
  width:100%;padding:13px;border-radius:var(--r);border:none;
  background:var(--ink);color:white;font:700 14px var(--sans);cursor:pointer;transition:all .2s;
}
.pt-submit:hover{background:var(--azure)}
.pt-err{background:var(--rose-l);border:1px solid rgba(255,68,102,.15);border-radius:8px;padding:9px 14px;font-size:12px;color:var(--rose);text-align:center;margin-bottom:12px}

.pt-status{max-width:400px;margin:0 auto;text-align:center}
.pt-status-ring{
  width:160px;height:160px;border-radius:50%;margin:0 auto 24px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  position:relative;
}
.pt-ring-waiting{background:var(--azure-l);border:3px solid rgba(0,102,255,.2)}
.pt-ring-called{background:var(--amber-l);border:3px solid var(--amber);animation:glow 1.5s ease-in-out infinite}
.pt-ring-done{background:var(--jade-l);border:3px solid rgba(0,196,122,.2)}
.pt-ring-results{background:var(--violet-l);border:3px solid rgba(124,58,237,.2)}
.pt-ring-num{font-family:var(--serif);font-size:3.5rem;font-weight:400;line-height:1}
.pt-ring-sub{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-top:2px;opacity:.6}
.pt-status-title{font-family:var(--serif);font-size:1.6rem;margin-bottom:8px}
.pt-status-desc{font-size:13px;color:var(--ink-50);line-height:1.6;margin-bottom:18px}
.pt-pos-chip{
  display:inline-flex;align-items:center;gap:8px;
  background:var(--surface-2);border:1px solid var(--ink-08);border-radius:100px;
  padding:8px 20px;font-size:13px;color:var(--ink-50);margin-bottom:16px;
}
.pt-pos-num{font-family:var(--serif);font-size:1.8rem;color:var(--ink);line-height:1}
.pt-eta{
  background:var(--azure-l);border:1px solid rgba(0,102,255,.15);border-radius:var(--r);
  padding:14px 20px;margin-bottom:14px;
}
.pt-eta-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--azure);margin-bottom:4px}
.pt-eta-time{font:800 2rem var(--serif);color:var(--ink);line-height:1}
.pt-eta-live{font-size:10px;color:var(--azure);opacity:.7;margin-top:3px}
.pt-alert-box{
  background:var(--amber-l);border:2px solid var(--amber);border-radius:var(--r);
  padding:14px 20px;font-size:14px;font-weight:700;color:var(--amber);margin-bottom:14px;
}
.pt-results{
  background:var(--surface);border:1px solid var(--ink-08);border-radius:var(--r-lg);
  padding:18px;margin-top:16px;text-align:left;box-shadow:var(--shadow-sm);
}
.pt-results-head{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-50);margin-bottom:12px}
.pt-result-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--ink-08)}
.pt-result-row:last-child{border-bottom:none}
.pt-result-name{font-size:13px;font-weight:600;color:var(--ink)}
.pt-result-val{font:700 14px var(--mono);color:var(--azure)}
.pt-live{font-size:11px;color:var(--ink-50);display:flex;align-items:center;justify-content:center;gap:6px;margin-top:16px}
.pt-live-dot{width:6px;height:6px;border-radius:50%;background:var(--jade);animation:pulse 2s infinite}
.pt-back{margin-top:14px;font-size:12px;color:var(--ink-50);background:none;border:none;cursor:pointer;text-decoration:underline;font-family:var(--sans);display:block;text-align:center}

/* BOTTOM CTA */
.bottom-cta{
  position:fixed;bottom:0;left:0;right:0;z-index:50;
  background:rgba(246,248,250,.9);backdrop-filter:blur(12px);
  border-top:1px solid var(--ink-08);padding:12px 20px 20px;
  display:flex;justify-content:center;
}
.call-cta{
  max-width:520px;width:100%;padding:14px 24px;border-radius:var(--r);border:none;
  background:var(--ink);color:white;font:700 14px var(--sans);cursor:pointer;
  transition:all .25s var(--ease);display:flex;align-items:center;justify-content:center;gap:10px;
  box-shadow:var(--shadow-md);
}
.call-cta:hover:not(:disabled){background:var(--azure);box-shadow:0 8px 32px rgba(0,102,255,.3);transform:translateY(-2px)}
.call-cta:disabled{background:var(--ink-08);color:var(--ink-50);box-shadow:none;cursor:not-allowed}
.call-cta-badge{background:rgba(255,255,255,.15);border-radius:5px;padding:2px 8px;font-family:var(--mono);font-size:12px}

@media(max-width:900px){
  .stats-grid{grid-template-columns:repeat(2,1fr)}
  .analytics-grid{grid-template-columns:1fr}
  .main-content{grid-template-columns:1fr}
  .right-panel{display:none}
}
`;

// ══════════════════════════════════════════════════════════
//  LANG BAR
// ══════════════════════════════════════════════════════════
function LangBar({ lang, setLang, waiting }) {
  const items = ["NFS","Glycémie","CRP","Bilan hépatique","TSH","Urée","Créatinine","ECBU","VS","TP"];
  const doubled = [...items,...items];
  return (
    <div className="langbar">
      <div className="langbar-brand">
        <span className="langbar-dot"/>
        Labo Boudissa
      </div>
      <div className="langbar-btns">
        {["fr","en","ar"].map(l=>(
          <button key={l} className={`lb ${lang===l?"on":""}`} onClick={()=>setLang(l)}>
            {l==="fr"?"FR":l==="en"?"EN":"عربي"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  TICKER
// ══════════════════════════════════════════════════════════
function Ticker({ queue }) {
  const called = queue.find(q=>q.status==="called");
  const waiting = queue.filter(q=>q.status==="waiting");
  const done = queue.filter(q=>q.status==="done");
  const analyses = [...new Set(queue.flatMap(q=>(q.analyses||"").split(",").map(a=>a.trim()).filter(Boolean)))];

  const items = [
    called && `🔬 En cours : ${called.name}`,
    `⏳ ${waiting.length} patient(s) en attente`,
    `✓ ${done.length} analyse(s) terminée(s)`,
    ...analyses.slice(0,5).map(a=>`📋 ${a}`),
    "🧬 Labo Boudissa · Boumerdès · 024 79 85 35",
    "⏰ Ouvert Dim–Jeu 07h–17h",
  ].filter(Boolean);

  return (
    <div className="ticker">
      <div className="ticker-inner">
        {[...items,...items].map((item,i)=>(
          <span key={i} className="ticker-item">
            {i>0 && <span className="ticker-sep">·</span>}
            <strong>{item}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════════
function Login({ onLogin, lang, setLang }) {
  const [role, setRole] = useState("accueil");
  const [pwd,  setPwd]  = useState("");
  const [err,  setErr]  = useState("");

  const T = {
    fr:{ title:["Accès", "Sécurisé"], sub:"Connectez-vous pour accéder au système de gestion", pwd:"Mot de passe", btn:"Se connecter", wrong:"Identifiants incorrects" },
    en:{ title:["Secure", "Access"], sub:"Sign in to access the laboratory management system", pwd:"Password", btn:"Sign in", wrong:"Incorrect credentials" },
    ar:{ title:["دخول", "آمن"], sub:"سجّل دخولك للوصول إلى نظام إدارة المختبر", pwd:"كلمة المرور", btn:"دخول", wrong:"بيانات غير صحيحة" }
  }[lang]||{};

  const handle = () => {
    const acc = ACCOUNTS[role];
    if(acc?.pwd===pwd){ saveSession({id:role,...acc}); onLogin({id:role,...acc}); }
    else{ setErr(T.wrong); setPwd(""); }
  };

  return (
    <>
      <style>{S}</style>
      <LangBar lang={lang} setLang={setLang} />
      <div className="login-bg" dir={lang==="ar"?"rtl":"ltr"}>
        <div className="login-card">
          <div className="login-badge">
            <span>🧬</span> Laboratoire Boudissa
          </div>
          <h1 className="login-title">
            {T.title?.[0]} <em>{T.title?.[1]}</em>
          </h1>
          <p className="login-sub">{T.sub}</p>

          <div className="role-grid">
            {Object.entries(ACCOUNTS).map(([id,acc])=>(
              <div key={id} className={`role-card ${role===id?"on":""}`} onClick={()=>{setRole(id);setErr("");setPwd("");}}>
                <div className="role-icon">{acc.icon}</div>
                <div className="role-name">{lang==="ar"&&id==="boudissa"?"د. بوديسة":lang==="ar"&&id==="tech1"?"تقني":lang==="ar"?"استقبال":acc.nom}</div>
              </div>
            ))}
          </div>

          <div className="input-wrap">
            <label>{T.pwd}</label>
            <input type="password" placeholder="••••••••" value={pwd}
              onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} autoFocus />
          </div>
          {err && <div className="login-err">{err}</div>}
          <button className="login-cta" onClick={handle}>
            {T.btn} <span>→</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  RESULTS MODAL
// ══════════════════════════════════════════════════════════
function ResultsModal({ ticket, onClose, onSave, user, lang }) {
  const analysesList = (ticket.analyses||"").split(",").map(a=>a.trim()).filter(Boolean);
  const [vals,  setVals]  = useState({});
  const [notes, setNotes] = useState(ticket.notes||"");
  const [saved, setSaved] = useState(false);

  const T = {
    fr:{ title:"Saisir les résultats", save:"💾 Enregistrer", saved:"✓ Sauvegardé !", notes:"Notes / Observations", value:"Valeur", print:"🖨️ Imprimer résultats" },
    en:{ title:"Enter results", save:"💾 Save results", saved:"✓ Saved!", notes:"Notes / Observations", value:"Value", print:"🖨️ Print results" },
    ar:{ title:"إدخال النتائج", save:"💾 حفظ", saved:"✓ تم الحفظ!", notes:"ملاحظات", value:"القيمة", print:"🖨️ طباعة النتائج" }
  }[lang]||{};

  const handleSave = async () => {
    const results = analysesList.map(a=>({ name:a, value:vals[a]||"", ref:"" }));
    await onSave(ticket.id, results, notes, user.nom);
    setSaved(true);
    setTimeout(()=>{ setSaved(false); onClose(); }, 1500);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-head">
          <div>
            <div className="modal-title">🔬 {T.title}</div>
            <div className="modal-subtitle">{ticket.name} · <span style={{fontFamily:"var(--mono)",fontSize:11}}>{ticket.code}</span></div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" dir={lang==="ar"?"rtl":"ltr"}>
          {/* Barcode */}
          <div style={{background:"var(--page)",border:"1px solid var(--ink-08)",borderRadius:"var(--r)",padding:14,textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"var(--ink-50)",marginBottom:8}}>Code-barres dossier</div>
            <div dangerouslySetInnerHTML={{__html:barcodeSVG(ticket.code)}} style={{display:"flex",justifyContent:"center"}}/>
          </div>

          {analysesList.length > 0 ? (
            <>
              <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"var(--ink-50)",marginBottom:10}}>
                Résultats par analyse
              </div>
              <div className="analyses-grid">
                {analysesList.map(a=>(
                  <div key={a} className="analyse-box">
                    <div className="analyse-name">{a}</div>
                    <div className="analyse-row">
                      <input className="analyse-input" placeholder={T.value}
                        value={vals[a]||""} onChange={e=>setVals({...vals,[a]:e.target.value})}/>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"var(--ink-50)",marginBottom:6,marginTop:4}}>{T.notes}</div>
          <textarea className="notes-field" placeholder="Observations cliniques, commentaires..."
            value={notes} onChange={e=>setNotes(e.target.value)}/>

          <button className={`save-btn ${saved?"saved":""}`} onClick={handleSave}>
            {saved ? T.saved : T.save}
          </button>
          <button style={{width:"100%",padding:"10px",borderRadius:"var(--r)",border:"1.5px solid var(--ink-08)",background:"transparent",font:"600 13px var(--sans)",cursor:"pointer",marginTop:8,transition:"all .2s"}}
            onClick={()=>printResults(ticket)}>
            {T.print}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  ANALYTICS PANEL
// ══════════════════════════════════════════════════════════
function Analytics({ queue, lang }) {
  const done    = queue.filter(q=>q.status==="done");
  const waiting = queue.filter(q=>q.status==="waiting");
  const called  = queue.find(q=>q.status==="called");

  // Count analyses
  const analyseCounts = {};
  queue.forEach(t=>{
    (t.analyses||"").split(",").map(a=>a.trim()).filter(Boolean).forEach(a=>{
      analyseCounts[a] = (analyseCounts[a]||0)+1;
    });
  });
  const topAnalyses = Object.entries(analyseCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxCount = topAnalyses[0]?.[1]||1;

  const hours = Array.from({length:8},(_,i)=>({ h:`${7+i}h`, count:queue.filter(t=>{ if(!t.createdAt) return false; const h=new Date(t.createdAt).getHours(); return h===7+i; }).length }));
  const maxH = Math.max(...hours.map(h=>h.count), 1);

  const barColors = ["var(--azure)","var(--teal)","var(--jade)","var(--amber)","var(--violet)"];

  const T = {
    fr:{ topAnalyses:"Analyses les plus demandées", hourly:"Activité par heure", total:"Total aujourd'hui", done:"Terminés", waiting:"En attente", avgTime:"Durée moy.", noData:"Aucune donnée" },
    en:{ topAnalyses:"Most requested analyses", hourly:"Activity by hour", total:"Total today", done:"Done", waiting:"Waiting", avgTime:"Avg time", noData:"No data" },
    ar:{ topAnalyses:"أكثر التحاليل طلباً", hourly:"النشاط بالساعة", total:"المجموع اليوم", done:"منتهي", waiting:"انتظار", avgTime:"متوسط الوقت", noData:"لا توجد بيانات" }
  }[lang]||{};

  return (
    <div className="right-panel">
      {/* Summary stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
        {[
          { label:T.total, value:queue.length, color:"var(--azure)" },
          { label:T.done,  value:done.length,  color:"var(--jade)"  },
          { label:T.waiting,value:waiting.length,color:"var(--amber)"},
        ].map(s=>(
          <div key={s.label} style={{background:"var(--surface)",border:"1px solid var(--ink-08)",borderRadius:"var(--r-lg)",padding:"16px 18px",boxShadow:"var(--shadow-sm)"}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"var(--ink-50)",marginBottom:6}}>{s.label}</div>
            <div style={{fontFamily:"var(--serif)",fontSize:"2rem",color:s.color,lineHeight:1}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="analytics-grid">
        {/* Top analyses */}
        <div className="analytics-card">
          <div className="analytics-card-title">📊 {T.topAnalyses}</div>
          {topAnalyses.length > 0 ? (
            <div className="bar-chart">
              {topAnalyses.map(([name,count],i)=>(
                <div key={name} className="bar-row">
                  <div className="bar-label">{name}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{width:`${(count/maxCount)*100}%`,background:barColors[i%5]}}/>
                  </div>
                  <div className="bar-count">{count}</div>
                </div>
              ))}
            </div>
          ) : <div style={{fontSize:12,color:"var(--ink-50)",textAlign:"center",padding:20}}>{T.noData}</div>}
        </div>

        {/* Hourly */}
        <div className="analytics-card">
          <div className="analytics-card-title">⏰ {T.hourly}</div>
          <div className="chart-area">
            {hours.map((h,i)=>(
              <div key={h.h} className="chart-col">
                <div className="chart-bar" style={{
                  height:`${(h.count/maxH)*80}px`,
                  background:h.count>0?"var(--azure)":"var(--ink-08)",
                  opacity: h.count>0?1:.5
                }}/>
                <div className="chart-xlabel">{h.h}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Archive */}
      <div style={{background:"var(--surface)",border:"1px solid var(--ink-08)",borderRadius:"var(--r-lg)",overflow:"hidden",boxShadow:"var(--shadow-sm)"}}>
        <div style={{padding:"14px 20px",borderBottom:"1px solid var(--ink-08)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"var(--ink-50)"}}>
            📋 {lang==="ar"?"سجل اليوم":lang==="en"?"Today's archive":"Archive du jour"}
          </div>
          <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--ink-50)"}}>{queue.length} dossiers</div>
        </div>
        <div style={{overflowX:"auto"}}>
          <table className="archive-table">
            <thead>
              <tr>
                <th>{lang==="ar"?"الرمز":"Code"}</th>
                <th>{lang==="ar"?"المريض":"Patient"}</th>
                <th>{lang==="ar"?"التحاليل":"Analyses"}</th>
                <th>{lang==="ar"?"الساعة":"Heure"}</th>
                <th>{lang==="ar"?"الحالة":"Statut"}</th>
              </tr>
            </thead>
            <tbody>
              {queue.length===0 ? (
                <tr><td colSpan={5} style={{textAlign:"center",padding:"24px",color:"var(--ink-50)",fontSize:12}}>
                  {T.noData}
                </td></tr>
              ) : queue.map(t=>(
                <tr key={t.id}>
                  <td><span className="archive-code">{t.code?.slice(-6)}</span></td>
                  <td style={{fontWeight:600,fontSize:13}}>{t.name}</td>
                  <td style={{maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11,color:"var(--ink-50)"}}>{t.analyses||"—"}</td>
                  <td style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--ink-50)"}}>{t.time}</td>
                  <td>
                    <span className="archive-status" style={{
                      background:t.status==="done"?"var(--jade-l)":t.status==="called"?"var(--amber-l)":"var(--azure-l)",
                      color:t.status==="done"?"var(--jade)":t.status==="called"?"var(--amber)":"var(--azure)"
                    }}>
                      {t.hasResults?"📋 ":""}{t.status==="done"?"✓":t.status==="called"?"🔬":"⏳"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════
function Dashboard({ user, onLogout, lang, setLang }) {
  const queue   = useQueue();
  const online  = useNetwork();
  const [tab,       setTab]       = useState("queue");
  const [showAdd,   setShowAdd]   = useState(false);
  const [lastTicket,setLastTicket]= useState(null);
  const [copied,    setCopied]    = useState(false);
  const [resultsFor,setResultsFor]= useState(null);
  const [form, setForm] = useState({ name:"",age:"",phone:"",analyses:"" });

  const waiting = queue.filter(q=>q.status==="waiting");
  const called  = queue.find(q=>q.status==="called");
  const done    = queue.filter(q=>q.status==="done");

  const handleAdd = async () => {
    if(!form.name.trim()) return;
    const t = await apiAdd(form);
    setLastTicket(t);
    setForm({name:"",age:"",phone:"",analyses:""});
  };

  const patientLink = code => `${window.location.origin}${window.location.pathname}?code=${code}&lang=${lang}`;

  const shareWA = t => {
    const msgs = {
      fr:`Bonjour ${t.name} 👋\n\nVotre dossier au *Laboratoire Boudissa*:\n🧬 Code: *${t.code.slice(-6)}*\n\n📱 Suivez vos résultats:\n${patientLink(t.code)}\n\nTél : 024 79 85 35`,
      en:`Hello ${t.name} 👋\n\nYour file at *Labo Boudissa*:\n🧬 Code: *${t.code.slice(-6)}*\n\n📱 Track your results:\n${patientLink(t.code)}`,
      ar:`السلام عليكم ${t.name} 👋\n\nملفك في *مخبر بوديسة*:\n🧬 الرمز: *${t.code.slice(-6)}*\n\n📱 تابع نتائجك:\n${patientLink(t.code)}`
    };
    window.open(`https://wa.me/?text=${encodeURIComponent(msgs[lang]||msgs.fr)}`,"_blank");
  };

  const T = {
    fr:{ newPatient:"Nouveau patient", name:"Nom complet", age:"Âge", phone:"Téléphone", analyses:"Analyses prescrites (ex: NFS, Glycémie, CRP)", submit:"Enregistrer patient", queue:"File d'attente", analytics:"Analytiques", waiting:"En attente", inProgress:"En cours", done:"Terminés", callNext:"Appeler le patient suivant", noPatients:"Aucun patient", addToStart:"Ajoutez un patient pour commencer" },
    en:{ newPatient:"New patient", name:"Full name", age:"Age", phone:"Phone", analyses:"Prescribed analyses (e.g. CBC, Glucose, CRP)", submit:"Register patient", queue:"Queue", analytics:"Analytics", waiting:"Waiting", inProgress:"In progress", done:"Done", callNext:"Call next patient", noPatients:"No patients", addToStart:"Add a patient to get started" },
    ar:{ newPatient:"مريض جديد", name:"الاسم الكامل", age:"العمر", phone:"الهاتف", analyses:"التحاليل المطلوبة (مثال: NFS, CRP)", submit:"تسجيل المريض", queue:"قائمة الانتظار", analytics:"الإحصائيات", waiting:"انتظار", inProgress:"قيد الفحص", done:"منتهي", callNext:"استدعاء المريض التالي", noPatients:"لا يوجد مرضى", addToStart:"أضف مريضاً للبدء" }
  }[lang]||{};

  const queueDisplay = [...queue.filter(q=>q.status==="called"),...queue.filter(q=>q.status==="waiting"),...queue.filter(q=>q.status==="done"||q.status==="skipped")];

  return (
    <>
      <style>{S}</style>
      <LangBar lang={lang} setLang={setLang} />
      {resultsFor && <ResultsModal ticket={resultsFor} lang={lang} user={user} onClose={()=>setResultsFor(null)} onSave={apiSaveResults}/>}

      <div className="app" dir={lang==="ar"?"rtl":"ltr"}>
        {/* TOPHEAD */}
        <div className="tophead">
          <div className="tophead-left">
            <div className="tophead-logo">
              <div className="tophead-logo-mark">🧬</div>
              <div>
                <div style={{fontSize:14,fontWeight:700,letterSpacing:"-.01em"}}>Labo Boudissa</div>
                <div style={{fontSize:9,color:"var(--ink-50)",letterSpacing:".06em",textTransform:"uppercase"}}>Boumerdès · 024 79 85 35</div>
              </div>
            </div>
            <div className="tophead-sep"/>
            <div className="tophead-nav">
              <button className={`nav-tab ${tab==="queue"?"on":""}`} onClick={()=>setTab("queue")}>
                📋 {T.queue}
              </button>
              {(user.role==="admin"||user.role==="tech") && (
                <button className={`nav-tab ${tab==="analytics"?"on":""}`} onClick={()=>setTab("analytics")}>
                  📊 {T.analytics}
                </button>
              )}
            </div>
          </div>
          <div className="tophead-right">
            <div className={`status-badge ${online?"online":"offline"}`}>
              <div className="status-dot"/>
              {online?"Live":"Offline"}
            </div>
            <div className="user-badge">
              <div className="user-avatar">{user.icon}</div>
              <div className="user-name">{lang==="ar"&&user.id==="boudissa"?"د. بوديسة":user.nom}</div>
            </div>
            <button className="logout-btn" onClick={()=>{clearSession();onLogout();}}>⏻</button>
          </div>
        </div>

        {/* TICKER */}
        <Ticker queue={queue} />

        {/* STATS */}
        <div className="stats-grid">
          {[
            { label:T.waiting, value:waiting.length, color:"var(--azure)", sub:`${queue.length} total` },
            { label:T.inProgress, value:called?1:0, color:"var(--amber)", sub:called?.name||"—" },
            { label:T.done, value:done.length, color:"var(--jade)", sub:`${Math.round(done.length/Math.max(queue.length,1)*100)}%` },
            { label:"Résultats prêts", value:queue.filter(q=>q.hasResults).length, color:"var(--violet)", sub:"disponibles" },
          ].map(s=>(
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{color:s.color}}>{s.value}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* CALLED BAR */}
        {called && (
          <div className="called-bar">
            <div className="called-info">
              <div className="called-num">{called.code?.slice(-4)}</div>
              <div>
                <div className="called-name">{called.name}</div>
                {called.analyses && <div className="called-analyses">{called.analyses}</div>}
              </div>
            </div>
            <div className="called-actions">
              <button className="delay-chip" onClick={()=>apiUpdate(called.id,{extraDelay:(called.extraDelay||0)+5})}>+5 min</button>
              <button className="delay-chip" onClick={()=>apiUpdate(called.id,{extraDelay:(called.extraDelay||0)+10})}>+10 min</button>
              {(user.role==="tech"||user.role==="admin") && (
                <button className="results-chip" onClick={()=>setResultsFor(called)}>🔬 Résultats</button>
              )}
              <button className="done-chip" onClick={()=>apiUpdate(called.id,{status:"done"})}>✓ Terminé</button>
            </div>
          </div>
        )}

        {tab==="queue" ? (
          <div className="main-content">
            {/* LEFT — queue */}
            <div className="left-panel">
              <div className="panel-head">
                <div className="panel-title">{T.newPatient}</div>
                <button className={`add-toggle ${showAdd?"open":""}`} onClick={()=>setShowAdd(!showAdd)}>
                  <span>{showAdd?"▲":"+"}</span>
                  {showAdd ? (lang==="ar"?"إغلاق":"Fermer") : (lang==="ar"?"تسجيل مريض جديد":T.newPatient)}
                </button>
              </div>

              {showAdd && (
                <div className="add-form">
                  <div className="form-grid">
                    <div className="field">
                      <label>{T.name}</label>
                      <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Mohamed Amrani"/>
                    </div>
                    <div className="field">
                      <label>{T.age}</label>
                      <input type="number" value={form.age} onChange={e=>setForm({...form,age:e.target.value})} placeholder="45"/>
                    </div>
                  </div>
                  <div className="field" style={{marginBottom:10}}>
                    <label>{T.phone}</label>
                    <input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="0555 XX XX XX"/>
                  </div>
                  <div className="field">
                    <label>{T.analyses}</label>
                    <textarea value={form.analyses} onChange={e=>setForm({...form,analyses:e.target.value})} placeholder="NFS, Glycémie, CRP..."/>
                  </div>
                  <button className="submit-btn" onClick={handleAdd}>
                    <span>🧬</span> {T.submit}
                  </button>

                  {lastTicket && (
                    <div className="ticket-popup">
                      <div className="ticket-popup-code">{lang==="ar"?"رمز الدوسيه":"Code dossier"}</div>
                      <div className="ticket-popup-num">{lastTicket.code?.slice(-4)}</div>
                      <div className="ticket-popup-name">{lastTicket.name}</div>
                      <div className="ticket-barcode">
                        <div className="ticket-barcode-label">Code-barres</div>
                        <div dangerouslySetInnerHTML={{__html:barcodeSVG(lastTicket.code)}}/>
                      </div>
                      <div className="ticket-actions">
                        <button className="btn-wa" onClick={()=>shareWA(lastTicket)}>📱 WhatsApp</button>
                        <button className="btn-print" onClick={()=>{ const w=window.open("","_blank"); w.document.write(`<html><body style="text-align:center;padding:20px;font-family:monospace">${barcodeSVG(lastTicket.code,2,60)}<br><b>${lastTicket.name}</b><br>${lastTicket.analyses||""}</body></html>`); w.document.close(); w.print(); }}>🖨️</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Queue items */}
              <div className="queue-list">
                {queueDisplay.length===0 ? (
                  <div className="queue-empty">
                    <span className="queue-empty-icon">🧬</span>
                    <div className="queue-empty-text">{T.noPatients}</div>
                    <div style={{fontSize:12,color:"var(--ink-50)",marginTop:6}}>{T.addToStart}</div>
                  </div>
                ) : queueDisplay.map(t=>(
                  <div key={t.id} className={`q-item ${t.status}`}>
                    <div className="q-main">
                      <div className="q-seq">{t.code?.slice(-4)}</div>
                      <div className="q-body">
                        <div className="q-name">{t.name}</div>
                        <div className="q-meta">{t.analyses||"—"} · {t.time}</div>
                        <div className="q-tags">
                          <span className={`q-tag ${t.status}`}>
                            {t.status==="waiting"?"⏳":t.status==="called"?"🔬":t.status==="done"?"✓":"—"}
                            {" "}{t.status}
                          </span>
                          {t.hasResults && <span className="q-tag results">📋 Résultats</span>}
                        </div>
                      </div>
                      <div className="q-btns">
                        {(user.role==="tech"||user.role==="admin") && (
                          <button className="q-btn" title="Résultats" onClick={()=>setResultsFor(t)}>🔬</button>
                        )}
                        {t.hasResults && (
                          <button className="q-btn" title="Imprimer" onClick={()=>printResults(t)}>🖨️</button>
                        )}
                        {t.status==="called" && <button className="q-btn" onClick={()=>apiUpdate(t.id,{status:"done"})}>✓</button>}
                        {t.status==="waiting" && <button className="q-btn danger" onClick={()=>apiUpdate(t.id,{status:"skipped"})}>✕</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — analytics */}
            <Analytics queue={queue} lang={lang} />
          </div>
        ) : (
          <div style={{flex:1,overflow:"auto"}}>
            <Analytics queue={queue} lang={lang} />
          </div>
        )}

        {/* CALL NEXT */}
        <div className="bottom-cta">
          <button className="call-cta" onClick={()=>apiCallNext(queue)} disabled={waiting.length===0}>
            📣 {T.callNext}
            {waiting.length>0 && <span className="call-cta-badge">{waiting.length}</span>}
          </button>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  PATIENT VIEW
// ══════════════════════════════════════════════════════════
function PatientView({ initialCode, lang, setLang }) {
  const queue = useQueue();
  const [input, setInput] = useState(initialCode||"");
  const [code,  setCode]  = useState(initialCode||"");
  const [info,  setInfo]  = useState(null);
  const [err,   setErr]   = useState("");
  const [,setTick] = useState(0);
  useEffect(()=>{ const id=setInterval(()=>setTick(t=>t+1),60000); return ()=>clearInterval(id); },[]);

  useEffect(()=>{
    if(!code) return;
    const t = queue.find(q=>q.code===code||q.code?.endsWith(code.toUpperCase()));
    if(t){ const p=queue.filter(x=>x.status==="waiting").findIndex(x=>x.id===t.id); setInfo({...t,position:p+1}); setErr(""); }
    else if(queue.length>0) setErr(lang==="ar"?"الرمز غير موجود":lang==="en"?"Code not found":"Code introuvable");
  },[queue,code,lang]);

  const confirm = async () => {
    const c = input.trim().toUpperCase();
    const t = queue.find(q=>q.code===c||q.code?.endsWith(c));
    if(t){ setCode(t.code); return; }
    const found = await getPatientByCode(c);
    if(found){ setCode(found.code); return; }
    setErr(lang==="ar"?"الرمز غير موجود":lang==="en"?"Code not found":"Code introuvable");
  };

  const T = {
    fr:{ title:"Votre dossier", sub:"Entrez le code reçu via WhatsApp pour suivre vos analyses et résultats.", see:"Suivre mon dossier →", waiting:"En attente", called:"C'est votre tour !", goNow:"🔬 Présentez-vous au laboratoire", done:"Analyse terminée", resultsReady:"✅ Vos résultats sont disponibles", noResults:"Vos résultats seront disponibles prochainement.", live:"Mise à jour en temps réel", back:"← Retour" },
    en:{ title:"Your file", sub:"Enter the code received via WhatsApp to track your analyses and results.", see:"Track my file →", waiting:"Waiting", called:"It's your turn!", goNow:"🔬 Please come to the laboratory", done:"Analysis complete", resultsReady:"✅ Your results are available", noResults:"Your results will be available soon.", live:"Real-time updates", back:"← Back" },
    ar:{ title:"ملفك الطبي", sub:"أدخل الرمز الذي استلمته عبر واتساب لمتابعة تحاليلك ونتائجك.", see:"متابعة ملفي ←", waiting:"انتظار", called:"حان دورك!", goNow:"🔬 تفضل إلى المختبر", done:"انتهى الفحص", resultsReady:"✅ نتائجك متاحة", noResults:"نتائجك ستكون متاحة قريباً.", live:"تحديث فوري", back:"← رجوع" }
  }[lang]||{};

  const isTermine = info&&(info.status==="done"||info.status==="skipped");
  const ringClass = info?(isTermine?(info.hasResults?"pt-ring-results":"pt-ring-done"):`pt-ring-${info.status}`):"pt-ring-waiting";

  return (
    <>
      <style>{S}</style>
      <LangBar lang={lang} setLang={setLang} />
      <div className="pt-shell" dir={lang==="ar"?"rtl":"ltr"}>
        <div className="pt-hero">
          <div className="pt-hero-badge"><span>🧬</span> Boumerdès</div>
          <div className="pt-hero-name">{lang==="ar"?"مخبر بوديسة":"Laboratoire Boudissa"}</div>
          <div className="pt-hero-sub">Analyses Médicales · 024 79 85 35</div>
        </div>

        <div className="pt-body">
          {!info ? (
            <div className="pt-entry-card">
              <div className="pt-entry-title">{T.title}</div>
              <div className="pt-entry-sub">{T.sub}</div>
              <input className="pt-code-input" placeholder={lang==="ar"?"الرمز":"Code"} value={input}
                onChange={e=>setInput(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&confirm()} />
              {err && <div className="pt-err">{err}</div>}
              <button className="pt-submit" onClick={confirm}>{T.see}</button>
            </div>
          ) : (
            <div className="pt-status">
              <div className={`pt-status-ring ${ringClass}`}>
                {isTermine&&info.hasResults ? <><div className="pt-ring-num">📋</div><div className="pt-ring-sub">{lang==="ar"?"النتائج":"Results"}</div></>
                : isTermine ? <><div className="pt-ring-num" style={{fontSize:"2.5rem"}}>✓</div><div className="pt-ring-sub">{T.done}</div></>
                : <><div className="pt-ring-num">{info.code?.slice(-4)}</div><div className="pt-ring-sub">{info.status==="waiting"?T.waiting:lang==="ar"?"مستدعى!":"Called!"}</div></>}
              </div>

              {info.status==="waiting" && (
                <>
                  <div className="pt-status-title">{T.waiting}</div>
                  {info.position>0 && (
                    <div className="pt-pos-chip">
                      <span style={{fontSize:13,color:"var(--ink-50)"}}>{lang==="ar"?"أنت":"Vous êtes"}</span>
                      <span className="pt-pos-num">{info.position}</span>
                      <span style={{fontSize:13,color:"var(--ink-50)"}}>{lang==="ar"?"في الطابور":lang==="en"?"in queue":"dans la file"}</span>
                    </div>
                  )}
                  <div className="pt-status-desc">{lang==="ar"?"ابقَ قريباً. سيتم استدعاؤك قريباً.":"Restez à proximité. Vous serez appelé(e) bientôt."}</div>
                </>
              )}

              {info.status==="called" && (
                <>
                  <div className="pt-status-title" style={{color:"var(--amber)"}}>{T.called}</div>
                  <div className="pt-alert-box">{T.goNow}</div>
                </>
              )}

              {isTermine && (
                <>
                  <div className="pt-status-title">{T.done}</div>
                  <div className="pt-status-desc">{info.hasResults?T.resultsReady:T.noResults}</div>
                  {info.hasResults && info.results && (
                    <div className="pt-results">
                      <div className="pt-results-head">🔬 {lang==="ar"?"نتائج التحاليل":lang==="en"?"Results":"Résultats d'analyses"}</div>
                      {info.results.map((r,i)=>(
                        <div key={i} className="pt-result-row">
                          <span className="pt-result-name">{r.name}</span>
                          <span className="pt-result-val">{r.value}</span>
                        </div>
                      ))}
                      {info.notes && (
                        <div style={{marginTop:10,padding:"8px 12px",background:"var(--page)",borderRadius:8,fontSize:12,color:"var(--ink-50)"}}>
                          📝 {info.notes}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="pt-live"><div className="pt-live-dot"/>{T.live}</div>
              <button className="pt-back" onClick={()=>{setInfo(null);setCode("");setInput("");}}>
                {T.back}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  APP ROOT
// ══════════════════════════════════════════════════════════
export default function App() {
  const params   = new URLSearchParams(window.location.search);
  const codeParam= params.get("code");
  const langParam= params.get("lang")||"fr";
  const [lang, setLang] = useState(langParam);
  const [user, setUser] = useState(()=>loadSession());

  useEffect(()=>{ document.title="Laboratoire Boudissa · Boumerdès"; },[]);

  if(codeParam) return <PatientView initialCode={codeParam} lang={lang} setLang={setLang}/>;
  if(!user)     return <Login onLogin={setUser} lang={lang} setLang={setLang}/>;
  return <Dashboard user={user} onLogout={()=>setUser(null)} lang={lang} setLang={setLang}/>;
}
