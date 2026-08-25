import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import Chart from "chart.js/auto";
import "./styles.css";

const cfg = await fetch("/api/config").then(r => r.json()).catch(() => ({
  maxFileMb: 25,
  plans: {
    anonymous: { limit: 50, windowHours: 72 },
    free: { limit: 200, windowHours: 24 },
    supreme: { limit: 25000, windowHours: 720 },
    premier: { limit: 50000, windowHours: 720 }
  }
}));

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const appUrl = (
  import.meta.env.VITE_APP_URL || window.location.origin
).replace(/\/$/, "");

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

const state = {
  session: null,
  account: null,
  headers: [],
  rows: [],
  processed: [],
  domains: {},
  charts: {},
  config: cfg
};

document.querySelector("#app").innerHTML = `
<div class="shell">
  <header class="topbar">
    <div>
      <div class="eyebrow">SECURE DATA VALIDATION</div>
      <h1>USA Validator</h1>
      <p class="muted">Simple Render deployment • Browser-side file processing • No raw uploads stored</p>
    </div>
    <div class="account-box">
      <div id="accountStatus">Anonymous</div>
      <div id="magicLogin" class="magic-login">
        <input id="emailInput" type="email" autocomplete="email" placeholder="Enter your email">
        <button id="loginBtn" class="btn primary">Email me a sign-in link</button>
      </div>
      <button id="logoutBtn" class="btn secondary hidden">Sign out</button>
      <div id="loginMessage" class="muted small"></div>
    </div>
  </header>

  <section class="grid stats-grid">
    <div class="card"><span>Plan</span><strong id="plan">Anonymous</strong></div>
    <div class="card"><span>Email credits</span><strong id="credits">50</strong></div>
    <div class="card"><span>Window</span><strong id="window">72 hours</strong></div>
    <div class="card"><span>Max file</span><strong>${cfg.maxFileMb} MB</strong></div>
  </section>

  <section id="guestPanel" class="card access-panel guest-panel">
    <div class="access-icon">GUEST</div>
    <div>
      <h2>Anonymous validation</h2>
      <p class="muted">You can validate up to <strong>50 emails</strong> in a rolling 72-hour window without creating an account.</p>
    </div>
    <div class="access-note">Sign in by email to unlock the 200-email Free tier.</div>
  </section>

  <section id="memberPanel" class="card access-panel member-panel hidden">
    <div class="member-top">
      <div>
        <div class="eyebrow">AUTHENTICATED ACCOUNT</div>
        <h2>Welcome back, <span id="memberName">Member</span></h2>
        <p id="memberEmail" class="muted">—</p>
      </div>
      <span id="memberPlanBadge" class="plan-badge">FREE</span>
    </div>
    <div class="member-grid">
      <div>
        <span class="label">Remaining credits</span>
        <strong id="memberCredits">200</strong>
      </div>
      <div>
        <span class="label">Usage window</span>
        <strong id="memberWindow">24 hours</strong>
      </div>
      <div>
        <span class="label">Account status</span>
        <strong class="status-good">Authenticated</strong>
      </div>
    </div>
    <div class="quota-track"><div id="memberQuotaBar"></div></div>
    <div class="member-actions">
      <span id="memberPlanHelp" class="muted small">Your Free account is protected by server-side quota enforcement.</span>
      <button id="memberSignOut" class="btn secondary">Sign out</button>
    </div>
  </section>

  <section class="card upload-card">
    <div id="dropZone" class="dropzone">
      <div class="upload-icon">↑</div>
      <h2>Upload CSV or Excel</h2>
      <p>Files are processed locally in your browser. They are not uploaded to the server.</p>
      <p id="uploadHint" class="small muted">Anonymous mode • 50 emails in a rolling 72-hour window.</p>
      <input id="fileInput" type="file" accept=".csv,.xlsx,.xls" hidden>
      <button id="chooseBtn" class="btn primary">Choose File</button>
      <div id="fileInfo" class="muted small"></div>
    </div>
  </section>

  <section id="memberFeatures" class="card feature-panel hidden">
    <div class="section-head">
      <div>
        <div class="eyebrow">MEMBER FEATURES</div>
        <h2>Authenticated processing</h2>
        <p class="muted">Your account unlocks the higher Free quota. Paid plans use the same secure account system.</p>
      </div>
    </div>
    <div class="feature-grid">
      <div><b>200</b><span>Free emails / 24h</span></div>
      <div><b>25,000</b><span>Supreme / month</span></div>
      <div><b>50,000</b><span>Premier / month</span></div>
      <div><b>Local</b><span>File processing</span></div>
    </div>
  </section>

  <section id="mapper" class="card hidden">
    <div class="section-head"><div><h2>1. Map columns</h2><p class="muted">Auto-detected where possible. Bypass fields you do not have.</p></div></div>
    <div class="map-grid" id="mapGrid"></div>
    <div class="toggle-grid">
      <label><input id="geo" type="checkbox" checked> ZIP / geographic check</label>
      <label><input id="mx" type="checkbox" checked> Email DNS MX check</label>
      <label><input id="spam" type="checkbox" checked> Disposable email check</label>
      <label><input id="phone" type="checkbox" checked> Phone area-code check</label>
      <label><input id="identity" type="checkbox"> SSN/DL format checks</label>
      <label><input id="finance" type="checkbox"> Bank/routing format checks</label>
    </div>
    <button id="runBtn" class="btn primary wide">Run Validation</button>
    <div id="progressWrap" class="hidden">
      <div class="progress"><div id="progress"></div></div>
      <div id="progressText" class="muted small">Preparing…</div>
    </div>
  </section>

  <section class="grid dashboard-grid">
    <div class="card"><h3>Rows processed</h3><div id="total" class="big">0</div></div>
    <div class="card"><h3>Average trust</h3><div id="avg" class="big">0%</div></div>
    <div class="card"><h3>Issues</h3><div id="issues" class="big">0</div></div>
  </section>

  <section class="grid chart-grid">
    <div class="card chart-card"><h3>Trust distribution</h3><canvas id="barChart"></canvas></div>
    <div class="card chart-card"><h3>Component health</h3><canvas id="radarChart"></canvas></div>
    <div class="card chart-card"><h3>Top email domains</h3><canvas id="pieChart"></canvas></div>
  </section>

  <section class="card">
    <div class="section-head"><div><h2>Export</h2><p class="muted">Select domains to export validated rows as Excel.</p></div></div>
    <div id="domains" class="domain-list"><div class="muted">No processed data yet.</div></div>
    <button id="exportBtn" class="btn secondary" disabled>Export Selected Domains</button>
  </section>

  <section class="card plans">
    <h2>Plans</h2>
    <div class="grid plan-grid">
      <div><b>Anonymous</b><span>50 emails / rolling 72 hours</span></div>
      <div><b>Free + Email</b><span>200 emails / rolling 24 hours</span></div>
      <div><b>Supreme</b><span>25,000 email credits / month</span></div>
      <div><b>Premier</b><span>50,000 email credits / month</span></div>
    </div>
    <p class="muted small">Paid plan assignment is server-side. Connect your billing provider later without changing the validation engine.</p>
  </section>

  <footer class="muted small footer">USA Validator • Render-ready • v26</footer>
</div>
`;

