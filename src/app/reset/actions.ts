"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase";

export async function setNewPassword(formData: FormData) {
  const p1 = String(formData.get("password") ?? "");
  const p2 = String(formData.get("password2") ?? "");
  if (p1.length < 8) redirect("/reset?error=" + encodeURIComponent("At least eight characters, please."));
  if (p1 !== p2) redirect("/reset?error=" + encodeURIComponent("The two passwords were not the same. Try again."));
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: p1 });
  if (error) redirect("/reset?error=" + encodeURIComponent("Could not save it. The link may have expired; ask for a new one."));
  redirect("/?welcome=back");
}
