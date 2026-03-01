"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // 🔥 IMPORTANT PART
  useEffect(() => {
    const handleRecovery = async () => {
      const hash = window.location.hash;

      // 🔥 Only allow recovery links
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

    handleRecovery();
  }, [router]);

  async function handleUpdate(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password updated successfully!");
      setTimeout(() => router.push("/login"), 2000);
    }

    setLoading(false);
  }

  if (!ready && !error) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <form
        onSubmit={handleUpdate}
        className="bg-zinc-900 p-8 rounded-xl w-full max-w-md space-y-4"
      >
        <h1 className="text-xl font-bold">Set New Password</h1>

        <input
          type="password"
          placeholder="New password"
          className="w-full p-3 rounded bg-zinc-800 border border-zinc-700"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black p-3 rounded font-semibold"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {message && <p className="text-green-500 text-sm">{message}</p>}
      </form>
    </main>
  );
}
