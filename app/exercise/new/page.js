"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewExercisePage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [splits, setSplits] = useState([]);
  const [selectedSplitId, setSelectedSplitId] = useState("");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  /* ===== AUTH ===== */
  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data?.session?.user ?? null;
      if (!sessionUser) {
        router.replace("/login");
        return;
      }
      setUser(sessionUser);
      setAuthLoading(false);
    }
    checkAuth();
  }, [router]);

  /* ===== FETCH USER SPLITS ===== */
  useEffect(() => {
    if (!user) return;

    const fetchUserSplits = async () => {
      try {
        const { data: program } = await supabase
          .from("programs")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (!program) return;

        const { data: splitsData, error } = await supabase
          .from("splits")
          .select("id, name, order_index")
          .eq("program_id", program.id)
          .order("order_index", { ascending: true });

        if (error) throw error;
        setSplits(splitsData || []);
      } catch (err) {
        console.error("Error fetching splits:", err);
      }
    };

    fetchUserSplits();
  }, [user]);

  function generateSlug(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (loading) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("Exercise name is required.");
      return;
    }
    if (!selectedSplitId) {
      setErrorMsg("Please select a split.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    const generatedSlug = generateSlug(trimmedName);

    try {
      const { data: existing, error: existingError } = await supabase
        .from("exercises")
        .select("id, slug")
        .eq("slug", generatedSlug)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) {
        router.push(`/exercise/${existing.slug}`);
        return;
      }

      const { data: newExercise, error: insertError } = await supabase
        .from("exercises")
        .insert({
          name: trimmedName,
          slug: generatedSlug,
          split_id: selectedSplitId,
          user_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      router.push(`/exercise/${newExercise.slug}`);
    } catch (err) {
      console.error("Error creating exercise:", err);
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-6 flex justify-center">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">
          ← Back
        </Link>

        <h1 className="text-3xl font-bold text-center">Create New Exercise</h1>

        <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-lg space-y-4">
          <label className="flex flex-col text-sm">
            Exercise Name
            <input
              type="text"
              placeholder="Enter exercise name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(generateSlug(e.target.value));
              }}
              className="mt-1 p-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:border-white focus:outline-none"
            />
          </label>

          {slug && (
            <div className="inline-block text-xs px-2 py-1 rounded-full bg-zinc-700 text-zinc-300">
              Slug: {slug}
            </div>
          )}

          <label className="flex flex-col text-sm">
            Split
            <select
              value={selectedSplitId}
              onChange={(e) => setSelectedSplitId(e.target.value)}
              className="mt-1 p-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:border-white focus:outline-none"
            >
              <option value="">Select Split</option>
              {splits.map((split) => (
                <option key={split.id} value={split.id}>
                  {split.name}
                </option>
              ))}
            </select>
          </label>

          {splits.length === 0 && (
            <p className="text-zinc-500 text-sm">
              No splits found. Create a split first in your{" "}
              <Link href="/profile" className="underline text-white">
                profile
              </Link>.
            </p>
          )}

          {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}

          <button
            type="submit"
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-white text-black py-3 rounded-xl font-semibold hover:bg-gray-200 disabled:opacity-50 transition"
          >
            {loading ? "Creating..." : "Create Exercise"}
          </button>
        </div>
      </div>
    </main>
  );
}
