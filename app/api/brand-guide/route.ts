import { NextResponse } from "next/server";
import type { BrandIntelligence } from "@/types/brand-intelligence";
import type { BrandProfile } from "@/types/brand-profile";
import {
  extractBrandIntelligenceFromUrl,
  extractBrandIntelligenceFromUrlViaWebFetch,
} from "@/lib/extract-brand-intelligence";
import { generateBrandGuideMarkdown } from "@/lib/generate-brand-guide";
import { generateBrandProfileFromUrlViaWebFetch } from "@/lib/generate-brand-profile";

function isValidUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url.trim()) return false;
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

async function runGuideFlow(url: string): Promise<string> {
  let brand: BrandIntelligence;
  try {
    brand = await extractBrandIntelligenceFromUrl(url);
  } catch {
    brand = await extractBrandIntelligenceFromUrlViaWebFetch(url);
  }
  return generateBrandGuideMarkdown(brand);
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

    const trimmedUrl = url.trim();

    const [guideResult, profileResult] = await Promise.allSettled([
      runGuideFlow(trimmedUrl),
      generateBrandProfileFromUrlViaWebFetch(trimmedUrl),
    ]);

    const markdown =
      guideResult.status === "fulfilled" ? guideResult.value : null;
    const profile =
      profileResult.status === "fulfilled" ? profileResult.value : null;

    const errors: { guide?: string; profile?: string } | null =
      guideResult.status === "rejected" || profileResult.status === "rejected"
        ? {}
        : null;
    if (guideResult.status === "rejected") {
      errors!.guide = guideResult.reason instanceof Error ? guideResult.reason.message : String(guideResult.reason);
    }
    if (profileResult.status === "rejected") {
      errors!.profile = profileResult.reason instanceof Error ? profileResult.reason.message : String(profileResult.reason);
    }

    return NextResponse.json({
      markdown,
      profile,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
