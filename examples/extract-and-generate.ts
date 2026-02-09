/**
 * Minimal example: extract brand intelligence from a URL (via web fetch),
 * then generate the brand guide Markdown.
 *
 * Usage: npx tsx examples/extract-and-generate.ts [url]
 * Requires: ANTHROPIC_API_KEY
 */

import { extractBrandIntelligenceFromUrlViaWebFetch } from "../lib/extract-brand-intelligence";
import { generateBrandGuideMarkdown } from "../lib/generate-brand-guide";

const DEFAULT_URL = "https://example.com";

/**
 * Extracts brand intelligence from the given URL (using Claude web fetch),
 * then generates and returns the brand guide as Markdown.
 */
export async function extractAndGenerateBrandGuide(url: string): Promise<string> {
  const brand = await extractBrandIntelligenceFromUrlViaWebFetch(url);
  const markdown = await generateBrandGuideMarkdown(brand);
  return markdown;
}

async function main(): Promise<void> {
  const url = process.argv[2] ?? DEFAULT_URL;
  const markdown = await extractAndGenerateBrandGuide(url);
  console.log(markdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
