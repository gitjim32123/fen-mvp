import { supabase } from "./supabase";

export type SpamCheckResult = {
  score: number;
  matchedTitles: string[];
  action: "allow" | "warn" | "block";
};

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function normalizedSimilarity(a: string, b: string): number {
  const tA = tokenize(a);
  const tB = tokenize(b);
  return jaccardSimilarity(tA, tB);
}

function titleSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().replace(/\s+/g, " ").trim();
  const normB = b.toLowerCase().replace(/\s+/g, " ").trim();
  if (normA === normB) return 1;
  return jaccardSimilarity(tokenize(normA), tokenize(normB));
}

function bodySimilarity(a: string, b: string): number {
  return normalizedSimilarity(a, b);
}

export async function checkRepeatPosting(
  newTitle: string,
  newDescription: string
): Promise<SpamCheckResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { score: 0, matchedTitles: [], action: "allow" };

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data: recentJobs } = await supabase
    .from("jobs")
    .select("id, title, description")
    .eq("poster_id", user.id)
    .is("deleted_at", null)
    .gte("created_at", fourteenDaysAgo.toISOString());

  if (!recentJobs || recentJobs.length === 0) {
    return { score: 0, matchedTitles: [], action: "allow" };
  }

  const postCount = recentJobs.length;
  let maxTitleSim = 0;
  let maxBodySim = 0;
  const matchedTitles: string[] = [];

  for (const job of recentJobs) {
    const tSim = titleSimilarity(newTitle, job.title || "");
    const bSim = bodySimilarity(newDescription, job.description || "");

    if (tSim > maxTitleSim) maxTitleSim = tSim;
    if (bSim > maxBodySim) maxBodySim = bSim;

    if (tSim >= 0.8 || (tSim >= 0.65 && bSim >= 0.65)) {
      matchedTitles.push(job.title);
    }
  }

  const combinedSim = maxTitleSim * 0.6 + maxBodySim * 0.4;

  let score = 0;

  if (postCount >= 5) {
    score += 4;
  } else if (postCount >= 3) {
    score += 2;
  } else if (postCount >= 2) {
    score += 1;
  }

  if (combinedSim >= 0.85) {
    score += 6;
  } else if (combinedSim >= 0.7) {
    score += 4;
  } else if (combinedSim >= 0.55) {
    score += 2;
  }

  let action: SpamCheckResult["action"] = "allow";
  if (score >= 8) action = "block";
  else if (score >= 4) action = "warn";

  return { score, matchedTitles: [...new Set(matchedTitles)], action };
}
