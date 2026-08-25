import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { BrainProviderRouter } from "./server/brain/provider-router.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PREMIUM_ENGINE = path.join(__dirname, "server", "premium-validation-engine.js");
const app = express();
const PORT = Number(process.env.PORT || 10000);
const DIST = path.join(__dirname, "dist");
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 25);
const VERSION = "27.0.0";

app.disable("x-powered-by");
app.use(express.json({ limit: "512kb" }));

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const PLAN_FEATURES = {
  anonymous: { premiumValidation: false, brain: false },
  free: { premiumValidation: false, brain: false },
  supreme: { premiumValidation: true, brain: true },
  premier: { premiumValidation: true, brain: true }
};

const BRAIN_CATALOG = [
  { name: "LimitDeck", baseUrl: "https://limitdeckai.ru/v1", role: "brain" },
  { name: "NEXUS API", baseUrl: "https://api.nexus-hub.ru/v1", role: "brain" },
  { name: "Router Cheap", baseUrl: "https://router.cheap/v1", role: "brain" }
];

const brainRouter = new BrainProviderRouter({
  supabaseUrl,
  serviceRoleKey: supabaseServiceRoleKey,
  credentialKey: process.env.BRAIN_CREDENTIAL_KEY || ""
});


function getUserClient(token) {
  if (!supabaseUrl || !supabaseAnonKey || !token) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

function bearer(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

async function getAuthenticatedUser(req) {
  const token = bearer(req);
  const client = getUserClient(token);
  if (!client) return { client: null, user: null, token };
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { client, user: null, token };
  return { client, user: data.user, token };
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "usa-validator", version: VERSION }));

app.get("/api/config", (_req, res) => {
  res.json({
    maxFileMb: MAX_FILE_MB,
    plans: {
      anonymous: { limit: 50, windowHours: 72 },
      free: { limit: 200, windowHours: 24 },
      supreme: { limit: 25000, windowHours: 720, billing: "monthly" },
      premier: { limit: 50000, windowHours: 720, billing: "monthly" }
    },
    paidFeatures: ["phone_area_code", "ssn_dl_format", "bank_routing_format"],
    brain: {
      enabled: true,
      paidOnly: true,
      providers: BRAIN_CATALOG.map(({ name, baseUrl, role }) => ({ name, baseUrl, role }))
    }
  });
});

app.get("/api/me", async (req, res) => {
  const { client, user } = await getAuthenticatedUser(req);
  if (!client || !user) {
    return res.json({
      authenticated: false,
      plan: "anonymous",
      features: PLAN_FEATURES.anonymous,
      quota: { limit: 50, used: 0, remaining: 50, windowHours: 72 }
    });
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("plan, monthly_email_credits, credits_used, credits_period_start")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return res.status(500).json({ error: "Could not load account profile." });

  const plan = ["free", "supreme", "premier"].includes(profile?.plan) ? profile.plan : "free";
  const quota = await getQuota(client, user.id, plan, profile);

  res.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name || "",
      avatar: user.user_metadata?.avatar_url || ""
    },
    plan,
    features: PLAN_FEATURES[plan],
    quota
  });
});

app.post("/api/usage/reserve", async (req, res) => {
  const requested = Number(req.body?.emails);
  if (!Number.isInteger(requested) || requested <= 0 || requested > 50000) {
    return res.status(400).json({ error: "Invalid email count." });
  }

  const { client, user } = await getAuthenticatedUser(req);
  if (!client || !user) {
    return res.status(401).json({ error: "Authentication required for server-side quota reservation." });
  }

  const { data: profile } = await client
    .from("profiles")
    .select("plan, monthly_email_credits, credits_used, credits_period_start")
    .eq("id", user.id)
    .maybeSingle();

  const plan = ["free", "supreme", "premier"].includes(profile?.plan) ? profile.plan : "free";
  const limit = plan === "premier" ? 50000 : plan === "supreme" ? 25000 : 200;
  if (requested > limit) {
    return res.status(429).json({ error: `${plan.toUpperCase()} plan cannot process more than ${limit.toLocaleString()} emails in one request.` });
  }

  const quota = await getQuota(client, user.id, plan, profile);
  if (requested > quota.remaining) {
    return res.status(429).json({ error: `Quota exceeded. ${quota.remaining.toLocaleString()} email credits remain.` });
  }

  const { data: result, error: rpcError } = await client.rpc("reserve_email_credits", { p_emails: requested });
  if (rpcError || !result?.allowed) {
    return res.status(429).json({ error: result?.message || "Quota could not be reserved." });
  }
  res.json({ ok: true, quota: result.quota });
});

