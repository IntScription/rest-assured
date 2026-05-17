"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPassword() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const getStrengthScore = () => {
    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    return score;
  };

  const score = getStrengthScore();

  const getStrengthLabel = () => {
    if (!password) return "Empty";
    if (score <= 2) return "Weak";
    if (score === 3 || score === 4) return "Medium";
    return "Strong";
  };

  const strength = getStrengthLabel();
  const strengthWidth = `${(score / 5) * 100}%`;

  const passwordsMatch = Boolean(password && confirm && password === confirm);
  const hasMismatch = Boolean(confirm && password !== confirm);

  const isValidPassword = score >= 3 && passwordsMatch;

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      setCheckingSession(true);
      setError("");

      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          if (mounted) {
            setCheckingSession(false);
          }

          return;
        }

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (!mounted) return;

          if (event === "PASSWORD_RECOVERY" || session) {
            setCheckingSession(false);
          }
        });

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (data?.session) {
          if (mounted) setCheckingSession(false);
          subscription.unsubscribe();
          return;
        }

        setTimeout(() => {
          if (!mounted) return;

          setCheckingSession(false);
          setError(
            "Reset link is missing, expired, or already used. Please request a new password reset link."
          );
        }, 1200);

        return () => subscription.unsubscribe();
      } catch (err) {
        console.log("RESET SESSION ERROR:", err);

        await supabase.auth.signOut();

        if (mounted) {
          setCheckingSession(false);
          setError(
            "Reset link expired or invalid. Please request a new password reset link."
          );
        }
      }
    }

    const cleanupPromise = prepareRecoverySession();

    return () => {
      mounted = false;

      Promise.resolve(cleanupPromise).then((cleanup) => {
        if (typeof cleanup === "function") cleanup();
      });
    };
  }, []);

  async function handleUpdate(event) {
    event.preventDefault();

    if (!isValidPassword || loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        setError(error.message || "Failed to update password.");
        setLoading(false);
        return;
      }

      setMessage("Password updated successfully. Redirecting to login...");

      await supabase.auth.signOut();

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      console.log("RESET UPDATE ERROR:", err);
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="rounded-3xl border border-white/10 bg-white/4 px-6 py-4 text-sm text-zinc-300">
          Checking reset link...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#000_100%)] px-4 py-8 text-white">
      <div className="w-full max-w-md space-y-6">
        <button
          onClick={() => router.push("/login")}
          className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          ← Back to Login
        </button>

        <section className="rounded-4xl border border-white/10 bg-linear-to-br from-white/8 to-white/2 p-6 text-center shadow-2xl shadow-black/40">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
            Password Reset
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight">
            Reset Password
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            Choose a strong new password for your account.
          </p>
        </section>

        <form
          onSubmit={handleUpdate}
          className="space-y-5 rounded-4xl border border-white/10 bg-white/4 p-6 shadow-2xl shadow-black/30 backdrop-blur"
        >
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}

              {error.toLowerCase().includes("reset link") && (
                <div className="mt-3">
                  <Link
                    href="/forgot-password"
                    className="font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                  >
                    Request a new link
                  </Link>
                </div>
              )}
            </div>
          )}

          <label className="block text-sm font-medium text-zinc-300">
            New Password
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New password"
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

          {password && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-black/40">
                <div
                  className={`h-full transition-all duration-300 ${strength === "Strong"
                      ? "bg-emerald-500"
                      : strength === "Medium"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  style={{ width: strengthWidth }}
                />
              </div>

              <p className="text-xs text-zinc-400">
                Strength:{" "}
                <span
                  className={
                    strength === "Strong"
                      ? "text-emerald-300"
                      : strength === "Medium"
                        ? "text-yellow-300"
                        : "text-red-300"
                  }
                >
                  {strength}
                </span>
              </p>
            </div>
          )}

          <label className="block text-sm font-medium text-zinc-300">
            Confirm Password
            <div className="relative mt-2">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm password"
                className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 pr-24 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                value={confirm}
                onChange={(event) => {
                  setConfirm(event.target.value);
                  setError("");
                  setMessage("");
                }}
                required
              />

              {passwordsMatch && (
                <span className="absolute right-16 top-1/2 -translate-y-1/2 text-emerald-400">
                  ✓
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {hasMismatch && (
            <p className="text-sm text-red-300">Passwords do not match.</p>
          )}

          {message && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isValidPassword || !!message}
            className="min-h-12 w-full rounded-2xl bg-white px-5 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Updating..." : message ? "Updated ✓" : "Update Password"}
          </button>
        </form>
      </div>
    </main>
  );
}
