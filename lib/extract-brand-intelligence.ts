import Anthropic from "@anthropic-ai/sdk";
import type { BrandIntelligence } from "../types/brand-intelligence";
import { normalizeBrandIntelligence } from "./normalize-brand-intelligence";

const SYSTEM_PROMPT = `You are a Brand Intelligence Extraction AI.

Your task is to:

Fetch and read the full contents of the provided homepage URL.

Extract brand, business, and positioning information ONLY from the visible content.

Return structured JSON suitable for downstream brand and design systems.

IMPORTANT RULES:

Do NOT use prior knowledge of the business.

Do NOT fabricate facts.

If information is not clearly present or reasonably supported, return "Not Provided".

Conservative accuracy is preferred over completeness.

Reasonable inference is allowed ONLY for tone, perception, and emotional qualities — not for operational facts.

LOGO URL RULES:

Attempt to identify the primary brand logo from:

Header or navigation image

SVG used as a logo

Image with "logo" in filename or alt text

If multiple logos exist, choose the primary brand logo.

If no clear logo is found, return null.

OUTPUT FORMAT:

Return VALID JSON ONLY

Do not include commentary, explanations, or markdown

Output must conform to the BrandIntelligence interface

FIELD RULES:

Use "Yes", "No", or "Not Provided" for boolean-style fields

Arrays must be empty if no data is found

Do not infer financing, insurance handling, drone usage, or founding year unless explicitly stated`;

const BOOLEAN_STYLE_FIELDS =
  "handles_insurance_claims, offers_drone_inspections, offers_financing";

const BRAND_INTELLIGENCE_JSON_FIELDS = `
business_name, logo_url, origin_story, business_goals, slogan_or_tagline,
unique_differentiators, primary_customer_result, ideal_customer_review_example,
accreditations_and_awards, core_values, desired_emotional_response,
brand_voice_description, brand_tone, brand_should_not_sound_like,
desired_brand_perception, buyer_persona, local_area_name, five_step_process,
weather_events_causing_service_needs, ${BOOLEAN_STYLE_FIELDS}, year_founded,
preferred_call_to_action, financing_callouts, financing_disclaimers,
reference_example_content
`;

/** Beta header value required for the web fetch tool (Anthropic docs). */
const WEB_FETCH_BETA = "web-fetch-2025-09-10";

/** Timeout for a single web fetch API call (ms). */
const WEB_FETCH_TIMEOUT_MS = 120_000;

/** Max length of visible text sent to Claude (reduces tokens, improves reliability). */
const EXTRACTION_TEXT_MAX_LENGTH = 80_000;

/**
 * Converts HTML to visible plain text for extraction: strips script/style/comments,
 * preserves headings/paragraph breaks, collapses whitespace, and caps length.
 * No heavy dependencies; regex and string only.
 */
function htmlToVisibleText(html: string, maxLength = EXTRACTION_TEXT_MAX_LENGTH): string {
  let s = html;

  // Remove <script>...</script> and <style>...</style> (including with attributes)
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  // Block elements → newline (preserve structure)
  const blockTags = /<\/?(?:h[1-6]|p|div|br|li|tr|th|td|hr|ul|ol|section|article|header|footer|nav|main|aside|blockquote|pre)(?:\s[^>]*)?\/?>/gi;
  s = s.replace(blockTags, "\n");

  // All remaining tags stripped
  s = s.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

  // Collapse whitespace: multiple spaces/newlines → single newline, trim lines
  s = s
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n\n");
  s = s.replace(/\n{3,}/g, "\n\n").trim();

  if (s.length > maxLength) {
    s = s.slice(0, maxLength) + "\n[... truncated for length ...]";
  }
  return s;
}

const WEB_FETCH_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

