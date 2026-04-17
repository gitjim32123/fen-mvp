import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { launchImageLibraryAsync } from "expo-image-picker";
import { postJob, uploadJobImages } from "../../lib/jobs";
import { scoreBusinessAdRisk } from "../../lib/moderation";
import { checkRepeatPosting } from "../../lib/spam";
import { addStrike, getStrikeCount } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

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
  fridge: { description: "Help moving a fridge or large appliance. Two people recommended.", budget: 30, category: "Moving Item" },
  wardrobe: { description: "Help moving a wardrobe or bulky furniture item.", budget: 25, category: "Moving Item" },
  bed: { description: "Help moving a bed or mattress. Disassembly may be needed.", budget: 25, category: "Moving Item" },
  piano: { description: "Help moving a piano. Needs care and at least two people.", budget: 40, category: "Moving Item" },
  "moving help": { description: "Small moving help needed. Packing or lifting assistance for a few items.", budget: 30, category: "Moving Items" },
  "small move": { description: "Help with a small move. Moving a few boxes or items to a new address.", budget: 25, category: "Moving Items" },
  garden: { description: "Garden tidy-up needed. Mowing, weeding, and general clearing.", budget: 40, category: "Garden & Outdoor" },
  gardening: { description: "General gardening help. Weeding, planting, or lawn care.", budget: 40, category: "Garden & Outdoor" },
  lawn: { description: "Lawn mowing and garden tidy-up needed.", budget: 35, category: "Garden & Outdoor" },
  weed: { description: "Weeding and garden clearing needed. Basic tools provided.", budget: 30, category: "Garden & Outdoor" },
  hedge: { description: "Hedge trimming and garden tidy-up.", budget: 35, category: "Garden & Outdoor" },
  collect: { description: "Collect and drop off a parcel. Must have own transport.", budget: 15, category: "Collection & Delivery" },
  parcel: { description: "Collect a parcel and drop it off at the given address.", budget: 15, category: "Collection & Delivery" },
  delivery: { description: "Pick up and deliver an item. Own transport required.", budget: 20, category: "Collection & Delivery" },
  "pick up": { description: "Pick up an item from a given location and deliver it.", budget: 18, category: "Collection & Delivery" },
  shop: { description: "Help with shopping. Collect items and deliver to the address.", budget: 20, category: "Collection & Delivery" },
  shopping: { description: "Help with a shopping trip. Collect items and deliver.", budget: 20, category: "Collection & Delivery" },
  dog: { description: "Dog walking needed. Take good care of the dog and bring it back safely.", budget: 15, category: "Other" },
  "dog walk": { description: "Dog walking needed. Friendly and reliable help required.", budget: 15, category: "Other" },
  walk: { description: "Dog walking or pet sitting needed. Take good care of the animal.", budget: 15, category: "Other" },
  pet: { description: "Pet care help needed. Walking, feeding, or sitting.", budget: 15, category: "Other" },
  clean: { description: "Light cleaning and tidying of indoor space.", budget: 30, category: "Cleaning" },
  cleaning: { description: "General cleaning of a home or room. Basic supplies provided.", budget: 35, category: "Cleaning" },
  "deep clean": { description: "Deep cleaning of a property. All equipment provided.", budget: 50, category: "Cleaning" },
  paint: { description: "Painting a room or small area. Bring your own brushes if possible.", budget: 45, category: "Painting & Decorating" },
  decorating: { description: "Decorating help needed. Painting or wallpapering assistance.", budget: 45, category: "Painting & Decorating" },
  flat: { description: "Flat pack assembly. Instructions will be provided.", budget: 35, category: "Assembly" },
  assemble: { description: "Assembly of furniture or equipment. Basic tools needed.", budget: 35, category: "Assembly" },
  furniture: { description: "Furniture assembly needed. All parts and tools provided.", budget: 35, category: "Assembly" },
  ikea: { description: "IKEA or flat-pack furniture assembly. Instructions available.", budget: 35, category: "Assembly" },
  shelf: { description: "Fitting or assembling shelves. Basic tools helpful.", budget: 25, category: "Assembly" },
  tech: { description: "Tech help needed. Computer, Wi-Fi, or device setup assistance.", budget: 30, category: "Other" },
  computer: { description: "Computer or laptop help. Setup, troubleshooting, or installation.", budget: 35, category: "Other" },
  wifi: { description: "Wi-Fi or internet setup help needed. Router configuration and troubleshooting.", budget: 25, category: "Other" },
  handyman: { description: "Odd jobs and small repairs around the house. Basic tools helpful.", budget: 30, category: "Other" },
  "odd job": { description: "Odd jobs and small tasks around the home. Flexible with what needs doing.", budget: 25, category: "Other" },
  repair: { description: "Small repair job needed. Tools provided or welcome.", budget: 30, category: "Other" },
  mount: { description: "Mounting help needed. TV, shelves, or pictures.", budget: 25, category: "Other" },
};

