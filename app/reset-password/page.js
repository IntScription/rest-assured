"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPassword() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordStrength = () => {
    if (password.length < 6) return "Weak";
    if (password.match(/[A-Z]/) && password.match(/[0-9]/)) return "Strong";
    return "Medium";
  };

  async function handleUpdate(e) {
    e.preventDefault();

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password updated successfully! Redirecting...");

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    }

    setLoading(false);
  }

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
        onSubmit={handleUpdate}
        className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md space-y-5"
      >
        <h1 className="text-2xl font-bold text-center">
          Reset Password
        </h1>

        <input
          type="password"
          placeholder="New Password"
          className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-white outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {password && (
          <p className={`text-sm ${passwordStrength() === "Strong"
            ? "text-green-500"
            : passwordStrength() === "Medium"
              ? "text-yellow-500"
              : "text-red-500"
            }`}>
            Strength: {passwordStrength()}
          </p>
        )}

        <input
          type="password"
          placeholder="Confirm Password"
          className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-white outline-none"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black p-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update Password"}
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
