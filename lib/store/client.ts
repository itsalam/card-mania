import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { Database } from "./supabase";

let client: SupabaseClient<Database> | null = null;
let fingerprint: string | null = null;

function envFingerprint() {
  return `${Constants.expoConfig?.extra?.supabaseUrl}|${Constants.expoConfig?.extra?.supabaseKey}`;
}

export function initSupabase() {
  const fp = envFingerprint();

  if (client && fingerprint === fp) return client;

  fingerprint = fp;

  client = createClient<Database>(
    Constants.expoConfig?.extra?.supabaseUrl ??
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
    Constants.expoConfig?.extra?.supabaseKey ??
      process.env.EXPO_PUBLIC_SUPABASE_KEY!,
    {
      auth: {
        storage: AsyncStorage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    },
  );
  return client;
}

export function getSupabase() {
  // guarantees a client even if you forgot to init explicitly

  return client ?? initSupabase();
}
