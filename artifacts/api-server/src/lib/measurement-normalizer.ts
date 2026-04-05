interface NormalizedMeasurement {
  originalText: string;
  value: number | null;
  unit: string;
  normalizedText: string;
  type: "diameter" | "thickness" | "length" | "width" | "weight" | "pressure" | "generic";
}

const UNIT_CONVERSIONS: Record<string, { factor: number; target: string }> = {
  '"': { factor: 25.4, target: "mm" },
  "in": { factor: 25.4, target: "mm" },
  "inch": { factor: 25.4, target: "mm" },
  "inches": { factor: 25.4, target: "mm" },
  "pulgada": { factor: 25.4, target: "mm" },
  "pulgadas": { factor: 25.4, target: "mm" },
  "pulg": { factor: 25.4, target: "mm" },
  "cm": { factor: 10, target: "mm" },
  "m": { factor: 1000, target: "mm" },
  "mts": { factor: 1000, target: "mm" },
  "metros": { factor: 1000, target: "mm" },
  "metro": { factor: 1000, target: "mm" },
  "ft": { factor: 304.8, target: "mm" },
  "pie": { factor: 304.8, target: "mm" },
  "pies": { factor: 304.8, target: "mm" },
  "mm": { factor: 1, target: "mm" },
  "kg": { factor: 1, target: "kg" },
  "kgs": { factor: 1, target: "kg" },
  "kilos": { factor: 1, target: "kg" },
  "kilogramos": { factor: 1, target: "kg" },
  "ton": { factor: 1000, target: "kg" },
  "tn": { factor: 1000, target: "kg" },
  "toneladas": { factor: 1000, target: "kg" },
};

const FRACTION_MAP: Record<string, number> = {
  "1/8": 0.125, "1/4": 0.25, "3/8": 0.375, "1/2": 0.5,
  "5/8": 0.625, "3/4": 0.75, "7/8": 0.875,
  "1/16": 0.0625, "3/16": 0.1875, "5/16": 0.3125, "7/16": 0.4375,
  "9/16": 0.5625, "11/16": 0.6875, "13/16": 0.8125, "15/16": 0.9375,
};

const DN_MAP: Record<string, number> = {
  "DN15": 21.3, "DN20": 26.7, "DN25": 33.4, "DN32": 42.2, "DN40": 48.3,
  "DN50": 60.3, "DN65": 73.0, "DN80": 88.9, "DN100": 114.3, "DN125": 141.3,
  "DN150": 168.3, "DN200": 219.1, "DN250": 273.0, "DN300": 323.9,
  "DN350": 355.6, "DN400": 406.4, "DN450": 457.0, "DN500": 508.0,
  "DN600": 610.0, "DN750": 762.0, "DN900": 914.0,
};

const NPS_TO_MM: Record<string, number> = {
  "1/8": 10.3, "1/4": 13.7, "3/8": 17.1, "1/2": 21.3, "3/4": 26.7,
  "1": 33.4, "1-1/4": 42.2, "1-1/2": 48.3, "2": 60.3, "2-1/2": 73.0,
  "3": 88.9, "4": 114.3, "5": 141.3, "6": 168.3, "8": 219.1,
  "10": 273.0, "12": 323.9, "14": 355.6, "16": 406.4, "18": 457.0,
  "20": 508.0, "24": 610.0, "30": 762.0, "36": 914.0,
};

const STANDARD_ALIASES: Record<string, string> = {
  "astm a53": "ASTM A53", "a53": "ASTM A53",
  "astm a106": "ASTM A106", "a106": "ASTM A106",
  "astm a333": "ASTM A333", "a333": "ASTM A333",
  "astm a312": "ASTM A312", "a312": "ASTM A312",
  "astm a269": "ASTM A269", "a269": "ASTM A269",
  "astm a213": "ASTM A213", "a213": "ASTM A213",
  "astm a519": "ASTM A519", "a519": "ASTM A519",
  "api 5l": "API 5L", "api5l": "API 5L",
  "api 5ct": "API 5CT", "api5ct": "API 5CT",
  "asme b16.5": "ASME B16.5", "b16.5": "ASME B16.5",
  "asme b16.9": "ASME B16.9", "b16.9": "ASME B16.9",
  "asme b16.11": "ASME B16.11", "b16.11": "ASME B16.11",
  "din 2440": "DIN 2440", "din 2441": "DIN 2441",
  "iram 2502": "IRAM 2502", "iram 2467": "IRAM 2467",
  "sae 1010": "SAE 1010", "sae 1020": "SAE 1020", "sae 1045": "SAE 1045",
  "sch 40": "SCH 40", "sch40": "SCH 40", "schedule 40": "SCH 40",
  "sch 80": "SCH 80", "sch80": "SCH 80", "schedule 80": "SCH 80",
  "sch 160": "SCH 160", "sch160": "SCH 160",
  "xxs": "XXS", "xs": "XS", "std": "STD",
};

