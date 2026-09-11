"use server";

import { redirect } from "next/navigation";
import { supabaseServer, isAllowed } from "@/lib/supabase";
import { SITE_URL } from "@/lib/config";

export async function sendReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!isAllowed(email)) redirect("/forgot?error=" + encodeURIComponent("That email address is not on the family list."));
  const supabase = await supabaseServer();
  const site = SITE_URL;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site}/reset` });
  if (error) redirect("/forgot?error=" + encodeURIComponent("Could not send the email just now. Try again in a minute."));
  redirect("/forgot?sent=1");
}
