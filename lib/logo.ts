/**
 * Local placeholder marks for supplier tiles. The catalog has company names,
 * not real logos — each name hashes to one of the SVG marks in
 * /public/supplier-marks/. Initials remain the onError fallback.
 */
import { BASE_PATH } from "@/lib/base-path";

export const PLACEHOLDER_MARK_COUNT = 12;

export function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/** Stable path to a local placeholder mark for this company name. */
export function placeholderMarkSrc(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 33 + name.charCodeAt(index)) >>> 0;
  }
  const slot = (hash % PLACEHOLDER_MARK_COUNT) + 1;
  return `${BASE_PATH}/supplier-marks/${String(slot).padStart(2, "0")}.svg`;
}