const $ = (s) => document.querySelector(s);

function setAccount(account) {
  state.account = account;
  const authenticated = !!account?.authenticated;
  const planName = authenticated ? account.plan : "anonymous";
  const quota = account.quota || {
    limit: authenticated ? 200 : 50,
    used: 0,
    remaining: authenticated ? 200 : 50,
    windowHours: authenticated ? 24 : 72
  };

  $("#accountStatus").textContent = authenticated
    ? (account.user?.name || account.user?.email || "Authenticated user")
    : "Anonymous";

  $("#magicLogin").classList.toggle("hidden", authenticated);
  $("#logoutBtn").classList.toggle("hidden", !authenticated);
  $("#guestPanel").classList.toggle("hidden", authenticated);
  $("#memberPanel").classList.toggle("hidden", !authenticated);
  $("#memberFeatures").classList.toggle("hidden", !authenticated);

  if (authenticated) {
    const name = account.user?.name || "Member";
    const email = account.user?.email || "";
    const planLabel = planName === "supreme" ? "SUPREME" :
      planName === "premier" ? "PREMIER" : "FREE";

    $("#memberName").textContent = name;
    $("#memberEmail").textContent = email;
    $("#memberPlanBadge").textContent = planLabel;
    $("#memberCredits").textContent = quota.remaining.toLocaleString();
    $("#memberWindow").textContent = quota.windowHours === 720 ? "Monthly" : `${quota.windowHours} hours`;

    const limit = Math.max(1, Number(quota.limit || 200));
    const used = Math.max(0, Number(quota.used || 0));
    const usedPct = Math.min(100, Math.round((used / limit) * 100));
    $("#memberQuotaBar").style.width = `${usedPct}%`;

    $("#memberPlanHelp").textContent =
      planName === "free"
        ? "Free authenticated account • 200 emails in a rolling 24-hour window."
        : `${planLabel} account • ${limit.toLocaleString()} email credits per monthly period.`;
  }

  $("#plan").textContent = planName === "anonymous"
    ? "Anonymous"
    : planName.charAt(0).toUpperCase() + planName.slice(1);

  $("#credits").textContent = quota.remaining.toLocaleString();
  $("#window").textContent = quota.windowHours === 720
    ? "Monthly"
    : `${quota.windowHours} hours`;

  const uploadHint = document.querySelector("#uploadHint");
  if (uploadHint) {
    uploadHint.textContent = authenticated
      ? `Authenticated ${planName} account • ${quota.remaining.toLocaleString()} email credits remaining.`
      : "Anonymous mode • 50 emails in a rolling 72-hour window.";
  }
}
async function refreshAccount() {
  if (!state.session?.access_token) {
    setAccount({ authenticated: false, plan: "anonymous", quota: { limit: 50, used: 0, remaining: 50, windowHours: 72 } });
    return;
  }
  const r = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${state.session.access_token}` }
  });
  if (r.ok) {
    setAccount(await r.json());
  } else {
    await supabase?.auth.signOut();
    setAccount({
      authenticated: false,
      plan: "anonymous",
      quota: { limit: 50, used: 0, remaining: 50, windowHours: 72 }
    });
  }
}

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;

    if (session && window.location.hash) {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search
      );
    }

    refreshAccount();
  });
  const { data } = await supabase.auth.getSession();
  state.session = data.session;
  await refreshAccount();
} else {
  setAccount({ authenticated: false, plan: "anonymous", quota: { limit: 50, used: 0, remaining: 50, windowHours: 72 } });
  $("#loginBtn").disabled = true;
  $("#emailInput").disabled = true;
  $("#loginBtn").title = "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable email login.";
}

$("#loginBtn").onclick = async () => {
  if (!supabase) return alert("Email login is not configured yet. Add the Supabase browser variables in Render.");

  const email = $("#emailInput").value.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    $("#loginMessage").textContent = "Enter a valid email address.";
    return;
  }

  const lastSent = Number(sessionStorage.getItem("magic_link_sent_at") || 0);
  const secondsSince = Math.floor((Date.now() - lastSent) / 1000);
  if (secondsSince < 60) {
    $("#loginMessage").textContent = `Please wait ${60 - secondsSince}s before requesting another link.`;
    return;
  }

  $("#loginBtn").disabled = true;
  $("#loginMessage").textContent = "Sending your secure sign-in link…";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: appUrl,
      shouldCreateUser: true
    }
  });

  if (error) {
    $("#loginMessage").textContent = error.message;
    $("#loginBtn").disabled = false;
    return;
  }

  sessionStorage.setItem("magic_link_sent_at", String(Date.now()));
  $("#loginMessage").textContent = "Check your email. Click the sign-in link to return to the dashboard.";
  $("#loginBtn").disabled = false;
};

$("#emailInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#loginBtn").click();
});

const signOut = async () => {
  await supabase?.auth.signOut();
  state.session = null;
  setAccount({
    authenticated: false,
    plan: "anonymous",
    quota: { limit: 50, used: 0, remaining: 50, windowHours: 72 }
  });
  $("#emailInput").value = "";
  $("#loginMessage").textContent = "";
};

$("#logoutBtn").onclick = signOut;
$("#memberSignOut").onclick = signOut;

$("#chooseBtn").onclick = () => $("#fileInput").click();
$("#dropZone").addEventListener("dragover", e => { e.preventDefault(); $("#dropZone").classList.add("drag"); });
$("#dropZone").addEventListener("dragleave", () => $("#dropZone").classList.remove("drag"));
$("#dropZone").addEventListener("drop", e => {
  e.preventDefault();
  $("#dropZone").classList.remove("drag");
  const f = e.dataTransfer.files?.[0];
  if (f) loadFile(f);
});
$("#fileInput").onchange = () => {
  const f = $("#fileInput").files?.[0];
  if (f) loadFile(f);
};

async function loadFile(file) {
  if (file.size > cfg.maxFileMb * 1024 * 1024) {
    return alert(`File is too large. Maximum is ${cfg.maxFileMb} MB.`);
  }
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return alert("Please choose a CSV, XLSX or XLS file.");

  try {
    let rows;
    if (/\.csv$/i.test(file.name)) {
      const parsed = await new Promise((resolve, reject) => Papa.parse(file, {
        complete: resolve, error: reject, skipEmptyLines: "greedy"
      }));
      rows = parsed.data;
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
    }
    if (!rows?.length || rows.length < 2) return alert("The file must contain a header row and at least one data row.");

    state.headers = rows[0].map((x, i) => String(x || `Column ${i + 1}`).trim());
    state.rows = rows.slice(1).filter(r => r.some(v => String(v ?? "").trim() !== ""));
    const limit = state.account?.authenticated
      ? (state.account.plan === "supreme" ? 25000 : state.account.plan === "premier" ? 50000 : 200)
      : 50;

    if (state.rows.length > limit) {
      return alert(`This upload contains ${state.rows.length.toLocaleString()} rows, but your current plan allows ${limit.toLocaleString()} emails for this upload.`);
    }

    $("#fileInfo").textContent = `${file.name} • ${state.rows.length.toLocaleString()} data rows`;
    buildMapper();
    $("#mapper").classList.remove("hidden");
  } catch (err) {
    console.error(err);
    alert("Could not read the file. Please check that it is a valid CSV/XLS/XLSX file.");
  }
}

const fieldDefs = [
  ["email","Email"],["state","State"],["city","City"],["zip","ZIP"],["phone","Phone"],
  ["ssn","SSN"],["dl","Driver License"],["routing","Routing / ABA"],["bank","Bank Account"]
];

function buildMapper() {
  const grid = $("#mapGrid");
  grid.innerHTML = "";
  for (const [key, label] of fieldDefs) {
    const wrap = document.createElement("label");
    wrap.innerHTML = `<span>${label}</span><select data-map="${key}"><option value="-1">— Bypass —</option></select>`;
    const select = wrap.querySelector("select");
    state.headers.forEach((h, i) => {
      const opt = document.createElement("option");
      opt.value = i; opt.textContent = h;
      if (detectHeader(h, key)) opt.selected = true;
      select.appendChild(opt);
    });
    grid.appendChild(wrap);
  }
}

function detectHeader(h, key) {
  const s = h.toLowerCase();
  const map = {
    email:["email","mail"], state:["state","st"], city:["city","town"], zip:["zip","postal","pin"],
    phone:["phone","mobile","cell","tele"], ssn:["ssn","social"], dl:["license","dl","driving"],
    routing:["routing","aba","transit"], bank:["account","bank","acct"]
  };
  return map[key].some(x => s.includes(x));
}

const AREA_CODES = {
  "201":"NJ","202":"DC","203":"CT","205":"AL","206":"WA","207":"ME","208":"ID","209":"CA","210":"TX",
  "212":"NY","213":"CA","214":"TX","215":"PA","216":"OH","217":"IL","218":"MN","219":"IN","220":"OH",
  "223":"PA","224":"IL","225":"LA","228":"MS","229":"GA","231":"MI","234":"OH","239":"FL","240":"MD",
  "248":"MI","251":"AL","252":"NC","253":"WA","254":"TX","256":"AL","260":"IN","262":"WI","267":"PA",
  "269":"MI","270":"KY","272":"NC","276":"VA","279":"CA","301":"MD","302":"DE","303":"CO","304":"WV",
  "305":"FL","307":"WY","308":"NE","309":"IL","310":"CA","312":"IL","313":"MI","314":"MO","315":"NY",
  "316":"KS","317":"IN","318":"LA","319":"IA","320":"MN","321":"FL","323":"CA","325":"TX","330":"OH",
  "331":"IL","334":"AL","336":"NC","337":"LA","339":"MA","341":"CA","346":"TX","347":"NY","351":"MA",
  "352":"FL","360":"WA","361":"TX","364":"KY","380":"OH","385":"UT","386":"FL","401":"RI","402":"NE",
  "404":"GA","405":"OK","406":"MT","407":"FL","408":"CA","409":"TX","410":"MD","412":"PA","413":"MA",
  "414":"WI","415":"CA","417":"MO","419":"OH","423":"TN","424":"CA","425":"WA","430":"TX","432":"TX",
  "434":"VA","435":"UT","440":"OH","442":"CA","443":"MD","458":"OR","463":"IN","469":"TX","470":"GA",
  "475":"CT","478":"GA","479":"AR","480":"AZ","484":"PA","501":"AR","502":"KY","503":"OR","504":"LA",
  "505":"NM","507":"MN","508":"MA","509":"WA","510":"CA","512":"TX","513":"OH","515":"IA","516":"NY",
  "517":"MI","518":"NY","520":"AZ","530":"CA","531":"NE","534":"WI","539":"WI","540":"VA","541":"OR",
  "551":"NJ","559":"CA","561":"FL","562":"CA","563":"IA","564":"WA","567":"OH","570":"PA","571":"VA",
  "573":"MO","574":"IN","575":"NM","580":"OK","585":"NY","586":"MI","601":"MS","602":"AZ","603":"NH",
  "605":"SD","606":"KY","607":"NY","608":"WI","609":"NJ","610":"PA","612":"MN","614":"OH","615":"TN",
  "616":"MI","617":"MA","618":"IL","619":"CA","620":"KS","623":"AZ","626":"CA","628":"CA","629":"TN",
  "630":"IL","631":"NY","636":"MO","641":"IA","646":"NY","650":"CA","651":"MN","657":"CA","660":"MO",
  "661":"CA","662":"MS","667":"MD","669":"CA","678":"GA","681":"WV","682":"TX","701":"ND","702":"NV",
  "703":"VA","704":"NC","706":"GA","707":"CA","708":"IL","712":"IA","713":"TX","714":"CA","715":"WI",
  "716":"NY","717":"PA","718":"NY","719":"CO","720":"CO","724":"PA","725":"NV","727":"FL","731":"TN",
  "732":"NJ","734":"MI","737":"TX","740":"OH","747":"CA","754":"FL","757":"VA","760":"CA","762":"GA",
  "763":"MN","765":"IN","769":"MS","770":"GA","772":"FL","773":"IL","774":"MA","775":"NV","779":"IL",
  "781":"MA","785":"KS","786":"FL","801":"UT","802":"VT","803":"SC","804":"VA","805":"CA","806":"TX",
  "808":"HI","810":"MI","812":"IN","813":"FL","814":"PA","815":"IL","816":"MO","817":"TX","818":"CA",
  "820":"CA","828":"NC","830":"TX","831":"CA","832":"TX","843":"SC","845":"NY","847":"IL","848":"NJ",
  "850":"FL","854":"SC","856":"NJ","857":"AZ","858":"CA","859":"KY","860":"CT","862":"NJ","863":"FL",
  "864":"SC","865":"TN","870":"AR","872":"IL","878":"PA","901":"TN","903":"TX","904":"FL","906":"MI",
  "907":"AK","908":"NJ","909":"CA","910":"NC","912":"GA","913":"KS","914":"NY","915":"TX","916":"CA",
  "917":"NY","918":"OK","919":"NC","920":"WI","925":"CA","928":"AZ","929":"NY","930":"CA","931":"TN",
  "934":"CA","936":"TX","937":"OH","938":"AL","940":"TX","941":"FL","947":"MI","949":"CA","951":"CA",
  "952":"MN","954":"FL","956":"TX","959":"CT","970":"CO","971":"OR","972":"TX","973":"NJ","978":"MA",
  "979":"TX","980":"NC","984":"NC","985":"LA","986":"WA","989":"MI"
};

const STATE_MAP = {
  ALABAMA:"AL",ALASKA:"AK",ARIZONA:"AZ",ARKANSAS:"AR",CALIFORNIA:"CA",COLORADO:"CO",CONNECTICUT:"CT",
  DELAWARE:"DE",FLORIDA:"FL",GEORGIA:"GA",HAWAII:"HI",IDAHO:"ID",ILLINOIS:"IL",INDIANA:"IN",IOWA:"IA",
  KANSAS:"KS",KENTUCKY:"KY",LOUISIANA:"LA",MAINE:"ME",MARYLAND:"MD",MASSACHUSETTS:"MA",MICHIGAN:"MI",
  MINNESOTA:"MN",MISSISSIPPI:"MS",MISSOURI:"MO",MONTANA:"MT",NEBRASKA:"NE",NEVADA:"NV",NEW_HAMPSHIRE:"NH",
  NEW_JERSEY:"NJ",NEW_MEXICO:"NM",NEW_YORK:"NY",NORTH_CAROLINA:"NC",NORTH_DAKOTA:"ND",OHIO:"OH",
  OKLAHOMA:"OK",OREGON:"OR",PENNSYLVANIA:"PA",RHODE_ISLAND:"RI",SOUTH_CAROLINA:"SC",SOUTH_DAKOTA:"SD",
  TENNESSEE:"TN",TEXAS:"TX",UTAH:"UT",VERMONT:"VT",VIRGINIA:"VA",WASHINGTON:"WA",WEST_VIRGINIA:"WV",
  WISCONSIN:"WI",WYOMING:"WY"
};

const DISPOSABLE = new Set(["mailinator.com","10minutemail.com","guerrillamail.com","tempmail.com","yopmail.com","trashmail.com","sharklasers.com","spam4.me","dropmail.me","nada.ltd"]);
const caches = { mx:new Map(), zip:new Map() };

function routingValid(v) {
  const c = String(v).replace(/\D/g,"");
  if (c.length !== 9) return false;
  let n = 0;
  for (let i=0;i<9;i+=3) n += Number(c[i])*3 + Number(c[i+1])*7 + Number(c[i+2]);
  return n !== 0 && n % 10 === 0;
}
function ssnFormatValid(v) {
  const c = String(v).replace(/\D/g,"");
  return c.length === 9 && !/^(000|666|9\d{2})/.test(c) && !/^\d{3}00\d{4}$/.test(c) && !/^\d{5}0000$/.test(c);
}
function val(row, key) {
  const sel = document.querySelector(`[data-map="${key}"]`);
  const i = Number(sel?.value ?? -1);
  return i >= 0 ? String(row[i] ?? "").trim() : "";
}

async function emailMx(domain) {
  if (caches.mx.has(domain)) return caches.mx.get(domain);
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`);
    const j = await r.json();
    const ok = j.Status === 0 && Array.isArray(j.Answer) && j.Answer.length > 0;
    caches.mx.set(domain, ok);
    return ok;
  } catch {
    return null;
  }
}
async function zipInfo(zip) {
  if (caches.zip.has(zip)) return caches.zip.get(zip);
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!r.ok) return null;
    const j = await r.json();
    const x = { city: String(j.places?.[0]?.["place name"] || "").toLowerCase(), state: j.places?.[0]?.["state abbreviation"] };
    caches.zip.set(zip, x);
    return x;
  } catch { return null; }
}

