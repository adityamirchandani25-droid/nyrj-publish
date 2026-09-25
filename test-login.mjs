import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rl = createInterface({
  input: stdin,
  output: stdout,
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const configuredKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl) throw new Error("Set SUPABASE_URL before running this check.");
const supabaseKey = configuredKey || (await rl.question("Enter your Supabase publishable key: "));

const email = await rl.question("Enter your existing NYRJ email: ");

const password = await rl.question("Enter your existing NYRJ password: ");

rl.close();

const supabase = createClient(supabaseUrl, supabaseKey.trim(), {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const { data, error } = await supabase.auth.signInWithPassword({
  email: email.trim(),
  password,
});

if (error) {
  console.log("\nLOGIN FAILED:", error.message);
} else {
  console.log("\nLOGIN SUCCESSFUL");
  console.log("User authenticated:", Boolean(data.user));

  await supabase.auth.signOut();
}
