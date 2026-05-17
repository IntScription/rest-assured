"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ForgotPassword() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const cleanEmail = email.trim().toLowerCase();
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);

  async function handleReset(event) {
    event.preventDefault();

    if (cooldown > 0 || loading || !isValidEmail) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        if (error.status === 429) {
          setError("Too many attempts. Please wait a few minutes.");
        } else {
          setError(error.message || "Failed to send reset link.");
        }

        setLoading(false);
        return;
      }

      setMessage("If this email exists, a reset link has been sent.");
      setCooldown(90);
      setLoading(false);
    } catch (err) {
      console.log("RESET ERROR:", err);
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#000_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <section className="w-full rounded-4xl border border-white/10 bg-white/4 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <button
            onClick={() => router.push("/login")}
            className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            ← Back to Login
          </button>

          <div className="mt-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-emerald-400/20 bg-emerald-400/10 text-2xl font-black text-emerald-300">
              ?
            </div>

            <p className="mt-5 text-sm uppercase tracking-[0.3em] text-emerald-400">
              Account Recovery
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight">
              Forgot Password
            </h1>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Enter your account email and we’ll send you a secure reset link.
            </p>
          </div>

          <form onSubmit={handleReset} className="mt-8 space-y-5">
            <label className="block text-sm font-medium text-zinc-300">
              Email
              <input
                type="email"
                placeholder="you@example.com"
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                  setMessage("");
                }}
                required
              />
            </label>

            {!isValidEmail && email && (
              <p className="text-sm text-zinc-500">
                Enter a valid email address.
              </p>
            )}

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || cooldown > 0 || !isValidEmail}
              className="min-h-12 w-full rounded-2xl bg-white px-5 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Sending..."
                : cooldown > 0
                  ? `Wait ${cooldown}s`
                  : message
                    ? "Send Again"
                    : "Send Reset Link →"}
            </button>

            <p className="border-t border-white/10 pt-5 text-center text-sm text-zinc-500">
              Remembered it?{" "}
              <Link
                href="/login"
                className="font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                Login
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