$("#runBtn").onclick = async () => {
  if (!state.rows.length) return;
  const count = state.rows.length;

  // Anonymous: client-side rolling 72-hour quota. Email-authenticated/paid users: server-side quota.
  if (!state.session?.access_token) {
    const key = "usa_validator_anonymous_usage_v1";
    const now = Date.now();
    const prior = JSON.parse(localStorage.getItem(key) || "[]").filter(x => now - x.ts < 72*3600*1000);
    const used = prior.reduce((s,x) => s+x.count,0);
    if (used + count > 50) {
      return alert(`Anonymous users can process 50 emails total in a rolling 72-hour window. Used: ${used}. Please sign in by email for the 200-email free tier.`);
    }
    prior.push({ ts:now, count });
    localStorage.setItem(key, JSON.stringify(prior));
  } else {
    const r = await fetch("/api/usage/reserve", {
      method:"POST",
      headers:{"Content-Type":"application/json", Authorization:`Bearer ${state.session.access_token}`},
      body:JSON.stringify({ emails:count })
    });
    const j = await r.json();
    if (!r.ok) return alert(j.error || "Quota check failed.");
  }

  $("#runBtn").disabled = true;
  $("#progressWrap").classList.remove("hidden");
  state.processed = [];
  state.domains = {};
  let issues = 0, scores = [];

  const config = {
    geo: $("#geo").checked, mx: $("#mx").checked, spam: $("#spam").checked,
    phone: $("#phone").checked, identity: $("#identity").checked, finance: $("#finance").checked
  };

  for (let i=0;i<count;i++) {
    const row = state.rows[i];
    const result = await validateRow(row, config);
    state.processed.push(result);
    scores.push(result.score);
    if (result.issues.length) issues++;
    const email = result.email;
    if (email.includes("@")) {
      const d = email.split("@")[1];
      state.domains[d] = (state.domains[d] || 0) + 1;
    }
    if (i % 5 === 0 || i === count-1) {
      const pct = Math.round(((i+1)/count)*100);
      $("#progress").style.width = `${pct}%`;
      $("#progressText").textContent = `${pct}% analyzed`;
      $("#total").textContent = (i+1).toLocaleString();
      $("#avg").textContent = `${Math.round(scores.reduce((a,b)=>a+b,0)/scores.length)}%`;
      $("#issues").textContent = issues.toLocaleString();
    }
  }

  renderCharts(scores);
  renderDomains();
  $("#exportBtn").disabled = false;
  $("#runBtn").disabled = false;
  await refreshAccount();
};

