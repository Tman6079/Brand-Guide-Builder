import Anthropic from "@anthropic-ai/sdk";
import type { BrandIntelligence } from "../types/brand-intelligence";

const NOT_PROVIDED = "Not provided.";

const FIELD_LABELS: Record<keyof BrandIntelligence, string> = {
  business_name: "Business name",
  logo_url: "Logo URL",
  origin_story: "Origin story",
  business_goals: "Business goals",
  slogan_or_tagline: "Slogan or tagline",
  unique_differentiators: "Unique differentiators",
  primary_customer_result: "Primary customer result",
  ideal_customer_review_example: "Ideal customer review example",
  accreditations_and_awards: "Accreditations and awards",
  core_values: "Core values",
  desired_emotional_response: "Desired emotional response",
  brand_voice_description: "Brand voice description",
  brand_tone: "Brand tone",
  brand_should_not_sound_like: "Brand should not sound like",
  desired_brand_perception: "Desired brand perception",
  buyer_persona: "Buyer persona",
  local_area_name: "Local area name",
  five_step_process: "Five step process",
  weather_events_causing_service_needs: "Weather events causing service needs",
  handles_insurance_claims: "Handles insurance claims",
  offers_drone_inspections: "Offers drone inspections",
  year_founded: "Year founded",
  preferred_call_to_action: "Preferred call to action",
  offers_financing: "Offers financing",
  financing_callouts: "Financing callouts",
  financing_disclaimers: "Financing disclaimers",
  reference_example_content: "Reference example content",
};

const BRAND_INTELLIGENCE_KEYS: (keyof BrandIntelligence)[] = [
  "business_name",
  "logo_url",
  "origin_story",
  "business_goals",
  "slogan_or_tagline",
  "unique_differentiators",
  "primary_customer_result",
  "ideal_customer_review_example",
  "accreditations_and_awards",
  "core_values",
  "desired_emotional_response",
  "brand_voice_description",
  "brand_tone",
  "brand_should_not_sound_like",
  "desired_brand_perception",
  "buyer_persona",
  "local_area_name",
  "five_step_process",
  "weather_events_causing_service_needs",
  "handles_insurance_claims",
  "offers_drone_inspections",
  "year_founded",
  "preferred_call_to_action",
  "offers_financing",
  "financing_callouts",
  "financing_disclaimers",
  "reference_example_content",
];

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "" || value.trim() === "Not Provided";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function formatValue(value: unknown): string {
  if (value == null || value === "") return NOT_PROVIDED;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "Not Provided" ? NOT_PROVIDED : trimmed;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return NOT_PROVIDED;
    return value.map((v) => (typeof v === "string" ? v : String(v))).join("\n");
  }
  return String(value);
}

/**
 * Generates a clean "inputs" block (labels + values) for use in the brand guide prompt.
 * Missing, empty, or "Not Provided" values are output as "Not provided."
 * Arrays are formatted as multi-line lists (one item per line with "  - ").
 */
export function formatBrandIntelligenceForPrompt(brand: BrandIntelligence): string {
  const lines: string[] = [];
  for (const key of BRAND_INTELLIGENCE_KEYS) {
    const value = brand[key];
    const label = FIELD_LABELS[key];
    if (isEmpty(value)) {
      lines.push(`${label}: ${NOT_PROVIDED}`);
      continue;
    }
    if (Array.isArray(value)) {
      lines.push(`${label}:`);
      for (const v of value) lines.push(`  - ${typeof v === "string" ? v : String(v)}`);
    } else {
      lines.push(`${label}: ${formatValue(value)}`);
    }
  }
  return lines.join("\n");
}

