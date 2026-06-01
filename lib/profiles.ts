import { supabase } from "./supabase";
import type { TransportMode } from "./types";

export async function getProfileDisplayNames(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return {};

  const { data, error } = await supabase.rpc("get_profile_display_names", { p_user_ids: ids });
  if (error) throw error;

  const names: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row?.id) {
      names[row.id] = row.display_name || "FEN user";
    }
  }
  return names;
}

export async function getProfileTravelArea(userId: string): Promise<{ postcode: string | null; transport_mode: TransportMode }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("postcode,transport_mode")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return {
    postcode: data?.postcode || null,
    transport_mode: data?.transport_mode || "unspecified",
  };
}