async function validateRow(row, config) {
  let score = 100, issues = [];
  const email = val(row,"email").toLowerCase();
  let emailOk = false;
  if (!email || !email.includes("@")) { issues.push("Missing/invalid email"); score -= 30; }
  else {
    const domain = email.split("@")[1];
    if (config.spam && DISPOSABLE.has(domain)) { issues.push("Disposable email"); score -= 30; }
    else if (config.mx) {
      const mx = await emailMx(domain);
      if (mx === false) { issues.push("Bad DNS MX"); score -= 30; }
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push("Bad email syntax"); score -= 30;
    }
    emailOk = !issues.some(x => x.includes("email") || x.includes("MX"));
  }

  const stateRaw = val(row,"state").toUpperCase().replace(/\s+/g,"_");
  const st = STATE_MAP[stateRaw] || (stateRaw.length===2 ? stateRaw : "");
  const zip = val(row,"zip").replace(/\D/g,"").slice(0,5);
  const city = val(row,"city").toLowerCase();
  if (zip) {
    if (zip.length !== 5) { issues.push("Bad ZIP"); score -= 20; }
    else if (config.geo) {
      const z = await zipInfo(zip);
      if (!z) { issues.push("Invalid ZIP"); score -= 20; }
      else {
        if (st && st !== z.state) { issues.push("State mismatch"); score -= 20; }
        if (city && !z.city.includes(city) && !city.includes(z.city)) { issues.push("City mismatch"); score -= 15; }
      }
    }
  }

  const rawPhone = val(row,"phone");
  if (rawPhone) {
    let p = rawPhone.replace(/\D/g,"");
    if (p.length===11 && p.startsWith("1")) p=p.slice(1);
    if (p.length!==10) { issues.push("Bad phone length"); score -= 20; }
    else if (config.phone && st && AREA_CODES[p.slice(0,3)] && AREA_CODES[p.slice(0,3)] !== st) {
      issues.push("Area code mismatch"); score -= 10;
    }
  }

  if (config.identity) {
    const ssn = val(row,"ssn");
    if (ssn && !ssnFormatValid(ssn)) { issues.push("Invalid SSN format"); score -= 50; }
    const dl = val(row,"dl").replace(/[^a-z0-9]/gi,"");
    if (dl && (dl.length < 5 || dl.length > 20)) { issues.push("Invalid DL format"); score -= 20; }
  }
  if (config.finance) {
    const routing = val(row,"routing");
    if (routing && !routingValid(routing)) { issues.push("ABA checksum failed"); score -= 50; }
    const bank = val(row,"bank").replace(/\D/g,"");
    if (bank && (bank.length < 4 || bank.length > 17)) { issues.push("Invalid bank account length"); score -= 20; }
  }

  score = Math.max(0, score);
  return {
    row,
    email,
    score,
    status: issues.length ? (score >= 80 ? "HIGH TRUST WITH ISSUES" : score >= 50 ? "MEDIUM TRUST" : "CRITICAL ISSUE") : "PERFECT VALID",
    issues
  };
}

