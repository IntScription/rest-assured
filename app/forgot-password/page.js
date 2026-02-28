"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";

export default function ForgotPassword() {
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
      redirectTo: "http://localhost:3000/reset-password",
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password reset link sent. Check your email.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <form onSubmit={handleReset} className="bg-zinc-900 p-8 rounded-xl w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold">Forgot Password</h1>

        <input
          type="email"
          placeholder="Enter your email"
          className="w-full p-3 rounded bg-zinc-800 border border-zinc-700"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full bg-white text-black p-3 rounded font-semibold"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {message && <p className="text-green-500 text-sm">{message}</p>}
      </form>
    </main>
  );
}

