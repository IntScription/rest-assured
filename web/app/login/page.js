"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cleanEmail = email.trim().toLowerCase();

  async function handleLogin(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setError(error.message || "Failed to login.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#000_100%)] px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden rounded-4xl border border-white/10 bg-linear-to-br from-white/8 to-white/2 p-8 shadow-2xl shadow-black/40 lg:block">
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-400">
            Rest Assured
          </p>

          <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight">
            Train hard.
            <br />
            Track smarter.
          </h1>

          <p className="mt-5 max-w-md text-sm leading-6 text-zinc-400">
            Continue your strength journey with programs, splits, exercise logs,
            and progress tracking built for consistent training.
          </p>

          <div className="mt-8 grid gap-3">
            <FeatureCard title="Structured programs" text="Keep your active training block organized." />
            <FeatureCard title="Exercise logs" text="Track weight, reps, sets, and volume." />
            <FeatureCard title="Progress history" text="See your training build up over time." />
          </div>
        </section>

        <section className="w-full rounded-4xl border border-white/10 bg-white/4 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-emerald-400/20 bg-emerald-400/10 text-2xl font-black text-emerald-300">
              R
            </div>

            <p className="mt-5 text-sm uppercase tracking-[0.3em] text-emerald-400">
              Welcome Back
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight">Login</h2>

            <p className="mt-3 text-sm text-zinc-400">
              Pick up right where your last workout left off.
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
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
                }}
                required
              />
            </label>

            <label className="block text-sm font-medium text-zinc-300">
              Password
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 pr-20 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-zinc-500 transition hover:text-white"
              >
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !cleanEmail || !password}
              className="min-h-12 w-full rounded-2xl bg-white px-5 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login →"}
            </button>

            <p className="border-t border-white/10 pt-5 text-center text-sm text-zinc-400">
              Don’t have an account?{" "}
              <Link
                href="/signup"
                className="font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                Create one
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({ title, text }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
      <p className="font-bold text-white">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{text}</p>
    </div>
  );
}
