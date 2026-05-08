import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://kfpgzxhlmkxgguqypswv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmcGd6eGhsbWt4Z2d1cXlwc3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzAwOTEsImV4cCI6MjA5MzU0NjA5MX0.lMlBFxZnZ7isUbHZnZ2_LAf7Gvo6tq46nE9bK1UZuzI";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const C = {
  bg:"#0A0A0C", surface:"#111116", card:"#18181F", cardHover:"#1E1E27",
  accent:"#F5B942", accentDim:"rgba(245,185,66,0.1)", accentBrd:"rgba(245,185,66,0.3)",
  text:"#EEEEF2", muted:"#6E6E82", border:"#222230",
  success:"#4ADE80", danger:"#F87171", info:"#60A5FA",
};
const card  = { background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px" };
const btn   = { background:C.accent, color:"#0A0A0C", border:"none", borderRadius:8, padding:"11px 22px", fontWeight:700, cursor:"pointer", fontSize:14 };
const btnGh = { background:"transparent", color:C.text, border:`1px solid ${C.border}`, borderRadius:8, padding:"11px 22px", cursor:"pointer", fontSize:14 };
const btnSm = { background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:12 };
const inp   = { background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"11px 14px", color:C.text, fontSize:15, width:"100%", boxSizing:"border-box", outline:"none", fontFamily:"inherit" };
const lbl   = { color:C.muted, fontSize:11, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6, display:"block" };
const sh    = { color:C.muted, fontSize:11, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", margin:"0 0 12px" };

// ── LOCAL STORAGE (session only) ───────────────────────────────────────────────
const ls = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem(k),
};

// ── RESPONSIVE HOOK ───────────────────────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return m;
}

