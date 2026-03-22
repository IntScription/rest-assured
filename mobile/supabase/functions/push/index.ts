import { createClient } from "jsr:@supabase/supabase-js@2";

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    user_id: string;
    title: string;
    body: string;
    data?: Record<string, any>;
  };
  old_record: null | Record<string, any>;
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();

    const userId = payload.record?.user_id;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing user_id" }),
        { status: 400 }
      );
    }

    // 1. Get user's push token
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("expo_push_token")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.expo_push_token) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "No push token" }),
        { status: 200 }
      );
    }

    // 2. Send notification to Expo
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(Deno.env.get("EXPO_ACCESS_TOKEN")
          ? { Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` }
          : {}),
      },
      body: JSON.stringify({
        to: profile.expo_push_token,
        sound: "default",
        title: payload.record.title,
        body: payload.record.body,
        data: payload.record.data ?? {},
      }),
    });

    const json = await res.json();

    return new Response(JSON.stringify(json), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
});
