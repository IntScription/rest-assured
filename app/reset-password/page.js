"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPassword() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // 🔐 Check recovery session
  useEffect(() => {
    const checkRecovery = async () => {
      const hash = window.location.hash;

      if (!hash.includes("type=recovery")) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setError("Invalid or expired recovery link.");
      } else {
        setReady(true);
      }
    };

    checkRecovery();
  }, [router]);

  async function handleUpdate(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated successfully!");

    setTimeout(() => {
      router.replace("/login");
    }, 2000);
  }

  if (!ready && !error) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Verifying link...</p>
      </main>
    );
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
        onSubmit={handleUpdate}
        className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md space-y-5 shadow-lg"
      >
        <h1 className="text-2xl font-bold text-center">Set New Password</h1>

        <input
          type="password"
          placeholder="New password"
          className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Confirm password"
          className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-white"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black p-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        {message && <p className="text-green-500 text-sm text-center">{message}</p>}
      </form>
    </main>
  );
}
