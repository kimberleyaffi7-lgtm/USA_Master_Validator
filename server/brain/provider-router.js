import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_MODEL = "gpt-4o-mini";

function decryptCiphertext(ciphertext, secret) {
  if (!ciphertext || !secret) return "";
  // Cipher format: base64(iv[12] + authTag[16] + ciphertext)
  const raw = Buffer.from(ciphertext, "base64");
  if (raw.length < 29) throw new Error("Invalid provider credential ciphertext.");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const key = crypto.createHash("sha256").update(secret).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function normalizeChatResponse(json) {
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text === "string" && text.trim()) return text.trim();
  if (Array.isArray(text)) {
    return text.map(part => typeof part === "string" ? part : part?.text || "").join("").trim();
  }
  return "";
}

export class BrainProviderRouter {
  constructor({ supabaseUrl, serviceRoleKey, credentialKey }) {
    this.supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
    this.credentialKey = credentialKey || "";
  }

  async listProviders() {
    if (!this.supabase) throw new Error("Supabase service role is not configured for Brain provider access.");
    const { data, error } = await this.supabase
      .from("brain_providers")
      .select("id,name,base_url,api_key_ciphertext,enabled,priority,model")
      .eq("enabled", true)
      .order("priority", { ascending: true });
    if (error) throw new Error(`Could not load Brain providers: ${error.message}`);
    return data || [];
  }

  async chat({ question, context = [], plan }) {
    if (!this.supabase) {
      const error = new Error("Brain provider storage is not configured.");
      error.publicMessage = "Add the Supabase service-role key and configure Brain providers.";
      throw error;
    }
    if (!this.credentialKey) {
      const error = new Error("Brain credential encryption key is not configured.");
      error.publicMessage = "Configure BRAIN_CREDENTIAL_KEY before enabling Brain calls.";
      throw error;
    }

    const providers = await this.listProviders();
    if (!providers.length) {
      const error = new Error("No Brain providers are enabled.");
      error.publicMessage = "Enable at least one Brain provider in Supabase.";
      throw error;
    }

    const system = [
      "You are the USA Validator Data Quality Brain.",
      "Answer using only the supplied sanitized validation context and general reasoning.",
      "Do not request, infer, reconstruct, or expose raw SSNs, driver's-license numbers, bank-account numbers, routing numbers, passwords, or other sensitive identifiers.",
      "When context is insufficient, say so clearly.",
      `Current subscription: ${plan}.`,
      "The product supports email, ZIP/geographic, phone area-code, SSN/DL-format and bank/routing validation. Paid-only features must not be represented as available to Free users."
    ].join(" ");

    const user = [
      `Question: ${question}`,
      "",
      "Sanitized validation context:",
      context.length ? context.map((x, i) => `${i + 1}. ${x}`).join("\n") : "No validation context supplied."
    ].join("\n");

    const failures = [];
    for (const provider of providers) {
      let apiKey = "";
      try {
        apiKey = decryptCiphertext(provider.api_key_ciphertext, this.credentialKey);
      } catch (e) {
        failures.push(`${provider.name}: invalid encrypted key`);
        continue;
      }
      if (!apiKey) {
        failures.push(`${provider.name}: no API key configured`);
        continue;
      }

      const endpoint = `${String(provider.base_url).replace(/\/$/, "")}/chat/completions`;
      const model = provider.model || DEFAULT_MODEL;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user }
            ],
            temperature: 0.2
          }),
          signal: AbortSignal.timeout(30000)
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          failures.push(`${provider.name}: HTTP ${response.status}`);
          continue;
        }
        const text = normalizeChatResponse(json);
        if (!text) {
          failures.push(`${provider.name}: empty response`);
          continue;
        }
        return { text, provider: provider.name, model };
      } catch (error) {
        failures.push(`${provider.name}: ${error?.message || "request failed"}`);
      }
    }

    const error = new Error(failures.join("; ") || "No Brain provider succeeded.");
    error.publicMessage = "All configured Brain providers failed or have no usable credentials.";
    throw error;
  }
}

export function encryptProviderApiKey(plaintext, secret) {
  if (!plaintext || !secret) throw new Error("Provider key and encryption secret are required.");
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(secret).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}
