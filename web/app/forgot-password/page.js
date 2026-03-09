"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

export default function ForgotPassword() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Simple email validation
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function handleReset(e) {
    e.preventDefault();

    if (cooldown > 0 || loading || !isValidEmail) return;

    setLoading(true);
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

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

      // Auto redirect after success
      setTimeout(() => {
        router.push("/login");
      }, 4000);

    } catch (err) {
      console.log("RESET ERROR:", err);
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  // Clean cooldown countdown (no interval stacking)
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

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
        onSubmit={handleReset}
        className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md space-y-5 shadow-xl"
      >
        <h1 className="text-2xl font-bold text-center">
          Forgot Password
        </h1>

        <p className="text-sm text-gray-400 text-center">
          Enter your account email and we’ll send you a reset link.
        </p>

        <input
          type="email"
          placeholder="Enter your email"
          className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-white outline-none transition"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading || cooldown > 0 || !isValidEmail}
          className="w-full bg-white text-black p-3 rounded-lg font-semibold disabled:opacity-50 transition"
        >
          {loading
            ? "Sending..."
            : message
              ? "Email Sent ✓"
              : cooldown > 0
                ? `Wait ${cooldown}s`
                : "Send Reset Link"}
        </button>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        {message && (
          <p className="text-green-500 text-sm text-center">
            {message} Redirecting to login...
          </p>
        )}
      </form>
    </main>
  );
}
