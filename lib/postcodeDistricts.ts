export type DistrictPosition = {
  x: number;
  y: number;
  known: boolean;
};

const DISTRICT_POSITIONS: Record<string, { x: number; y: number }> = {
  DN1: { x: 49, y: 45 },
  DN2: { x: 55, y: 39 },
  DN3: { x: 61, y: 43 },
  DN4: { x: 48, y: 55 },
  DN5: { x: 42, y: 42 },
  DN6: { x: 43, y: 30 },
  DN7: { x: 63, y: 55 },
  DN8: { x: 68, y: 45 },
  DN9: { x: 55, y: 68 },
  DN10: { x: 40, y: 65 },
  DN11: { x: 33, y: 73 },
  DN12: { x: 35, y: 52 },
  S1: { x: 24, y: 52 },
  S2: { x: 28, y: 58 },
  S3: { x: 22, y: 47 },
  S4: { x: 29, y: 44 },
  S5: { x: 24, y: 39 },
  S6: { x: 17, y: 42 },
  S7: { x: 20, y: 60 },
  S8: { x: 24, y: 66 },
  S9: { x: 32, y: 48 },
  S10: { x: 14, y: 52 },
  S11: { x: 16, y: 59 },
  S12: { x: 31, y: 63 },
  S13: { x: 35, y: 54 },
  S14: { x: 28, y: 61 },
  S17: { x: 17, y: 69 },
  S18: { x: 22, y: 78 },
  S20: { x: 33, y: 68 },
  S21: { x: 38, y: 72 },
  S25: { x: 36, y: 78 },
  S26: { x: 39, y: 63 },
  S35: { x: 18, y: 31 },
  S36: { x: 14, y: 25 },
  S60: { x: 35, y: 37 },
  S61: { x: 31, y: 32 },
  S62: { x: 38, y: 29 },
  S63: { x: 40, y: 41 },
  S64: { x: 44, y: 37 },
  S65: { x: 38, y: 46 },
  S66: { x: 43, y: 48 },
  S70: { x: 25, y: 27 },
  S71: { x: 29, y: 23 },
  S72: { x: 35, y: 24 },
  S73: { x: 34, y: 33 },
  S74: { x: 23, y: 33 },
  S75: { x: 20, y: 21 },
  S80: { x: 35, y: 83 },
  S81: { x: 42, y: 82 },
};

const GENERIC_AREA_VALUES = new Set(["AREA", "AREA NOT PROVIDED", "LOCAL", "UNKNOWN"]);

function hashDistrict(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function normalizePostcodeDistrict(value?: string | null): string {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || GENERIC_AREA_VALUES.has(raw)) return "";
  const firstArea = raw.split(/->|→/)[0]?.trim() || raw;
  if (GENERIC_AREA_VALUES.has(firstArea)) return "";
  const match = firstArea.match(/\b[A-Z]{1,2}\d[A-Z\d]?\b/);
  if (match) return match[0];
  const normalized = firstArea.split(/\s+/)[0]?.replace(/[^A-Z0-9]/g, "") || "";
  const fullPostcodeMatch = normalized.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
  if (fullPostcodeMatch) return fullPostcodeMatch[1];
  return GENERIC_AREA_VALUES.has(normalized) ? "" : normalized;
}

export function isValidPostcodeDistrict(value?: string | null): boolean {
  return /^[A-Z]{1,2}\d[A-Z\d]?$/.test(normalizePostcodeDistrict(value));
}

export function getDistrictPosition(district: string): DistrictPosition {
  const normalized = normalizePostcodeDistrict(district);
  const known = DISTRICT_POSITIONS[normalized];
  if (known) return { ...known, known: true };

  const hash = hashDistrict(normalized || "LOCAL");
  return {
    x: 18 + (hash % 62),
    y: 22 + ((hash >> 6) % 54),
    known: false,
  };
}
