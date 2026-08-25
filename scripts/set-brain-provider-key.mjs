import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [providerName, apiKey, model = ""] = process.argv.slice(2);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const secret = process.env.BRAIN_CREDENTIAL_KEY;

if (!providerName || !apiKey || !supabaseUrl || !serviceRole || !secret) {
  console.error("Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... BRAIN_CREDENTIAL_KEY=... node scripts/set-brain-provider-key.mjs \"LimitDeck\" \"API_KEY\" [MODEL]");
  process.exit(1);
}

const iv = crypto.randomBytes(12);
const key = crypto.createHash("sha256").update(secret).digest();
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();
const ciphertext = Buffer.concat([iv, tag, encrypted]).toString("base64");

const supabase = createClient(supabaseUrl, serviceRole);
const { error } = await supabase
  .from("brain_providers")
  .update({ api_key_ciphertext: ciphertext, enabled: true, ...(model ? { model } : {}), updated_at: new Date().toISOString() })
  .eq("name", providerName);

if (error) throw error;
console.log(`Encrypted credential stored for ${providerName}. The plaintext API key was not written to the repository.`);
