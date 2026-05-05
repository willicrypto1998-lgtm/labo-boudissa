/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, set, onValue, update, get } from "firebase/database";

// ══════════════════════════════════════════════════════════
//  🔥 FIREBASE CONFIG — Remplacez avec vos clés Firebase
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

// ══════════════════════════════════════════════════════════
//  🔑 COMPTES ADMIN
// ══════════════════════════════════════════════════════════
const ADMIN_ACCOUNTS = {
  boudissa: { pwd: "Boudissa2026", role: "admin",  label: "Dr. Boudissa",   labelAr: "د. بوديسة"  },
  tech1:    { pwd: "Tech2026",     role: "tech",   label: "Technicien 1",   labelAr: "تقني 1"      },
  accueil:  { pwd: "Accueil2026",  role: "accueil",label: "Accueil",        labelAr: "الاستقبال"   },
};

// ══════════════════════════════════════════════════════════
//  💾 SESSION
// ══════════════════════════════════════════════════════════
const SESSION_KEY = "boudissa_session";
function saveSession(user) { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

// ══════════════════════════════════════════════════════════
//  🔥 FIREBASE
// ══════════════════════════════════════════════════════════
let db = null;
let fbOK = false;
try {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  fbOK = !firebaseConfig.apiKey.includes("VOTRE");
} catch(e) { fbOK = false; }

const todayKey = () => new Date().toISOString().slice(0,10).replace(/-/g,"");

// Local fallback
const LOCAL = {
  queue: [], patients: {}, counter: 0, listeners: [],
  notify() { this.listeners.forEach(fn => fn([...this.queue])); },
  subscribe(fn) {
    this.listeners.push(fn);
    fn([...this.queue]);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }
};

// Seed demo data
setTimeout(() => {
  if (LOCAL.queue.length === 0) {
    addPatient({ name: "Amrani Mohamed", age: "45", phone: "0555123456", analyses: "NFS, Glycémie, CRP" });
    addPatient({ name: "Hamidi Karima", age: "32", phone: "0661987654", analyses: "Bilan hépatique, TSH" });
  }
}, 300);

async function addPatient(data) {
  LOCAL.counter++;
  const code = todayKey() + String(LOCAL.counter).padStart(4, "0");
  const ticket = {
    id: Date.now().toString(), code, ...data,
    status: "waiting", time: new Date().toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" }),
    createdAt: Date.now(), results: null, resultDate: null
  };
  if (!fbOK) { LOCAL.queue.push(ticket); LOCAL.notify(); return ticket; }
  const tRef = push(ref(db, `days/${todayKey()}/queue`));
  ticket.id = tRef.key;
  await set(tRef, ticket);
  return ticket;
}

async function updateTicket(id, data) {
  if (!fbOK) {
    const t = LOCAL.queue.find(t => t.id === id);
    if (t) { Object.assign(t, data); LOCAL.notify(); }
    return;
  }
  await update(ref(db, `days/${todayKey()}/queue/${id}`), data);
}

async function callNext(queue) {
  const cur = queue.find(t => t.status === "called");
  if (cur) await updateTicket(cur.id, { status: "done" });
  const next = queue.find(t => t.status === "waiting");
  if (next) await updateTicket(next.id, { status: "called", calledAt: Date.now() });
}

function subscribeQueue(cb) {
  if (!fbOK) return LOCAL.subscribe(cb);
  const qRef = ref(db, `days/${todayKey()}/queue`);
  onValue(qRef, snap => {
    const data = snap.val();
    const q = data ? Object.entries(data).map(([id,v]) => ({...v,id})).sort((a,b) => a.createdAt - b.createdAt) : [];
    cb(q);
  });
  return () => {};
}

async function getPatientByCode(code) {
  if (!fbOK) return LOCAL.queue.find(t => t.code === code) || null;
  const days = [todayKey()];
  for (const day of days) {
    const snap = await get(ref(db, `days/${day}/queue`));
    if (snap.val()) {
      const found = Object.values(snap.val()).find(t => t.code === code);
      if (found) return found;
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════
//  📊 BARCODE GENERATOR (pure JS, no library needed)
// ══════════════════════════════════════════════════════════
function generateBarcodeSVG(code) {
  // Code 128 B subset — simplified but functional
  const encode128 = (str) => {
    const TABLE = {
      ' ':0,  '!':1,  '"':2,  '#':3,  '$':4,  '%':5,  '&':6,  "'":7,
      '(':8,  ')':9,  '*':10, '+':11, ',':12, '-':13, '.':14, '/':15,
      '0':16, '1':17, '2':18, '3':19, '4':20, '5':21, '6':22, '7':23,
      '8':24, '9':25, ':':26, ';':27, '<':28, '=':29, '>':30, '?':31,
      '@':32, 'A':33, 'B':34, 'C':35, 'D':36, 'E':37, 'F':38, 'G':39,
      'H':40, 'I':41, 'J':42, 'K':43, 'L':44, 'M':45, 'N':46, 'O':47,
      'P':48, 'Q':49, 'R':50, 'S':51, 'T':52, 'U':53, 'V':54, 'W':55,
      'X':56, 'Y':57, 'Z':58, '[':59, '\\':60,']':61, '^':62, '_':63,
      '`':64, 'a':65, 'b':66, 'c':67, 'd':68, 'e':69, 'f':70, 'g':71,
      'h':72, 'i':73, 'j':74, 'k':75, 'l':76, 'm':77, 'n':78, 'o':79,
      'p':80, 'q':81, 'r':82, 's':83, 't':84, 'u':85, 'v':86, 'w':87,
      'x':88, 'y':89, 'z':90
    };
    const PATTERNS = [
      "11011001100","11001101100","11001100110","10010011000","10010001100",
      "10001001100","10011001000","10011000100","10001100100","11001001000",
      "11001000100","11000100100","10110011100","10011011100","10011001110",
      "10111001100","10011101100","10011100110","11001110010","11001011100",
      "11001001110","11011100100","11001110100","11101101110","11101001100",
      "11100101100","11100100110","11101100100","11100110100","11100110010",
      "11011011000","11011000110","11000110110","10100011000","10001011000",
      "10001000110","10110001000","10001101000","10001100010","11010001000",
      "11000101000","11000100010","10110111000","10110001110","10001101110",
      "10111011000","10111000110","10001110110","11101110110","11010001110",
      "11000101110","11011101000","11011100010","11011101110","11101011000",
      "11101000110","11100010110","11101101000","11101100010","11100011010",
      "11101111010","11001000010","11110001010","10100110000","10100001100",
      "10010110000","10010000110","10000101100","10000100110","10110010000",
      "10110000100","10011010000","10011000010","10000110100","10000110010",
      "11000010010","11001010000","11110111010","11000010100","10001111010",
      "10100111100","10010111100","10010011110","10111100100","10011110100",
      "10011110010","11110100100","11110010100","11110010010","11011011110",
      "11011110110","11110110110","10101111000","10100011110","10001011110",
      "10111101000","10111100010","11110101000","11110100010","10111011110",
      "10111101110","11101011110","11110101110","11010000100","11010010000",
      "11010011100","11000111010",
    ];
    // Start B = 104
    let codes = [104];
    let check = 104;
    for (let i = 0; i < str.length; i++) {
      const v = TABLE[str[i]] !== undefined ? TABLE[str[i]] : 0;
      codes.push(v);
      check += v * (i + 1);
    }
    codes.push(check % 103); // checksum
    codes.push(106); // stop
    return codes.map(c => PATTERNS[c] || "10101010").join("") + "11";
  };

  const bars = encode128(code);
  const barW = 2;
  const h = 60;
  const width = bars.length * barW + 20;

  let rects = "";
  let x = 10;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i] === "1") {
      rects += `<rect x="${x}" y="0" width="${barW}" height="${h}" fill="#000"/>`;
    }
    x += barW;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h + 20}" viewBox="0 0 ${width} ${h + 20}">
    <rect width="${width}" height="${h + 20}" fill="white"/>
    ${rects}
    <text x="${width/2}" y="${h + 16}" text-anchor="middle" font-family="monospace" font-size="10" fill="#000">${code}</text>
  </svg>`;
}

// ══════════════════════════════════════════════════════════
//  🎨 STYLES
// ══════════════════════════════════════════════════════════
const S = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=Syne:wght@500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --navy:#0a1628;--navy-m:#0d1f3c;--navy-l:#1a3a5c;
  --blue:#1e6fc4;--blue-l:#ddeeff;--blue-d:#0d4a8a;--blue-m:#4a9fd4;
  --teal:#00b4d8;--teal-l:#caf0f8;
  --gold:#f4a261;--gold-l:#fff3e0;
  --green:#2d9e6b;--green-l:#e8f5ee;
  --red:#e63946;--red-l:#fdecea;
  --amber:#d4832a;--amber-l:#fef3e2;
  --cream:#f4f8ff;--sand:#dce6f5;
  --txt:#0a1628;--soft:#6b7fa3;--w:#fff;
  --ease:cubic-bezier(.16,1,.3,1);
  --r:14px;
}
html,body{height:100%;font-family:'Syne',sans-serif;background:var(--cream);color:var(--txt);-webkit-font-smoothing:antialiased}
body.ar{font-family:'Tajawal',sans-serif}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--sand);border-radius:2px}

/* ── LANG BAR ── */
.lang-bar{position:fixed;top:0;left:0;right:0;z-index:999;background:var(--navy);padding:7px 20px;display:flex;justify-content:space-between;align-items:center}
.lang-bar-brand{font-size:11px;color:rgba(255,255,255,.4);letter-spacing:.1em;text-transform:uppercase}
.lang-btns{display:flex;gap:6px}
.lang-btn{padding:4px 14px;border-radius:100px;border:1.5px solid rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.6);font-size:.72rem;font-weight:700;cursor:pointer;transition:all .2s;font-family:'Syne',sans-serif}
.lang-btn.active{background:var(--teal);color:var(--navy);border-color:var(--teal)}

/* ── LOGIN ── */
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;padding-top:52px;
  background:radial-gradient(ellipse at 20% 50%,rgba(30,111,196,.15) 0%,transparent 60%),
             radial-gradient(ellipse at 80% 20%,rgba(0,180,216,.1) 0%,transparent 50%),
             var(--navy)}
.login-box{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(20px);border-radius:24px;padding:44px 36px;width:100%;max-width:400px;box-shadow:0 40px 80px rgba(0,0,0,.4);animation:fadeUp .5s var(--ease) both}
.login-logo{text-align:center;margin-bottom:32px}
.login-logo-mark{width:72px;height:72px;background:linear-gradient(135deg,var(--blue),var(--teal));border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:28px;box-shadow:0 12px 40px rgba(0,180,216,.3)}
.login-name{font-size:1.1rem;font-weight:800;color:white;letter-spacing:-.01em}
.login-sub{font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;text-transform:uppercase;letter-spacing:.1em}
.role-tabs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:20px}
.role-tab{padding:10px 6px;border:1.5px solid rgba(255,255,255,.1);background:transparent;border-radius:10px;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;cursor:pointer;color:rgba(255,255,255,.5);transition:all .2s;text-align:center;line-height:1.3}
.role-tab.active{background:rgba(0,180,216,.15);border-color:var(--teal);color:var(--teal)}
.lfield{margin-bottom:16px}
.lfield label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.4);margin-bottom:7px}
.lfield input{width:100%;padding:12px 16px;border-radius:10px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);font-family:'Syne',sans-serif;font-size:14px;color:white;outline:none;transition:all .2s}
.lfield input:focus{border-color:var(--teal);background:rgba(0,180,216,.08)}
.login-btn{width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--blue),var(--teal));color:white;font-family:'Syne',sans-serif;font-size:14px;font-weight:800;cursor:pointer;transition:all .2s;letter-spacing:.02em}
.login-btn:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(0,180,216,.4)}
.login-error{color:#ff6b6b;font-size:12px;text-align:center;margin-top:10px;background:rgba(230,57,70,.1);padding:8px;border-radius:8px;border:1px solid rgba(230,57,70,.2)}

/* ── SHELL ── */
.shell{min-height:100vh;display:flex;flex-direction:column;max-width:520px;margin:0 auto;background:var(--cream)}
.shell.rtl{direction:rtl}

/* ── TOPBAR ── */
.topbar{background:var(--navy);color:white;padding:20px 18px 16px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:38px;z-index:20;box-shadow:0 4px 24px rgba(0,0,0,.2)}
.topbar-left{display:flex;align-items:center;gap:12px}
.topbar-icon{width:40px;height:40px;background:linear-gradient(135deg,var(--blue),var(--teal));border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.topbar-title{font-size:15px;font-weight:800;line-height:1;letter-spacing:-.01em}
.topbar-sub{font-size:10px;opacity:.5;margin-top:2px;text-transform:uppercase;letter-spacing:.08em}
.topbar-right{display:flex;align-items:center;gap:8px}
.live-pill{background:rgba(45,158,107,.2);border:1px solid rgba(45,158,107,.4);border-radius:100px;padding:4px 12px;font-size:11px;font-weight:700;color:#4ade80;display:flex;align-items:center;gap:5px}
.live-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;animation:blink 1.5s infinite}
.topbar-btn{background:rgba(255,255,255,.08);border:none;color:white;border-radius:8px;padding:6px 10px;font-size:13px;cursor:pointer;transition:all .2s}
.topbar-btn:hover{background:rgba(255,255,255,.15)}

/* ── STATS BAR ── */
.stats-row{display:flex;background:var(--navy-m);border-bottom:1px solid rgba(255,255,255,.05)}
.stat-item{flex:1;padding:12px 8px;text-align:center;border-right:1px solid rgba(255,255,255,.05)}
.stat-item:last-child{border-right:none}
.stat-n{font-size:22px;font-weight:800;line-height:1}
.stat-l{font-size:9px;color:rgba(255,255,255,.35);margin-top:3px;text-transform:uppercase;letter-spacing:.06em}
.s-w .stat-n{color:var(--teal)}.s-c .stat-n{color:var(--gold)}.s-d .stat-n{color:#4ade80}

/* ── CALLED BANNER ── */
.called-banner{background:linear-gradient(135deg,rgba(244,162,97,.15),rgba(244,162,97,.05));border-bottom:2px solid var(--gold);padding:14px 18px;display:flex;align-items:flex-start;gap:12px}
.cb-icon{font-size:22px;flex-shrink:0;margin-top:2px}
.cb-info{flex:1}
.cb-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);font-weight:800;margin-bottom:3px}
.cb-name{font-size:15px;font-weight:800;color:var(--navy)}
.cb-code{font-size:11px;color:var(--soft);margin-top:2px}
.cb-analyses{font-size:11px;color:var(--blue-d);margin-top:4px;font-style:italic}
.cb-actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.delay-btn{background:rgba(244,162,97,.15);color:var(--amber);border:1px solid rgba(244,162,97,.3);border-radius:8px;padding:5px 12px;font-size:11px;font-weight:800;cursor:pointer;font-family:'Syne',sans-serif;transition:all .2s}
.delay-btn:hover{background:var(--amber);color:white}
.done-btn{background:var(--green);color:white;border:none;border-radius:8px;padding:5px 16px;font-size:11px;font-weight:800;cursor:pointer;font-family:'Syne',sans-serif}

/* ── ADD FORM ── */
.add-section{background:white;border-bottom:1px solid var(--sand)}
.add-toggle{width:100%;padding:14px 18px;background:none;border:none;display:flex;align-items:center;gap:10px;cursor:pointer;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--navy);text-align:left}
.add-toggle-icon{width:32px;height:32px;background:var(--blue-l);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.add-form-body{padding:0 18px 18px;display:flex;flex-direction:column;gap:12px}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.field label{display:block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--soft);margin-bottom:5px}
.field input,.field textarea,.field select{width:100%;padding:10px 13px;border-radius:10px;border:1.5px solid var(--sand);background:var(--cream);font-family:'Syne',sans-serif;font-size:13px;color:var(--txt);outline:none;transition:all .2s}
.field input:focus,.field textarea:focus,.field select:focus{border-color:var(--blue);background:white}
.field textarea{resize:vertical;min-height:70px}
.submit-btn{width:100%;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--blue),var(--teal));color:white;font-family:'Syne',sans-serif;font-size:14px;font-weight:800;cursor:pointer;transition:all .2s}
.submit-btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,180,216,.3)}

/* ── TICKET RESULT ── */
.ticket-result{background:linear-gradient(135deg,var(--blue-l),var(--teal-l));border:1.5px solid var(--teal);border-radius:14px;padding:18px;text-align:center;animation:fadeUp .3s var(--ease);margin-top:12px}
.ticket-code{font-family:'Syne',sans-serif;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.15em;color:var(--blue-d);margin-bottom:4px}
.ticket-num-big{font-size:48px;font-weight:800;color:var(--navy);line-height:1;letter-spacing:-.02em}
.ticket-patient{font-size:13px;font-weight:600;color:var(--soft);margin-top:4px}
.barcode-wrap{margin:14px 0;background:white;border-radius:8px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:6px}
.barcode-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--soft);font-weight:700}
.share-btns{display:flex;gap:8px}
.share-btns button{flex:1;padding:10px;border-radius:10px;border:none;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s}
.btn-wa{background:#25D366;color:white}.btn-wa:hover{background:#1ebe5a}
.btn-copy{background:var(--blue-l);color:var(--blue-d);border:1.5px solid var(--blue)!important}

/* ── QUEUE LIST ── */
.queue-body{flex:1;overflow-y:auto;padding-bottom:130px}
.section-label{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--soft);padding:14px 18px 6px}
.progress-bar{height:3px;background:var(--sand);margin:0 18px 8px;border-radius:2px;overflow:hidden}
.progress-fill{height:100%;background:linear-gradient(90deg,var(--blue),var(--teal));border-radius:2px;transition:width .8s var(--ease)}

.q-card{background:white;margin:0 12px 8px;border-radius:14px;border:1.5px solid var(--sand);overflow:hidden;transition:all .3s var(--ease);box-shadow:0 2px 8px rgba(0,0,0,.04)}
.q-card.s-called{border-color:var(--gold);box-shadow:0 0 0 3px rgba(244,162,97,.15),0 4px 20px rgba(244,162,97,.2)}
.q-card.s-done,.q-card.s-skipped{opacity:.35}
.q-card-main{display:flex;align-items:center;gap:12px;padding:13px 14px}
.q-num{width:42px;height:42px;border-radius:10px;background:var(--blue-l);color:var(--blue-d);font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;letter-spacing:-.01em}
.q-card.s-called .q-num{background:linear-gradient(135deg,var(--gold),#f9844a);color:white}
.q-info{flex:1;min-width:0}
.q-name{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.q-analyses{font-size:11px;color:var(--soft);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.q-time{font-size:10px;color:var(--soft);margin-top:3px;display:flex;align-items:center;gap:4px}
.q-status{font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px}
.q-status.waiting{background:var(--blue-l);color:var(--blue-d)}
.q-status.called{background:rgba(244,162,97,.15);color:var(--amber)}
.q-status.done{background:var(--green-l);color:var(--green)}
.q-actions{display:flex;gap:5px;flex-shrink:0}
.q-btn{width:34px;height:34px;border-radius:8px;border:none;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
.q-btn-results{background:var(--blue-l);color:var(--blue-d)}.q-btn-results:hover{background:var(--blue);color:white}
.q-btn-done{background:var(--green-l);color:var(--green)}.q-btn-done:hover{background:var(--green);color:white}
.q-btn-skip{background:var(--red-l);color:var(--red)}.q-btn-skip:hover{background:var(--red);color:white}
.q-btn-print{background:var(--gold-l);color:var(--amber)}.q-btn-print:hover{background:var(--gold);color:white}

/* ── RESULTS PANEL (slide up) ── */
.panel-overlay{position:fixed;inset:0;z-index:300;background:rgba(10,22,40,.6);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .2s}
.panel-box{background:white;border-radius:20px 20px 0 0;width:100%;max-width:520px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;animation:slideUp .35s var(--ease)}
.panel-handle{width:40px;height:4px;background:var(--sand);border-radius:2px;margin:14px auto 0}
.panel-head{padding:18px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--sand)}
.panel-title{font-size:16px;font-weight:800;color:var(--navy)}
.panel-close{background:var(--cream);border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;color:var(--soft);font-family:'Syne',sans-serif;font-weight:700}
.panel-body{flex:1;overflow-y:auto;padding:20px}
.result-field{margin-bottom:14px}
.result-field label{display:block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--soft);margin-bottom:5px}
.result-field input,.result-field textarea,.result-field select{width:100%;padding:10px 13px;border-radius:10px;border:1.5px solid var(--sand);background:var(--cream);font-family:'Syne',sans-serif;font-size:13px;color:var(--txt);outline:none;transition:all .2s}
.result-field input:focus,.result-field textarea:focus{border-color:var(--blue);background:white}
.result-field textarea{min-height:100px;resize:vertical}
.analyses-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.analyse-item{background:var(--cream);border-radius:10px;padding:10px 12px;border:1.5px solid var(--sand)}
.analyse-name{font-size:11px;font-weight:700;color:var(--navy);margin-bottom:4px}
.analyse-input{width:100%;background:none;border:none;border-bottom:1.5px solid var(--sand);font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--navy);outline:none;padding:2px 0;transition:border-color .2s}
.analyse-input:focus{border-color:var(--blue)}
.analyse-unit{font-size:9px;color:var(--soft);margin-top:2px}
.save-results-btn{width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--green),#52c41a);color:white;font-family:'Syne',sans-serif;font-size:14px;font-weight:800;cursor:pointer;margin-top:8px;transition:all .2s}
.save-results-btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(45,158,107,.3)}

/* ── BOTTOM ACTION ── */
.bottom-action{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:520px;background:white;border-top:1px solid var(--sand);padding:14px 16px 28px;z-index:30}
.call-btn{width:100%;padding:16px;border-radius:14px;border:none;background:linear-gradient(135deg,var(--gold),#f9844a);color:white;font-family:'Syne',sans-serif;font-size:15px;font-weight:800;cursor:pointer;transition:all .2s;letter-spacing:.02em;box-shadow:0 4px 20px rgba(244,162,97,.4)}
.call-btn:disabled{background:var(--sand);color:var(--soft);box-shadow:none;cursor:not-allowed}
.call-btn:not(:disabled):active{transform:scale(.98)}

/* ══ PATIENT VIEW ══ */
.pt-shell{min-height:100vh;display:flex;flex-direction:column;max-width:520px;margin:0 auto;background:var(--navy)}
.pt-shell.rtl{direction:rtl}
.pt-hero{padding:48px 24px 36px;text-align:center;position:relative;overflow:hidden}
.pt-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(0,180,216,.2),transparent 70%);pointer-events:none}
.pt-logo{width:64px;height:64px;background:linear-gradient(135deg,var(--blue),var(--teal));border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:26px;position:relative;z-index:1}
.pt-name{font-size:18px;font-weight:800;color:white;position:relative;z-index:1}
.pt-sub{font-size:12px;color:rgba(255,255,255,.5);margin-top:4px;position:relative;z-index:1}
.pt-body{flex:1;background:var(--cream);border-radius:24px 24px 0 0;padding:28px 20px 48px;margin-top:-8px}
.pt-card{background:white;border-radius:16px;padding:28px 22px;box-shadow:0 8px 40px rgba(0,0,0,.08);text-align:center;margin-bottom:16px}
.pt-card-title{font-size:18px;font-weight:800;color:var(--navy);margin-bottom:6px}
.pt-card-sub{font-size:13px;color:var(--soft);line-height:1.6;margin-bottom:22px}
.pt-code-input{width:100%;padding:16px;font-family:'Syne',sans-serif;font-size:24px;font-weight:800;text-align:center;letter-spacing:.2em;border:2px solid var(--sand);border-radius:12px;background:var(--cream);color:var(--navy);outline:none;transition:all .2s;margin-bottom:14px}
.pt-code-input:focus{border-color:var(--teal);background:white}
.pt-error{color:var(--red);font-size:13px;margin-bottom:12px;background:var(--red-l);padding:8px 14px;border-radius:8px;border:1px solid rgba(230,57,70,.2)}
.pt-confirm-btn{width:100%;padding:15px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--blue),var(--teal));color:white;font-family:'Syne',sans-serif;font-size:15px;font-weight:800;cursor:pointer}

/* Status ring */
.pt-status-wrap{text-align:center}
.pt-ring{width:180px;height:180px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 24px;position:relative}
.pt-ring.r-waiting{background:radial-gradient(circle,var(--blue-l),white);border:4px solid var(--blue)}
.pt-ring.r-called{background:radial-gradient(circle,rgba(244,162,97,.15),white);border:4px solid var(--gold);animation:ringPulse 1.4s ease-in-out infinite}
.pt-ring.r-done{background:radial-gradient(circle,var(--green-l),white);border:4px solid var(--green)}
.pt-ring.r-results{background:radial-gradient(circle,var(--teal-l),white);border:4px solid var(--teal)}
.pt-ring-num{font-family:'Syne',sans-serif;font-size:52px;font-weight:800;line-height:1;letter-spacing:-.02em}
.r-waiting .pt-ring-num{color:var(--blue-d)}.r-called .pt-ring-num{color:var(--amber)}.r-done .pt-ring-num{font-size:40px}.r-results .pt-ring-num{font-size:36px}
.pt-ring-sub{font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-top:4px;font-weight:800}
.r-waiting .pt-ring-sub{color:var(--blue-d)}.r-called .pt-ring-sub{color:var(--amber)}.r-done .pt-ring-sub{color:var(--green)}.r-results .pt-ring-sub{color:var(--teal)}
.pt-title{font-size:22px;font-weight:800;margin-bottom:8px;letter-spacing:-.01em}
.pt-desc{font-size:14px;color:var(--soft);line-height:1.6;margin-bottom:18px;max-width:280px;margin-left:auto;margin-right:auto}
.pt-pos-badge{background:white;border:1.5px solid var(--sand);border-radius:100px;padding:10px 24px;display:inline-flex;align-items:center;gap:10px;font-size:14px;color:var(--soft);margin-bottom:14px;box-shadow:0 2px 12px rgba(0,0,0,.06)}
.pt-pos-n{font-size:26px;font-weight:800;color:var(--navy)}
.pt-eta{background:var(--blue-l);border:1px solid var(--blue);border-radius:12px;padding:14px 20px;text-align:center;margin-bottom:14px}
.pt-eta-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--blue-d);font-weight:800;margin-bottom:4px}
.pt-eta-time{font-size:28px;font-weight:800;color:var(--navy)}
.pt-eta-live{font-size:10px;color:var(--blue-d);opacity:.7;margin-top:3px}
.pt-alert{background:linear-gradient(135deg,rgba(244,162,97,.1),rgba(249,132,74,.05));border:2px solid var(--gold);border-radius:14px;padding:16px 20px;font-size:15px;text-align:center;font-weight:700;color:var(--amber);margin-bottom:14px}

/* Results display */
.results-card{background:white;border-radius:14px;padding:18px;margin-top:16px;border:1px solid var(--sand)}
.results-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--soft);margin-bottom:14px}
.result-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--sand)}
.result-row:last-child{border-bottom:none}
.result-name{font-size:13px;font-weight:600;color:var(--navy)}
.result-val{font-size:14px;font-weight:800;color:var(--blue-d)}
.result-val.abnormal{color:var(--red)}
.result-unit{font-size:10px;color:var(--soft);margin-left:4px}
.print-results-btn{width:100%;margin-top:14px;padding:12px;border-radius:10px;border:1.5px solid var(--blue);background:white;color:var(--blue-d);font-family:'Syne',sans-serif;font-size:13px;font-weight:800;cursor:pointer}

.pt-live{font-size:11px;color:var(--soft);display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px}
.pt-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:blink 1.5s infinite}
.pt-back{margin-top:18px;font-size:13px;color:var(--soft);background:none;border:none;cursor:pointer;text-decoration:underline;font-family:'Syne',sans-serif;display:block;text-align:center}

/* PRINT */
@media print{
  .no-print{display:none!important}
  body{background:white}
  .print-page{padding:20px;max-width:210mm;margin:0 auto;font-family:'Syne',sans-serif}
}

@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:none}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes ringPulse{0%,100%{box-shadow:0 0 0 0 rgba(244,162,97,.4)}50%{box-shadow:0 0 0 20px rgba(244,162,97,0)}}
`;

// ══════════════════════════════════════════════════════════
//  HOOKS
// ══════════════════════════════════════════════════════════
function useQueue() {
  const [queue, setQueue] = useState([]);
  useEffect(() => { const u = subscribeQueue(setQueue); return u; }, []);
  return queue;
}
function useNetwork() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    window.addEventListener("online",  () => setOn(true));
    window.addEventListener("offline", () => setOn(false));
  }, []);
  return on;
}

