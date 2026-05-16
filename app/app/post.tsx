import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { launchImageLibraryAsync } from "expo-image-picker";
import { postJob } from "../../lib/jobs";
import { supabase } from "../../lib/supabase";
import { checkJobSafety, scoreBusinessAdRisk } from "../../lib/moderation";
import { checkRepeatPosting } from "../../lib/spam";
import { estimateMiles, estimateTravelMinutes, geocodePostcode, roundToFive } from "../../lib/geocoding";
import { confirmAction } from "../../lib/confirmAction";
import { SignInRequired } from "../../components/ui/Premium";
import { CATEGORY_OPTIONS, type JobCategory } from "../../lib/categories";

type Urgency = "Need now" | "Today" | "Flexible";

type Category = JobCategory;

const TRAVEL_CATEGORIES: Category[] = ["Delivery / collection"];

function isMovingCategory(cat: Category): boolean {
  return cat === "Moving / lifting";
}

function needsTravelPostcodes(cat: Category, title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  if (/\b(one room|same room|another room|upstairs|downstairs|inside|within (the )?(house|flat|home))\b/.test(text)) {
    return false;
  }
  if (TRAVEL_CATEGORIES.includes(cat)) {
    return /\b(from|to|deliver|delivery|collect|collection|pick ?up|drop ?off|transport|between)\b/.test(text);
  }
  if (isMovingCategory(cat)) {
    return /\b(new address|another address|between addresses|house to house|flat to flat|pick ?up|drop ?off|transport|deliver|delivery|collect|collection)\b/.test(text);
  }
  return false;
}

