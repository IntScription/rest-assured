// src/lib/notices/actions.ts
import * as Linking from "expo-linking";
import { supabase } from "@/src/lib/supabase";

export async function dismissNotice(userId: string, noticeId: string) {
  const { error } = await supabase
    .from("user_notice_dismissals")
    .insert({
      user_id: userId,
      notice_id: noticeId,
    });

  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    throw error;
  }
}

export async function openStore(url?: string | null) {
  if (!url) return;
  await Linking.openURL(url);
}
