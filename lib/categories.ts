export type JobCategory =
  | "Cleaning"
  | "Garden & Outdoor"
  | "Dog Walking"
  | "Moving / lifting"
  | "Delivery / collection"
  | "Shopping & Errands"
  | "Coding & Tech Help"
  | "Business & Admin"
  | "Assembly"
  | "Decorating & Basic DIY"
  | "Companionship & Errands"
  | "Other";

export const CATEGORY_OPTIONS: JobCategory[] = [
  "Cleaning",
  "Garden & Outdoor",
  "Dog Walking",
  "Moving / lifting",
  "Delivery / collection",
  "Shopping & Errands",
  "Coding & Tech Help",
  "Business & Admin",
  "Assembly",
  "Decorating & Basic DIY",
  "Companionship & Errands",
  "Other",
];

export function normalizeCategory(value?: string | null): JobCategory | string {
  const raw = (value || "Other").trim();
  if (raw === "Moving Item" || raw === "Moving Items" || raw === "Moving") return "Moving / lifting";
  if (raw === "Collection & Delivery" || raw === "Delivery") return "Delivery / collection";
  if (raw === "Gardening") return "Garden & Outdoor";
  if (raw === "Tech help") return "Coding & Tech Help";
  if (raw === "Admin help") return "Business & Admin";
  if (raw === "Companionship") return "Companionship & Errands";
  return raw || "Other";
}
