import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = "https://znbmrridvdtombbtujnj.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuYm1ycmlkdmR0b21iYnR1am5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTkxNzQsImV4cCI6MjA4NzA3NTE3NH0.3vswq6s63g6YbQplyC-kHU3n2IFPcYdSzEqrUktDbEs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
