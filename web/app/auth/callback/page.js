"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthCallbackPage() {
  const router = useRouter();

  const [error, setError] = useState("");
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    let mounted = true;

    async function handleCallback() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (!data?.session) {
          throw new Error("Session could not be created. Please login again.");
        }

        if (!mounted) return;

        setStatus("Signed in successfully. Redirecting...");
        router.replace("/");
        router.refresh();
      } catch (err) {
        console.error("AUTH CALLBACK ERROR:", err);

        if (!mounted) return;

        setError(err?.message || "Authentication failed.");
        setStatus("Could not sign you in.");
      }
    }

    handleCallback();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#000_100%)] px-4 py-8 text-white">
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-white/4 p-6 text-center shadow-2xl shadow-black/40">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
          Rest Assured
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight">{status}</h1>

        {error ? (
          <>
            <p className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>

            <Link
              href="/login"
              className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200"
            >
              Back to Login
            </Link>
          </>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">
            Please wait while we complete your session.
          </p>
        )}
      </div>
    </main>
  );
}