// ── SUPABASE DB HELPERS ───────────────────────────────────────────────────────
const db = {
  // AUTH
  signup: async (name, email, password) => {
    const { data: existing } = await sb.from("users").select("id").eq("email", email.toLowerCase()).single();
    if (existing) throw new Error("Email already registered. Try logging in.");
    const user = { id: `u${Date.now()}`, name: name.trim(), email: email.toLowerCase(), password };
    const { error } = await sb.from("users").insert(user);
    if (error) throw new Error("Could not create account. Try again.");
    return { id: user.id, name: user.name, email: user.email };
  },
  login: async (email, password) => {
    const { data: user, error } = await sb.from("users").select("*").eq("email", email.toLowerCase()).single();
    if (error || !user) throw new Error("Incorrect email or password.");
    if (user.password !== password) throw new Error("Incorrect email or password.");
    return { id: user.id, name: user.name, email: user.email };
  },

  // GOALS
  getGoals: async (uid) => { const { data } = await sb.from("goals").select("*").eq("user_id", uid).order("created_at", { ascending: false }); return data || []; },
  addGoal: async (uid, title, progress) => { const g = { id: `g${Date.now()}`, user_id: uid, title, progress }; await sb.from("goals").insert(g); return g; },
  updateGoal: async (id, progress) => { await sb.from("goals").update({ progress }).eq("id", id); },
  deleteGoal: async (id) => { await sb.from("goals").delete().eq("id", id); },

  // HABITS
  getHabits: async (uid) => { const { data } = await sb.from("habits").select("*").eq("user_id", uid).order("created_at", { ascending: false }); return (data || []).map(h => ({ ...h, completedDates: h.completed_dates || [] })); },
  addHabit: async (uid, name) => { const h = { id: `h${Date.now()}`, user_id: uid, name, completed_dates: [], streak: 0 }; await sb.from("habits").insert(h); return { ...h, completedDates: [] }; },
  updateHabit: async (id, completedDates, streak) => { await sb.from("habits").update({ completed_dates: completedDates, streak }).eq("id", id); },
  deleteHabit: async (id) => { await sb.from("habits").delete().eq("id", id); },

  // JOURNAL
  getJournal: async (uid) => { const { data } = await sb.from("journal").select("*").eq("user_id", uid).order("created_at", { ascending: false }); return (data || []).map(j => ({ ...j, date: new Date(j.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" }) })); },
  addJournal: async (uid, content, mood) => { const j = { id: `j${Date.now()}`, user_id: uid, content, mood }; await sb.from("journal").insert(j); return j; },
  deleteJournal: async (id) => { await sb.from("journal").delete().eq("id", id); },

  // AI SESSIONS
  getAISessions: async (uid) => { const { data } = await sb.from("ai_sessions").select("*").eq("user_id", uid).order("created_at", { ascending: false }); return (data || []).map(s => ({ ...s, data: s.data, date: new Date(s.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" }) })); },
  addAISession: async (uid, input, data, msgCount) => { const s = { id: `ai${Date.now()}`, user_id: uid, input, data, msg_count: msgCount }; await sb.from("ai_sessions").insert(s); return s; },

  // CHECKINS
  getCheckins: async (uid) => { const { data } = await sb.from("checkins").select("*").eq("user_id", uid).order("created_at", { ascending: false }); return data || []; },
  addCheckin: async (uid, entry) => { const c = { id: `ci${Date.now()}`, user_id: uid, date: entry.date, what_went: entry.whatWent, blocker: entry.blocker, priority: entry.priority, energy: entry.energy, yest_habit_rate: entry.yestHabitRate }; await sb.from("checkins").insert(c); return c; },
};

// ── DAILY CHECK-IN HELPERS ────────────────────────────────────────────────────
const todayStr = () => new Date().toDateString();
const hasCheckedInToday = (checkins) => (checkins || []).some(c => c.date === todayStr());
function getEngagementStreak(checkins) {
  if (!checkins?.length) return 0;
  let streak = 0, d = new Date(); d.setDate(d.getDate() - 1);
  const sorted = [...checkins].sort((a,b) => new Date(b.date) - new Date(a.date));
  for (const x of sorted) { if (x.date === d.toDateString()) { streak++; d.setDate(d.getDate()-1); } else break; }
  if (checkins.find(x => x.date === todayStr())) streak++;
  return streak;
}
function getLast7() {
  return Array.from({length:7},(_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (6-i));
    return { dateStr:d.toDateString(), label:d.toLocaleDateString("en",{weekday:"short"}).slice(0,1) };
  });
}
function habitStatus(h) {
  const dates = h.completedDates || [], today = todayStr();
  const yest = new Date(); yest.setDate(yest.getDate()-1); const ys = yest.toDateString();
  if (dates.includes(today)) return "good";
  if (!dates.includes(today) && !dates.includes(ys) && h.streak > 0) return "broken";
  if (!dates.includes(today) && !dates.includes(ys)) return "at-risk";
  return "pending";
}
function weeklyRate(h) {
  const dates = h.completedDates || [], days = getLast7();
  const done = days.filter(d => dates.includes(d.dateStr)).length;
  return { done, pct: Math.round((done/7)*100) };
}
function calcStreak(dates) {
  let s = 0, d = new Date();
  while (dates.includes(d.toDateString())) { s++; d.setDate(d.getDate()-1); }
  return s;
}

// ── AI COACH — GEMINI ─────────────────────────────────────────────────────────
const GEMINI_KEY = "AIzaSyD6dd-a4ZLgpbpzkab1p6O04A-KVvpXnMk";
const GEMINI_URL = "/api/coach";
const COACH_SYSTEM = `You are Ignite — a strict but deeply caring personal development coach for students and ambitious young adults. You are direct, surgical, and never generic. You remember everything said in this conversation.

Rules:
- Always respond to what the user just said specifically
- Push back when answers are vague or sound like excuses
- Ask one sharp follow-up question at the end when appropriate
- Be direct but not harsh
- After the first structured response, speak in natural coaching language
- Keep replies under 180 words unless a full plan is needed
- Reference things the user said earlier when relevant
- If the user says they've tried before, dig into WHY it failed`;

async function callFirstResponse(struggling, improve, userName) {
  const userMsg = `What I am struggling with:\n${struggling}\n\nWhat I want to improve:\n${improve}`;
  const prompt = `${COACH_SYSTEM}

My name is ${userName}.

${userMsg}

Reply in this exact JSON format — no markdown, no preamble, just the JSON:
{"understanding":"2-3 sentences on the root challenge. Be direct.","strategy":["Step 1 — concrete and specific","Step 2","Step 3","Step 4"],"daily_actions":["Action 1 with timing","Action 2","Action 3"],"mindset_note":"One sharp reframe. Not a cliche.","followup":"One sharp follow-up question to keep coaching going."}`;

  const res = await fetch(GEMINI_URL, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ contents:[{ parts:[{ text:prompt }] }] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(raw.replace(/```json|```/g,"").trim());
}

async function callFollowUp(messages) {
  const history = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts:[{ text: m.content }]
  }));
  const res = await fetch(GEMINI_URL, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      system_instruction:{ parts:[{ text:COACH_SYSTEM }] },
      contents: history,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, type="habit") => { setToast({msg,type,id:Date.now()}); setTimeout(()=>setToast(null),2400); };
  return [toast, show];
}
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:C.card,border:`1px solid ${C.accentBrd}`,borderRadius:24,padding:"9px 18px",zIndex:500,display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 24px rgba(0,0,0,0.4)",animation:"slideUp .2s ease",whiteSpace:"nowrap"}}>
      <span style={{fontSize:13,fontWeight:600,color:C.text}}>{toast.msg}</span>
    </div>
  );
}

// ── LANDING ───────────────────────────────────────────────────────────────────
function Landing({ onNav }) {
  const m = useIsMobile();
  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans','Segoe UI',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:m?"40px 20px":"60px 24px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 70% 40% at 50% 20%,rgba(245,185,66,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{fontSize:28,color:C.accent,marginBottom:16}}>✦</div>
      <h1 style={{fontSize:m?"30px":"clamp(36px,6vw,60px)",fontWeight:800,margin:"0 0 16px",lineHeight:1.1,letterSpacing:"-0.03em"}}>
        Track Your Growth.<br/><span style={{color:C.accent}}>Become Your Best Self.</span>
      </h1>
      <p style={{color:C.muted,fontSize:m?15:17,marginBottom:36,maxWidth:440,lineHeight:1.7}}>
        Personalised AI coaching, goal tracking, habit accountability, and daily check-ins.
      </p>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center",marginBottom:52}}>
        <button style={{...btn,padding:"12px 28px",fontSize:m?14:16}} onClick={()=>onNav("signup")}>Get Started — Free</button>
        <button style={{...btnGh,padding:"12px 28px",fontSize:m?14:16}} onClick={()=>onNav("login")}>Login</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(3,1fr)",gap:12,maxWidth:580,width:"100%"}}>
        {[{icon:"✦",t:"AI Coach",d:"Strategic plans for your real struggles"},{icon:"◈",t:"Habit Accountability",d:"Streak protection with weekly reviews"},{icon:"◷",t:"Daily Check-In",d:"Build the return habit — see your streak grow"}].map(f=>(
          <div key={f.t} style={{...card,textAlign:"left"}}>
            <div style={{color:C.accent,fontSize:16,marginBottom:7}}>{f.icon}</div>
            <div style={{fontWeight:700,marginBottom:3,fontSize:14}}>{f.t}</div>
            <div style={{color:C.muted,fontSize:13,lineHeight:1.6}}>{f.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function Auth({ mode, onAuth, onSwitch }) {
  const m = useIsMobile();
  const [form,    setForm]    = useState({name:"",email:"",password:""});
  const [err,     setErr]     = useState("");
  const [status,  setStatus]  = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setErr(""); setStatus("");
    if (mode==="signup" && !form.name.trim()) return setErr("Please enter your full name.");
    if (!form.email.includes("@")) return setErr("Enter a valid email address.");
    if (form.password.length < 6) return setErr("Password must be at least 6 characters.");
    setLoading(true);
    try {
      if (mode === "signup") {
        setStatus("Setting up your account…");
        const user = await db.signup(form.name, form.email, form.password);
        ls.set("ig_session", user); onAuth(user);
      } else {
        setStatus("Checking credentials…");
        const user = await db.login(form.email, form.password);
        ls.set("ig_session", user); onAuth(user);
      }
    } catch(e) { setErr(e.message || "Something went wrong. Try again."); }
    setLoading(false); setStatus("");
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans','Segoe UI',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:m?"16px":"24px"}}>
      <div style={{...card,width:"100%",maxWidth:370,padding:m?"22px 18px":"28px 26px"}}>
        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{fontSize:24,color:C.accent,marginBottom:10}}>✦</div>
          <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800}}>{mode==="login"?"Welcome back":"Join Ignite Growth"}</h2>
          <p style={{color:C.muted,fontSize:13,margin:0}}>{mode==="login"?"Your growth continues here.":"Start tracking. Start winning."}</p>
        </div>
        {mode==="signup" && <div style={{marginBottom:14}}><label style={lbl}>Full Name</label><input style={inp} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your full name"/></div>}
        <div style={{marginBottom:14}}><label style={lbl}>Email</label><input style={inp} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@email.com"/></div>
        <div style={{marginBottom:18}}><label style={lbl}>Password</label><input style={inp} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handle()}/></div>
        {err && <div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:8,padding:"10px 14px",color:C.danger,fontSize:13,marginBottom:14}}>{err}</div>}
        {status && <div style={{color:C.muted,fontSize:13,marginBottom:12,textAlign:"center"}}>{status}</div>}
        <button style={{...btn,width:"100%",padding:"12px",opacity:loading?0.6:1}} onClick={handle} disabled={loading}>
          {loading?"Please wait…":mode==="login"?"Login":"Create Account"}
        </button>
        <p style={{textAlign:"center",marginTop:16,color:C.muted,fontSize:13}}>
          {mode==="login"?"New? ":"Have an account? "}
          <span style={{color:C.accent,cursor:"pointer",fontWeight:600}} onClick={onSwitch}>{mode==="login"?"Sign up":"Login"}</span>
        </p>
        <div style={{marginTop:14,background:C.surface,borderRadius:8,padding:"10px 14px",border:`1px solid ${C.border}`,textAlign:"center"}}>
          <span style={{fontSize:12,color:C.muted}}>🌐 Works across all browsers & devices</span>
        </div>
      </div>
    </div>
  );
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
const NAV = [
  {id:"dashboard",label:"Home",    icon:"⊞"},
  {id:"growth",   label:"Coach",   icon:"✦"},
  {id:"goals",    label:"Goals",   icon:"◎"},
  {id:"habits",   label:"Habits",  icon:"◈"},
  {id:"journal",  label:"Journal", icon:"◷"},
  {id:"progress", label:"Progress",icon:"↗"},
  {id:"profile",  label:"Profile", icon:"○"},
];

function Sidebar({page,onNav,user,onLogout,onCheckin,streak,checkedIn}) {
  return (
    <div style={{width:215,minHeight:"100vh",background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
      <div style={{padding:"18px 16px 14px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{color:C.accent,fontSize:15,fontWeight:800}}>✦ Ignite Growth</div>
        <div style={{color:C.muted,fontSize:11,marginTop:2}}>Personal Development</div>
      </div>
      <nav style={{flex:1,padding:"10px 0"}}>
        {NAV.map(n=>{
          const a=page===n.id;
          return (
            <div key={n.id} onClick={()=>onNav(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",cursor:"pointer",marginRight:8,borderRadius:"0 8px 8px 0",background:a?C.accentDim:"transparent",color:a?C.accent:C.muted,borderLeft:a?`2px solid ${C.accent}`:"2px solid transparent",fontSize:14,fontWeight:a?600:400,transition:"all .15s"}}>
              <span>{n.icon}</span>{n.label}
            </div>
          );
        })}
      </nav>
      <div style={{padding:"12px 12px 18px",borderTop:`1px solid ${C.border}`}}>
        {streak>0 && (
          <div style={{background:C.accentDim,border:`1px solid ${C.accentBrd}`,borderRadius:8,padding:"8px 10px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>{streak>=14?"🏆":streak>=7?"🔥":"⚡"}</span>
            <div><div style={{fontSize:12,fontWeight:700,color:C.accent}}>{streak} day streak</div><div style={{fontSize:10,color:C.muted}}>daily check-ins</div></div>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div style={{width:26,height:26,borderRadius:"50%",background:C.accentDim,border:`1px solid ${C.accentBrd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.accent,flexShrink:0}}>
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div style={{overflow:"hidden",flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name.split(" ")[0]}</div>
            <div style={{fontSize:10,color:checkedIn?C.success:"#FBBF24"}}>{checkedIn?"✓ Checked in":"⚠ Pending"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button style={{...btnSm,flex:1,padding:"6px",fontSize:11}} onClick={onCheckin}>{checkedIn?"✓ Done":"Check-in"}</button>
          <button style={{...btnSm,padding:"6px 10px"}} onClick={onLogout}>Out</button>
        </div>
      </div>
    </div>
  );
}

function BottomNav({page,onNav}) {
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100}}>
      {NAV.slice(0,5).map(n=>{
        const a=page===n.id;
        return (
          <button key={n.id} onClick={()=>onNav(n.id)} style={{flex:1,border:"none",background:"none",cursor:"pointer",padding:"10px 4px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,color:a?C.accent:C.muted}}>
            <span style={{fontSize:18,lineHeight:1}}>{n.icon}</span>
            <span style={{fontSize:9,fontWeight:a?700:400}}>{n.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TopBar({page,user,onCheckin,onMore,streak,checkedIn}) {
  const cur = NAV.find(n=>n.id===page);
  return (
    <div style={{position:"sticky",top:0,zIndex:90,background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"11px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{color:C.accent}}>{cur?.icon}</span>
        <span style={{fontWeight:700,fontSize:16}}>{cur?.label==="Home"?"Dashboard":cur?.label}</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {streak>0 && (
          <div style={{display:"flex",alignItems:"center",gap:3,background:C.accentDim,border:`1px solid ${C.accentBrd}`,borderRadius:20,padding:"3px 9px"}}>
            <span style={{fontSize:11}}>{streak>=7?"🔥":"⚡"}</span>
            <span style={{fontSize:11,fontWeight:700,color:C.accent}}>{streak}d</span>
          </div>
        )}
        <button onClick={onCheckin} style={{...btnSm,padding:"5px 10px",borderColor:checkedIn?"rgba(74,222,128,.3)":C.border,color:checkedIn?C.success:C.muted,fontSize:11}}>
          {checkedIn?"✓ Done":"Check-in"}
        </button>
        <button onClick={onMore} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:22,padding:"0 2px",lineHeight:1}}>≡</button>
      </div>
    </div>
  );
}

function SideMenu({onNav,onLogout,user,onClose}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.6)"}} onClick={onClose}>
      <div style={{position:"absolute",top:0,right:0,bottom:0,width:255,background:C.surface,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"18px 16px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{color:C.accent,fontSize:14,fontWeight:800}}>✦ Ignite Growth</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:22}}>×</button>
        </div>
        <div style={{padding:"12px 0",flex:1,overflowY:"auto"}}>
          {NAV.map(n=>(
            <div key={n.id} onClick={()=>{onNav(n.id);onClose();}} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",cursor:"pointer",color:C.muted,fontSize:15}}>
              <span>{n.icon}</span><span>{n.label}</span>
            </div>
          ))}
        </div>
        <div style={{padding:"14px 16px",borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2}}>{user.name}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>{user.email}</div>
          <button onClick={onLogout} style={{...btnSm,width:"100%",padding:"8px",color:C.danger,borderColor:"rgba(248,113,113,0.3)"}}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}

// ── DAILY CHECK-IN ────────────────────────────────────────────────────────────
function DailyCheckIn({user,habits,aiSessions,onDismiss,onSaved}) {
  const m = useIsMobile();
  const yest = new Date(); yest.setDate(yest.getDate()-1); const ys=yest.toDateString();
  const yDone = habits.filter(h=>(h.completedDates||[]).includes(ys)).length;
  const yRate = habits.length ? Math.round((yDone/habits.length)*100) : null;
  const lastAct = aiSessions[0]?.data?.daily_actions?.[0];
  const [step,     setStep]     = useState(1);
  const [whatWent, setWhatWent] = useState("");
  const [blocker,  setBlocker]  = useState("");
  const [priority, setPriority] = useState("");
  const [energy,   setEnergy]   = useState("medium");
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const EN=[{v:"low",e:"🪫",l:"Low",c:C.danger},{v:"medium",e:"⚡",l:"Medium",c:C.accent},{v:"high",e:"🔥",l:"High",c:C.success}];

  const submit = async () => {
    setSaving(true);
    const entry = { date:todayStr(), whatWent, blocker, priority, energy, yestHabitRate:yRate };
    await db.addCheckin(user.id, entry);
    setSaved(true); onSaved(entry);
    setTimeout(onDismiss, 1400);
  };

  if (saved) return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:44,marginBottom:12}}>✦</div><div style={{fontSize:20,fontWeight:800,color:C.accent}}>Check-in saved.</div><div style={{color:C.muted,marginTop:6}}>Now go execute.</div></div>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:m?"flex-end":"center",justifyContent:"center",zIndex:300,padding:m?0:"24px"}}>
      <div style={{...card,width:"100%",maxWidth:490,borderColor:C.accentBrd,maxHeight:"92vh",overflowY:"auto",borderRadius:m?"16px 16px 0 0":"12px",padding:m?"20px 18px 32px":"24px 26px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div>
            <div style={{color:C.accent,fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:4}}>Daily Check-In · {new Date().toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"})}</div>
            <h2 style={{margin:0,fontSize:m?18:20,fontWeight:800}}>{step===1?"How did yesterday go?":"What's the plan?"}</h2>
          </div>
          <button onClick={onDismiss} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:22,padding:0}}>×</button>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:18}}>{[1,2].map(s=><div key={s} style={{flex:1,height:3,borderRadius:2,background:step>=s?C.accent:C.border}}/>)}</div>
        {step===1 && (
          <div>
            {habits.length>0 && yRate!==null && (
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginBottom:14}}>
                <div style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Yesterday's Habits</div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:26,fontWeight:800,color:yRate>=70?C.success:yRate>=40?C.accent:C.danger}}>{yRate}%</div>
                  <div><div style={{fontSize:14}}>{yDone}/{habits.length} done</div><div style={{fontSize:12,color:C.muted}}>{yRate===100?"Perfect.":yRate>=70?"Strong day.":yRate>=40?"Below target.":"Weak day."}</div></div>
                </div>
              </div>
            )}
            {lastAct && (
              <div style={{background:C.accentDim,border:`1px solid ${C.accentBrd}`,borderRadius:8,padding:"10px 14px",marginBottom:14}}>
                <div style={{fontSize:10,color:C.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Coach's Last Action</div>
                <div style={{fontSize:13,lineHeight:1.6}}>{lastAct}</div>
              </div>
            )}
            <div style={{marginBottom:13}}><label style={lbl}>What actually got done?</label><textarea style={{...inp,minHeight:72,resize:"vertical",lineHeight:1.65}} value={whatWent} onChange={e=>setWhatWent(e.target.value)} placeholder="What did you actually execute on?"/></div>
            <div style={{marginBottom:18}}><label style={lbl}>What blocked you?</label><textarea style={{...inp,minHeight:62,resize:"vertical",lineHeight:1.65}} value={blocker} onChange={e=>setBlocker(e.target.value)} placeholder="Distraction? Procrastination? Name it."/></div>
            <button style={{...btn,width:"100%"}} onClick={()=>setStep(2)}>Next → Set Today's Intention</button>
          </div>
        )}
        {step===2 && (
          <div>
            <div style={{marginBottom:16}}><label style={lbl}>Your #1 priority for today</label><input style={inp} value={priority} onChange={e=>setPriority(e.target.value)} placeholder="One thing. If only this gets done, today is a win." onKeyDown={e=>e.key==="Enter"&&priority.trim()&&submit()} autoFocus/><div style={{fontSize:12,color:C.muted,marginTop:5}}>One priority. Not a list. One thing.</div></div>
            <div style={{marginBottom:22}}>
              <label style={lbl}>Energy level?</label>
              <div style={{display:"flex",gap:8}}>
                {EN.map(e=><button key={e.v} onClick={()=>setEnergy(e.v)} style={{flex:1,padding:"9px 6px",border:`1px solid ${energy===e.v?e.c:C.border}`,borderRadius:8,background:energy===e.v?`${e.c}18`:"transparent",cursor:"pointer",color:energy===e.v?e.c:C.muted,fontWeight:energy===e.v?700:400,fontSize:m?12:14}}>{e.e} {e.l}</button>)}
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...btnGh,padding:"10px 14px"}} onClick={()=>setStep(1)}>← Back</button>
              <button style={{...btn,flex:1,opacity:saving?0.6:1}} onClick={submit} disabled={!priority.trim()||saving}>{saving?"Saving…":"Lock In & Start Day"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({user,goals,habits,checkins,aiSessions,onNav,streak,checkedIn}) {
  const m = useIsMobile();
  const today = todayStr();
  const doneT = habits.filter(h=>h.completedDates?.includes(today)).length;
  const hour  = new Date().getHours();
  const greet = hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const todayCI = checkins.find(c=>c.date===today);
  const pp = m?"16px 16px 100px":"28px 32px";

  return (
    <div style={{padding:pp,maxWidth:900}}>
      <div style={{marginBottom:20}}>
        <p style={{margin:"0 0 1px",color:C.muted,fontSize:13}}>{greet},</p>
        <h1 style={{margin:"0 0 2px",fontSize:m?22:28,fontWeight:800,letterSpacing:"-0.02em"}}>{user.name.split(" ")[0]} 👋</h1>
        <p style={{margin:0,color:C.muted,fontSize:12}}>{new Date().toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric"})}</p>
      </div>

      {checkedIn && todayCI?.priority ? (
        <div style={{background:C.accentDim,border:`1px solid ${C.accentBrd}`,borderRadius:10,padding:"12px 16px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div><div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:4}}>Today's #1 Priority</div><div style={{fontSize:15,fontWeight:700}}>{todayCI.priority}</div></div>
          {streak>0&&<div style={{textAlign:"center",background:"rgba(0,0,0,0.3)",borderRadius:8,padding:"5px 14px",flexShrink:0}}><div style={{fontSize:20,fontWeight:800,color:C.accent}}>{streak}</div><div style={{fontSize:10,color:C.muted}}>day streak</div></div>}
        </div>
      ) : !checkedIn && (
        <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:10,padding:"12px 16px",marginBottom:18}}>
          <div style={{fontSize:14,fontWeight:600,color:"#FBBF24",marginBottom:2}}>⚠ Daily check-in pending</div>
          <div style={{fontSize:13,color:C.muted}}>2 minutes to review yesterday and set today's priority.{streak>0?` Don't break your ${streak}-day streak.`:""}</div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:22}}>
        {[
          {label:"Streak",      val:streak||"—",sub:"check-ins",color:streak>=7?C.success:C.accent},
          {label:"Habits Today",val:`${doneT}/${habits.length}`,sub:"done today",color:C.accent},
          {label:"Active Goals",val:goals.filter(g=>g.progress<100).length,sub:"in progress",color:C.accent},
          {label:"Done Rate",   val:habits.length?`${Math.round((doneT/habits.length)*100)}%`:"—",sub:"today",color:C.accent},
        ].map(c=>(
          <div key={c.label} style={{...card,padding:m?"14px":"16px"}}>
            <div style={{color:C.muted,fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:8}}>{c.label}</div>
            <div style={{fontSize:m?26:30,fontWeight:800,color:c.color,letterSpacing:"-0.02em"}}>{c.val}</div>
            <div style={{color:C.muted,fontSize:11,marginTop:3}}>{c.sub}</div>
          </div>
        ))}
      </div>

      <h3 style={sh}>Quick Actions</h3>
      <div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(2,1fr)",gap:10,marginBottom:24}}>
        {[
          {icon:"✦",t:"Growth Space",d:"Get AI coaching for your struggles",p:"growth"},
          {icon:"◎",t:"Add a Goal",d:"Define a target and track progress",p:"goals"},
          {icon:"◈",t:"Add a Habit",d:"Build a discipline, track your streak",p:"habits"},
          {icon:"◷",t:"Journal",d:"Reflect on today and track your mood",p:"journal"},
        ].map(f=>(
          <div key={f.t} onClick={()=>onNav(f.p)} style={{...card,cursor:"pointer"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
            <div style={{color:C.accent,fontSize:16,marginBottom:6}}>{f.icon}</div>
            <div style={{fontWeight:600,marginBottom:3,fontSize:14}}>{f.t}</div>
            <div style={{color:C.muted,fontSize:12,lineHeight:1.5}}>{f.d}</div>
          </div>
        ))}
      </div>

      {goals.filter(g=>g.progress<100).length>0 && (
        <>
          <h3 style={sh}>Active Goals</h3>
          {goals.filter(g=>g.progress<100).slice(0,4).map(g=>(
            <div key={g.id} style={{...card,marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontWeight:500,fontSize:14}}>{g.title}</span><span style={{color:C.accent,fontWeight:700}}>{g.progress}%</span></div>
              <div style={{background:C.border,borderRadius:4,height:5}}><div style={{background:C.accent,borderRadius:4,height:5,width:`${g.progress}%`}}/></div>
            </div>
          ))}
        </>
      )}

      {habits.length>0 && (
        <>
          <h3 style={{...sh,marginTop:18}}>Today's Habits</h3>
          {habits.slice(0,6).map(h=>{
            const done=h.completedDates?.includes(today);
            return (
              <div key={h.id} style={{...card,marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${done?C.accent:C.border}`,background:done?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#0A0A0C",flexShrink:0}}>{done?"✓":""}</div>
                <span style={{flex:1,color:done?C.muted:C.text,textDecoration:done?"line-through":"none",fontSize:14}}>{h.name}</span>
                {h.streak>0&&<span style={{fontSize:11,color:C.muted}}>🔥{h.streak}d</span>}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── GROWTH SPACE ──────────────────────────────────────────────────────────────
function AddBtn({ label, icon, onClick, added }) {
  return (
    <button onClick={onClick} disabled={added} style={{background:added?"rgba(74,222,128,0.1)":C.accentDim,border:`1px solid ${added?"rgba(74,222,128,0.35)":C.accentBrd}`,borderRadius:6,padding:"3px 10px",cursor:added?"default":"pointer",fontSize:11,fontWeight:600,color:added?C.success:C.accent,transition:"all .15s",whiteSpace:"nowrap",flexShrink:0}}>
      {added ? "✓ Added" : `${icon} ${label}`}
    </button>
  );
}

function ChatBubble({ msg, onAddHabit, onAddGoal }) {
  const [addedHabits, setAddedHabits] = useState({});
  const [addedGoals,  setAddedGoals]  = useState({});
  const isCoach = msg.role === "coach";
  const bubbleStyle = {padding:"11px 14px",borderRadius:isCoach?"4px 12px 12px 12px":"12px 4px 12px 12px",fontSize:14,lineHeight:1.7,maxWidth:"84%",wordBreak:"break-word",background:isCoach?C.card:C.accent,border:isCoach?`1px solid ${C.border}`:"none",color:isCoach?C.text:"#0A0A0C"};
  const avStyle = {width:26,height:26,borderRadius:"50%",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,background:isCoach?"#1A1A20":C.accentDim,color:C.accent,border:isCoach?"none":`1px solid ${C.accentBrd}`};

  if (msg.type === "structured") {
    return (
      <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
        <div style={avStyle}>✦</div>
        <div style={{...bubbleStyle,maxWidth:"100%"}}>
          <div style={{marginBottom:14}}>
            <div style={{...sh,color:C.accent,margin:"0 0 6px"}}>🔍 Understanding Your Challenge</div>
            <p style={{margin:0,lineHeight:1.75,fontSize:14}}>{msg.data.understanding}</p>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:6}}>
              <div style={sh}>🧠 Strategy Plan</div>
              <span style={{fontSize:10,color:C.muted,fontStyle:"italic"}}>Tap to track as a goal</span>
            </div>
            {msg.data.strategy?.map((s,i)=>(
              <div key={i} style={{marginBottom:10,background:C.surface,borderRadius:8,padding:"9px 12px",border:`1px solid ${C.border}`}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:6}}>
                  <div style={{width:20,height:20,borderRadius:"50%",background:C.accentDim,border:`1px solid ${C.accentBrd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:C.accent,flexShrink:0}}>{i+1}</div>
                  <p style={{margin:0,lineHeight:1.6,flex:1,fontSize:13,paddingTop:1}}>{s}</p>
                </div>
                <div style={{display:"flex",justifyContent:"flex-end"}}><AddBtn label="Add as Goal" icon="◎" added={!!addedGoals[i]} onClick={()=>{onAddGoal(s);setAddedGoals(p=>({...p,[i]:true}));}}/></div>
              </div>
            ))}
          </div>
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:6}}>
              <div style={sh}>📅 Daily Actions</div>
              <span style={{fontSize:10,color:C.muted,fontStyle:"italic"}}>Tap to track as a habit</span>
            </div>
            {msg.data.daily_actions?.map((a,i)=>(
              <div key={i} style={{marginBottom:8,background:C.surface,borderRadius:8,padding:"9px 12px",border:`1px solid ${C.border}`}}>
                <div style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:6}}>
                  <span style={{color:C.success,fontWeight:700,fontSize:14,flexShrink:0}}>✓</span>
                  <p style={{margin:0,lineHeight:1.6,flex:1,fontSize:13}}>{a}</p>
                </div>
                <div style={{display:"flex",justifyContent:"flex-end"}}><AddBtn label="Add as Habit" icon="◈" added={!!addedHabits[i]} onClick={()=>{onAddHabit(a);setAddedHabits(p=>({...p,[i]:true}));}}/></div>
              </div>
            ))}
          </div>
          {msg.data.mindset_note && <div style={{background:"rgba(245,185,66,0.07)",borderLeft:`2px solid ${C.accentBrd}`,padding:"9px 12px",marginBottom:10}}><div style={{fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:C.accent,marginBottom:4}}>Mindset Note</div><p style={{margin:0,fontStyle:"italic",fontSize:13,lineHeight:1.65}}>{msg.data.mindset_note}</p></div>}
          {msg.data.followup && <p style={{margin:0,fontSize:13,color:C.muted,fontStyle:"italic",borderTop:`1px solid ${C.border}`,paddingTop:10}}>{msg.data.followup}</p>}
        </div>
      </div>
    );
  }
  return (
    <div style={{display:"flex",gap:8,alignItems:"flex-start",flexDirection:isCoach?"row":"row-reverse"}}>
      <div style={avStyle}>{isCoach?"✦":"J"}</div>
      <div style={bubbleStyle}>{msg.content}</div>
    </div>
  );
}

function GrowthSpace({user,aiSessions,onSessionSaved,onAddHabit,onAddGoal}) {
  const m = useIsMobile();
  const [view,       setView]      = useState("start");
  const [struggling, setStruggling]= useState("");
  const [improve,    setImprove]   = useState("");
  const [messages,   setMessages]  = useState([]);
  const [apiMsgs,    setApiMsgs]   = useState([]);
  const [input,      setInput]     = useState("");
  const [loading,    setLoading]   = useState(false);
  const [error,      setError]     = useState("");
  const [saved,      setSaved]     = useState(false);
  const [toast,      showToast]    = useToast();
  const pp = m?"16px 16px 100px":"28px 32px";

  const scrollToBottom = () => { setTimeout(()=>{ const el=document.getElementById("coach-chat-scroll"); if(el) el.scrollTop=el.scrollHeight; },80); };

  const handleAddHabit = useCallback((text) => {
    const name = text.replace(/^\d+[\.\)]\s*/,"").replace(/\(.*?\)/g,"").trim().slice(0,60);
    onAddHabit(name);
    showToast("◈ Added to Habits","habit");
  },[onAddHabit,showToast]);

  const handleAddGoal = useCallback((text) => {
    const title = text.replace(/^Step\s*\d+\s*[—\-:]\s*/i,"").replace(/\(.*?\)/g,"").trim().slice(0,70);
    onAddGoal(title);
    showToast("◎ Added to Goals","goal");
  },[onAddGoal,showToast]);

  const startSession = async () => {
    if (!struggling.trim()||!improve.trim()) return setError("Please fill in both fields.");
    setError(""); setLoading(true); setSaved(false);
    try {
      const ai = await callFirstResponse(struggling, improve, user.name);
      const userText = `What I am struggling with:\n${struggling}\n\nWhat I want to improve:\n${improve}`;
      const coachSummary = `Understanding: ${ai.understanding}\n\nStrategy: ${(ai.strategy||[]).join(" | ")}\n\nDaily actions: ${(ai.daily_actions||[]).join(" | ")}\n\nMindset: ${ai.mindset_note}\n\n${ai.followup||""}`;
      setMessages([{id:1,role:"coach",type:"structured",data:ai}]);
      setApiMsgs([{role:"user",content:`My name is ${user.name}.\n\n${userText}`},{role:"assistant",content:coachSummary}]);
      setView("chat"); scrollToBottom();
    } catch { setError("Coach unavailable. Check your connection and try again."); }
    setLoading(false);
  };

  const sendReply = async () => {
    if (!input.trim()||loading) return;
    const text=input.trim(); setInput(""); setLoading(true);
    const newApiMsgs=[...apiMsgs,{role:"user",content:text}];
    setMessages(prev=>[...prev,{id:Date.now(),role:"user",content:text}]);
    setApiMsgs(newApiMsgs); scrollToBottom();
    try {
      const reply=await callFollowUp(newApiMsgs);
      setMessages(prev=>[...prev,{id:Date.now()+1,role:"coach",content:reply}]);
      setApiMsgs([...newApiMsgs,{role:"assistant",content:reply}]); scrollToBottom();
    } catch { setMessages(prev=>[...prev,{id:Date.now()+2,role:"coach",content:"Something went wrong. Try again."}]); }
    setLoading(false);
  };

  const saveSession = async () => {
    if (saved||messages.length===0) return;
    const first=messages.find(m=>m.type==="structured"); if(!first) return;
    await db.addAISession(user.id, struggling, first.data, messages.length);
    onSessionSaved(); setSaved(true);
  };

  const newSession = () => { setView("start"); setMessages([]); setApiMsgs([]); setStruggling(""); setImprove(""); setInput(""); setError(""); setSaved(false); setLoading(false); };
  const CHIPS = ["That's harder than it sounds","I've tried this before and failed","What if I don't have time?","Give me the hardest truth"];

  return (
    <div style={{padding:pp,maxWidth:700}}>
      <Toast toast={toast}/>
      <style>{`@keyframes pulse{0%,80%,100%{opacity:0.3}40%{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
        <div>
          <h1 style={{margin:"0 0 4px",fontSize:m?21:24,fontWeight:800,letterSpacing:"-0.02em"}}>✦ Growth Space</h1>
          <p style={{color:C.muted,margin:0,fontSize:13}}>{view==="chat"?"Session live — tap any action to track it instantly.":"Be brutally honest. Get a real plan."}</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {view==="chat"&&<button onClick={saveSession} style={{...btnSm,borderColor:saved?C.success:C.border,color:saved?C.success:C.muted}}>{saved?"✓ Saved":"Save session"}</button>}
          {view!=="start"&&<button onClick={newSession} style={btnSm}>New session</button>}
          <button onClick={()=>setView(view==="history"?"start":"history")} style={{...btnSm,borderColor:view==="history"?C.accent:C.border,color:view==="history"?C.accent:C.muted}}>Past ({aiSessions.length})</button>
        </div>
      </div>

      {view==="start" && (
        <div style={card}>
          <div style={{marginBottom:14}}><label style={lbl}>What are you struggling with?</label><textarea style={{...inp,minHeight:88,resize:"vertical",lineHeight:1.65}} value={struggling} onChange={e=>setStruggling(e.target.value)} placeholder="Be specific. E.g. 'I keep procrastinating on my studies even though exams are close…'"/></div>
          <div style={{marginBottom:18}}><label style={lbl}>What do you want to improve?</label><textarea style={{...inp,minHeight:70,resize:"vertical",lineHeight:1.65}} value={improve} onChange={e=>setImprove(e.target.value)} placeholder="E.g. 'Study 3+ hours consistently every day…'"/></div>
          {error&&<div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:8,padding:"10px 14px",color:C.danger,fontSize:13,marginBottom:14}}>{error}</div>}
          <button style={{...btn,width:"100%",opacity:loading?0.6:1}} onClick={startSession} disabled={loading}>{loading?"Coach is analysing…":"→ Start Coaching Session"}</button>
          <p style={{margin:"12px 0 0",fontSize:12,color:C.muted,textAlign:"center"}}>Real back-and-forth coaching. Tap daily actions to add them to your habit tracker instantly.</p>
        </div>
      )}

      {view==="chat" && (
        <div style={{...card,padding:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div id="coach-chat-scroll" style={{flex:1,overflowY:"auto",padding:"16px 16px 8px",display:"flex",flexDirection:"column",gap:14,maxHeight:m?380:440}}>
            {messages.map(msg=><ChatBubble key={msg.id} msg={msg} onAddHabit={handleAddHabit} onAddGoal={handleAddGoal}/>)}
            {loading && (
              <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:"#1A1A20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.accent,flexShrink:0}}>✦</div>
                <div style={{padding:"11px 14px",borderRadius:"4px 12px 12px 12px",background:C.card,border:`1px solid ${C.border}`,display:"flex",gap:5,alignItems:"center"}}>
                  {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:C.muted,animation:`pulse 1.2s ${i*0.2}s ease-in-out infinite`}}/>)}
                </div>
              </div>
            )}
          </div>
          <div style={{padding:"8px 12px 4px",display:"flex",gap:6,flexWrap:"wrap",borderTop:`1px solid ${C.border}`}}>
            {CHIPS.map(c=><button key={c} onClick={()=>setInput(c)} disabled={loading} style={{...btnSm,fontSize:11,padding:"4px 10px",opacity:loading?0.4:1}}>{c}</button>)}
          </div>
          <div style={{display:"flex",gap:8,padding:"10px 12px",alignItems:"flex-end",borderTop:`1px solid ${C.border}`}}>
            <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendReply();}}} placeholder="Reply to your coach…" disabled={loading} style={{...inp,minHeight:38,maxHeight:100,resize:"none",lineHeight:1.5,flex:1,width:"auto",opacity:loading?0.6:1}}/>
            <button onClick={sendReply} disabled={loading||!input.trim()} style={{...btn,padding:"9px 16px",opacity:(loading||!input.trim())?0.4:1,flexShrink:0}}>↑</button>
          </div>
        </div>
      )}

      {view==="history" && (
        <div>
          {aiSessions.length===0?<div style={{...card,textAlign:"center",padding:52}}><div style={{fontSize:32,marginBottom:12,opacity:0.2}}>✦</div><p style={{color:C.muted,margin:0}}>No saved sessions yet.</p></div>
            :aiSessions.map(h=>(
              <div key={h.id} style={{...card,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:10}}>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{h.input?.slice(0,65)}…</div><div style={{fontSize:12,color:C.muted}}>{h.date} · {h.msg_count||1} message{h.msg_count!==1?"s":""}</div></div>
                </div>
                {h.data?.understanding&&<div style={{background:C.accentDim,border:`1px solid ${C.accentBrd}`,borderRadius:8,padding:"9px 12px",marginBottom:10}}><div style={{fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:C.accent,marginBottom:4}}>Understanding</div><p style={{margin:0,fontSize:13,lineHeight:1.65}}>{h.data.understanding}</p></div>}
                {h.data?.daily_actions&&<div>{h.data.daily_actions.map((a,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:6}}><span style={{color:C.success,fontWeight:700,fontSize:13,flexShrink:0}}>✓</span><p style={{margin:0,fontSize:13,lineHeight:1.6}}>{a}</p></div>)}</div>}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── GOALS ─────────────────────────────────────────────────────────────────────
function Goals({user,goals,onRefresh}) {
  const m = useIsMobile();
  const [form,   setForm]   = useState({title:"",progress:0});
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const pp = m?"16px 16px 100px":"28px 32px";

  const add = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await db.addGoal(user.id, form.title.trim(), parseInt(form.progress)||0);
    setForm({title:"",progress:0}); setAdding(false); setSaving(false); onRefresh();
  };
  const update = async (id, progress) => { await db.updateGoal(id, progress); onRefresh(); };
  const del    = async (id) => { await db.deleteGoal(id); onRefresh(); };

  const active=goals.filter(g=>g.progress<100), done=goals.filter(g=>g.progress>=100);

  return (
    <div style={{padding:pp,maxWidth:700}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div><h1 style={{margin:"0 0 3px",fontSize:m?22:26,fontWeight:800,letterSpacing:"-0.02em"}}>◎ Goals</h1><p style={{color:C.muted,margin:0,fontSize:13}}>Set targets. Track progress. Cross them off.</p></div>
        <button style={{...btn,padding:"9px 14px",fontSize:13}} onClick={()=>setAdding(!adding)}>+ New</button>
      </div>
      {adding&&(
        <div style={{...card,marginBottom:18,borderColor:C.accentBrd}}>
          <div style={{marginBottom:12}}><label style={lbl}>Goal Title</label><input style={inp} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="E.g. Score 300+ in JAMB, Read 10 books" onKeyDown={e=>e.key==="Enter"&&add()}/></div>
          <div style={{marginBottom:16}}><label style={lbl}>Starting Progress: {form.progress}%</label><input type="range" min="0" max="100" value={form.progress} onChange={e=>setForm({...form,progress:parseInt(e.target.value)})} style={{width:"100%",accentColor:C.accent}}/></div>
          <div style={{display:"flex",gap:10}}><button style={{...btn,opacity:saving?0.6:1}} onClick={add} disabled={saving}>{saving?"Saving…":"Save"}</button><button style={btnGh} onClick={()=>setAdding(false)}>Cancel</button></div>
        </div>
      )}
      {active.length===0&&!adding&&<div style={{...card,textAlign:"center",padding:52}}><div style={{fontSize:32,marginBottom:12,opacity:0.2}}>◎</div><p style={{color:C.muted,margin:0}}>No active goals. Set your first target.</p></div>}
      {active.length>0&&<><h3 style={sh}>Active ({active.length})</h3>{active.map(g=>(
        <div key={g.id} style={{...card,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontWeight:600,fontSize:14}}>{g.title}</span><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:C.accent,fontWeight:700}}>{g.progress}%</span><button onClick={()=>del(g.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:0}}>×</button></div></div>
          <div style={{background:C.border,borderRadius:4,height:6,marginBottom:10}}><div style={{background:C.accent,borderRadius:4,height:6,width:`${g.progress}%`,transition:"width .3s"}}/></div>
          <input type="range" min="0" max="100" value={g.progress} onChange={e=>update(g.id,parseInt(e.target.value))} style={{width:"100%",accentColor:C.accent,cursor:"pointer"}}/>
        </div>
      ))}</>}
      {done.length>0&&<><h3 style={{...sh,marginTop:22}}>Completed ({done.length})</h3>{done.map(g=>(
        <div key={g.id} style={{...card,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",opacity:0.7}}>
          <span style={{fontWeight:500,fontSize:14,textDecoration:"line-through"}}>{g.title}</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{color:C.success,fontSize:12,fontWeight:700}}>✓ Done</span><button onClick={()=>del(g.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:0}}>×</button></div>
        </div>
      ))}</>}
    </div>
  );
}

// ── HABITS ────────────────────────────────────────────────────────────────────
function WeeklyDots({h}) {
  const days=getLast7(),dates=h.completedDates||[],st=habitStatus(h);
  const dc=st==="broken"?C.danger:st==="at-risk"?"#F59E0B":C.accent;
  return (
    <div style={{display:"flex",gap:4}}>
      {days.map(d=>{const done=dates.includes(d.dateStr),iT=d.dateStr===todayStr();return(
        <div key={d.dateStr} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <div style={{width:20,height:20,borderRadius:"50%",background:done?dc:"transparent",border:`1.5px solid ${done?dc:iT?C.muted:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#0A0A0C"}}>{done?"✓":""}</div>
          <span style={{fontSize:8,color:iT?C.text:C.muted,fontWeight:iT?700:400}}>{d.label}</span>
        </div>
      );})}
    </div>
  );
}
function SBadge({status}) {
  const M={good:{l:"Done",bg:"rgba(74,222,128,0.1)",bd:"rgba(74,222,128,0.3)",c:C.success},pending:{l:"Pending",bg:"rgba(96,165,250,0.1)",bd:"rgba(96,165,250,0.3)",c:C.info},"at-risk":{l:"⚠ At risk",bg:"rgba(245,158,11,0.12)",bd:"rgba(245,158,11,0.35)",c:"#FBBF24"},broken:{l:"✕ Broken",bg:"rgba(248,113,113,0.1)",bd:"rgba(248,113,113,0.3)",c:C.danger}};
  const x=M[status]||M.pending;
  return <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.04em",background:x.bg,border:`1px solid ${x.bd}`,color:x.c,borderRadius:5,padding:"2px 7px"}}>{x.l}</span>;
}

function Habits({user,habits,onRefresh}) {
  const m = useIsMobile();
  const [name,   setName]   = useState("");
  const [adding, setAdding] = useState(false);
  const [tab,    setTab]    = useState("today");
  const today = todayStr();
  const pp = m?"16px 16px 100px":"28px 32px";

  const add = async () => {
    if (!name.trim()) return;
    await db.addHabit(user.id, name.trim());
    setName(""); setAdding(false); onRefresh();
  };
  const toggle = async (h) => {
    const dates = h.completedDates || [];
    const done  = dates.includes(today);
    const updated = done ? dates.filter(d=>d!==today) : [...dates, today];
    const streak  = calcStreak(updated);
    await db.updateHabit(h.id, updated, streak);
    onRefresh();
  };
  const del = async (id) => { await db.deleteHabit(id); onRefresh(); };

  const doneC  = habits.filter(h=>h.completedDates?.includes(today)).length;
  const atRisk = habits.filter(h=>{const s=habitStatus(h);return s==="at-risk"||s==="broken";});
  const wavg   = habits.length?Math.round(habits.reduce((a,h)=>a+weeklyRate(h).pct,0)/habits.length):0;
  const last7  = getLast7();
  const wtot   = last7.map(d=>({label:d.label,done:habits.filter(h=>(h.completedDates||[]).includes(d.dateStr)).length}));

  return (
    <div style={{padding:pp,maxWidth:760}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
        <div><h1 style={{margin:"0 0 3px",fontSize:m?22:26,fontWeight:800,letterSpacing:"-0.02em"}}>◈ Habits</h1><p style={{color:C.muted,margin:0,fontSize:13}}>Daily disciplines build extraordinary people.</p></div>
        <button style={{...btn,padding:"9px 12px",fontSize:13}} onClick={()=>setAdding(!adding)}>+ Add</button>
      </div>

      {atRisk.length>0&&(
        <div style={{background:"rgba(248,113,113,0.07)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:10,padding:"12px 14px",marginBottom:16,display:"flex",gap:12,alignItems:"flex-start"}}>
          <span style={{fontSize:16,flexShrink:0}}>⚠</span>
          <div><div style={{fontWeight:700,color:C.danger,marginBottom:5,fontSize:13}}>{atRisk.length} habit{atRisk.length>1?"s":""} need attention</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{atRisk.map(h=><span key={h.id} style={{fontSize:11,background:"rgba(248,113,113,0.12)",border:"1px solid rgba(248,113,113,0.2)",color:C.danger,borderRadius:4,padding:"2px 8px"}}>{h.name}</span>)}</div></div>
        </div>
      )}

      {habits.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
          {[{l:"Today",v:`${doneC}/${habits.length}`,s:"done",c:C.accent},{l:"This Week",v:`${wavg}%`,s:"avg",c:C.info}].map(x=>(
            <div key={x.l} style={{...card,textAlign:"center",padding:"13px 10px"}}><div style={{fontSize:24,fontWeight:800,color:x.c}}>{x.v}</div><div style={{color:C.muted,fontSize:11,marginTop:3}}>{x.l} · {x.s}</div></div>
          ))}
        </div>
      )}

      {habits.length>0&&<div style={{display:"flex",gap:8,marginBottom:16}}>{[{id:"today",l:"Today"},{id:"weekly",l:"Weekly Review"}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{...btnSm,borderColor:tab===t.id?C.accent:C.border,color:tab===t.id?C.accent:C.muted}}>{t.l}</button>)}</div>}

      {adding&&(
        <div style={{...card,marginBottom:16,borderColor:C.accentBrd}}>
          <label style={lbl}>New Habit</label>
          <div style={{display:"flex",gap:8,marginTop:6}}>
            <input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="E.g. Study 2 hrs, Read 30 pages, Exercise" onKeyDown={e=>e.key==="Enter"&&add()} autoFocus/>
            <button style={{...btn,padding:"11px 14px"}} onClick={add}>Add</button>
            <button style={{...btnGh,padding:"11px 12px"}} onClick={()=>setAdding(false)}>×</button>
          </div>
        </div>
      )}

      {habits.length===0&&!adding&&<div style={{...card,textAlign:"center",padding:52}}><div style={{fontSize:32,marginBottom:12,opacity:0.2}}>◈</div><p style={{color:C.muted,margin:0}}>No habits yet. Add your first discipline.</p></div>}

      {tab==="today"&&habits.map(h=>{
        const done=(h.completedDates||[]).includes(today),st=habitStatus(h),warn=st==="broken"||(st==="pending"&&!done&&h.streak>0);
        return (
          <div key={h.id} style={{...card,marginBottom:10,borderColor:warn&&!done?(st==="broken"?C.danger:"#854D0E"):C.border}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
              <button onClick={()=>toggle(h)} style={{width:28,height:28,borderRadius:"50%",flexShrink:0,marginTop:1,border:`2px solid ${done?C.accent:warn?C.danger:C.border}`,background:done?C.accent:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#0A0A0C"}}>
                {done?"✓":""}
              </button>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                  <span style={{fontWeight:600,fontSize:14,color:done?C.muted:C.text,textDecoration:done?"line-through":"none"}}>{h.name}</span>
                  <SBadge status={st}/>
                </div>
                <WeeklyDots h={h}/>
                <div style={{marginTop:6,fontSize:12,color:warn&&!done?C.danger:C.muted}}>
                  {st==="broken"&&!done&&"Streak broken. Start fresh today."}
                  {st==="at-risk"&&!done&&`Log now or lose your${h.streak>0?" "+h.streak+"-day":""} streak.`}
                  {st==="good"&&`🔥 ${h.streak} day streak — keep going.`}
                  {st==="pending"&&h.streak>0&&`🔥 ${h.streak}d — log before day ends.`}
                  {st==="pending"&&!h.streak&&"No streak yet — today is day 1."}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                <span style={{fontSize:11,color:C.muted}}>{h.completedDates?.length||0}×</span>
                <button onClick={()=>del(h.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16,padding:0}}>×</button>
              </div>
            </div>
          </div>
        );
      })}

      {tab==="weekly"&&habits.length>0&&(
        <div>
          <div style={{...card,marginBottom:16}}>
            <div style={sh}>Daily Completions — Last 7 Days</div>
            <div style={{display:"flex",gap:6,alignItems:"flex-end",height:66,marginBottom:8}}>
              {wtot.map((d,i)=>{const p=habits.length?d.done/habits.length:0,iT=i===6;return(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{fontSize:9,color:C.muted}}>{d.done||""}</div>
                  <div style={{width:"100%",height:50,display:"flex",alignItems:"flex-end",background:C.border,borderRadius:4,overflow:"hidden"}}>
                    <div style={{width:"100%",height:`${p*100}%`,background:iT?C.accent:C.info,borderRadius:4,minHeight:p>0?3:0}}/>
                  </div>
                  <div style={{fontSize:9,color:iT?C.text:C.muted,fontWeight:iT?700:400}}>{d.label}</div>
                </div>
              );})}
            </div>
          </div>
          {habits.map(h=>{const r=weeklyRate(h),st=habitStatus(h),bc=r.pct>=71?C.success:r.pct>=43?C.accent:C.danger;return(
            <div key={h.id} style={{...card,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div><div style={{fontWeight:600,fontSize:14,marginBottom:5}}>{h.name}</div><SBadge status={st}/></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:800,color:bc}}>{r.pct}%</div><div style={{fontSize:11,color:C.muted}}>{r.done}/7 days</div></div>
              </div>
              <div style={{background:C.border,borderRadius:4,height:5,marginBottom:10}}><div style={{background:bc,borderRadius:4,height:5,width:`${r.pct}%`}}/></div>
              <WeeklyDots h={h}/>
              <div style={{marginTop:7,fontSize:12,color:C.muted}}>
                {r.pct===100&&"Perfect week."}{r.pct>=71&&r.pct<100&&"Strong — keep building."}{r.pct>=43&&r.pct<71&&"Inconsistent. Still deciding if this matters."}{r.pct>0&&r.pct<43&&"Almost nonexistent. Are you committed?"}{r.pct===0&&"Zero days. Commit or remove it."}
              </div>
            </div>
          );})}
          <div style={{marginTop:16,background:wavg>=70?C.accentDim:"rgba(248,113,113,0.06)",border:`1px solid ${wavg>=70?C.accentBrd:"rgba(248,113,113,0.2)"}`,borderRadius:10,padding:"14px 16px"}}>
            <div style={{fontWeight:700,color:wavg>=70?C.accent:C.danger,marginBottom:5}}>Weekly verdict: {wavg}%</div>
            <p style={{margin:0,color:C.muted,fontSize:13,lineHeight:1.7}}>
              {wavg>=85&&"Exceptional."}{wavg>=70&&wavg<85&&"Solid — don't let complacency creep in."}{wavg>=50&&wavg<70&&"Mediocre. Enough to feel busy — not enough to change."}{wavg>=1&&wavg<50&&"Intentions don't build people. Execution does."}{wavg===0&&"No completions. A choice — so is changing it."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── JOURNAL ───────────────────────────────────────────────────────────────────
function Journal({user,journal,onRefresh}) {
  const m = useIsMobile();
  const [content,setContent]=useState("");
  const [mood,   setMood]   =useState("neutral");
  const pp = m?"16px 16px 100px":"28px 32px";
  const MO=[{v:"happy",e:"😊",l:"Happy",c:C.success},{v:"neutral",e:"😐",l:"Neutral",c:C.accent},{v:"sad",e:"😔",l:"Low",c:C.info}];
  const save=async()=>{if(!content.trim())return;await db.addJournal(user.id,content.trim(),mood);setContent("");onRefresh();};
  const del=async(id)=>{await db.deleteJournal(id);onRefresh();};
  return (
    <div style={{padding:pp,maxWidth:700}}>
      <h1 style={{margin:"0 0 4px",fontSize:m?22:26,fontWeight:800,letterSpacing:"-0.02em"}}>◷ Journal</h1>
      <p style={{color:C.muted,margin:"0 0 20px",fontSize:13}}>Reflection is how growth becomes permanent.</p>
      <div style={{...card,marginBottom:22}}>
        <div style={{marginBottom:14}}>
          <label style={lbl}>How are you feeling?</label>
          <div style={{display:"flex",gap:8,marginTop:6}}>{MO.map(mo=><button key={mo.v} onClick={()=>setMood(mo.v)} style={{flex:1,padding:"9px 6px",border:`1px solid ${mood===mo.v?mo.c:C.border}`,borderRadius:8,background:mood===mo.v?`${mo.c}18`:"transparent",cursor:"pointer",color:mood===mo.v?mo.c:C.muted,fontWeight:mood===mo.v?700:400,fontSize:m?12:14}}>{mo.e} {mo.l}</button>)}</div>
        </div>
        <div style={{marginBottom:14}}><label style={lbl}>Today's Reflection</label><textarea style={{...inp,minHeight:105,resize:"vertical",lineHeight:1.7}} value={content} onChange={e=>setContent(e.target.value)} placeholder="What happened? What challenged you? What are you grateful for?"/></div>
        <button style={{...btn,width:"100%"}} onClick={save}>Save Entry</button>
      </div>
      {journal.length===0&&<div style={{...card,textAlign:"center",padding:44,opacity:0.6}}><div style={{fontSize:28,marginBottom:8}}>◷</div><p style={{color:C.muted,margin:0}}>No entries yet.</p></div>}
      {journal.map(e=>{const mo=MO.find(x=>x.v===e.mood)||MO[1];return(
        <div key={e.id} style={{...card,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:15}}>{mo.e}</span><span style={{fontSize:11,fontWeight:700,color:mo.c,textTransform:"uppercase",letterSpacing:"0.05em"}}>{mo.l}</span></div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{color:C.muted,fontSize:12}}>{e.date}</span><button onClick={()=>del(e.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>×</button></div>
          </div>
          <p style={{margin:0,lineHeight:1.75,fontSize:14}}>{e.content}</p>
        </div>
      );})}
    </div>
  );
}

// ── PROGRESS ──────────────────────────────────────────────────────────────────
function Progress({habits,goals,journal,aiSessions,checkins}) {
  const m = useIsMobile();
  const pp = m?"16px 16px 100px":"28px 32px";
  const streak = getEngagementStreak(checkins);
  const hChart=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const ds=d.toDateString();return{day:d.toLocaleDateString("en",{weekday:"short"}),done:habits.filter(h=>h.completedDates?.includes(ds)).length};});
  const gChart=goals.slice(0,8).map(g=>({name:g.title.length>14?g.title.slice(0,14)+"…":g.title,progress:g.progress}));
  const mMap={happy:3,neutral:2,sad:1};
  const mChart=journal.slice(0,14).reverse().map((e,i)=>({day:`#${i+1}`,mood:mMap[e.mood]||2,label:e.date}));
  const TT=({...p})=><Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}} {...p}/>;
  return (
    <div style={{padding:pp,maxWidth:800}}>
      <h1 style={{margin:"0 0 4px",fontSize:m?22:26,fontWeight:800,letterSpacing:"-0.02em"}}>↗ Progress</h1>
      <p style={{color:C.muted,margin:"0 0 22px",fontSize:13}}>Your growth story in data.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:22}}>
        {[{l:"Goals Done",v:goals.filter(g=>g.progress>=100).length,c:C.success},{l:"Habits",v:habits.length,c:C.accent},{l:"Journal",v:journal.length,c:C.info},{l:"Day Streak",v:streak,c:streak>=7?C.success:C.accent}].map(x=>(
          <div key={x.l} style={{...card,textAlign:"center",padding:"14px"}}><div style={{fontSize:26,fontWeight:800,color:x.c}}>{x.v}</div><div style={{color:C.muted,fontSize:12,marginTop:5}}>{x.l}</div></div>
        ))}
      </div>
      <div style={{...card,marginBottom:16}}>
        <h3 style={sh}>Habit Completions — Last 7 Days</h3>
        {habits.length===0?<div style={{textAlign:"center",padding:"24px 0",color:C.muted,fontSize:13}}>Add habits to see chart</div>:(
          <ResponsiveContainer width="100%" height={170}><BarChart data={hChart} margin={{top:4,right:4,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/><XAxis dataKey="day" stroke={C.muted} fontSize={11} tickLine={false}/><YAxis stroke={C.muted} fontSize={11} tickLine={false} allowDecimals={false}/><TT formatter={v=>[v,"Done"]}/><Bar dataKey="done" fill={C.accent} radius={[4,4,0,0]} maxBarSize={34}/></BarChart></ResponsiveContainer>
        )}
      </div>
      {gChart.length>0&&(
        <div style={{...card,marginBottom:16}}>
          <h3 style={sh}>Goal Progress</h3>
          <ResponsiveContainer width="100%" height={Math.max(130,gChart.length*32)}><BarChart data={gChart} layout="vertical" margin={{top:0,right:34,left:6,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/><XAxis type="number" domain={[0,100]} stroke={C.muted} fontSize={11} tickLine={false} tickFormatter={v=>`${v}%`}/><YAxis dataKey="name" type="category" stroke={C.muted} fontSize={11} tickLine={false} width={m?90:120}/><TT formatter={v=>[`${v}%`,"Progress"]}/><Bar dataKey="progress" fill={C.info} radius={[0,4,4,0]} maxBarSize={16}/></BarChart></ResponsiveContainer>
        </div>
      )}
      {mChart.length>0&&(
        <div style={card}>
          <h3 style={sh}>Mood Trend</h3>
          <ResponsiveContainer width="100%" height={145}><LineChart data={mChart} margin={{top:4,right:4,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/><XAxis dataKey="day" stroke={C.muted} fontSize={11} tickLine={false}/><YAxis domain={[0.5,3.5]} ticks={[1,2,3]} stroke={C.muted} fontSize={11} tickLine={false} tickFormatter={v=>v===3?"😊":v===2?"😐":"😔"}/><TT formatter={v=>[v===3?"Happy":v===2?"Neutral":"Low","Mood"]} labelFormatter={(_,p)=>p?.[0]?.payload?.label||""}/><Line type="monotone" dataKey="mood" stroke={C.accent} strokeWidth={2} dot={{fill:C.accent,r:3}} activeDot={{r:5}}/></LineChart></ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── PROFILE ───────────────────────────────────────────────────────────────────
function Profile({user,goals,habits,journal,aiSessions,checkins,onLogout}) {
  const m = useIsMobile();
  const streak = getEngagementStreak(checkins);
  const pp = m?"16px 16px 100px":"28px 32px";
  return (
    <div style={{padding:pp,maxWidth:560}}>
      <h1 style={{margin:"0 0 22px",fontSize:m?22:26,fontWeight:800,letterSpacing:"-0.02em"}}>○ Profile</h1>
      <div style={{...card,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
          <div style={{width:50,height:50,borderRadius:"50%",background:C.accentDim,border:`2px solid ${C.accentBrd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:C.accent}}>{user.name[0].toUpperCase()}</div>
          <div><div style={{fontWeight:700,fontSize:17}}>{user.name}</div><div style={{color:C.muted,fontSize:13,marginTop:2}}>{user.email}</div><div style={{color:C.success,fontSize:12,marginTop:3,fontWeight:600}}>● Active</div></div>
        </div>
        {streak>0&&<div style={{background:C.accentDim,border:`1px solid ${C.accentBrd}`,borderRadius:8,padding:"9px 12px",marginBottom:14,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>{streak>=14?"🏆":streak>=7?"🔥":"⚡"}</span><div><div style={{fontWeight:700,color:C.accent,fontSize:14}}>{streak} day streak</div><div style={{fontSize:12,color:C.muted}}>{streak>=7?"Building real consistency.":streak>0?"Keep showing up.":"Start today."}</div></div></div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
          {[{l:"Goals Set",v:goals.length},{l:"Completed",v:goals.filter(g=>g.progress>=100).length},{l:"Habits",v:habits.length},{l:"Journal",v:journal.length},{l:"AI Sessions",v:aiSessions.length},{l:"Day Streak",v:streak}].map(x=>(
            <div key={x.l} style={{background:C.surface,borderRadius:8,padding:"11px 13px",border:`1px solid ${C.border}`}}><div style={{color:C.muted,fontSize:11,marginBottom:4}}>{x.l}</div><div style={{fontWeight:700,fontSize:20,color:C.accent}}>{x.v}</div></div>
          ))}
        </div>
      </div>
      <div style={{...card,marginBottom:14}}>
        <h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:700}}>Account</h3>
        <div style={{fontSize:13,color:C.muted,lineHeight:1.8}}>
          <div><strong style={{color:C.text}}>Name:</strong> {user.name}</div>
          <div><strong style={{color:C.text}}>Email:</strong> {user.email}</div>
          <div style={{marginTop:8,fontSize:12,color:C.success}}>🌐 Account synced across all browsers & devices</div>
        </div>
      </div>
      <button onClick={onLogout} style={{...btn,background:"rgba(248,113,113,.15)",color:C.danger,border:"1px solid rgba(248,113,113,.3)"}}>Sign Out</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP SHELL — loads all data centrally
// ══════════════════════════════════════════════════════════════════════════════
export default function IgniteGrowth() {
  const m = useIsMobile();
  const [user,        setUser]        = useState(()=>ls.get("ig_session"));
  const [authMode,    setAuthMode]    = useState("login");
  const [pubPage,     setPubPage]     = useState("landing");
  const [appPage,     setAppPage]     = useState("dashboard");
  const [showCheckin, setShowCheckin] = useState(false);
  const [showMenu,    setShowMenu]    = useState(false);

  // ── CENTRAL DATA STATE ────────────────────────────────────────────────────
  const [goals,      setGoals]      = useState([]);
  const [habits,     setHabits]     = useState([]);
  const [journal,    setJournal]    = useState([]);
  const [aiSessions, setAiSessions] = useState([]);
  const [checkins,   setCheckins]   = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const loadAll = useCallback(async (uid) => {
    const [g,h,j,ai,ci] = await Promise.all([
      db.getGoals(uid), db.getHabits(uid), db.getJournal(uid),
      db.getAISessions(uid), db.getCheckins(uid),
    ]);
    setGoals(g); setHabits(h); setJournal(j); setAiSessions(ai); setCheckins(ci);
    setDataLoaded(true);
  },[]);

  const refreshGoals      = useCallback(()=>db.getGoals(user?.id).then(setGoals),[user]);
  const refreshHabits     = useCallback(()=>db.getHabits(user?.id).then(setHabits),[user]);
  const refreshJournal    = useCallback(()=>db.getJournal(user?.id).then(setJournal),[user]);
  const refreshAiSessions = useCallback(()=>db.getAISessions(user?.id).then(setAiSessions),[user]);
  const refreshCheckins   = useCallback(()=>db.getCheckins(user?.id).then(setCheckins),[user]);

  const login = useCallback(async (u) => {
    setUser(u);
    await loadAll(u.id);
    const cis = await db.getCheckins(u.id);
    if (!hasCheckedInToday(cis)) setShowCheckin(true);
  },[loadAll]);

  const logout = useCallback(()=>{
    ls.del("ig_session"); setUser(null);
    setGoals([]); setHabits([]); setJournal([]); setAiSessions([]); setCheckins([]);
    setDataLoaded(false); setPubPage("landing"); setAppPage("dashboard"); setShowCheckin(false);
  },[]);

  useEffect(()=>{ if(user) loadAll(user.id); },[]);

  // ── ADD HABIT/GOAL from AI coach ──────────────────────────────────────────
  const handleAddHabitFromAI = useCallback(async (name) => {
    const existing = habits.find(h=>h.name.toLowerCase()===name.toLowerCase());
    if (existing) return;
    await db.addHabit(user.id, name);
    refreshHabits();
  },[habits,user,refreshHabits]);

  const handleAddGoalFromAI = useCallback(async (title) => {
    const existing = goals.find(g=>g.title.toLowerCase()===title.toLowerCase());
    if (existing) return;
    await db.addGoal(user.id, title, 0);
    refreshGoals();
  },[goals,user,refreshGoals]);

  const streak    = getEngagementStreak(checkins);
  const checkedIn = hasCheckedInToday(checkins);

  if (!user) {
    if (pubPage==="login"||pubPage==="signup")
      return <Auth mode={authMode} onAuth={login} onSwitch={()=>{const n=authMode==="login"?"signup":"login";setAuthMode(n);setPubPage(n);}}/>;
    return <Landing onNav={p=>{setPubPage(p);setAuthMode(p);}}/>;
  }

  if (!dataLoaded) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{color:C.accent,fontSize:32,marginBottom:16}}>✦</div>
        <div style={{color:C.muted,fontSize:14}}>Loading your data…</div>
      </div>
    </div>
  );

  const PAGES = {
    dashboard: <Dashboard user={user} goals={goals} habits={habits} checkins={checkins} aiSessions={aiSessions} onNav={setAppPage} streak={streak} checkedIn={checkedIn}/>,
    growth:    <GrowthSpace user={user} aiSessions={aiSessions} onSessionSaved={refreshAiSessions} onAddHabit={handleAddHabitFromAI} onAddGoal={handleAddGoalFromAI}/>,
    goals:     <Goals user={user} goals={goals} onRefresh={refreshGoals}/>,
    habits:    <Habits user={user} habits={habits} onRefresh={refreshHabits}/>,
    journal:   <Journal user={user} journal={journal} onRefresh={refreshJournal}/>,
    progress:  <Progress habits={habits} goals={goals} journal={journal} aiSessions={aiSessions} checkins={checkins}/>,
    profile:   <Profile user={user} goals={goals} habits={habits} journal={journal} aiSessions={aiSessions} checkins={checkins} onLogout={logout}/>,
  };

  return (
    <div style={{display:"flex",minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      {showCheckin && (
        <DailyCheckIn
          user={user} habits={habits} aiSessions={aiSessions}
          onDismiss={()=>setShowCheckin(false)}
          onSaved={()=>refreshCheckins()}
        />
      )}
      {showMenu && <SideMenu onNav={setAppPage} onLogout={logout} user={user} onClose={()=>setShowMenu(false)}/>}
      {!m && <Sidebar page={appPage} onNav={setAppPage} user={user} onLogout={logout} onCheckin={()=>setShowCheckin(true)} streak={streak} checkedIn={checkedIn}/>}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {m && <TopBar page={appPage} user={user} onCheckin={()=>setShowCheckin(true)} onMore={()=>setShowMenu(true)} streak={streak} checkedIn={checkedIn}/>}
        <main style={{flex:1,overflowY:"auto"}}>{PAGES[appPage]}</main>
        {m && <BottomNav page={appPage} onNav={setAppPage}/>}
      </div>
    </div>
  );
}