import { supabase } from "./supabase";

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
