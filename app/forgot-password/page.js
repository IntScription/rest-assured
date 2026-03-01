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

  async function handleReset(e) {
    e.preventDefault();

    if (cooldown > 0) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        if (error.message.toLowerCase().includes("rate")) {
          setError("Too many attempts. Wait a minute before trying again.");
        } else {
          setError(error.message);
        }
      } else {
        setMessage("If this email exists, a reset link has been sent.");
        setCooldown(60);
      }
    } catch (err) {
      setError("Something went wrong. Try again.");
    }

    setLoading(false);
  }

  useEffect(() => {
    if (cooldown === 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center relative px-4">

      {/* Back Button */}
      <button
        onClick={() => router.push("/login")}
        className="absolute top-6 right-6 text-sm text-gray-400 hover:text-white"
      >
        Back
      </button>

      <form
        onSubmit={handleReset}
        className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md space-y-5"
      >
        <h1 className="text-2xl font-bold text-center">
          Forgot Password
        </h1>

        <input
          type="email"
          placeholder="Enter your email"
          className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-white outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading || cooldown > 0}
          className="w-full bg-white text-black p-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading
            ? "Sending..."
            : cooldown > 0
              ? `Wait ${cooldown}s`
              : "Send Reset Link"}
        </button>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        {message && (
          <p className="text-green-500 text-sm text-center">{message}</p>
        )}
      </form>
    </main>
  );
}