const BRAND_GUIDE_SYSTEM_PROMPT = `**Instructions:** Output each section below under a clearly labeled heading. Follow the instructions within each section for input mapping and writing style. Start each section with a level-3 Markdown heading on its own line: use exactly \`### Section Name\` (e.g. \`### Mission Statement\`, \`### Unique Value Proposition (UVP)\`, \`### Primary Audience\`, \`### Audience Needs & Pain Points\`, \`### Brand Voice & Personality\`, \`### Messaging Foundations\`, \`### Content Guidelines\`).

🗂️ INPUTS YOU WILL RECEIVE
You will be provided with:

- Business Name
- Origin Story — what made you decide to start this business?
- Goals for yourself and/or your company
- Slogan, tagline, or motto (if any)
- What separates your company from local competitors
- Primary result customers want from your work
- Example of an ideal review
- Accreditations, memberships, and awards
- Desired feeling when someone visits your site
- Brand voice description
- What the brand should NOT sound like
- Reference/example content
- 3–5 core values
- Desired brand perception
- Brand tone
- Buyer persona
- Local area name (what the service area is called by locals)
- 5-step process for how your company gets jobs done
- Types of weather events that cause service needs in your area
- Whether you handle insurance claims from storms
- Whether you offer drone inspections/estimates
- Year business was founded
- Preferred call to action for buttons
- Whether you offer financing
- 5 key callouts of your financing options
- Disclaimers about your financing

---

### Mission Statement

Using the company's origin story, goals, and core values, write a clear and authentic mission statement (1–2 sentences) that:
- Reflects why the business exists and what it promises customers
- Feels relevant to the brand's primary audience and local context
- Uses action verbs and avoids generic or vague phrasing
- (Optional) Includes a nod to a key differentiator, if provided

---

### Unique Value Proposition (UVP)

Using the answers about what separates the company from local competitors, the primary result customers want, any unique processes or guarantees, and (optionally) relevant accreditations or awards:
- Write a clear, specific Unique Value Proposition (1–2 sentences) that:
    - States the main benefit or promise to customers
    - Highlights what makes this business uniquely different in its market or region
    - Feels authentic and tailored to the primary audience
    - Uses concrete language, avoids generic phrasing, and, if possible, references a process, guarantee, or award that proves the claim

---

### Primary Audience

Write a clear and specific description of the brand's primary audience (1–2 sentences) that:
- States who they are (demographics, role, or situation)
- Includes location or service area if relevant
- Feels human and relatable, not generic or overly formal

---

### Audience Needs & Pain Points

Using answers about the primary result customers want, common weather events, whether the business handles insurance, offers financing, and any specific scenarios or challenges described:
- Write a concise summary (1–2 sentences or a bullet list) of the main needs, pain points, and desired outcomes for the brand's primary audience.
    - Be specific about the events or frustrations that prompt them to seek help.
    - Include emotional or practical drivers (e.g., peace of mind, avoiding hassle, urgency, safety).
    - Make it feel relatable and grounded in the local/service context.

---

### Brand Voice & Personality

Using the brand voice description, tone, desired feeling, brand perception, core values, and "what not to sound like" responses:
- Write a clear, actionable summary (short paragraph or bullets) of the brand's voice and personality.
    - List 3–5 personality traits or adjectives that reflect the brand's style.
    - Specify the desired emotional impact on the audience.
    - Include explicit language guidelines—what the brand voice should and should not sound like.
    - Use examples or sample phrases if provided.

---

### Messaging Foundations

Using the tagline/motto, example reviews, process descriptions, value statements, and answers about desired CTAs:
- Write the following messaging foundations:
    - **Tagline:** If provided, use it exactly as given. Otherwise, synthesize a short, memorable phrase reflecting the brand's promise.
    - **Elevator Pitch:** In 1–2 sentences, summarize who the business serves, what it does, and why it matters—using information from the origin story, goals, and unique value proposition. Make it clear, human, and audience-relevant.
    - **Key Brand Messages:** List 2–4 recurring messages, each 1–2 sentences or phrases, that highlight the business's differentiators, process, trust factors, or values. Prioritize messages that would matter most to the primary audience.
    - **Required CTAs:** List the specific calls-to-action or button text provided by the client. If multiple are mentioned (e.g., "Call now" and "Ask about financing"), include all as separate items.

---

### Content Guidelines

Using answers about desired style, brand voice, sample content, disclaimers, section preferences, and any formatting or linking rules:
- Write a clear, actionable set of content guidelines in bullet or short-paragraph format.
    - Specify stylistic "dos" (tone, style, approach) and "don'ts" (phrases or formats to avoid).
    - Include any required disclaimers or compliance language.
    - Reference example content, reviews, or sample links as models to follow.
    - Note any must-have content sections or structural guidelines.
    - If any formatting or linking/CTA placement rules are given, include those instructions.
    - Make sure the guidelines are concise, specific, and easily followed by writers or LLMs.

---

Use \`###\` for every section title so they render as headings. Output Markdown only. No JSON, no commentary, no preamble.`;

/**
 * Calls the Anthropic API to generate the final brand guide in Markdown.
 * Uses only the provided BrandIntelligence; does not invent or infer missing information.
 *
 * @param brand - Structured brand input (e.g. from extraction or survey)
 * @returns The brand guide as a single Markdown string
 * @throws If ANTHROPIC_API_KEY is not set or the API request fails
 */
export async function generateBrandGuideMarkdown(brand: BrandIntelligence): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const inputsBlock = formatBrandIntelligenceForPrompt(brand);
  const userMessage = `Use ONLY the inputs below. Do not invent or infer missing information. Output Markdown only.\n\n--- Inputs ---\n\n${inputsBlock}`;

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_BRANDGUIDE_MODEL ?? "claude-sonnet-4-20250514";

  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    system: BRAND_GUIDE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  let markdown = "";
  for (const block of response.content ?? []) {
    if (block.type === "text" && "text" in block && typeof (block as { text: string }).text === "string") {
      markdown += (block as { text: string }).text;
    }
  }
  return markdown.trim();
}
