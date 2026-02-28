"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function handleSignup(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data?.user && !data?.session) {
      setMessage(
        "Account created! Please check your email to confirm your account."
      );
    }

    setLoading(false);
  }

  async function resendConfirmation() {
    if (!email) {
      setError("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Confirmation email resent.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <form
        onSubmit={handleSignup}
        className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md space-y-5 border border-zinc-800"
      >
        <h1 className="text-2xl font-bold text-center">Create Account</h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading || message}
          className="w-full bg-white text-black p-3 rounded-xl font-semibold"
        >
          {loading ? "Creating..." : "Sign Up"}
        </button>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        {message && (
          <div className="text-green-400 text-sm text-center space-y-2">
            <p>{message}</p>
            <button
              type="button"
              onClick={resendConfirmation}
              className="underline"
            >
              Resend confirmation email
            </button>
          </div>
        )}

        <p className="text-sm text-zinc-400 text-center">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Login
          </Link>
        </p>
      </form>
    </main>
  );
}

