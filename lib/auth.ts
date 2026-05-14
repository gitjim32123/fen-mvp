import { supabase } from "./supabase";
import type { Profile } from "./types";

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  postcode: string,
  transportMode: string = "unspecified"
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName, postcode, transport_mode: transportMode } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function updateProfile(updates: Omit<Partial<Profile>, "bio"> & { bio?: string | null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No profile was updated. This may be a permissions/RLS issue.");
}

export async function addStrike(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase.rpc("add_profile_strike", { p_user_id: user.id });
  if (error) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("strike_count")
      .eq("id", user.id)
      .single();
    const current = (profile as any)?.strike_count ?? 0;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ strike_count: current + 1 })
      .eq("id", user.id);
    if (updateError) throw updateError;
    return current + 1;
  }
  return (data as number) ?? 1;
}

export async function getStrikeCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await supabase
    .from("profiles")
    .select("strike_count")
    .eq("id", user.id)
    .single();
  return (data as any)?.strike_count ?? 0;
}
