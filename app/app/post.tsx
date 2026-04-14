import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { postJob } from "../../lib/jobs";

type Urgency = "Need now" | "Today" | "Flexible";

type Category =
  | "Moving Item"
  | "Moving Items"
  | "Collection & Delivery"
  | "Garden & Outdoor"
  | "Cleaning"
  | "Assembly"
  | "Painting & Decorating"
  | "Other";

const MOVING_CATEGORIES: Category[] = ["Moving Item", "Moving Items", "Collection & Delivery"];

function isMovingCategory(cat: Category): boolean {
  return MOVING_CATEGORIES.includes(cat);
}

const SUGGESTIONS: Record<string, { description: string; budget: number; category: Category }> = {
  move: { description: "Help moving furniture or heavy items. Please be careful and reliable.", budget: 25, category: "Moving Item" },
  sofa: { description: "Help moving a sofa. Need someone strong and careful with handling.", budget: 25, category: "Moving Item" },
  garden: { description: "Garden tidy-up needed. Mowing, weeding, and general clearing.", budget: 40, category: "Garden & Outdoor" },
  tidy: { description: "Tidy-up and clean-up of a small area. Basic tools welcome.", budget: 30, category: "Garden & Outdoor" },
  collect: { description: "Collect and drop off a parcel. Must have own transport.", budget: 15, category: "Collection & Delivery" },
  parcel: { description: "Collect a parcel and drop it off at the given address.", budget: 15, category: "Collection & Delivery" },
  clean: { description: "Light cleaning and tidying of indoor space.", budget: 30, category: "Cleaning" },
  paint: { description: "Painting a room or small area. Bring your own brushes if possible.", budget: 45, category: "Painting & Decorating" },
  flat: { description: "Flat pack assembly. Instructions will be provided.", budget: 35, category: "Assembly" },
  assemble: { description: "Assembly of furniture or equipment. Basic tools needed.", budget: 35, category: "Assembly" },
};

function detectCategory(title: string): { category: Category; description: string; budget: number } | null {
  const lower = title.toLowerCase();
  for (const [keyword, suggestion] of Object.entries(SUGGESTIONS)) {
    if (lower.includes(keyword)) {
      return { category: suggestion.category, description: suggestion.description, budget: suggestion.budget };
    }
  }
  return null;
}

