import { NextResponse } from "next/server";
import type { BrandIntelligence } from "@/types/brand-intelligence";
import { extractBrandIntelligenceFromUrlViaWebFetch } from "@/lib/extract-brand-intelligence";
import { generateBrandGuideMarkdown } from "@/lib/generate-brand-guide";

function isValidUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url.trim()) return false;
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = body?.url;

    if (!isValidUrl(url)) {
      return NextResponse.json(
        { error: "Invalid request: url must be a non-empty string starting with http:// or https://" },
        { status: 400 }
      );
    }

    const brand = await extractBrandIntelligenceFromUrlViaWebFetch(url.trim());
    const markdown = await generateBrandGuideMarkdown(brand);

    return NextResponse.json({ markdown, brand });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
