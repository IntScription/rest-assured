import * as Linking from "expo-linking";
import { supabase } from "@/src/lib/supabase";

function parseHashParams(url: string) {
  const hash = url.split("#")[1] ?? "";
  return new URLSearchParams(hash);
}

export type AuthRedirectResult =
  | { ok: true; type: "oauth" | "recovery" | "signup" | "unknown" }
  | { ok: false; error: string };

export async function handleAuthRedirectUrl(url: string | null): Promise<AuthRedirectResult> {
  if (!url) {
    return { ok: true, type: "unknown" };
  }

  try {
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }

    const code = parsed?.searchParams?.get("code") ?? null;

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return { ok: false, error: error.message };

      const type =
        parsed?.searchParams?.get("type") === "recovery"
          ? "recovery"
          : parsed?.searchParams?.get("type") === "signup"
            ? "signup"
            : "oauth";

      return { ok: true, type };
    }

    const hashParams = parseHashParams(url);
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");
    const type = hashParams.get("type");

    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) return { ok: false, error: error.message };

      if (type === "recovery") return { ok: true, type: "recovery" };
      if (type === "signup") return { ok: true, type: "signup" };
      return { ok: true, type: "oauth" };
    }

    return { ok: true, type: "unknown" };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? "Could not process auth link") };
  }
}

export async function getInitialAuthUrl() {
  return Linking.getInitialURL();
}
