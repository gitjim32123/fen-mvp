import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tzdtumvoiajmfpymmgky.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6ZHR1bXZvaWFqbWZweW1tZ2t5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODcxMDIsImV4cCI6MjA5MDg2MzEwMn0.KYXzNYtSpv7yI1hmgvxxh5GE1BL77XruW9Q04e3hXIw";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
