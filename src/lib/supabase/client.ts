import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://zpbwgodtjxhdecgsosxv.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYndnb2R0anhoZGVjZ3Nvc3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMzE5NjIsImV4cCI6MjEwMTgwNzk2Mn0.c81Bo6tmArG0Voq2EPmaQEoWk2jB6a6VuDVzHVv4H1M";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