function renderCharts(scores) {
  const high = scores.filter(x=>x>=80).length, med=scores.filter(x=>x>=50&&x<80).length, low=scores.filter(x=>x<50).length;
  Object.values(state.charts).forEach(c=>c?.destroy());

  state.charts.bar = new Chart($("#barChart"), {type:"bar",data:{labels:["High","Medium","Low"],datasets:[{data:[high,med,low]}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});
  const avg = scores.reduce((a,b)=>a+b,0)/Math.max(1,scores.length);
  state.charts.radar = new Chart($("#radarChart"), {type:"radar",data:{labels:["Overall","Email","Geo","Phone"],datasets:[{data:[avg,avg,avg,avg]}]},options:{responsive:true,maintainAspectRatio:false,scales:{r:{min:0,max:100}}}});
  const domains = Object.entries(state.domains).sort((a,b)=>b[1]-a[1]).slice(0,6);
  state.charts.pie = new Chart($("#pieChart"), {type:"doughnut",data:{labels:domains.map(x=>x[0]),datasets:[{data:domains.map(x=>x[1])}]},options:{responsive:true,maintainAspectRatio:false}});
}

function renderDomains() {
  const box = $("#domains");
  box.innerHTML = "";
  Object.entries(state.domains).sort((a,b)=>b[1]-a[1]).forEach(([domain,count]) => {
    const label = document.createElement("label");
    label.className = "domain";
    label.innerHTML = `<input type="checkbox" value="${domain}" checked> <span>${domain}</span><b>${count}</b>`;
    box.appendChild(label);
  });
}

$("#exportBtn").onclick = () => {
  const selected = new Set([...document.querySelectorAll("#domains input:checked")].map(x=>x.value));
  if (!selected.size) return alert("Select at least one domain.");
  const headers = [...state.headers, "VALIDATION_STATUS","TRUST_SCORE","ISSUE_LOGS"];
  const rows = state.processed
    .filter(x => selected.has(x.email.split("@")[1]))
    .map(x => [...x.row, x.status, `${x.score}%`, x.issues.join(" | ") || "Passed validation"]);
  const ws = XLSX.utils.aoa_to_sheet([headers,...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Validated_Data");
  XLSX.writeFile(wb, "USA_Validator_Validated.xlsx");
};