// ══════════════════════════════════════════════════════════
//  LANG BAR
// ══════════════════════════════════════════════════════════
function LangBar({ lang, setLang }) {
  return (
    <div className="lang-bar">
      <span className="lang-bar-brand">Labo Boudissa</span>
      <div className="lang-btns">
        <button className={`lang-btn ${lang==="fr"?"active":""}`} onClick={() => setLang("fr")}>FR</button>
        <button className={`lang-btn ${lang==="en"?"active":""}`} onClick={() => setLang("en")}>EN</button>
        <button className={`lang-btn ${lang==="ar"?"active":""}`} onClick={() => setLang("ar")}>عربي</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════════
function Login({ onLogin, lang, setLang }) {
  const [role, setRole] = useState("accueil");
  const [pwd, setPwd]   = useState("");
  const [err, setErr]   = useState("");

  const labels = { fr: { accueil:"Accueil", tech:"Technicien", boudissa:"Dr. Boudissa", pwd:"Mot de passe", btn:"Se connecter →", wrong:"Mot de passe incorrect" },
                   en: { accueil:"Reception", tech:"Technician", boudissa:"Dr. Boudissa", pwd:"Password", btn:"Login →", wrong:"Incorrect password" },
                   ar: { accueil:"الاستقبال", tech:"التقني", boudissa:"د. بوديسة", pwd:"كلمة المرور", btn:"دخول ←", wrong:"كلمة المرور غير صحيحة" } };
  const L = labels[lang] || labels.fr;

  const handle = () => {
    const acc = ADMIN_ACCOUNTS[role];
    if (acc && acc.pwd === pwd) { saveSession({ role, ...acc }); onLogin({ role, ...acc }); }
    else { setErr(L.wrong); setPwd(""); }
  };

  return (
    <>
      <style>{S}</style>
      <LangBar lang={lang} setLang={setLang} />
      <div className="login-wrap" dir={lang==="ar"?"rtl":"ltr"}>
        <div className="login-box">
          <div className="login-logo">
            <div className="login-logo-mark">🧬</div>
            <div className="login-name">
              {lang==="ar" ? "مخبر تحاليل بوديسة" : "Laboratoire Boudissa"}
            </div>
            <div className="login-sub">Boumerdès · {lang==="ar" ? "تحاليل طبية" : "Analyses Médicales"}</div>
          </div>

          <div className="role-tabs">
            {["accueil","tech","boudissa"].map(r => (
              <button key={r} className={`role-tab ${role===r?"active":""}`}
                onClick={() => { setRole(r); setErr(""); setPwd(""); }}>
                {r==="accueil" ? "🏥" : r==="tech" ? "🔬" : "👨‍⚕️"}<br/>
                {L[r]}
              </button>
            ))}
          </div>

          <div className="lfield">
            <label>{L.pwd}</label>
            <input type="password" placeholder="••••••••" value={pwd}
              onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key==="Enter" && handle()} autoFocus />
          </div>
          {err && <div className="login-error">{err}</div>}
          <button className="login-btn" onClick={handle}>{L.btn}</button>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  RESULTS PANEL
// ══════════════════════════════════════════════════════════
function ResultsPanel({ ticket, onClose, onSave, lang }) {
  const defaultAnalyses = (ticket.analyses || "").split(",").map(a => a.trim()).filter(Boolean);
  const [vals, setVals] = useState({});
  const [notes, setNotes] = useState(ticket.resultNotes || "");
  const [saved, setSaved] = useState(false);

  const L = {
    fr: { title:"Saisir les résultats", patient:"Patient", analyses:"Analyses", notes:"Notes / Observations", save:"💾 Enregistrer les résultats", value:"Valeur", ref:"Référence", done:"✓ Sauvegardé !" },
    en: { title:"Enter results", patient:"Patient", analyses:"Analyses", notes:"Notes / Observations", save:"💾 Save results", value:"Value", ref:"Reference", done:"✓ Saved!" },
    ar: { title:"إدخال النتائج", patient:"المريض", analyses:"التحاليل", notes:"ملاحظات", save:"💾 حفظ النتائج", value:"القيمة", ref:"المرجع", done:"✓ تم الحفظ!" }
  }[lang] || {};

  const handleSave = async () => {
    const results = defaultAnalyses.map(a => ({ name: a, value: vals[a] || "", notes }));
    await onSave(ticket.id, results, notes);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1500);
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel-box" onClick={e => e.stopPropagation()}>
        <div className="panel-handle"/>
        <div className="panel-head">
          <div>
            <div className="panel-title">🔬 {L.title}</div>
            <div style={{fontSize:12,color:"var(--soft)",marginTop:2}}>{ticket.name} · {ticket.code}</div>
          </div>
          <button className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="panel-body" dir={lang==="ar"?"rtl":"ltr"}>
          {/* Barcode */}
          <div style={{background:"var(--cream)",borderRadius:12,padding:14,marginBottom:16,textAlign:"center",border:"1px solid var(--sand)"}}>
            <div style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",color:"var(--soft)",marginBottom:8}}>Code-barres dossier</div>
            <div dangerouslySetInnerHTML={{__html: generateBarcodeSVG(ticket.code)}} style={{display:"flex",justifyContent:"center"}}/>
          </div>

          {/* Analyses inputs */}
          <div style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"var(--soft)",marginBottom:10}}>{L.analyses}</div>
          {defaultAnalyses.length > 0 ? (
            <div className="analyses-grid">
              {defaultAnalyses.map(a => (
                <div key={a} className="analyse-item">
                  <div className="analyse-name">{a}</div>
                  <input className="analyse-input" placeholder={L.value}
                    value={vals[a] || ""}
                    onChange={e => setVals({...vals, [a]: e.target.value})}/>
                  <div className="analyse-unit">Valeur saisie</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{marginBottom:14}}>
              <div className="result-field">
                <label>{L.value}</label>
                <textarea className="result-field textarea" placeholder="Saisir les résultats complets..." rows={5}
                  value={notes} onChange={e => setNotes(e.target.value)}/>
              </div>
            </div>
          )}

          <div className="result-field">
            <label>{L.notes}</label>
            <textarea placeholder="Observations, commentaires du technicien..." rows={3}
              value={notes} onChange={e => setNotes(e.target.value)}
              style={{width:"100%",padding:"10px 13px",borderRadius:10,border:"1.5px solid var(--sand)",background:"var(--cream)",fontFamily:"'Syne',sans-serif",fontSize:13,resize:"vertical",outline:"none"}}/>
          </div>

          <button className="save-results-btn" onClick={handleSave}>
            {saved ? L.done : L.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  STAFF DASHBOARD
// ══════════════════════════════════════════════════════════
function Dashboard({ user, onLogout, lang, setLang }) {
  const queue   = useQueue();
  const online  = useNetwork();
  const [showAdd,    setShowAdd]    = useState(false);
  const [lastTicket, setLastTicket] = useState(null);
  const [copied,     setCopied]     = useState(false);
  const [resultsFor, setResultsFor] = useState(null);
  const [form, setForm] = useState({ name:"", age:"", phone:"", analyses:"" });

  const waiting = queue.filter(q => q.status === "waiting");
  const called  = queue.find(q => q.status === "called");
  const done    = queue.filter(q => q.status === "done");

  const pos = {};
  waiting.forEach((q,i) => pos[q.id] = i+1);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    const t = await addPatient(form);
    setLastTicket(t);
    setForm({ name:"", age:"", phone:"", analyses:"" });
  };

  const patientLink = (code) => `${window.location.origin}${window.location.pathname}?code=${code}&lang=${lang}`;

  const shareWA = (t) => {
    const msgs = {
      fr: `Bonjour ${t.name} 👋\nVotre numéro au *Laboratoire Boudissa*:\n\n🧬 Code: *${t.code}*\n\n📱 Suivez votre résultat:\n${patientLink(t.code)}`,
      en: `Hello ${t.name} 👋\nYour number at *Labo Boudissa*:\n\n🧬 Code: *${t.code}*\n\n📱 Track your results:\n${patientLink(t.code)}`,
      ar: `السلام عليكم ${t.name} 👋\nرقمك في *مخبر بوديسة*:\n\n🧬 الرمز: *${t.code}*\n\n📱 تابع نتائجك:\n${patientLink(t.code)}`
    };
    window.open(`https://wa.me/?text=${encodeURIComponent(msgs[lang] || msgs.fr)}`, "_blank");
  };

  const copyLink = (t) => {
    navigator.clipboard.writeText(patientLink(t.code));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const saveResults = async (id, results, notes) => {
    await updateTicket(id, { results, resultNotes: notes, resultDate: Date.now(), hasResults: true });
  };

  const printBarcode = (t) => {
    const svg = generateBarcodeSVG(t.code);
    const w = window.open("","_blank","width=400,height=300");
    w.document.write(`<html><head><title>Code-barres</title><style>body{margin:20px;font-family:monospace;text-align:center}.info{margin-top:10px;font-size:12px}</style></head><body>
      ${svg}
      <div class="info"><strong>${t.name}</strong><br/>${t.code}<br/>${t.analyses || ""}</div>
      <script>window.print();window.close();<\/script></body></html>`);
  };

  const L = {
    fr: { newPatient:"Nouveau patient", nameLbl:"Nom complet", ageLbl:"Âge", phoneLbl:"Téléphone", analysesLbl:"Analyses prescrites (séparées par des virgules)", submit:"➕ Enregistrer et générer ticket", ticketGen:"Ticket généré", queueTitle:"File d'attente", waiting:"En attente", inProgress:"En cours", done:"Terminés", callNext:"📣 Appeler le patient suivant", position:"Position", results:"Résultats", technician:"Technicien" },
    en: { newPatient:"New patient", nameLbl:"Full name", ageLbl:"Age", phoneLbl:"Phone", analysesLbl:"Prescribed analyses (comma separated)", submit:"➕ Register & generate ticket", ticketGen:"Ticket generated", queueTitle:"Queue", waiting:"Waiting", inProgress:"In progress", done:"Done", callNext:"📣 Call next patient", position:"Position", results:"Results", technician:"Technician" },
    ar: { newPatient:"مريض جديد", nameLbl:"الاسم الكامل", ageLbl:"العمر", phoneLbl:"الهاتف", analysesLbl:"التحاليل المطلوبة (مفصولة بفواصل)", submit:"➕ تسجيل وإنشاء تذكرة", ticketGen:"تم إنشاء التذكرة", queueTitle:"قائمة الانتظار", waiting:"انتظار", inProgress:"قيد المعالجة", done:"منتهي", callNext:"📣 استدعاء المريض التالي", position:"الترتيب", results:"النتائج", technician:"التقني" }
  }[lang] || {};

  return (
    <>
      <style>{S}</style>
      <LangBar lang={lang} setLang={setLang} />
      {resultsFor && <ResultsPanel ticket={resultsFor} lang={lang} onClose={() => setResultsFor(null)} onSave={saveResults} />}

      <div className={`shell ${lang==="ar"?"rtl":""}`} dir={lang==="ar"?"rtl":"ltr"}>
        {/* TOPBAR */}
        <div className="topbar">
          <div className="topbar-left">
            <div className="topbar-icon">🧬</div>
            <div>
              <div className="topbar-title">{lang==="ar" ? "مخبر بوديسة" : "Labo Boudissa"}</div>
              <div className="topbar-sub">{lang==="ar" ? user.labelAr : user.label}</div>
            </div>
          </div>
          <div className="topbar-right">
            <div className="live-pill">
              <span className="live-dot"/>
              {waiting.length} {L.waiting}
            </div>
            <button className="topbar-btn" onClick={() => { clearSession(); onLogout(); }}>⏻</button>
          </div>
        </div>

        {/* STATS */}
        <div className="stats-row">
          <div className="stat-item s-w"><div className="stat-n">{waiting.length}</div><div className="stat-l">{L.waiting}</div></div>
          <div className="stat-item s-c"><div className="stat-n">{called ? 1 : 0}</div><div className="stat-l">{L.inProgress}</div></div>
          <div className="stat-item s-d"><div className="stat-n">{done.length}</div><div className="stat-l">{L.done}</div></div>
        </div>

        {/* CALLED BANNER */}
        {called && (
          <div className="called-banner">
            <span className="cb-icon">🔬</span>
            <div className="cb-info">
              <div className="cb-label">{L.inProgress}</div>
              <div className="cb-name">{called.name}</div>
              <div className="cb-code">{called.code}</div>
              {called.analyses && <div className="cb-analyses">{called.analyses}</div>}
              <div className="cb-actions">
                <button className="delay-btn" onClick={() => updateTicket(called.id, { extraDelay: (called.extraDelay||0)+5 })}>+5 min</button>
                <button className="delay-btn" onClick={() => updateTicket(called.id, { extraDelay: (called.extraDelay||0)+10 })}>+10 min</button>
                {(user.role==="tech"||user.role==="boudissa") && (
                  <button className="delay-btn" style={{background:"var(--blue-l)",color:"var(--blue-d)",borderColor:"var(--blue)"}}
                    onClick={() => setResultsFor(called)}>🔬 {L.results}</button>
                )}
                <button className="done-btn" onClick={() => updateTicket(called.id, { status:"done" })}>✓</button>
              </div>
            </div>
          </div>
        )}

        <div className="queue-body">
          {/* ADD FORM */}
          <div className="add-section">
            <button className="add-toggle" onClick={() => setShowAdd(!showAdd)}>
              <div className="add-toggle-icon">➕</div>
              {L.newPatient}
              <span style={{marginLeft:"auto",fontSize:12,color:"var(--soft)"}}>{showAdd?"▲":"▼"}</span>
            </button>
            {showAdd && (
              <div className="add-form-body">
                <div className="form-row">
                  <div className="field"><label>{L.nameLbl}</label><input value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Mohamed Amrani"/></div>
                  <div className="field"><label>{L.ageLbl}</label><input type="number" value={form.age} onChange={e => setForm({...form,age:e.target.value})} placeholder="45"/></div>
                </div>
                <div className="field"><label>{L.phoneLbl}</label><input type="tel" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="0555 XX XX XX"/></div>
                <div className="field"><label>{L.analysesLbl}</label>
                  <textarea value={form.analyses} onChange={e => setForm({...form,analyses:e.target.value})} placeholder="NFS, Glycémie, CRP, Bilan hépatique..."/>
                </div>
                <button className="submit-btn" onClick={handleAdd}>{L.submit}</button>

                {lastTicket && (
                  <div className="ticket-result">
                    <div className="ticket-code">{lang==="ar" ? "تم إنشاء التذكرة" : L.ticketGen}</div>
                    <div className="ticket-num-big">{lastTicket.code?.slice(-4)}</div>
                    <div className="ticket-patient">{lastTicket.name}</div>
                    <div className="barcode-wrap">
                      <div className="barcode-label">Code-barres dossier</div>
                      <div dangerouslySetInnerHTML={{__html: generateBarcodeSVG(lastTicket.code)}}/>
                      <button onClick={() => printBarcode(lastTicket)} style={{background:"none",border:"1px solid var(--sand)",borderRadius:6,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"'Syne',sans-serif"}}>🖨️ Imprimer code-barres</button>
                    </div>
                    <div className="share-btns">
                      <button className="btn-wa" onClick={() => shareWA(lastTicket)}>📱 WhatsApp</button>
                      <button className="btn-copy" onClick={() => copyLink(lastTicket)}>{copied ? "✓" : "📋 Copier"}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* QUEUE */}
          <div className="section-label">{L.queueTitle} · {queue.length}</div>
          {queue.length > 0 && (
            <div className="progress-bar">
              <div className="progress-fill" style={{width:`${done.length/queue.length*100}%`}}/>
            </div>
          )}

          {queue.length === 0 ? (
            <div style={{textAlign:"center",padding:"48px 24px",color:"var(--soft)"}}>
              <div style={{fontSize:40,marginBottom:10}}>🧬</div>
              <div style={{fontWeight:700}}>{lang==="ar" ? "لا يوجد مرضى بعد" : "Aucun patient pour l'instant"}</div>
            </div>
          ) : [...queue.filter(q=>q.status==="called"), ...queue.filter(q=>q.status==="waiting"), ...queue.filter(q=>q.status==="done"||q.status==="skipped")].map(q => (
            <div key={q.id} className={`q-card s-${q.status}`}>
              <div className="q-card-main">
                <div className="q-num">{q.code?.slice(-4)}</div>
                <div className="q-info">
                  <div className="q-name">{q.name}</div>
                  <div className="q-analyses">{q.analyses || "—"}</div>
                  <div className="q-time">
                    🕐 {q.time}
                    {q.status==="waiting" && <span className="q-status waiting">#{pos[q.id]}</span>}
                    {q.status==="called"  && <span className="q-status called">🔬 {L.inProgress}</span>}
                    {q.status==="done"    && <span className="q-status done">✓</span>}
                    {q.hasResults && <span style={{marginLeft:4,fontSize:10,color:"var(--green)",fontWeight:700}}>📋 Résultats prêts</span>}
                  </div>
                </div>
                <div className="q-actions">
                  {(user.role==="tech"||user.role==="boudissa") && (
                    <button className="q-btn q-btn-results" title="Saisir résultats" onClick={() => setResultsFor(q)}>🔬</button>
                  )}
                  <button className="q-btn q-btn-print" title="Imprimer code-barres" onClick={() => printBarcode(q)}>🖨️</button>
                  {q.status==="called"  && <button className="q-btn q-btn-done" onClick={() => updateTicket(q.id,{status:"done"})}>✓</button>}
                  {q.status==="waiting" && <button className="q-btn q-btn-skip" onClick={() => updateTicket(q.id,{status:"skipped"})}>✕</button>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CALL NEXT */}
        <div className="bottom-action no-print">
          <button className="call-btn" onClick={() => callNext(queue)} disabled={waiting.length===0}>
            {L.callNext} {waiting.length > 0 && `(${waiting.length})`}
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
  const [input, setInput] = useState(initialCode || "");
  const [code,  setCode]  = useState(initialCode || "");
  const [info,  setInfo]  = useState(null);
  const [err,   setErr]   = useState("");
  const [, setTick] = useState(0);

  useEffect(() => { const id = setInterval(() => setTick(t=>t+1), 60000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (!code) return;
    const tk = queue.find(q => q.code === code || q.code?.endsWith(code));
    if (tk) {
      const p = queue.filter(x=>x.status==="waiting").findIndex(x=>x.id===tk.id);
      setInfo({...tk, position: p+1});
      setErr("");
    } else if (queue.length > 0) {
      setErr(lang==="ar" ? "الرمز غير موجود" : lang==="en" ? "Code not found" : "Code introuvable");
    }
  }, [queue, code, lang]);

  const confirm = async () => {
    const padded = input.trim();
    // Search in today's queue first, then Firebase
    const tk = queue.find(q => q.code === padded || q.code?.endsWith(padded));
    if (tk) { setCode(tk.code); return; }
    const found = await getPatientByCode(padded);
    if (found) { setCode(found.code); return; }
    setErr(lang==="ar" ? "الرمز غير موجود" : lang==="en" ? "Code not found" : "Code introuvable");
  };

  const isTermine = info && (info.status==="done"||info.status==="skipped");
  const hasResults = info?.hasResults && info?.results;

  const L = {
    fr: { title:"Votre numéro de file", sub:"Entrez le code reçu par WhatsApp pour suivre votre position et vos résultats.", see:"Voir mon tour →", waiting:"En attente", yourTurn:"C'est votre tour !", goNow:"🔬 Présentez-vous maintenant", done:"Analyse terminée", resultsReady:"✅ Vos résultats sont disponibles !", noResults:"Vos résultats seront disponibles bientôt.", live:"Mise à jour en temps réel", other:"← Entrer un autre code", youAre:"Vous êtes", inQueue:"dans la file", estTime:"Heure estimée", stayNear:"Restez à proximité. Vous serez appelé(e) très bientôt.", position:"Position" },
    en: { title:"Your queue number", sub:"Enter the code received via WhatsApp to track your position and results.", see:"See my turn →", waiting:"Waiting", yourTurn:"It's your turn!", goNow:"🔬 Please come now", done:"Analysis done", resultsReady:"✅ Your results are available!", noResults:"Your results will be available soon.", live:"Real-time updates", other:"← Enter another code", youAre:"You are", inQueue:"in queue", estTime:"Estimated time", stayNear:"Stay nearby. You will be called very soon.", position:"Position" },
    ar: { title:"رقم دورك", sub:"أدخل الرمز الذي استلمته عبر واتساب لمتابعة مكانك ونتائجك.", see:"عرض دوري ←", waiting:"انتظار", yourTurn:"حان دورك!", goNow:"🔬 تفضل الآن", done:"انتهى الفحص", resultsReady:"✅ نتائجك متاحة!", noResults:"نتائجك ستكون متاحة قريباً.", live:"تحديث فوري", other:"← إدخال رمز آخر", youAre:"أنت", inQueue:"في قائمة الانتظار", estTime:"الوقت المتوقع", stayNear:"ابقَ قريباً. سيتم استدعاؤك قريباً جداً.", position:"الترتيب" }
  }[lang] || {};

  const ringClass = info ? (isTermine ? (hasResults ? "r-results" : "r-done") : `r-${info.status}`) : "";

  return (
    <>
      <style>{S}</style>
      <LangBar lang={lang} setLang={setLang} />
      <div className={`pt-shell ${lang==="ar"?"rtl":""}`} dir={lang==="ar"?"rtl":"ltr"}>
        <div className="pt-hero">
          <div className="pt-logo">🧬</div>
          <div className="pt-name">{lang==="ar" ? "مخبر تحاليل بوديسة" : "Laboratoire Boudissa"}</div>
          <div className="pt-sub">Boumerdès · {lang==="ar" ? "تحاليل طبية" : "Analyses Médicales"}</div>
        </div>

        <div className="pt-body">
          {!info ? (
            <div className="pt-card">
              <div className="pt-card-title">{L.title}</div>
              <div className="pt-card-sub">{L.sub}</div>
              <input className="pt-code-input" placeholder={lang==="ar" ? "الرمز" : "Code"} value={input}
                onChange={e => setInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key==="Enter" && confirm()} />
              {err && <div className="pt-error">{err}</div>}
              <button className="pt-confirm-btn" onClick={confirm}>{L.see}</button>
            </div>
          ) : (
            <div className="pt-status-wrap">
              <div className={`pt-ring ${ringClass}`}>
                {isTermine && hasResults ? (
                  <><div className="pt-ring-num">📋</div><div className="pt-ring-sub">{lang==="ar"?"النتائج":"Results"}</div></>
                ) : isTermine ? (
                  <><div className="pt-ring-num">✓</div><div className="pt-ring-sub">{lang==="ar"?"منتهي":"Done"}</div></>
                ) : (
                  <><div className="pt-ring-num">{info.code?.slice(-4)}</div><div className="pt-ring-sub">{info.status==="waiting"?L.waiting:lang==="ar"?"مستدعى!":"Called!"}</div></>
                )}
              </div>

              {info.status==="waiting" && (
                <>
                  <div style={{textAlign:"center",marginBottom:16}}>
                    <div style={{fontSize:22,fontWeight:800,marginBottom:6}}>{L.waiting}</div>
                    <div style={{fontSize:13,color:"var(--soft)"}}>{L.stayNear}</div>
                  </div>
                  {info.position > 0 && (
                    <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
                      <div className="pt-pos-badge">
                        <span>{L.youAre}</span>
                        <span className="pt-pos-n">{info.position}</span>
                        <span>{L.inQueue}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {info.status==="called" && (
                <>
                  <div style={{textAlign:"center",marginBottom:14}}>
                    <div style={{fontSize:22,fontWeight:800,color:"var(--amber)",marginBottom:6}}>{L.yourTurn}</div>
                  </div>
                  <div className="pt-alert">{L.goNow}</div>
                </>
              )}

              {isTermine && (
                <>
                  <div style={{textAlign:"center",marginBottom:14}}>
                    <div style={{fontSize:20,fontWeight:800,marginBottom:6}}>{L.done}</div>
                    <div style={{fontSize:13,color:"var(--soft)"}}>{hasResults ? L.resultsReady : L.noResults}</div>
                  </div>

                  {hasResults && (
                    <div className="results-card">
                      <div className="results-title">🔬 {lang==="ar" ? "نتائج التحاليل" : lang==="en" ? "Analysis Results" : "Résultats d'analyses"}</div>
                      {info.results.map((r, i) => (
                        <div key={i} className="result-row">
                          <span className="result-name">{r.name}</span>
                          <span className="result-val">{r.value} <span className="result-unit"></span></span>
                        </div>
                      ))}
                      {info.resultNotes && (
                        <div style={{marginTop:12,padding:"10px 12px",background:"var(--cream)",borderRadius:8,fontSize:12,color:"var(--soft)"}}>
                          📝 {info.resultNotes}
                        </div>
                      )}
                      <div style={{marginTop:10,fontSize:10,color:"var(--soft)",textAlign:"center"}}>
                        {lang==="ar" ? "تاريخ النتائج: " : "Date résultats: "}
                        {info.resultDate ? new Date(info.resultDate).toLocaleDateString("fr-DZ") : "—"}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="pt-live">
                <div className="pt-dot"/>
                {L.live}
              </div>
              <button className="pt-back" onClick={() => { setInfo(null); setCode(""); setInput(""); }}>{L.other}</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  APP
// ══════════════════════════════════════════════════════════
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const codeParam = params.get("code");
  const langParam = params.get("lang") || "fr";

  const [lang, setLang] = useState(langParam);
  const [user, setUser] = useState(() => loadSession());

  useEffect(() => { document.body.className = lang==="ar" ? "ar" : ""; }, [lang]);

  // Patient view — direct access via link
  if (codeParam) return <PatientView initialCode={codeParam} lang={lang} setLang={setLang} />;

  // Not logged in
  if (!user) return <Login onLogin={setUser} lang={lang} setLang={setLang} />;

  // Staff dashboard
  return <Dashboard user={user} onLogout={() => setUser(null)} lang={lang} setLang={setLang} />;
}
