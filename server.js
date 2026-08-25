import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 10000);
const DIST = path.join(__dirname, "dist");
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 25);

app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

function getUserClient(token) {
  if (!supabaseUrl || !supabaseAnonKey || !token) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "usa-validator", version: "26.0.0" });
});

app.get("/api/config", (_req, res) => {
  res.json({
    maxFileMb: MAX_FILE_MB,
    plans: {
      anonymous: { limit: 50, windowHours: 72 },
      free: { limit: 200, windowHours: 24 },
      supreme: { limit: 25000, windowHours: 720, billing: "monthly" },
      premier: { limit: 50000, windowHours: 720, billing: "monthly" }
    }
  });
});

app.get("/api/me", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const client = getUserClient(token);

  if (!client) {
    return res.json({
      authenticated: false,
      plan: "anonymous",
      quota: { limit: 50, used: 0, remaining: 50, windowHours: 72 }
    });
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("plan, monthly_email_credits, credits_used, credits_period_start")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    return res.status(500).json({ error: "Could not load account profile." });
  }

  const plan = profile?.plan || "free";
  const quota = await getQuota(client, data.user.id, plan, profile);

  res.json({
    authenticated: true,
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || "",
      avatar: data.user.user_metadata?.avatar_url || ""
    },
    plan,
    quota
  });
});

app.post("/api/usage/reserve", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const client = getUserClient(token);
  const requested = Number(req.body?.emails);

  if (!Number.isInteger(requested) || requested <= 0 || requested > 50000) {
    return res.status(400).json({ error: "Invalid email count." });
  }

  if (!client) {
    return res.status(401).json({
      error: "Anonymous quota is enforced in the browser. Sign in with Google for the higher authenticated quota."
    });
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: "Invalid session." });

  const { data: profile } = await client
    .from("profiles")
    .select("plan, monthly_email_credits, credits_used, credits_period_start")
    .eq("id", data.user.id)
    .maybeSingle();

  const plan = profile?.plan || "free";
  if (plan === "free" && requested > 200) {
    return res.status(429).json({ error: "Free Google accounts can process at most 200 emails per upload." });
  }
  if (plan === "supreme" && requested > 25000) {
    return res.status(429).json({ error: "Supreme plan limit is 25,000 email credits per month." });
  }
  if (plan === "premier" && requested > 50000) {
    return res.status(429).json({ error: "Premier plan limit is 50,000 email credits per month." });
  }

  const quota = await getQuota(client, data.user.id, plan, profile);
  if (requested > quota.remaining) {
    return res.status(429).json({
      error: `Quota exceeded. ${quota.remaining.toLocaleString()} email credits remain.`
    });
  }

  // Atomic enforcement is handled by the SQL function below.
  const { data: result, error: rpcError } = await client.rpc("reserve_email_credits", {
    p_emails: requested
  });

  if (rpcError || !result?.allowed) {
    return res.status(429).json({
      error: result?.message || "Quota could not be reserved."
    });
  }

  res.json({ ok: true, quota: result.quota });
});

async function getQuota(client, userId, plan, profile) {
  const now = Date.now();
  if (plan === "supreme" || plan === "premier") {
    const limit = plan === "premier" ? 50000 : 25000;
    const periodStart = profile?.credits_period_start
      ? new Date(profile.credits_period_start).getTime()
      : now;
    const used = periodStart + 30 * 24 * 60 * 60 * 1000 <= now ? 0 : Number(profile?.credits_used || 0);
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      windowHours: 720
    };
  }

  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("usage_events")
    .select("email_count")
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) return { limit: 200, used: 0, remaining: 200, windowHours: 24 };
  const used = (data || []).reduce((sum, x) => sum + Number(x.email_count || 0), 0);
  return { limit: 200, used, remaining: Math.max(0, 200 - used), windowHours: 24 };
}

app.use(express.static(DIST));
app.get("*splat", (_req, res) => {
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, () => {
  console.log(`USA Validator running on port ${PORT}`);
});
