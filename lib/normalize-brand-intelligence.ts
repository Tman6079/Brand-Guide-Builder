import type { BrandIntelligence } from "../types/brand-intelligence";

const NOT_PROVIDED = "Not Provided";

/**
 * Normalizes empty or whitespace-only strings to "Not Provided".
 * Use for string fields returned by the extraction API.
 */
export function normalizeEmptyString(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Normalizes boolean-style API values ("Yes" / "No" / "Not Provided") to boolean or undefined.
 */
export function normalizeBooleanField(
  value: string | boolean | null | undefined
): boolean | undefined {
  if (value === true || value === false) return value;
  if (value == null) return undefined;
  const s = String(value).trim().toLowerCase();
  if (s === "yes" || s === "true" || s === "1") return true;
  if (s === "no" || s === "false" || s === "0") return false;
  return undefined;
}

/** Keys that are boolean in BrandIntelligence and come as "Yes"/"No"/"Not Provided" from the API. */
const BOOLEAN_KEYS = new Set([
  "handles_insurance_claims",
  "offers_drone_inspections",
  "offers_financing",
]);

/**
 * Normalizes raw extraction output into a valid BrandIntelligence object:
 * - Empty strings -> "Not Provided" (or omitted)
 * - Boolean-style string fields -> boolean | undefined
 * - logo_url null/empty -> undefined
 */
export function normalizeBrandIntelligence(
  raw: Record<string, unknown> & Partial<BrandIntelligence>
): BrandIntelligence {
  const out: BrandIntelligence = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!(key in raw) || value === undefined) continue;

    if (BOOLEAN_KEYS.has(key)) {
      const b = normalizeBooleanField(value as string | boolean);
      if (b !== undefined) (out as Record<string, unknown>)[key] = b;
      continue;
    }

    if (Array.isArray(value)) {
      (out as Record<string, unknown>)[key] = value.length ? value : undefined;
      continue;
    }

    if (typeof value === "string") {
      const normalized = normalizeEmptyString(value);
      if (normalized !== undefined) (out as Record<string, unknown>)[key] = normalized;
      else if (key === "logo_url") continue; // leave logo_url undefined when empty
      else (out as Record<string, unknown>)[key] = NOT_PROVIDED;
      continue;
    }

    if (typeof value === "number" && key === "year_founded") {
      (out as Record<string, unknown>)[key] = value;
      continue;
    }

    if (value !== null && typeof value === "object") continue;
    (out as Record<string, unknown>)[key] = value;
  }

  return out;
}
