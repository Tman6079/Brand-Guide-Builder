import Anthropic from "@anthropic-ai/sdk";
import type { BrandProfile } from "../types/brand-profile";

const WEB_FETCH_BETA = "web-fetch-2025-09-10";
const WEB_FETCH_TIMEOUT_MS = 120_000;
const NOT_PROVIDED = "Not Provided";

const BRAND_PROFILE_KEYS: (keyof BrandProfile)[] = [
  "company_name",
  "type_of_business",
  "website",
  "company_email",
  "company_address",
  "phone_number",
  "business_hours",
  "tone_of_voice",
  "target_audience",
  "customer_pain_points",
  "brand_promise",
  "brand_values",
  "what_does_your_brand_do",
  "what_makes_you_better_than_competitors",
  "unique_selling_proposition",
  "risks_of_inaction",
  "call_to_action",
];

const SYSTEM_PROMPT = `You are a Brand Profile Extraction AI.

Your task is to:
- Fetch the given URL with the web_fetch tool and read ONLY the visible page content.
- Extract brand and business information ONLY from what is explicitly visible on the page.
- Return a single JSON object conforming exactly to the BrandProfile interface (the exact keys you were given).
- Use "Not Provided" for any field that is not clearly present on the page.
- Do NOT infer email, address, phone number, or business hours unless they are explicitly shown on the page.
- Output MUST be valid JSON only—no commentary, no markdown, no code fences.`;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function stripJsonFromResponse(text: string): string {
  const trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/m);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  return trimmed;
}

function extractFirstValidJsonObject(text: string): Record<string, unknown> | null {
  const stripped = stripJsonFromResponse(text);
  const start = stripped.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  let quote = "";
  for (let i = start; i < stripped.length; i++) {
    const c = stripped[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === quote) inString = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(stripped.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function normalizeBrandProfile(raw: Record<string, unknown>): BrandProfile {
  const out: Record<string, string> = {};
  for (const key of BRAND_PROFILE_KEYS) {
    const v = raw[key];
    if (v != null && typeof v === "string" && v.trim() !== "") {
      out[key] = v.trim();
    } else {
      out[key] = NOT_PROVIDED;
    }
  }
  return out as BrandProfile;
}

/**
 * Generates a BrandProfile from a URL using Claude with web_fetch enabled.
 * Extracts only from visible page content; uses "Not Provided" for missing fields.
 *
 * @param url - The URL to fetch and analyze (included verbatim in the user message).
 * @returns A BrandProfile with all string fields.
 * @throws If the API call fails or the response is not valid JSON.
 */
export async function generateBrandProfileFromUrlViaWebFetch(url: string): Promise<BrandProfile> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_EXTRACTION_MODEL ?? "claude-sonnet-4-20250514";
  const timeoutMs = Number(process.env.ANTHROPIC_WEB_FETCH_TIMEOUT_MS) || WEB_FETCH_TIMEOUT_MS;

  const userMessage = `Fetch this exact URL and extract a brand profile from its visible content only:\n\n${url}\n\nUse the web_fetch tool to retrieve the page, then return a single JSON object conforming exactly to the BrandProfile interface with these keys: ${BRAND_PROFILE_KEYS.join(", ")}. Use "Not Provided" for any missing field. Return VALID JSON ONLY, no commentary or markdown.`;

  const response = await withTimeout(
    client.beta.messages.create({
      model,
      max_tokens: 8192,
      stream: false,
      betas: [WEB_FETCH_BETA],
      tools: [
        {
          type: "web_fetch_20250910",
          name: "web_fetch",
          max_uses: 5,
        },
      ],
      system: `${SYSTEM_PROMPT}\n\nBrandProfile keys (use these exact keys): ${BRAND_PROFILE_KEYS.join(", ")}`,
      messages: [{ role: "user", content: userMessage }],
    }),
    timeoutMs
  );

  const content = (response as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  let rawText = "";
  for (const block of content) {
    if (block.type === "text" && typeof block.text === "string") {
      rawText += block.text;
    }
  }

  const raw = extractFirstValidJsonObject(rawText);
  if (!raw) {
    throw new Error("Brand profile extraction returned invalid JSON. Raw (first 500 chars): " + rawText.slice(0, 500));
  }

  return normalizeBrandProfile(raw as Record<string, unknown>);
}