const SUGGESTIONS: Record<string, { description: string; budget: number; category: Category }> = {
  "collect sofa": { description: "Help collecting or moving a sofa. Large item handling needed.", budget: 35, category: "Moving / lifting" },
  "sofa pickup": { description: "Help picking up and moving a sofa. Large item handling needed.", budget: 35, category: "Moving / lifting" },
  move: { description: "Help moving items. Please describe the size, stairs, and distance clearly.", budget: 25, category: "Moving / lifting" },
  sofa: { description: "Help moving a sofa. Need someone strong and careful with handling.", budget: 35, category: "Moving / lifting" },
  fridge: { description: "Help moving a fridge or large appliance. Two people recommended.", budget: 40, category: "Moving / lifting" },
  wardrobe: { description: "Help moving a wardrobe or bulky furniture item.", budget: 30, category: "Moving / lifting" },
  bed: { description: "Help moving a bed or mattress. Disassembly may be needed.", budget: 30, category: "Moving / lifting" },
  piano: { description: "Help moving a piano. Needs care and at least two people.", budget: 60, category: "Moving / lifting" },
  "moving help": { description: "Moving help needed. Packing or lifting assistance for a few items.", budget: 25, category: "Moving / lifting" },
  "small move": { description: "Help with a small move. Moving a few boxes or items.", budget: 20, category: "Moving / lifting" },
  "few boxes": { description: "Help moving a few boxes or smaller items.", budget: 20, category: "Moving / lifting" },
  boxes: { description: "Help moving boxes or smaller items.", budget: 20, category: "Moving / lifting" },
  "bulky furniture": { description: "Help moving bulky furniture. Please describe stairs, size, and access.", budget: 35, category: "Moving / lifting" },
  "man with van": { description: "Moving or lifting help requested. Keep this as a one-off help request, not a service advert.", budget: 35, category: "Moving / lifting" },
  "man in van": { description: "Moving or lifting help requested. Keep this as a one-off help request, not a service advert.", budget: 35, category: "Moving / lifting" },
  garden: { description: "Garden tidy-up needed. Mowing, weeding, and general clearing.", budget: 25, category: "Garden & Outdoor" },
  gardening: { description: "General gardening help. Weeding, planting, or lawn care.", budget: 25, category: "Garden & Outdoor" },
  lawn: { description: "Lawn mowing and quick garden tidy-up needed.", budget: 20, category: "Garden & Outdoor" },
  weed: { description: "Weeding and light garden clearing needed. Basic tools provided.", budget: 20, category: "Garden & Outdoor" },
  hedge: { description: "Hedge trimming and garden tidy-up.", budget: 30, category: "Garden & Outdoor" },
  "collect parcel": { description: "Collect a parcel and drop it off nearby. Must have suitable transport.", budget: 15, category: "Delivery / collection" },
  "deliver parcel": { description: "Pick up and deliver a parcel. Must have suitable transport.", budget: 15, category: "Delivery / collection" },
  collect: { description: "Collect and drop off a small item. Must have suitable transport.", budget: 15, category: "Delivery / collection" },
  parcel: { description: "Collect a parcel and drop it off at the given address.", budget: 15, category: "Delivery / collection" },
  delivery: { description: "Pick up and deliver an item. Own transport required.", budget: 20, category: "Delivery / collection" },
  "pick up": { description: "Pick up an item from a given location and deliver it.", budget: 20, category: "Delivery / collection" },
  shop: { description: "Help with shopping. Collect items and deliver to the address.", budget: 20, category: "Shopping & Errands" },
  shopping: { description: "Help with a shopping trip. Collect items and deliver.", budget: 20, category: "Shopping & Errands" },
  errand: { description: "Local errand help needed. Collect, drop off, or sort a small task nearby.", budget: 20, category: "Shopping & Errands" },
  dog: { description: "Dog walking needed. Take good care of the dog and bring it back safely.", budget: 15, category: "Dog Walking" },
  "dog walk": { description: "Dog walking needed. Friendly and reliable help required.", budget: 15, category: "Dog Walking" },
  walk: { description: "Dog walking or pet sitting needed. Take good care of the animal.", budget: 15, category: "Dog Walking" },
  pet: { description: "Pet care help needed. Walking, feeding, or sitting.", budget: 15, category: "Dog Walking" },
  clean: { description: "Light cleaning and tidying of indoor space.", budget: 20, category: "Cleaning" },
  cleaning: { description: "General cleaning of a home or room. Basic supplies provided.", budget: 25, category: "Cleaning" },
  "deep clean": { description: "Deep cleaning of a property. All equipment provided.", budget: 50, category: "Cleaning" },
  "window clean": { description: "One-off help cleaning accessible windows. Avoid professional service advertising.", budget: 20, category: "Other" },
  "window cleaner": { description: "One-off help cleaning accessible windows. Avoid professional service advertising.", budget: 20, category: "Other" },
  paint: { description: "Painting a room or small area. Bring your own brushes if possible.", budget: 45, category: "Decorating & Basic DIY" },
  decorating: { description: "Decorating help needed. Painting or wallpapering assistance.", budget: 45, category: "Decorating & Basic DIY" },
  diy: { description: "Basic DIY help needed for a small non-regulated household task.", budget: 35, category: "Decorating & Basic DIY" },
  flat: { description: "Flat pack assembly. Instructions will be provided.", budget: 35, category: "Assembly" },
  assemble: { description: "Assembly of furniture or equipment. Basic tools needed.", budget: 35, category: "Assembly" },
  furniture: { description: "Furniture assembly needed. All parts and tools provided.", budget: 35, category: "Assembly" },
  ikea: { description: "IKEA or flat-pack furniture assembly. Instructions available.", budget: 35, category: "Assembly" },
  shelf: { description: "Fitting or assembling shelves. Basic tools helpful.", budget: 25, category: "Assembly" },
  tech: { description: "Tech help needed. Computer, Wi-Fi, or device setup assistance.", budget: 30, category: "Coding & Tech Help" },
  coding: { description: "Coding or tech help needed for a small task. Explain the issue and what outcome you need.", budget: 30, category: "Coding & Tech Help" },
  computer: { description: "Computer or laptop help. Setup, troubleshooting, or installation.", budget: 25, category: "Coding & Tech Help" },
  wifi: { description: "Wi-Fi or internet setup help needed. Router configuration and troubleshooting.", budget: 25, category: "Coding & Tech Help" },
  admin: { description: "Admin help needed for a small one-off task such as organising files or data entry.", budget: 30, category: "Business & Admin" },
  "keep someone company": { description: "Looking for someone friendly to keep company for around an hour. Details and expectations can be agreed in messages.", budget: 15, category: "Companionship & Errands" },
  "keep company": { description: "Looking for someone friendly to keep company for around an hour. Details and expectations can be agreed in messages.", budget: 15, category: "Companionship & Errands" },
  "someone company": { description: "Looking for someone friendly to keep company for around an hour. Details and expectations can be agreed in messages.", budget: 15, category: "Companionship & Errands" },
  companionship: { description: "Looking for someone friendly to keep company for around an hour. Details and expectations can be agreed in messages.", budget: 15, category: "Companionship & Errands" },
  "sit with": { description: "Looking for someone friendly to keep company for around an hour. Details and expectations can be agreed in messages.", budget: 15, category: "Companionship & Errands" },
  "chat for an hour": { description: "Looking for someone friendly to keep company for around an hour. Details and expectations can be agreed in messages.", budget: 15, category: "Companionship & Errands" },
  lonely: { description: "Looking for someone friendly to keep company for around an hour. Details and expectations can be agreed in messages.", budget: 15, category: "Companionship & Errands" },
  visit: { description: "Looking for someone friendly to keep company for around an hour. Details and expectations can be agreed in messages.", budget: 15, category: "Companionship & Errands" },
  "social support": { description: "Looking for someone friendly to keep company for around an hour. Details and expectations can be agreed in messages.", budget: 15, category: "Companionship & Errands" },
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

function suggestBudget(category: Category, titleText: string, baseBudget: number, miles?: number) {
  const text = titleText.toLowerCase();
  let budget = baseBudget;
  if (category === "Moving / lifting") {
    if (/\b(boxes|few boxes|small move)\b/.test(text)) budget = Math.max(20, Math.min(budget, 25));
    if (/\b(sofa|wardrobe|bulky furniture|large item)\b/.test(text)) budget = Math.max(budget, 35);
    if (/\b(fridge|heavy|very heavy)\b/.test(text)) budget = Math.max(budget, 40);
    if (/\b(piano)\b/.test(text)) budget = Math.max(budget, 60);
  }
  if (category === "Delivery / collection" && /\b(parcel|small)\b/.test(text)) {
    budget = Math.min(Math.max(budget, 15), 25);
  }
  if (typeof miles === "number" && miles > 0) {
    const uplift =
      category === "Moving / lifting" ? Math.min(20, Math.max(0, miles - 3) * 1.25) :
      category === "Delivery / collection" ? Math.min(15, Math.max(0, miles - 2)) :
      0;
    budget += uplift;
  }
  return roundToFive(budget);
}

function getValidPreferredStartAt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return undefined;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export default function PostScreen() {
  const [title, setTitle] = useState("");
  const [detectedCategory, setDetectedCategory] = useState<Category>("Other");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [locationPostcode, setLocationPostcode] = useState("");
  const [fromPostcode, setFromPostcode] = useState("");
  const [toPostcode, setToPostcode] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("Need now");
  const [preferredTime, setPreferredTime] = useState("");
  const [toolsSupplied, setToolsSupplied] = useState(true);
  const [posting, setPosting] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [moderationBlock, setModerationBlock] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const [postedJobId, setPostedJobId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [categoryOverridden, setCategoryOverridden] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [travelEstimate, setTravelEstimate] = useState<{ miles: number; suggestedBudget: number; minutes: number } | null>(null);
  const [travelEstimateStatus, setTravelEstimateStatus] = useState<string | null>(null);

  const showPostcodes = needsTravelPostcodes(detectedCategory, title, description);

  useFocusEffect(
    useCallback(() => {
      setPostSuccess(null);
      setPostError(null);
      setPostedJobId(null);
      setPosting(false);
    }, [])
  );

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setCurrentUserId(data.user?.id ?? null);
      setAuthChecked(true);
    }).catch(() => {
      if (!active) return;
      setCurrentUserId(null);
      setAuthChecked(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!title.trim()) {
      if (!categoryOverridden) setDetectedCategory("Other");
      return;
    }
    if (categoryOverridden) return;
    const detected = detectCategory(title);
    if (detected) {
      setDetectedCategory(detected.category);
    } else {
      setDetectedCategory("Other");
    }
  }, [title, categoryOverridden]);

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
          const budgetVal = suggestBudget(detected.category, title, detected.budget);
          setBudget(String(budgetVal));
        }
        if (!categoryOverridden) {
          setDetectedCategory(detected.category);
        }
        setAiSuggested(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [title, categoryOverridden]);

  useEffect(() => {
    if ((title + description).trim().length < 8) {
      setModerationWarning(null);
      setModerationBlock(null);
      return;
    }
    const timer = setTimeout(() => {
      const safety = checkJobSafety({ title, description });
      if (safety.action === "block") {
        setModerationBlock(safety.reason || "This job is not allowed on FEN MVP.");
        setModerationWarning(null);
        return;
      }
      setModerationBlock(null);
      if (safety.action === "warn") {
        setModerationWarning("FEN is for one-off local help, not professional service adverts or regulated trade work.");
        return;
      }
      const result = scoreBusinessAdRisk({ title, description });
      if (result.action === "warn" || result.action === "block") {
        setModerationWarning("This looks like a business/service advert. FEN is for one-off local jobs.");
      } else {
        setModerationWarning(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [title, description]);

  useEffect(() => {
    if (!showPostcodes) {
      setTravelEstimate(null);
      setTravelEstimateStatus(null);
      return;
    }
    if (!fromPostcode.trim() || !toPostcode.trim()) {
      setTravelEstimate(null);
      setTravelEstimateStatus(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setTravelEstimateStatus("Checking travel estimate...");
        const [fromPoint, toPoint] = await Promise.all([
          geocodePostcode(fromPostcode),
          geocodePostcode(toPostcode),
        ]);
        if (!active) return;
        if (!fromPoint || !toPoint) {
          setTravelEstimate(null);
          setTravelEstimateStatus("Travel estimate unavailable until both postcodes are valid.");
          return;
        }
        const miles = estimateMiles(fromPoint, toPoint);
        const minutes = estimateTravelMinutes(miles);
        const detected = detectCategory(title);
        const baseBudget = Number.isFinite(Number(budget)) && Number(budget) > 0
          ? Number(budget)
          : detected?.budget ?? 20;
        setTravelEstimate({
          miles,
          minutes,
          suggestedBudget: suggestBudget(detectedCategory, title, baseBudget, miles),
        });
        setTravelEstimateStatus(null);
      } catch {
        if (!active) return;
        setTravelEstimate(null);
        setTravelEstimateStatus("Travel estimate unavailable until both locations are known.");
      }
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [showPostcodes, fromPostcode, toPostcode, budget, title, detectedCategory]);

  const movingEstimate = travelEstimate
    ? { estimate: `~£${travelEstimate.suggestedBudget}`, miles: travelEstimate.miles, minutes: travelEstimate.minutes }
    : null;

  async function handleAiSuggest() {
    if (!title.trim()) {
      setPostError("Enter a title first so FEN can suggest details.");
      Alert.alert("Enter a title first", "FEN needs a job title to suggest a description and budget.");
      return;
    }
    setPostError(null);
    setAiSuggesting(true);
    await new Promise((r) => setTimeout(r, 600));
    const detected = detectCategory(title);
    if (detected) {
      const budgetVal = suggestBudget(detected.category, title, detected.budget, travelEstimate?.miles);
      setDescription(detected.description);
      setBudget(String(budgetVal));
      setDetectedCategory(detected.category);
      setCategoryOverridden(false);
      setAiSuggested(true);
    } else {
      setDescription("");
      setBudget("");
      setAiSuggested(false);
      setPostError("No suggestion available. Try a more specific job title.");
      Alert.alert("No suggestion available", "Try a more specific job title like 'Help move a sofa' or 'Garden tidy-up'.");
    }
    setAiSuggesting(false);
  }

  async function handleAddPhotos() {
    const result = await launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: Math.max(0, 3 - selectedImages.length),
    });
    if ((result as any).canceled || (result as any).status === "cancelled") {
      return;
    }
    const assets = result.assets;
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

  function handleSelectCategory(category: Category) {
    setDetectedCategory(category);
    setCategoryOverridden(true);
  }

  async function submitJob() {
    if (posting || postedJobId) return;
    try {
      setPosting(true);
      setPostError(null);
      setPostSuccess(null);
      const postcodeValue = showPostcodes
        ? `${fromPostcode.trim().toUpperCase()} → ${toPostcode.trim().toUpperCase()}`
        : locationPostcode.trim().toUpperCase();
      if (selectedImages.length > 0) {
        console.log("FEN MVP: photos selected but not submitted because photo uploads are preview-only.");
      }
      await doPost(postcodeValue);
    } catch (err: any) {
      const message = err?.message || "Something went wrong.";
      console.log("Could not post job", message, err);
      setPostError(message);
      Alert.alert("Could not post", message);
    } finally {
      setPosting(false);
    }
  }

  async function doPost(postcodeValue: string) {
    const primaryPostcode = showPostcodes ? fromPostcode.trim() : locationPostcode.trim();
    const jobPoint = primaryPostcode ? await geocodePostcode(primaryPostcode).catch(() => null) : null;
    const job = await postJob({
      title: title.trim(),
      description: description.trim(),
      budget_gbp: roundToFive(parseFloat(budget)),
      postcode: postcodeValue,
      category: detectedCategory,
      urgency,
      tools_supplied: toolsSupplied,
      preferred_start_at: getValidPreferredStartAt(preferredTime),
      lat: jobPoint?.latitude,
      lng: jobPoint?.longitude,
    });
    setPostedJobId(job.id);
    setPostSuccess("Job posted. Opening the job now...");
    Alert.alert("Job posted", "Your job is now live for nearby workers to see.");
    router.replace(`/app/job/${job.id}`);
  }

  async function handlePost() {
    setPostError(null);
    if (!currentUserId) {
      setPostError("Sign in before posting a job.");
      Alert.alert("Sign in required", "Sign in before posting a job.");
      return;
    }
    if (!title.trim() || !description.trim() || !budget.trim()) {
      setPostError("Fill in title, description, and budget.");
      Alert.alert("Missing details", "Fill in title, description, and budget.");
      return;
    }
    const parsedBudget = Number(budget);
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      setPostError("Enter a valid budget in GBP. Budgets are rounded to the nearest £5.");
      Alert.alert("Invalid budget", "Enter a valid budget in GBP. Budgets are rounded to the nearest £5.");
      return;
    }
    if (moderationBlock) {
      setPostError(moderationBlock);
      Alert.alert("Post not allowed", moderationBlock);
      return;
    }
    if (showPostcodes) {
      if (!fromPostcode.trim() || !toPostcode.trim()) {
        setPostError("Moving jobs need a from and to postcode so workers can estimate distance.");
        Alert.alert("Postcodes required", "Moving jobs need a from and to postcode so workers can estimate distance.");
        return;
      }
    }
    const safetyResult = checkJobSafety({ title, description });
    if (safetyResult.action === "block") {
      const message = safetyResult.reason || "This job is not allowed on FEN MVP.";
      setPostError(message);
      Alert.alert("Post not allowed", message);
      return;
    }
    if (safetyResult.action === "warn") {
      const warning = "FEN is for one-off local help, not professional service adverts or regulated trade work.";
      setPostError(`${warning} Please rewrite it as a one-off help request.`);
      Alert.alert(
        "Rewrite needed",
        `${warning} Please rewrite it as a one-off help request.`
      );
      return;
    }
    const modResult = scoreBusinessAdRisk({ title, description });
    if (modResult.action === "block") {
      setPostError("This looks like business advertising. FEN is for local one-off jobs, not commercial promotion.");
      Alert.alert(
        "Post not allowed",
        "This looks like business advertising. FEN is for local one-off jobs, not commercial promotion."
      );
      return;
    }
    if (modResult.action === "warn") {
      setPostError("Your post may include service-advert wording. Please rewrite it as a one-off local job or help request.");
      confirmAction({
        title: "Check your post",
        message: "Your post may include service-advert wording. If this is genuinely a one-off help request, you can continue. Otherwise, rewrite it first.",
        confirmText: "Post anyway",
        cancelText: "Cancel",
        onConfirm: submitJob,
      });
      return;
    }
    const spamResult = await checkRepeatPosting(title, description);
    if (spamResult.action === "block") {
      setPostError("This post appears to be a repeat or spam repost of a recent listing.");
      Alert.alert(
        "Post not allowed",
        "This post appears to be a repeat or spam repost of a recent listing."
      );
      return;
    }
    if (spamResult.action === "warn") {
      setPostError("This looks very similar to one of your recent posts. Only repost if this is genuinely a new job.");
      confirmAction({
        title: "Similar to recent posts",
        message: "This looks very similar to one of your recent posts. Please only repost if this is genuinely a new job.",
        confirmText: "Post anyway",
        cancelText: "Edit",
        onConfirm: submitJob,
      });
      return;
    }
    await submitJob();
  }

  const canPost = title.trim() && description.trim() && budget.trim() && !moderationBlock && (!showPostcodes || (fromPostcode.trim() && toPostcode.trim())) && !posting && !postedJobId;

  if (!authChecked) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B56CFF" />
        <Text style={styles.loadingText}>Checking sign in…</Text>
      </View>
    );
  }

  if (!currentUserId) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <SignInRequired title="Sign in to post" text="You need to sign in before creating a job on FEN." />
      </ScrollView>
    );
  }

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

      <View style={styles.categorySection}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
          {CATEGORY_OPTIONS.map((category) => (
            <Pressable
              key={category}
              style={[styles.categoryChip, detectedCategory === category && styles.categoryChipActive]}
              onPress={() => handleSelectCategory(category)}
              disabled={posting}
            >
              <Text style={[styles.categoryChipText, detectedCategory === category && styles.categoryChipTextActive]}>
                {category}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable style={[styles.aiButton, aiSuggesting && styles.disabledButton]} onPress={handleAiSuggest} disabled={aiSuggesting}>
        {aiSuggesting ? (
          <ActivityIndicator size="small" color="#B56CFF" />
        ) : (
          <>
            <Ionicons name="sparkles" size={16} color="#B56CFF" />
            <Text style={styles.aiButtonText}>Suggest description &amp; budget</Text>
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
        onChangeText={(text: string) => { setDescription(text); setAiSuggested(false); }}
      />

      {moderationWarning && (
        <Text style={styles.warningText}>{moderationWarning}</Text>
      )}
      {moderationBlock && (
        <Text style={styles.blockText}>{moderationBlock}</Text>
      )}

      <TextInput placeholder="Budget in GBP" placeholderTextColor="#8D79AF" style={[styles.input, aiSuggested && styles.aiFilled]} keyboardType="numeric" value={budget} onChangeText={(text: string) => { setBudget(text); setAiSuggested(false); }} />

      {showPostcodes ? (
        <>
          <TextInput placeholder="From postcode" placeholderTextColor="#8D79AF" style={styles.input} autoCapitalize="characters" value={fromPostcode} onChangeText={setFromPostcode} />
          <TextInput placeholder="To postcode" placeholderTextColor="#8D79AF" style={styles.input} autoCapitalize="characters" value={toPostcode} onChangeText={setToPostcode} />
          {movingEstimate ? (
            <View style={styles.estimateCard}>
              <Ionicons name="navigate" size={14} color="#B56CFF" />
              <Text style={styles.estimateText}>Suggested offer: {movingEstimate.estimate} · approx travel distance {movingEstimate.miles.toFixed(1)} miles · about {movingEstimate.minutes} min</Text>
            </View>
          ) : travelEstimateStatus ? (
            <Text style={styles.postcodeHint}>{travelEstimateStatus}</Text>
          ) : (
            <Text style={styles.postcodeHint}>Enter both postcodes to see an estimated price</Text>
          )}
        </>
      ) : (
        <>
          <TextInput
            placeholder="Area or postcode (optional)"
            placeholderTextColor="#8D79AF"
            style={styles.input}
            autoCapitalize="characters"
            value={locationPostcode}
            onChangeText={setLocationPostcode}
          />
          <Text style={styles.postcodeHint}>General jobs can be posted without a postcode, but adding an area improves travel estimates.</Text>
        </>
      )}

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
        <Pressable style={styles.addPhotosButton} onPress={handleAddPhotos} disabled={posting}>
          <Ionicons name="camera-outline" size={18} color="#B56CFF" />
          <Text style={styles.addPhotosText}>Add photos (optional)</Text>
        </Pressable>
      )}

      {postError && (
        <Text style={styles.blockText}>{postError}</Text>
      )}
      {postSuccess && (
        <Text style={styles.successText}>{postSuccess}</Text>
      )}

      <Text style={styles.photoHint}>Add photos to help others understand the job (avoid logos or adverts)</Text>
      {selectedImages.length > 0 ? (
        <Text style={styles.photoNotice}>Photos can help explain the job, but uploads are not available in this test version yet.</Text>
      ) : null}

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Suggestions are guidance only</Text>
        <Text style={styles.noticeText}>Final job details, pricing, and arrangements are chosen by the users. FEN does not process payments — any money is agreed and exchanged directly between users.</Text>
      </View>

      <View style={styles.policyNotice}>
        <Text style={styles.policyText}>FEN is for local one-off jobs and immediate help requests. Business advertising or repeated service promotion is not allowed.</Text>
      </View>

      <Pressable style={[styles.primaryButton, !canPost && styles.disabledButton]} onPress={handlePost} disabled={!canPost}>
        {posting ? (
          <ActivityIndicator size="small" color="#140E1D" />
        ) : (
              <Text style={styles.primaryButtonText}>{postedJobId ? "Job posted" : "Post job"}</Text>
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
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  title: {
    color: "#E7D9FF",
    fontSize: 28,
    lineHeight: 34,
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
  categorySection: {
    gap: 10,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    backgroundColor: "#171024",
    borderColor: "#231A33",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "100%",
  },
  categoryChipActive: {
    backgroundColor: "#2A1E3D",
    borderColor: "#B56CFF",
  },
  categoryChipText: {
    color: "#CBB8F1",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  categoryChipTextActive: {
    color: "#F0E2FF",
    fontWeight: "800",
  },
  aiButton: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
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
    minWidth: 0,
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
    flexWrap: "wrap",
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
  blockText: {
    color: "#FFD8DE",
    backgroundColor: "#2B161B",
    borderColor: "#8E4656",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  successText: {
    color: "#C8F7D2",
    backgroundColor: "#102619",
    borderColor: "#2F7A45",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
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
  photoNotice: {
    color: "#FFD8DE",
    backgroundColor: "#2B161B",
    borderColor: "#8E4656",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
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
    flexWrap: "wrap",
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
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
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
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  centered: {
    flex: 1,
    backgroundColor: "#0E0A14",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#CBB8F1",
    fontSize: 15,
    marginTop: 12,
  },
});
