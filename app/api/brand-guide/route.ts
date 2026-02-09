import { NextResponse } from "next/server";
import type { BrandIntelligence } from "@/types/brand-intelligence";
import {
  extractBrandIntelligenceFromUrl,
  extractBrandIntelligenceFromUrlViaWebFetch,
} from "@/lib/extract-brand-intelligence";
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

    const trimmedUrl = url.trim();
    // Prefer server-side fetch: we convert HTML to visible text and cap length, avoiding "prompt is too long".
    // Fall back to web_fetch only when server-side fetch fails (e.g. CORS).
    let brand: BrandIntelligence;
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/619a2aaf-4d05-4e48-a482-ad27c306e60f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/brand-guide/route.ts:primary',message:'Trying FromUrl first (capped visible text)',data:{url:trimmedUrl},timestamp:Date.now(),runId:'post-fix'})}).catch(()=>{});
      // #endregion
      brand = await extractBrandIntelligenceFromUrl(trimmedUrl);
    } catch (primaryErr) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/619a2aaf-4d05-4e48-a482-ad27c306e60f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/brand-guide/route.ts:fallback',message:'FromUrl failed, trying ViaWebFetch',data:{url:trimmedUrl,errMsg:primaryErr instanceof Error ? primaryErr.message : String(primaryErr)},timestamp:Date.now(),runId:'post-fix'})}).catch(()=>{});
      // #endregion
      brand = await extractBrandIntelligenceFromUrlViaWebFetch(trimmedUrl);
    }

    const markdown = await generateBrandGuideMarkdown(brand);

    return NextResponse.json({ markdown, brand });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