Use web_fetch only for this exact URL. Do not fetch any other URLs.
After you receive the page content, extract brand information and return the BrandIntelligence JSON as specified above.`;

function stripJsonFromResponse(text: string): string {
  const trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/m);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  return trimmed;
}

/**
 * Extracts the first valid JSON object from the assistant's final text (after stripping code fences).
 * Returns the parsed object or null if parsing fails.
 */
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

/**
 * Fetches the URL and returns the response text (HTML).
 * Does not execute JavaScript; for JS-rendered content, a separate pipeline would be needed.
 */
async function fetchPageContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "BrandIntelligenceExtractor/1.0 (extraction; no indexing)",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * Extracts brand information from the visible content of a homepage using the Claude API.
 * Performs extraction only; does not generate a brand guide or marketing copy.
 *
 * @param homepageUrl - The URL of the homepage to analyze
 * @returns A valid BrandIntelligence object (normalized; optional fields may be omitted)
 * @throws If the URL cannot be fetched or the API returns invalid/unparseable JSON
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 */
export async function extractBrandIntelligenceFromUrl(
  homepageUrl: string
): Promise<BrandIntelligence> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const html = await fetchPageContent(homepageUrl);
  const visibleText = htmlToVisibleText(html);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/619a2aaf-4d05-4e48-a482-ad27c306e60f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/extract-brand-intelligence.ts:FromUrl:visibleText',message:'Server-side path: visible text length',data:{htmlLen:html.length,visibleTextLen:visibleText.length,capped:visibleText.length<=EXTRACTION_TEXT_MAX_LENGTH},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  const userContent = `Homepage URL: ${homepageUrl}\n\nPage content (visible text) to analyze:\n\n${visibleText}`;

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_EXTRACTION_MODEL ?? "claude-sonnet-4-20250514";

  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    system: `${SYSTEM_PROMPT}\n\nBrandIntelligence JSON keys (use these exact keys): ${BRAND_INTELLIGENCE_JSON_FIELDS}`,
    messages: [{ role: "user", content: userContent }],
  });

  let rawText = "";
  for (const block of response.content ?? []) {
    if (block.type === "text" && "text" in block && typeof (block as { text: string }).text === "string") {
      rawText += (block as { text: string }).text;
    }
  }

  const raw = extractFirstValidJsonObject(rawText);
  if (!raw) {
    throw new Error(
      "Extraction returned invalid JSON. Raw response (first 500 chars): " +
        rawText.slice(0, 500)
    );
  }
  return normalizeBrandIntelligence(raw as Partial<BrandIntelligence> & Record<string, unknown>);
}

/**
 * Returns true if the message content includes a web_fetch_tool_result with an error.
 */
function hasWebFetchToolError(content: Array<{ type: string; content?: unknown }> | null): boolean {
  if (!content) return false;
  for (const block of content) {
    if (block.type !== "web_fetch_tool_result" || !block.content) continue;
    const c = block.content as { type?: string };
    if (c.type === "web_fetch_tool_result_error") return true;
  }
  return false;
}

/**
 * Extracts brand information using Claude with the web fetch tool: Claude fetches the URL
 * and extracts from the fetched content. Uses the required beta header per Anthropic docs.
 * Falls back to server-side fetch (extractBrandIntelligenceFromUrl) if the web fetch tool errors.
 *
 * @param url - The homepage URL to fetch and analyze
 * @returns A valid BrandIntelligence object (normalized; optional fields may be omitted)
 * @throws If both web fetch and fallback fail, or API returns invalid/unparseable JSON
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 */
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

export async function extractBrandIntelligenceFromUrlViaWebFetch(
  url: string
): Promise<BrandIntelligence> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/619a2aaf-4d05-4e48-a482-ad27c306e60f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/extract-brand-intelligence.ts:ViaWebFetch:entry',message:'ViaWebFetch entered',data:{url},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_EXTRACTION_MODEL ?? "claude-sonnet-4-20250514";
  const timeoutMs = Number(process.env.ANTHROPIC_WEB_FETCH_TIMEOUT_MS) || WEB_FETCH_TIMEOUT_MS;

  const userMessage = `Fetch this exact URL and extract brand intelligence from its visible content:\n\n${url}\n\nUse the web_fetch tool to retrieve the page, then extract and return a single JSON object conforming to the BrandIntelligence interface (the exact keys you were given). Return VALID JSON ONLY, no commentary or markdown.`;

  const doWebFetchCall = () =>
    withTimeout(
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
        system: `${WEB_FETCH_SYSTEM_PROMPT}\n\nBrandIntelligence JSON keys (use these exact keys): ${BRAND_INTELLIGENCE_JSON_FIELDS}`,
        messages: [{ role: "user", content: userMessage }],
      }),
      timeoutMs
    );

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await doWebFetchCall();

      const content = (response as { content?: Array<{ type: string; content?: unknown; text?: string }> }).content;
      if (hasWebFetchToolError(content ?? null)) {
        return extractBrandIntelligenceFromUrl(url);
      }

      let rawText = "";
      for (const block of content ?? []) {
        if (block.type === "text" && typeof block.text === "string") {
          rawText += block.text;
        }
      }

      const raw = extractFirstValidJsonObject(rawText);
      if (!raw) {
        return extractBrandIntelligenceFromUrl(url);
      }
      return normalizeBrandIntelligence(raw as Partial<BrandIntelligence> & Record<string, unknown>);
    } catch (err) {
      // #region agent log
      const errMsg = err instanceof Error ? err.message : String(err);
      fetch('http://127.0.0.1:7242/ingest/619a2aaf-4d05-4e48-a482-ad27c306e60f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/extract-brand-intelligence.ts:ViaWebFetch:catch',message:'doWebFetchCall threw',data:{attempt,errMsg,promptTooLong:errMsg.includes('prompt is too long')},timestamp:Date.now(),hypothesisId:'H1,H2'})}).catch(()=>{});
      // #endregion
      lastErr = err;
      if (attempt === 1) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/619a2aaf-4d05-4e48-a482-ad27c306e60f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/extract-brand-intelligence.ts:ViaWebFetch:fallback',message:'Falling back to FromUrl',data:{url},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        return extractBrandIntelligenceFromUrl(url);
      }
    }
  }

  throw lastErr;
}
