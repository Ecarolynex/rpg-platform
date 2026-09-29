import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://jruhyqwwzucrwzqzhoog.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydWh5cXd3enVjcnd6cXpob29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4NTQyMzgsImV4cCI6MjEwNTQzMDIzOH0.1_80jfDIU54lb0kfAyNbyGm3iUW1tRMsg4vaoZm0u4s";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
