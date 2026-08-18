import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://zkqlegxjynwurxzfhyzt.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWxlZ3hqeW53dXJ4emZoeXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTgwMDYsImV4cCI6MjEwMjU3NDAwNn0.V9s6gsi6lcl4qpZpXBUFg-QPzOn9sGTsTTKZaxxZcWw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
