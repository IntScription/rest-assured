"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

export default function NewExercisePage() {
  return (
    <Suspense fallback={<PageLoader text="Loading exercise builder..." />}>
      <NewExerciseContent />
    </Suspense>
  );
}

function NewExerciseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedSplitId = searchParams.get("split");

  const [user, setUser] = useState(null);
  const [activeProgram, setActiveProgram] = useState(null);
  const [splits, setSplits] = useState([]);
  const [selectedSplitId, setSelectedSplitId] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const [authLoading, setAuthLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const selectedSplit = useMemo(() => {
    return splits.find((split) => String(split.id) === String(selectedSplitId));
  }, [splits, selectedSplitId]);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data?.session?.user ?? null;

      if (!mounted) return;

      if (!sessionUser) {
        router.replace("/login");
        return;
      }

      setUser(sessionUser);
      setAuthLoading(false);
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!user) return;

    let ignore = false;

    async function fetchSetup() {
      setPageLoading(true);
      setErrorMsg("");

      const { data: program, error: programError } = await supabase
        .from("programs")
        .select("id, name")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (ignore) return;

      if (programError) {
        console.error(programError);
        setErrorMsg(programError.message);
        setPageLoading(false);
        return;
      }

      if (!program) {
        setActiveProgram(null);
        setSplits([]);
        setSelectedSplitId("");
        setPageLoading(false);
        return;
      }

      const { data: splitData, error: splitsError } = await supabase
        .from("splits")
        .select("id, name, focus, order_index")
        .eq("program_id", program.id)
        .order("order_index", { ascending: true });

      if (ignore) return;

      if (splitsError) {
        console.error(splitsError);
        setErrorMsg(splitsError.message);
        setPageLoading(false);
        return;
      }

      const nextSplits = splitData || [];

      setActiveProgram(program);
      setSplits(nextSplits);

      const requestedExists = nextSplits.some(
        (split) => String(split.id) === String(requestedSplitId)
      );

      if (requestedSplitId && requestedExists) {
        setSelectedSplitId(requestedSplitId);
      } else if (nextSplits.length > 0) {
        setSelectedSplitId(nextSplits[0].id);
      } else {
        setSelectedSplitId("");
      }

      setPageLoading(false);
    }

    fetchSetup();

    return () => {
      ignore = true;
    };
  }, [user, requestedSplitId]);

  function generateSlug(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function getAvailableSlug(baseSlug) {
    let candidate = baseSlug;

    for (let attempt = 1; attempt <= 20; attempt++) {
      const { data, error } = await supabase
        .from("exercises")
        .select("id")
        .eq("user_id", user.id)
        .eq("slug", candidate)
        .maybeSingle();

      if (error) throw error;

      if (!data) return candidate;

      candidate = `${baseSlug}-${attempt + 1}`;
    }

    return `${baseSlug}-${Date.now().toString(36)}`;
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (creating) return;

    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrorMsg("Exercise name is required.");
      return;
    }

    if (!selectedSplitId) {
      setErrorMsg("Please select a split.");
      return;
    }

    if (!user) {
      setErrorMsg("User not found. Please login again.");
      return;
    }

    const baseSlug = generateSlug(trimmedName);

    if (!baseSlug) {
      setErrorMsg("Use at least one letter or number in the exercise name.");
      return;
    }

    setCreating(true);
    setErrorMsg("");

    try {
      const availableSlug = await getAvailableSlug(baseSlug);

      const { data: newExercise, error } = await supabase
        .from("exercises")
        .insert({
          name: trimmedName,
          slug: availableSlug,
          split_id: selectedSplitId,
          user_id: user.id,
        })
        .select("id, slug")
        .single();

      if (error) throw error;

      router.push(`/exercise/${newExercise.slug}?split=${selectedSplitId}`);
      router.refresh();
    } catch (err) {
      console.error("CREATE EXERCISE ERROR:", err);
      setErrorMsg(err?.message || "Something went wrong while creating.");
    } finally {
      setCreating(false);
    }
  }

  if (authLoading || pageLoading) {
    return <PageLoader text="Loading exercise builder..." />;
  }

  if (!activeProgram) {
    return (
      <SetupRequired
        title="No Active Program"
        message="Create or activate a training program before adding exercises."
        buttonText="Open Training Setup"
      />
    );
  }

  if (!splits.length) {
    return (
      <SetupRequired
        title="No Splits Found"
        message="Add at least one split before creating exercises."
        buttonText="Add Splits"
      />
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#000_100%)] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            ← Back
          </button>

          <Link
            href="/profile"
            className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            Training Setup
          </Link>
        </div>

        <section className="rounded-4xl border border-white/10 bg-linear-to-br from-white/8 to-white/2 p-6 shadow-2xl shadow-black/40 sm:p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
            Add Exercise
          </p>

          <div className="mt-3 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                Build Your Split
              </h1>

              <p className="mt-3 max-w-2xl text-sm text-zinc-400">
                Add a movement to your active program and start tracking load,
                reps, sets, and volume.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Active Program
              </p>

              <p className="mt-1 text-xl font-black">{activeProgram.name}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-4xl border border-white/10 bg-white/4 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
              Choose Split
            </p>

            <h2 className="mt-2 text-2xl font-black">Where does it belong?</h2>

            <p className="mt-1 text-sm text-zinc-500">
              The split from the dashboard is pre-selected automatically.
            </p>

            <div className="mt-5 grid gap-3">
              {splits.map((split) => {
                const isSelected = String(selectedSplitId) === String(split.id);

                return (
                  <button
                    key={split.id}
                    type="button"
                    onClick={() => setSelectedSplitId(split.id)}
                    className={`rounded-3xl border p-4 text-left transition ${isSelected
                        ? "border-emerald-400/40 bg-emerald-400/10"
                        : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/6"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold">{split.name}</p>

                        <p className="mt-1 text-xs text-zinc-500">
                          {split.focus || "No focus added"}
                        </p>
                      </div>

                      {isSelected && (
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                          Selected
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <form
            onSubmit={handleCreate}
            className="rounded-4xl border border-white/10 bg-white/4 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-6"
          >
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
              New Movement
            </p>

            <h2 className="mt-2 text-2xl font-black">Exercise Details</h2>

            <div className="mt-5 space-y-5">
              <label className="block text-sm font-medium text-zinc-300">
                Exercise Name
                <input
                  type="text"
                  placeholder="e.g. Weighted Pull Ups"
                  value={name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setName(value);
                    setSlug(generateSlug(value));
                    setErrorMsg("");
                  }}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                  required
                />
              </label>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Preview
                </p>

                <p className="mt-2 text-lg font-bold">
                  {name.trim() || "Exercise name"}
                </p>

                <p className="mt-1 break-all text-sm text-zinc-500">
                  {selectedSplit
                    ? `${selectedSplit.name} · /exercise/${slug || "your-slug"}`
                    : `/exercise/${slug || "your-slug"}`}
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={creating || !name.trim() || !selectedSplitId}
                className="min-h-12 w-full rounded-2xl bg-white px-5 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Exercise →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

function PageLoader({ text }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="rounded-3xl border border-white/10 bg-white/4 px-6 py-4 text-sm text-zinc-300">
        {text}
      </div>
    </main>
  );
}

function SetupRequired({ title, message, buttonText }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#000_100%)] px-4 text-white">
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-white/4 p-6 text-center shadow-2xl shadow-black/40">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
          Rest Assured
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight">{title}</h1>

        <p className="mt-3 text-sm text-zinc-400">{message}</p>

        <Link
          href="/profile"
          className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200"
        >
          {buttonText}
        </Link>
      </div>
    </main>
  );
}
