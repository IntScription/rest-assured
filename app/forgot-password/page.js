"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

export default function ForgotPassword() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset(e) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password reset link sent. Check your email.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center relative px-4">

      {/* 🔙 Back Button */}
      <button
        onClick={() => router.push("/login")}
        className="absolute top-6 right-6 text-sm text-gray-400 hover:text-white transition"
      >
        Back
      </button>

      <form
        onSubmit={handleReset}
        className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md space-y-5 shadow-lg"
      >
        <h1 className="text-2xl font-bold text-center">Forgot Password</h1>

        <input
          type="email"
          placeholder="Enter your email"
          className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black p-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send Reset Link"}
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
