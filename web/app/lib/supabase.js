"use client";

import { createClient } from "@supabase/supabase-js";

let browserClient = null;

export function getSupabaseClient() {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseClient();
      const value = client[prop];

      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);