function hashPostcode(pc: string): number {
  let h = 0;
  for (let i = 0; i < pc.length; i++) h = ((h << 5) - h + pc.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function estimateDistanceMiles(from: string, to: string): number {
  if (!from.trim() || !to.trim()) return 0;
  const h1 = hashPostcode(from.toUpperCase());
  const h2 = hashPostcode(to.toUpperCase());
  const diff = Math.abs(h1 - h2);
  return Math.max(0.5, (diff % 20) + 0.5);
}

function calcMovingPrice(baseBudget: number, fromPostcode: string, toPostcode: string): { estimate: string; miles: number } | null {
  if (!fromPostcode.trim() || !toPostcode.trim()) return null;
  const miles = estimateDistanceMiles(fromPostcode, toPostcode);
  const distCost = Math.round(miles * 1.5);
  const total = baseBudget + distCost;
  return { estimate: `~£${total}`, miles };
}

export default function PostScreen() {
  const [title, setTitle] = useState("");
  const [detectedCategory, setDetectedCategory] = useState<Category>("Other");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [fromPostcode, setFromPostcode] = useState("");
  const [toPostcode, setToPostcode] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("Need now");
  const [preferredTime, setPreferredTime] = useState("");
  const [toolsSupplied, setToolsSupplied] = useState(true);
  const [posting, setPosting] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);

  const showPostcodes = isMovingCategory(detectedCategory);

  useEffect(() => {
    if (!title.trim()) {
      setDetectedCategory("Other");
      return;
    }
    const detected = detectCategory(title);
    if (detected) {
      setDetectedCategory(detected.category);
    } else {
      setDetectedCategory("Other");
    }
  }, [title]);

  const movingEstimate = useMemo(() => {
    if (!showPostcodes) return null;
    const base = budget.trim() ? parseFloat(budget) : 0;
    if (base <= 0) return null;
    return calcMovingPrice(base, fromPostcode, toPostcode);
  }, [showPostcodes, budget, fromPostcode, toPostcode]);

  async function handleAiSuggest() {
    if (!title.trim()) {
      Alert.alert("Enter a title first", "AI needs a job title to suggest a description and budget.");
      return;
    }
    setAiSuggesting(true);
    await new Promise((r) => setTimeout(r, 600));
    const detected = detectCategory(title);
    if (detected) {
      let budgetVal = detected.budget;
      if (isMovingCategory(detected.category)) {
        budgetVal = Math.round(budgetVal * 1.2);
      }
      setDescription(detected.description);
      setBudget(String(budgetVal));
      setDetectedCategory(detected.category);
      setAiSuggested(true);
    } else {
      setDescription("");
      setBudget("");
      setAiSuggested(false);
      Alert.alert("No suggestion available", "Try a more specific job title like 'Help move a sofa' or 'Garden tidy-up'.");
    }
    setAiSuggesting(false);
  }

  async function handlePost() {
    if (!title.trim() || !description.trim() || !budget.trim()) {
      Alert.alert("Missing details", "Fill in title, description, and budget.");
      return;
    }
    if (showPostcodes) {
      if (!fromPostcode.trim() || !toPostcode.trim()) {
        Alert.alert("Postcodes required", "Moving jobs need a from and to postcode so workers can estimate distance.");
        return;
      }
    }
    try {
      setPosting(true);
      const postcodeValue = showPostcodes
        ? `${fromPostcode.trim().toUpperCase()} → ${toPostcode.trim().toUpperCase()}`
        : "N/A";
      await postJob({
        title: title.trim(),
        description: description.trim(),
        budget_gbp: parseFloat(budget),
        postcode: postcodeValue,
        urgency,
        tools_supplied: toolsSupplied,
        preferred_start_at: preferredTime.trim() || undefined,
      });
      Alert.alert("Job posted", "Your job is now live for nearby workers to see.", [
        { text: "OK", onPress: () => router.replace("/app/my-jobs") },
      ]);
    } catch (err: any) {
      Alert.alert("Could not post", err?.message || "Something went wrong.");
    } finally {
      setPosting(false);
    }
  }

  const canPost = title.trim() && description.trim() && budget.trim() && (!showPostcodes || (fromPostcode.trim() && toPostcode.trim())) && !posting;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Post a job</Text>
      <Text style={styles.subtitle}>Keep it simple. The aim is to post in under a minute.</Text>

      <TextInput placeholder="Job title" placeholderTextColor="#8D79AF" style={styles.input} value={title} onChangeText={setTitle} />

      {detectedCategory !== "Other" && (
        <View style={styles.catBadge}>
          <Ionicons name="pricetag" size={14} color="#B56CFF" />
          <Text style={styles.catBadgeText}>{detectedCategory}</Text>
        </View>
      )}

      <Pressable style={[styles.aiButton, aiSuggesting && styles.disabledButton]} onPress={handleAiSuggest} disabled={aiSuggesting}>
        {aiSuggesting ? (
          <ActivityIndicator size="small" color="#B56CFF" />
        ) : (
          <>
            <Ionicons name="sparkles" size={16} color="#B56CFF" />
            <Text style={styles.aiButtonText}>AI suggest description &amp; budget</Text>
          </>
        )}
      </Pressable>

      <TextInput
        placeholder="Description"
        placeholderTextColor="#8D79AF"
        style={[styles.input, styles.textArea, aiSuggested && styles.aiFilled]}
        multiline
        textAlignVertical="top"
        value={description}
        onChangeText={(text) => { setDescription(text); setAiSuggested(false); }}
      />

      <TextInput placeholder="Budget in GBP" placeholderTextColor="#8D79AF" style={[styles.input, aiSuggested && styles.aiFilled]} keyboardType="numeric" value={budget} onChangeText={(text) => { setBudget(text); setAiSuggested(false); }} />

      {showPostcodes ? (
        <>
          <TextInput placeholder="From postcode" placeholderTextColor="#8D79AF" style={styles.input} autoCapitalize="characters" value={fromPostcode} onChangeText={setFromPostcode} />
          <TextInput placeholder="To postcode" placeholderTextColor="#8D79AF" style={styles.input} autoCapitalize="characters" value={toPostcode} onChangeText={setToPostcode} />
          {movingEstimate ? (
            <View style={styles.estimateCard}>
              <Ionicons name="navigate" size={14} color="#B56CFF" />
              <Text style={styles.estimateText}>Estimated price: {movingEstimate.estimate} · approx {movingEstimate.miles.toFixed(1)} miles</Text>
            </View>
          ) : (
            <Text style={styles.postcodeHint}>Enter both postcodes to see an estimated price</Text>
          )}
        </>
      ) : null}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>Urgency</Text>
          <View style={styles.pillRow}>
            {(["Need now", "Today", "Flexible"] as Urgency[]).map((u) => (
              <Pressable key={u} style={[urgency === u ? styles.pillActive : styles.pill]} onPress={() => setUrgency(u)}>
                <Text style={urgency === u ? styles.pillActiveText : styles.pillText}>{u}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <TextInput placeholder="Preferred time (optional)" placeholderTextColor="#8D79AF" style={styles.input} value={preferredTime} onChangeText={setPreferredTime} />

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>Tools supplied</Text>
          <Text style={styles.small}>Turn on if the worker does not need to bring tools.</Text>
        </View>
        <Switch value={toolsSupplied} onValueChange={setToolsSupplied} thumbColor="#B56CFF" trackColor={{ false: "#3A2B52", true: "#6E46A3" }} />
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>AI suggestions are guidance only</Text>
        <Text style={styles.noticeText}>Final job details, pricing, and arrangements are chosen by the users. FEN does not process payments — any money is agreed and exchanged directly between users.</Text>
      </View>

      <Pressable style={[styles.primaryButton, !canPost && styles.disabledButton]} onPress={handlePost} disabled={!canPost}>
        {posting ? (
          <ActivityIndicator size="small" color="#140E1D" />
        ) : (
          <Text style={styles.primaryButtonText}>Post job</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0E0A14",
  },
  content: {
    padding: 20,
    paddingBottom: 110,
    gap: 14,
  },
  title: {
    color: "#E7D9FF",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 8,
  },
  subtitle: {
    color: "#CBB8F1",
    fontSize: 16,
    lineHeight: 23,
  },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#20172E",
    borderColor: "#5B3A87",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
    gap: 6,
  },
  catBadgeText: {
    color: "#E7D9FF",
    fontSize: 13,
    fontWeight: "700",
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171024",
    borderColor: "#5B3A87",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    gap: 8,
  },
  aiButtonText: {
    color: "#B56CFF",
    fontSize: 14,
    fontWeight: "700",
  },
  aiFilled: {
    borderColor: "#5B3A87",
  },
  input: {
    backgroundColor: "#171024",
    borderColor: "#231A33",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 15,
    color: "#E7D9FF",
    fontSize: 16,
  },
  textArea: {
    minHeight: 110,
  },
  estimateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#171024",
    borderColor: "#5B3A87",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  estimateText: {
    color: "#B56CFF",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  postcodeHint: {
    color: "#A590C9",
    fontSize: 13,
    fontStyle: "italic",
  },
  row: {
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  label: {
    color: "#E7D9FF",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  small: {
    color: "#CBB8F1",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    backgroundColor: "#171024",
    borderColor: "#231A33",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pillText: {
    color: "#CBB8F1",
    fontSize: 13,
    fontWeight: "700",
  },
  pillActive: {
    backgroundColor: "#2A1E3D",
    borderColor: "#B56CFF",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pillActiveText: {
    color: "#F0E2FF",
    fontSize: 13,
    fontWeight: "800",
  },
  switchRow: {
    backgroundColor: "#171024",
    borderWidth: 1,
    borderColor: "#231A33",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  notice: {
    backgroundColor: "#20172E",
    borderWidth: 1,
    borderColor: "#5B3A87",
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  noticeTitle: {
    color: "#E7D9FF",
    fontSize: 14,
    fontWeight: "800",
  },
  noticeText: {
    color: "#CBB8F1",
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: "#B56CFF",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#140E1D",
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
  },
});
