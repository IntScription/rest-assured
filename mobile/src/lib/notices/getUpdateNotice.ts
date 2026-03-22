// src/lib/notices/getUpdateNotice.ts
import { supabase } from "@/src/lib/supabase";

export type AppNotice = {
  id: string;
  title: string;
  message: string;
  kind: "info" | "update" | "announcement";
  is_active: boolean;
  created_at: string;
  min_app_version?: string | null;
  latest_app_version?: string | null;
  action_url?: string | null;
  force_update?: boolean | null;
};

export async function getVisibleUpdateNotice(userId: string) {
  const { data, error } = await supabase
    .from("app_notices")
    .select(
      `
      id,
      title,
      message,
      kind,
      is_active,
      created_at,
      min_app_version,
      latest_app_version,
      action_url,
      force_update
    `
    )
    .eq("is_active", true)
    .in("kind", ["update", "announcement"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data?.length) return null;

  const { data: dismissedRows, error: dismissedError } = await supabase
    .from("user_notice_dismissals")
    .select("notice_id")
    .eq("user_id", userId);

  if (dismissedError) throw dismissedError;

  const dismissedIds = new Set((dismissedRows ?? []).map((r) => r.notice_id));

  const visible = data.find((notice) => !dismissedIds.has(notice.id));
  return (visible as AppNotice | undefined) ?? null;
}
