export interface ExtractedMeasurement {
  values: Record<string, number>;
  unit: 'INCH' | 'CM';
  confidence: number;
}

export function parseVoiceMeasurementText(text: string): ExtractedMeasurement {
  const result: Record<string, number> = {};
  const lower = text.toLowerCase();

  // Pattern matching for typical tailoring speech inputs
  const patterns: Record<string, RegExp[]> = {
    chest: [/chest\s*(?:is|equals)?\s*(\d+(?:\.\d+)?)/i, /chati\s*(\d+(?:\.\d+)?)/i, /bust\s*(\d+(?:\.\d+)?)/i],
    waist: [/waist\s*(?:is|equals)?\s*(\d+(?:\.\d+)?)/i, /kamar\s*(\d+(?:\.\d+)?)/i],
    hip: [/hip\s*(?:is|equals)?\s*(\d+(?:\.\d+)?)/i, /seat\s*(\d+(?:\.\d+)?)/i],
    shoulder: [/shoulder\s*(?:is|equals)?\s*(\d+(?:\.\d+)?)/i, /tera\s*(\d+(?:\.\d+)?)/i],
    sleeve: [/sleeve\s*(?:length)?\s*(?:is|equals)?\s*(\d+(?:\.\d+)?)/i, /aasteen\s*(\d+(?:\.\d+)?)/i],
    length: [/length\s*(?:is|equals)?\s*(\d+(?:\.\d+)?)/i, /lambai\s*(\d+(?:\.\d+)?)/i],
    neck: [/neck\s*(?:is|equals)?\s*(\d+(?:\.\d+)?)/i, /collar\s*(\d+(?:\.\d+)?)/i, /gala\s*(\d+(?:\.\d+)?)/i],
    inseam: [/inseam\s*(\d+(?:\.\d+)?)/i],
    thigh: [/thigh\s*(\d+(?:\.\d+)?)/i, /raan\s*(\d+(?:\.\d+)?)/i],
    bottom: [/bottom\s*(\d+(?:\.\d+)?)/i, /morhi\s*(\d+(?:\.\d+)?)/i]
  };

  for (const [key, regexList] of Object.entries(patterns)) {
    for (const reg of regexList) {
      const match = lower.match(reg);
      if (match && match[1]) {
        result[key] = parseFloat(match[1]);
        break;
      }
    }
  }

  const isCm = lower.includes('cm') || lower.includes('centimeter');

  return {
    values: result,
    unit: isCm ? 'CM' : 'INCH',
    confidence: Object.keys(result).length > 0 ? 0.95 : 0.0
  };
}
