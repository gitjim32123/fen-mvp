export type ModerationResult = {
  score: number;
  signals: string[];
  action: "allow" | "warn" | "block";
};

const STRONG_SIGNALS: { pattern: RegExp; label: string; points: number }[] = [
  { pattern: /0\d{9,10}/g, label: "Phone number detected", points: 5 },
  { pattern: /07\d{9}/g, label: "UK mobile number detected", points: 5 },
  { pattern: /\+?[\d\s\-().]{10,}/g, label: "Phone number detected", points: 4 },
  { pattern: /https?:\/\/[^\s]+/gi, label: "URL detected", points: 4 },
  { pattern: /www\.[^\s]+/gi, label: "Website URL detected", points: 3 },
  { pattern: /\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/gi, label: "Email address detected", points: 4 },
  { pattern: /fully\s+insured/gi, label: '"Fully insured" found', points: 4 },
  { pattern: /free\s+quote/gi, label: '"Free quote" found', points: 4 },
  { pattern: /quote\s+for\s+(free|cheap)/gi, label: '"Quote for free/cheap" found', points: 3 },
  { pattern: /message\s+(me|us)\s+(for|about)\s+(quotes?|price)/gi, label: '"Message for quotes" found', points: 4 },
  { pattern: /contact\s+(me|us)/gi, label: '"Contact me/us" found', points: 3 },
  { pattern: /book\s+now/gi, label: '"Book now" found', points: 3 },
  { pattern: /available\s+24\s*[\/\-]?\s*7/gi, label: '"Available 24/7" found', points: 3 },
  { pattern: /registered\s+(business|company|trader)/gi, label: '"Registered business" found', points: 3 },
  { pattern: /(^|\s)ltd\.?(\s|$)/gi, label: "Business Ltd detected", points: 3 },
  { pattern: /(^|\s)plc\.?(\s|$)/gi, label: "Business PLC detected", points: 3 },
  { pattern: /call\s+(me|us)\s+on/gi, label: '"Call me on" found', points: 4 },
  { pattern: /whatsapp/gi, label: "WhatsApp reference found", points: 3 },
];

const MEDIUM_SIGNALS: { pattern: RegExp; label: string; points: number }[] = [
  { pattern: /\d+\s+years?\s+(of\s+)?experience/gi, label: '"Years experience" found', points: 2 },
  { pattern: /competitive\s+(rates?|price)/gi, label: '"Competitive rates" found', points: 2 },
  { pattern: /professional\s+(service|handyman|builder|cleaner|trader)/gi, label: '"Professional service" found', points: 2 },
  { pattern: /reliable\s+(service|trader|worker)/gi, label: '"Reliable service" found', points: 2 },
  { pattern: /highly\s+rated/gi, label: '"Highly rated" found', points: 2 },
  { pattern: /check\s+my\s+(reviews?|profile|page)/gi, label: '"Check my reviews" found', points: 2 },
  { pattern: /trusted\s+(trader|provider|service)/gi, label: '"Trusted trader" found', points: 2 },
  { pattern: /no\s+job\s+(too\s+)?(small|large|big)/gi, label: "Business marketing phrase", points: 2 },
  { pattern: /domestic\s+and\s+commercial/gi, label: "Business marketing phrase", points: 2 },
  { pattern: /fully\s+equipped/gi, label: '"Fully equipped" found', points: 2 },
];

const SERVICE_WORDS = [
  "cleaning", "plumbing", "plumber", "roofing", "roofer", "electrical", "electrician",
  "painting", "painter", "decorating", "decorator", "carpentry", "carpenter",
  "landscaping", "landscape", "paving", "flooring", "tiling", "tiler",
  "damp", "conversion", "extension", "build", "builder",
  "maintenance", "handyman", "trade", "tradesman",
  "waste", "clearance", "removal", "skip",
];

function countServiceWords(text: string): number {
  let count = 0;
  for (const word of SERVICE_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    const matches = text.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

function countEmojis(text: string): number {
  return (text.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
}

function hasRepeatedPhrases(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/);
  const seen = new Set<string>();
  for (const word of words) {
    if (word.length > 4 && seen.has(word)) return true;
    seen.add(word);
  }
  return false;
}

export function scoreBusinessAdRisk(input: {
  title: string;
  description: string;
  recentPostCount?: number;
  duplicateSimilarity?: number;
}): ModerationResult {
  const { title, description, recentPostCount = 0, duplicateSimilarity = 0 } = input;
  const text = (title + " " + description).toLowerCase();
  let score = 0;
  const signals: string[] = [];

  for (const { pattern, label, points } of STRONG_SIGNALS) {
    if (pattern.test(text)) {
      score += points;
      signals.push(label);
    }
  }

  for (const { pattern, label, points } of MEDIUM_SIGNALS) {
    if (pattern.test(text)) {
      score += points;
      signals.push(label);
    }
  }

  const serviceWordCount = countServiceWords(text);
  if (serviceWordCount >= 3) {
    score += 2;
    signals.push(`Multiple service types listed (${serviceWordCount})`);
  }

  const emojiCount = countEmojis(text);
  if (emojiCount >= 4) {
    score += 1;
    signals.push(`${emojiCount} emojis found`);
  }

  if (hasRepeatedPhrases(text)) {
    score += 2;
    signals.push("Repeated phrases detected");
  }

  if (recentPostCount > 3) {
    score += 3;
    signals.push(`${recentPostCount} recent posts detected`);
  }

  if (duplicateSimilarity > 0.8) {
    score += 5;
    signals.push("High similarity to previous posts");
  }

  let action: ModerationResult["action"] = "allow";
  if (score >= 8) action = "block";
  else if (score >= 4) action = "warn";

  return { score, signals, action };
}