export function normalizeMeasurement(text: string): NormalizedMeasurement {
  const original = text.trim();
  const lower = original.toLowerCase();

  const dnMatch = lower.match(/dn\s*(\d+)/i);
  if (dnMatch) {
    const dn = `DN${dnMatch[1]}`;
    const mm = DN_MAP[dn];
    return {
      originalText: original,
      value: mm || parseInt(dnMatch[1]),
      unit: "mm",
      normalizedText: mm ? `${dn} (${mm}mm OD)` : dn,
      type: "diameter",
    };
  }

  const fractionInchMatch = lower.match(/(\d+)?\s*[-]?\s*(\d+\/\d+)\s*["''″]?\s*(pulgada|pulg|inch|in)?/i);
  if (fractionInchMatch) {
    const whole = fractionInchMatch[1] ? parseInt(fractionInchMatch[1]) : 0;
    const fraction = FRACTION_MAP[fractionInchMatch[2]] || 0;
    const inches = whole + fraction;
    const mm = inches * 25.4;
    const npsKey = whole > 0 ? `${whole}-${fractionInchMatch[2]}` : fractionInchMatch[2];
    const od = NPS_TO_MM[npsKey] || NPS_TO_MM[String(inches)];
    return {
      originalText: original,
      value: od || mm,
      unit: "mm",
      normalizedText: od ? `${inches}" (${od}mm OD)` : `${inches}" (${mm.toFixed(1)}mm)`,
      type: "diameter",
    };
  }

  const decimalInchMatch = lower.match(/(\d+(?:\.\d+)?)\s*["''″]\s*/);
  if (decimalInchMatch) {
    const inches = parseFloat(decimalInchMatch[1]);
    const od = NPS_TO_MM[String(inches)];
    const mm = inches * 25.4;
    return {
      originalText: original,
      value: od || mm,
      unit: "mm",
      normalizedText: od ? `${inches}" (${od}mm OD)` : `${inches}" (${mm.toFixed(1)}mm)`,
      type: "diameter",
    };
  }

  const numberUnitMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m|mts|metros|metro|ft|pie|pies|kg|kgs|ton|tn|kilogramos|toneladas|pulgadas?|pulg|inch|inches|in)\b/i);
  if (numberUnitMatch) {
    const value = parseFloat(numberUnitMatch[1].replace(",", "."));
    const unit = numberUnitMatch[2].toLowerCase();
    const conv = UNIT_CONVERSIONS[unit];
    if (conv) {
      const converted = value * conv.factor;
      let type: NormalizedMeasurement["type"] = "generic";
      if (conv.target === "mm") type = "diameter";
      if (conv.target === "kg") type = "weight";
      return {
        originalText: original,
        value: converted,
        unit: conv.target,
        normalizedText: `${converted.toFixed(1)}${conv.target}`,
        type,
      };
    }
  }

  const plainNumber = lower.match(/^(\d+(?:[.,]\d+)?)\s*$/);
  if (plainNumber) {
    return {
      originalText: original,
      value: parseFloat(plainNumber[1].replace(",", ".")),
      unit: "unknown",
      normalizedText: original,
      type: "generic",
    };
  }

  return {
    originalText: original,
    value: null,
    unit: "unknown",
    normalizedText: original,
    type: "generic",
  };
}

export function normalizeStandard(text: string): string {
  const lower = text.toLowerCase().trim();
  return STANDARD_ALIASES[lower] || text.trim().toUpperCase();
}

export function normalizeMeasurements(texts: string[]): NormalizedMeasurement[] {
  return texts.map(normalizeMeasurement);
}

export interface MatchResult {
  productId: number;
  productName: string;
  productCode: string | null;
  productDimensions: string | null;
  productStandard: string | null;
  matchType: "exact" | "approximate" | "no_match";
  score: number;
  matchedOn: string;
}

export function calculateMatchScore(
  searchValue: number | null,
  searchUnit: string,
  productDimensions: string,
  searchStandard?: string,
  productStandard?: string | null,
): { score: number; matchType: "exact" | "approximate" | "no_match"; matchedOn: string } {
  if (!productDimensions && !productStandard) {
    return { score: 0, matchType: "no_match", matchedOn: "" };
  }

  let score = 0;
  let matchedOn = "";

  if (searchValue && productDimensions) {
    const normalized = normalizeMeasurement(productDimensions);
    if (normalized.value && normalized.unit === searchUnit) {
      const diff = Math.abs(normalized.value - searchValue);
      const tolerance = searchValue * 0.02;

      if (diff < 0.01) {
        score += 80;
        matchedOn = "dimensión_exacta";
      } else if (diff <= tolerance) {
        score += 60;
        matchedOn = "dimensión_aproximada";
      } else if (diff <= searchValue * 0.1) {
        score += 30;
        matchedOn = "dimensión_cercana";
      }
    }

    const dimLower = productDimensions.toLowerCase();
    const searchText = searchValue.toFixed(1);
    if (dimLower.includes(searchText)) {
      score = Math.max(score, 50);
      if (!matchedOn) matchedOn = "texto_dimensión";
    }
  }

  if (searchStandard && productStandard) {
    const normSearch = normalizeStandard(searchStandard);
    const normProduct = normalizeStandard(productStandard);
    if (normSearch === normProduct) {
      score += 20;
      matchedOn += (matchedOn ? "+" : "") + "norma_exacta";
    }
  }

  let matchType: "exact" | "approximate" | "no_match" = "no_match";
  if (score >= 80) matchType = "exact";
  else if (score >= 30) matchType = "approximate";

  return { score, matchType, matchedOn };
}
