"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const cleanEmail = email.trim().toLowerCase();

  const passwordChecks = {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const isPasswordValid =
    passwordChecks.length && passwordChecks.letter && passwordChecks.number;

  async function handleSignup(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    if (!isPasswordValid) {
      setError("Use at least 8 characters with letters and numbers.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setError(error.message || "Failed to create account.");
      setLoading(false);
      return;
    }

    if (data?.session) {
      setMessage("Account created successfully. You can now use the app.");
    } else {
      setMessage(
        "Account created! Please check your email to confirm your account."
      );
    }

    setLoading(false);
  }

  async function resendConfirmation() {
    if (!cleanEmail) {
      setError("Enter your email first.");
      return;
    }

    setResending(true);
    setError("");

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setError(error.message || "Failed to resend confirmation email.");
    } else {
      setMessage("Confirmation email resent.");
    }

    setResending(false);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#000_100%)] px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="w-full rounded-4xl border border-white/10 bg-white/4 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-emerald-400/20 bg-emerald-400/10 text-2xl font-black text-emerald-300">
              R
            </div>

            <p className="mt-5 text-sm uppercase tracking-[0.3em] text-emerald-400">
              Get Started
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight">
              Create Account
            </h1>

            <p className="mt-3 text-sm text-zinc-400">
              Build your training setup and start logging progress.
            </p>
          </div>

          <form onSubmit={handleSignup} className="mt-8 space-y-5">
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

            <label className="block text-sm font-medium text-zinc-300">
              Password
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 pr-20 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                    setMessage("");
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

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Password Checklist
              </p>

              <div className="mt-3 grid gap-2 text-sm">
                <PasswordCheck active={passwordChecks.length}>
                  At least 8 characters
                </PasswordCheck>

                <PasswordCheck active={passwordChecks.letter}>
                  Contains letters
                </PasswordCheck>

                <PasswordCheck active={passwordChecks.number}>
                  Contains a number
                </PasswordCheck>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {message && (
              <div className="space-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-center text-sm text-emerald-300">
                <p>{message}</p>

                <button
                  type="button"
                  onClick={resendConfirmation}
                  disabled={resending}
                  className="font-semibold underline decoration-emerald-300/30 underline-offset-4 transition hover:decoration-emerald-300 disabled:opacity-50"
                >
                  {resending ? "Resending..." : "Resend confirmation email"}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !cleanEmail || !password || Boolean(message)}
              className="min-h-12 w-full rounded-2xl bg-white px-5 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Account →"}
            </button>

            <p className="border-t border-white/10 pt-5 text-center text-sm text-zinc-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                Login
              </Link>
            </p>
          </form>
        </section>

        <section className="hidden rounded-4xl border border-white/10 bg-linear-to-br from-white/8 to-white/2 p-8 shadow-2xl shadow-black/40 lg:block">
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-400">
            Your Logbook
          </p>

          <h2 className="mt-5 text-5xl font-black leading-tight tracking-tight">
            Make progress
            <br />
            visible.
          </h2>

          <p className="mt-5 max-w-md text-sm leading-6 text-zinc-400">
            Create your training program, add splits, add exercises, then track
            every session with clean volume-based logging.
          </p>

          <div className="mt-8 rounded-4xl border border-emerald-400/20 bg-emerald-400/10 p-5">
            <p className="text-sm font-bold text-emerald-300">
              Good for strength blocks, hypertrophy phases, and progressive
              overload tracking.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function PasswordCheck({ active, children }) {
  return (
    <p className={active ? "text-emerald-300" : "text-zinc-500"}>
      {active ? "✓" : "•"} {children}
    </p>
  );
}