app.get("/api/premium-engine", async (req, res) => {
  const { client, user } = await getAuthenticatedUser(req);
  if (!client || !user) return res.status(401).send("Authentication required.");

  const { data: profile } = await client.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  const plan = profile?.plan || "free";
  if (!PLAN_FEATURES[plan]?.premiumValidation) return res.status(403).send("Paid plan required.");

  try {
    const source = await import("node:fs/promises").then(fs => fs.readFile(PREMIUM_ENGINE, "utf8"));
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(source);
  } catch (error) {
    console.error("Premium engine load failed:", error);
    return res.status(500).send("Premium engine unavailable.");
  }
});

// Paid-only feature gate. The validation data itself stays in the browser.
app.post("/api/features/authorize", async (req, res) => {
  const feature = String(req.body?.feature || "");
  const allowedFeatures = new Set(["phone_area_code", "ssn_dl_format", "bank_routing_format"]);
  if (!allowedFeatures.has(feature)) return res.status(400).json({ allowed: false, error: "Unknown feature." });

  const { client, user } = await getAuthenticatedUser(req);
  if (!client || !user) return res.json({ allowed: false, reason: "authentication_required" });

  const { data: profile } = await client.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  const plan = profile?.plan || "free";
  const allowed = PLAN_FEATURES[plan]?.premiumValidation === true;
  res.json({ allowed, plan, feature });
});

// Brain status never returns API keys. Provider secrets remain in Supabase and are read only server-side.
app.get("/api/brain/status", async (req, res) => {
  const { client, user } = await getAuthenticatedUser(req);
  if (!client || !user) return res.status(401).json({ enabled: false, reason: "authentication_required" });
  const { data: profile } = await client.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  const plan = profile?.plan || "free";
  const paid = PLAN_FEATURES[plan]?.brain === true;
  res.json({ enabled: paid, paidOnly: true, plan, providers: BRAIN_CATALOG.map(({ name, baseUrl }) => ({ name, baseUrl })) });
});

// Optional future Brain endpoint. It accepts only sanitized context; never send raw SSN/DL/bank values here.
app.post("/api/brain/chat", async (req, res) => {
  const { client, user } = await getAuthenticatedUser(req);
  if (!client || !user) return res.status(401).json({ error: "Authentication required." });

  const { data: profile } = await client.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  const plan = profile?.plan || "free";
  if (!PLAN_FEATURES[plan]?.brain) return res.status(403).json({ error: "Brain/RAG features require a paid plan." });

  const question = String(req.body?.question || "").trim();
  const context = Array.isArray(req.body?.context) ? req.body.context.slice(0, 40) : [];
  if (!question || question.length > 2000) return res.status(400).json({ error: "A question between 1 and 2000 characters is required." });

  const safeContext = context
    .filter(item => typeof item === "string")
    .slice(0, 40)
    .map(item => item.slice(0, 1200));

  try {
    const answer = await brainRouter.chat({
      question,
      context: safeContext,
      plan
    });
    return res.json({
      ok: true,
      answer: answer.text,
      provider: answer.provider,
      model: answer.model || null
    });
  } catch (error) {
    console.error("Brain request failed:", error?.message || error);
    return res.status(503).json({
      error: "No configured Brain provider is currently available.",
      details: error?.publicMessage || undefined
    });
  }
});

async function getQuota(client, userId, plan, profile) {
  const now = Date.now();
  if (plan === "supreme" || plan === "premier") {
    const limit = plan === "premier" ? 50000 : 25000;
    const periodStart = profile?.credits_period_start ? new Date(profile.credits_period_start) : new Date(now);
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const used = periodStart < currentMonthStart ? 0 : Number(profile?.credits_used || 0);
    return { limit, used, remaining: Math.max(0, limit - used), windowHours: 720 };
  }

  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client.from("usage_events").select("email_count").eq("user_id", userId).gte("created_at", since);
  if (error) return { limit: 200, used: 0, remaining: 200, windowHours: 24 };
  const used = (data || []).reduce((sum, x) => sum + Number(x.email_count || 0), 0);
  return { limit: 200, used, remaining: Math.max(0, 200 - used), windowHours: 24 };
}

app.use(express.static(DIST));
app.get("*splat", (_req, res) => res.sendFile(path.join(DIST, "index.html")));
app.listen(PORT, () => console.log(`USA Validator ${VERSION} running on port ${PORT}`));
