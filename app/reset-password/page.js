"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

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

  /* ---------------- SESSION VERIFICATION ---------------- */

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data?.session) {
        router.replace("/login");
      } else {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [router]);

  /* ---------------- PASSWORD STRENGTH ---------------- */

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
    if (score <= 2) return "Weak";
    if (score === 3 || score === 4) return "Medium";
    return "Strong";
  };

  const strength = getStrengthLabel();

  const strengthWidth = `${(score / 5) * 100}%`;

  const passwordsMatch = password && confirm && password === confirm;

  const isValidPassword =
    score >= 3 && passwordsMatch;

  /* ---------------- HANDLE UPDATE ---------------- */

  async function handleUpdate(e) {
    e.preventDefault();

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

      setMessage("Password updated successfully! Redirecting...");

      setTimeout(() => {
        router.push("/login");
      }, 3000);

    } catch (err) {
      console.log("RESET UPDATE ERROR:", err);
      setError("Network error. Please try again.");
    }

    setLoading(false);
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center text-white">
        Checking session...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center relative px-4">

      {/* Back Button */}
      <button
        onClick={() => router.push("/login")}
        className="absolute top-6 right-6 text-sm text-gray-400 hover:text-white transition"
      >
        Back
      </button>

      <form
        onSubmit={handleUpdate}
        className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md space-y-5 shadow-xl"
      >
        <h1 className="text-2xl font-bold text-center">
          Reset Password
        </h1>

        <p className="text-sm text-gray-400 text-center">
          Choose a strong new password.
        </p>

        {/* ---------------- NEW PASSWORD ---------------- */}

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="New Password"
            className="w-full p-3 pr-16 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-white outline-none transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3 text-sm text-gray-400 hover:text-white"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        {/* ---------------- STRENGTH BAR ---------------- */}

        {password && (
          <div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${strength === "Strong"
                    ? "bg-green-500"
                    : strength === "Medium"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                style={{ width: strengthWidth }}
              />
            </div>
            <p className="text-xs mt-1 text-gray-400">
              Strength: {strength}
            </p>
          </div>
        )}

        {/* ---------------- CONFIRM PASSWORD ---------------- */}

        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm Password"
            className="w-full p-3 pr-10 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-white outline-none transition"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-3 text-sm text-gray-400 hover:text-white"
          >
            {showConfirm ? "Hide" : "Show"}
          </button>

          {confirm && passwordsMatch && (
            <span className="absolute right-14 top-3 text-green-500">
              ✓
            </span>
          )}
        </div>

        {/* ---------------- SUBMIT ---------------- */}

        <button
          type="submit"
          disabled={loading || !isValidPassword}
          className="w-full bg-white text-black p-3 rounded-lg font-semibold disabled:opacity-50 transition"
        >
          {loading
            ? "Updating..."
            : message
              ? "Updated ✓"
              : "Update Password"}
        </button>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        {message && (
          <p className="text-green-500 text-sm text-center">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