function detectCategory(title: string): { category: Category; description: string; budget: number } | null {
  const lower = title.toLowerCase().replace(/\s+/g, " ").trim();
  let best: { category: Category; description: string; budget: number; keyLen: number } | null = null;
  for (const [keyword, suggestion] of Object.entries(SUGGESTIONS)) {
    const keyLower = keyword.toLowerCase();
    if (lower.includes(keyLower) || keyLower.includes(lower)) {
      if (!best || keyLower.length > best.keyLen) {
        best = { category: suggestion.category, description: suggestion.description, budget: suggestion.budget, keyLen: keyLower.length };
      }
    }
  }
  if (best) {
    const { keyLen: _k, ...result } = best;
    return result;
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
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadSessionId, setUploadSessionId] = useState<string>("");

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

  useEffect(() => {
    if (!title.trim() || title.trim().length < 4) return;
    if (description.trim() && budget.trim() && aiSuggested) return;
    const timer = setTimeout(() => {
      const detected = detectCategory(title);
      if (detected) {
        if (!description.trim()) {
          setDescription(detected.description);
        }
        if (!budget.trim()) {
          let budgetVal = detected.budget;
          if (isMovingCategory(detected.category)) {
            budgetVal = Math.round(budgetVal * 1.2);
          }
          setBudget(String(budgetVal));
        }
        setDetectedCategory(detected.category);
        setAiSuggested(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [title]);

  useEffect(() => {
    if (description.length < 25) {
      setModerationWarning(null);
      return;
    }
    const timer = setTimeout(() => {
      const result = scoreBusinessAdRisk({ title, description });
      if (result.action === "warn" || result.action === "block") {
        setModerationWarning("This looks like a business/service advert. FEN is for one-off local jobs.");
      } else {
        setModerationWarning(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [title, description]);

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

  async function handleAddPhotos() {
    const { status, assets } = await launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: Math.max(0, 3 - selectedImages.length),
    });
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access in your device settings.");
      return;
    }
    if (!assets?.length) return;
    const newUris = assets
      .filter((a) => {
        const sizeMB = (a.fileSize || 0) / (1024 * 1024);
        return sizeMB <= 5;
      })
      .map((a) => a.uri);
    setSelectedImages((prev) => [...prev, ...newUris].slice(0, 3));
  }

  function handleRemoveImage(index: number) {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitJob() {
    try {
      setPosting(true);
      const postcodeValue = showPostcodes
        ? `${fromPostcode.trim().toUpperCase()} → ${toPostcode.trim().toUpperCase()}`
        : "N/A";
      let imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        setImageUploading(true);
        const sessionId = `job_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id ?? "anon";
        const { urls, failedCount } = await uploadJobImages(selectedImages, sessionId, userId);
        setImageUploading(false);
        if (failedCount === selectedImages.length) {
          Alert.alert("Image upload failed", "Photos could not be uploaded. Please try again or post without photos.", [
            { text: "Try again", style: "cancel" },
            { text: "Post without photos", onPress: () => doPost(postcodeValue, []) },
          ]);
          setPosting(false);
          return;
        }
        imageUrls = urls;
        if (failedCount > 0) {
          Alert.alert("Some photos could not be uploaded", `${selectedImages.length - failedCount} of ${selectedImages.length} photos were uploaded.`, [
            { text: "Continue", onPress: () => doPost(postcodeValue, imageUrls) },
          ]);
          return;
        }
      }
      await doPost(postcodeValue, imageUrls);
    } catch (err: any) {
      Alert.alert("Could not post", err?.message || "Something went wrong.");
      setPosting(false);
      setImageUploading(false);
    }
  }

  async function doPost(postcodeValue: string, imageUrls: string[]) {
    await postJob({
      title: title.trim(),
      description: description.trim(),
      budget_gbp: parseFloat(budget),
      postcode: postcodeValue,
      urgency,
      tools_supplied: toolsSupplied,
      preferred_start_at: preferredTime.trim() || undefined,
      images: imageUrls,
    });
    Alert.alert("Job posted", "Your job is now live for nearby workers to see.", [
      { text: "OK", onPress: () => router.replace("/app/my-jobs") },
    ]);
    setPosting(false);
    setImageUploading(false);
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
    const strikes = await getStrikeCount().catch(() => 0);
    if (strikes >= 3) {
      Alert.alert("Posting restricted", "You've attempted to post business adverts multiple times. Posting is temporarily restricted.");
      return;
    }
    const modResult = scoreBusinessAdRisk({ title, description });
    if (modResult.action === "block") {
      await addStrike().catch(() => {});
      Alert.alert(
        "Post not allowed",
        "This looks like business advertising. FEN is for local one-off jobs, not commercial promotion."
      );
      return;
    }
    if (modResult.action === "warn") {
      Alert.alert(
        "Check your post",
        "Your post looks like a business advert. Please rewrite it as a one-off local job or help request.",
        [
          { text: "Edit", style: "cancel" },
          { text: "Post anyway", onPress: submitJob },
        ]
      );
      return;
    }
    const spamResult = await checkRepeatPosting(title, description);
    if (spamResult.action === "block") {
      Alert.alert(
        "Post not allowed",
        "This post appears to be a repeat or spam repost of a recent listing."
      );
      return;
    }
    if (spamResult.action === "warn") {
      Alert.alert(
        "Similar to recent posts",
        "This looks very similar to one of your recent posts. Please only repost if this is genuinely a new job.",
        [
          { text: "Edit", style: "cancel" },
          { text: "Post anyway", onPress: submitJob },
        ]
      );
      return;
    }
    await submitJob();
  }

  const canPost = title.trim() && description.trim() && budget.trim() && (!showPostcodes || (fromPostcode.trim() && toPostcode.trim())) && !posting && !imageUploading;

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

      {moderationWarning && (
        <Text style={styles.warningText}>{moderationWarning}</Text>
      )}

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

      {selectedImages.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScroll}>
          {selectedImages.map((uri, i) => (
            <View key={uri} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              <Pressable style={styles.thumbRemove} onPress={() => handleRemoveImage(i)}>
                <Ionicons name="close-circle" size={20} color="#B56CFF" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {selectedImages.length < 3 && (
        <Pressable style={styles.addPhotosButton} onPress={handleAddPhotos} disabled={posting || imageUploading}>
          <Ionicons name="camera-outline" size={18} color="#B56CFF" />
          <Text style={styles.addPhotosText}>Add photos (optional)</Text>
        </Pressable>
      )}

      {imageUploading && (
        <View style={styles.uploadIndicator}>
          <ActivityIndicator size="small" color="#B56CFF" />
          <Text style={styles.uploadText}>Uploading photos…</Text>
        </View>
      )}

      <Text style={styles.photoHint}>Add photos to help others understand the job (avoid logos or adverts)</Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>AI suggestions are guidance only</Text>
        <Text style={styles.noticeText}>Final job details, pricing, and arrangements are chosen by the users. FEN does not process payments — any money is agreed and exchanged directly between users.</Text>
      </View>

      <View style={styles.policyNotice}>
        <Text style={styles.policyText}>FEN is for local one-off jobs and immediate help requests. Business advertising or repeated service promotion is not allowed.</Text>
      </View>

      <Pressable style={[styles.primaryButton, !canPost && styles.disabledButton]} onPress={handlePost} disabled={!canPost}>
        {(posting || imageUploading) ? (
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
  modWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2B1E0A",
    borderWidth: 1,
    borderColor: "#7A4A1E",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  modWarningText: {
    color: "#FFB347",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  warningText: {
    color: "#FFB84D",
    marginTop: 6,
    fontSize: 13,
  },
  policyNotice: {
    backgroundColor: "#1A1025",
    borderWidth: 1,
    borderColor: "#3A2B52",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  photoHint: {
    color: "#A590C9",
    fontSize: 13,
    fontStyle: "italic",
    marginTop: -6,
  },
  uploadIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  uploadText: {
    color: "#B56CFF",
    fontSize: 13,
    fontWeight: "700",
  },
  thumbScroll: {
    flexDirection: "row",
    gap: 10,
  },
  thumbWrap: {
    position: "relative",
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "visible",
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#1A1025",
    borderWidth: 1,
    borderColor: "#3A2B52",
  },
  thumbRemove: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#0E0A14",
    borderRadius: 10,
  },
  addPhotosButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171024",
    borderColor: "#3A2B52",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    gap: 8,
  },
  addPhotosText: {
    color: "#B56CFF",
    fontSize: 14,
    fontWeight: "700",
  },
  policyText: {
    color: "#A590C9",
    fontSize: 13,
    lineHeight: 19,
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
