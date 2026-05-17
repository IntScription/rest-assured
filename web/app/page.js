"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { FaUserCircle } from "react-icons/fa";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useSwipeable } from "react-swipeable";

export default function HomePage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const todayKey = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const readableDate = useMemo(() => format(new Date(), "EEEE, dd MMM"), []);

  const [user, setUser] = useState(null);
  const [activeProgram, setActiveProgram] = useState(null);
  const [splits, setSplits] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [exercises, setExercises] = useState([]);

  const [loading, setLoading] = useState(true);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [navGlow, setNavGlow] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!data?.session) {
        router.replace("/login");
        return;
      }

      setUser(data.session.user);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!user) return;

    let ignore = false;

    async function fetchActiveProgram() {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (ignore) return;

      if (error) {
        console.error(error);
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setActiveProgram(data || null);

      if (!data) {
        setSplits([]);
        setExercises([]);
        setLoading(false);
      }
    }

    fetchActiveProgram();

    return () => {
      ignore = true;
    };
  }, [user]);

  useEffect(() => {
    if (!activeProgram) return;

    let ignore = false;

    async function fetchSplits() {
      const { data, error } = await supabase
        .from("splits")
        .select("id, name, focus, order_index")
        .eq("program_id", activeProgram.id)
        .order("order_index", { ascending: true });

      if (ignore) return;

      if (error) {
        console.error(error);
        setErrorMsg(error.message);
        setSplits([]);
        setLoading(false);
        return;
      }

      const nextSplits = data || [];
      setSplits(nextSplits);

      const splitFromUrl = searchParams.get("split");
      let index = 0;

      if (splitFromUrl) {
        const foundIndex = nextSplits.findIndex(
          (split) => String(split.id) === String(splitFromUrl)
        );

        if (foundIndex >= 0) {
          index = foundIndex;
        }
      }

      setCurrentIndex(index);
      setLoading(false);
    }

    fetchSplits();

    return () => {
      ignore = true;
    };
  }, [activeProgram, searchParams]);

  const currentSplit = splits[currentIndex] || null;

  useEffect(() => {
    let ignore = false;

    async function loadExercises() {
      if (!currentSplit) {
        return;
      }

      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, slug")
        .eq("split_id", currentSplit.id)
        .order("id", { ascending: true });

      if (ignore) return;

      if (error) {
        console.error(error);
        setErrorMsg(error.message);
        setExercises([]);
        return;
      }

      setExercises(data || []);
    }

    loadExercises();

    return () => {
      ignore = true;
    };
  }, [currentSplit]);

  const refreshExercises = useCallback(async () => {
    if (!currentSplit) return;

    setExercisesLoading(true);

    const { data, error } = await supabase
      .from("exercises")
      .select("id, name, slug")
      .eq("split_id", currentSplit.id)
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setExercises([]);
    } else {
      setExercises(data || []);
    }

    setExercisesLoading(false);
  }, [currentSplit]);

  useEffect(() => {
    if (!user || !currentSplit || !activeProgram) return;

    let ignore = false;

    async function fetchCompletion() {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("program_id", activeProgram.id)
        .eq("split_id", currentSplit.id)
        .eq("workout_date", todayKey)
        .maybeSingle();

      if (ignore) return;

      if (!error) {
        setCompleted(Boolean(data));
      }
    }

    fetchCompletion();

    return () => {
      ignore = true;
    };
  }, [user, currentSplit, activeProgram, todayKey]);

  async function toggleComplete() {
    if (!user || !currentSplit || !activeProgram) return;

    setErrorMsg("");

    if (completed) {
      const { error } = await supabase
        .from("workout_sessions")
        .delete()
        .eq("user_id", user.id)
        .eq("program_id", activeProgram.id)
        .eq("split_id", currentSplit.id)
        .eq("workout_date", todayKey);

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setCompleted(false);
      return;
    }

    const { error } = await supabase.from("workout_sessions").insert({
      user_id: user.id,
      program_id: activeProgram.id,
      split_id: currentSplit.id,
      workout_date: todayKey,
      completed_at: new Date().toISOString(),
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setCompleted(true);
  }

  function handleNext() {
    if (!splits.length) return;

    setNavGlow("next");
    setTimeout(() => setNavGlow(null), 250);

    const next = currentIndex + 1 < splits.length ? currentIndex + 1 : 0;
    setCurrentIndex(next);
    router.replace(`/?split=${splits[next].id}`, { scroll: false });
  }

  function handlePrev() {
    if (!splits.length) return;

    setNavGlow("prev");
    setTimeout(() => setNavGlow(null), 250);

    const prev = currentIndex - 1 >= 0 ? currentIndex - 1 : splits.length - 1;
    setCurrentIndex(prev);
    router.replace(`/?split=${splits[prev].id}`, { scroll: false });
  }

  if (loading) return <FullScreenLoader />;

  if (!activeProgram) {
    return (
      <SetupEmptyState
        title="Build Your Training Setup"
        message="Create a program and add your first split before tracking exercises."
        link="/profile"
        linkText="Open Training Setup"
      />
    );
  }

  if (!splits.length) {
    return (
      <SetupEmptyState
        title={activeProgram.name}
        message="No splits added yet. Add your first split to start building your workout dashboard."
        link="/profile"
        linkText="Add Splits"
      />
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#000_100%)] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
              Rest Assured
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              Today
            </h1>

            <p className="mt-2 text-sm text-zinc-400">{readableDate}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrev}
              disabled={splits.length <= 1}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/4 text-zinc-300 transition hover:bg-white/10 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${navGlow === "prev"
                ? "ring-2 ring-white shadow-lg shadow-white/20"
                : ""
                }`}
              aria-label="Previous split"
            >
              <FiChevronLeft size={22} />
            </button>

            <button
              onClick={handleNext}
              disabled={splits.length <= 1}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/4 text-zinc-300 transition hover:bg-white/10 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${navGlow === "next"
                ? "ring-2 ring-white shadow-lg shadow-white/20"
                : ""
                }`}
              aria-label="Next split"
            >
              <FiChevronRight size={22} />
            </button>

            <Link
              href="/profile"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white text-xl text-black transition hover:scale-105"
              aria-label="Training setup"
              title="Training setup"
            >
              <FaUserCircle />
            </Link>
          </div>
        </header>

        {errorMsg && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMsg}
          </div>
        )}

        <section className="rounded-4xl border border-white/10 bg-linear-to-br from-white/8 to-white/2 p-6 shadow-2xl shadow-black/40 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Active Program
                </span>

                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-zinc-400">
                  {activeProgram.name}
                </span>
              </div>

              <h2 className="mt-4 text-4xl font-black tracking-tight">
                {currentSplit.name}
              </h2>

              {currentSplit.focus ? (
                <p className="mt-2 text-sm text-zinc-400">
                  Focus: {currentSplit.focus}
                </p>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">
                  Track exercises, log performance, and mark this session
                  complete.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-80">
              <Link
                href={`/exercise/new?split=${currentSplit.id}`}
                className="flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200"
              >
                Add Exercise →
              </Link>

              <button
                onClick={toggleComplete}
                className={`min-h-12 rounded-2xl px-5 font-bold transition hover:scale-[1.01] ${completed
                  ? "border border-emerald-400/30 bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/20"
                  : "border border-white/10 bg-black/30 text-zinc-200 hover:bg-white/10"
                  }`}
              >
                {completed ? "Completed ✓" : "Mark Complete"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Splits" value={splits.length} />

            <StatCard
              label="Current"
              value={`${currentIndex + 1}/${splits.length}`}
            />

            <StatCard label="Exercises" value={exercises.length} />

            <StatCard label="Status" value={completed ? "Done" : "Open"} />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
                Workout
              </p>

              <h2 className="mt-2 text-2xl font-black">Exercises</h2>
            </div>

            {exercisesLoading && (
              <p className="text-sm text-zinc-500">Refreshing exercises...</p>
            )}
          </div>

          <ExercisesGrid
            exercises={exercises}
            currentSplit={currentSplit}
            onUpdate={refreshExercises}
          />
        </section>
      </div>
    </main>
  );
}

function ExercisesGrid({ exercises, currentSplit, onUpdate }) {
  const [swipeIndex, setSwipeIndex] = useState(0);

  const localExercises = useMemo(() => exercises || [], [exercises]);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (!localExercises.length) return;

      setSwipeIndex((prev) =>
        prev + 1 < localExercises.length ? prev + 1 : 0
      );
    },

    onSwipedRight: () => {
      if (!localExercises.length) return;

      setSwipeIndex((prev) =>
        prev - 1 >= 0 ? prev - 1 : localExercises.length - 1
      );
    },

    trackMouse: true,
  });

  async function handleRename(exercise) {
    const newName = prompt("Rename exercise:", exercise.name)?.trim();

    if (!newName || newName === exercise.name) return;

    const { error } = await supabase
      .from("exercises")
      .update({ name: newName })
      .eq("id", exercise.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (onUpdate) onUpdate();
  }

  async function handleDelete(exerciseId) {
    if (!confirm("Delete this exercise?")) return;

    const { error } = await supabase
      .from("exercises")
      .delete()
      .eq("id", exerciseId);

    if (error) {
      alert(error.message);
      return;
    }

    if (onUpdate) onUpdate();
  }

  if (!localExercises.length) {
    return (
      <div className="rounded-4xl border border-dashed border-white/10 bg-white/3 p-8 text-center">
        <p className="text-lg font-bold">No exercises added yet</p>

        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          Add exercises for this split, then open each exercise to start logging
          weight, reps, sets, and volume.
        </p>

        <Link
          href={`/exercise/new?split=${currentSplit.id}`}
          className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200"
        >
          Add First Exercise →
        </Link>
      </div>
    );
  }

  return (
    <div
      className="sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
      {...handlers}
    >
      {localExercises.map((exercise, index) => (
        <article
          key={exercise.id}
          className={`group relative overflow-hidden rounded-4xl border border-white/10 bg-white/4 p-5 shadow-xl shadow-black/20 transition hover:border-emerald-400/30 hover:bg-white/6 ${index !== swipeIndex ? "hidden sm:block" : ""
            }`}
        >
          {/* Full-card clickable layer */}
          <Link
            href={`/exercise/${exercise.slug}?split=${currentSplit.id}`}
            aria-label={`Open ${exercise.name} log`}
            className="absolute inset-0 z-10 rounded-4xl"
          />

          {/* Card content */}
          <div className="pointer-events-none relative z-20 min-h-28">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Exercise
            </p>

            <h3 className="mt-3 text-2xl font-black tracking-tight transition group-hover:text-emerald-300">
              {exercise.name}
            </h3>

            <p className="mt-2 text-sm text-zinc-500 transition group-hover:text-zinc-300">
              Tap anywhere to open log →
            </p>
          </div>

          {/* Buttons stay clickable above the card link */}
          <div className="relative z-30 mt-5 flex gap-2 border-t border-white/10 pt-4 text-sm">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleRename(exercise);
              }}
              className="rounded-full border border-white/10 px-3 py-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              Rename
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleDelete(exercise.id);
              }}
              className="rounded-full border border-red-500/20 px-3 py-1.5 text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
            >
              Delete
            </button>
          </div>

          {localExercises.length > 1 && (
            <p className="pointer-events-none relative z-20 mt-4 text-center text-xs text-zinc-600 sm:hidden">
              Swipe to switch exercises · {index + 1}/{localExercises.length}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="rounded-3xl border border-white/10 bg-white/4 px-6 py-4 text-sm text-zinc-300">
        Loading dashboard...
      </div>
    </main>
  );
}

function SetupEmptyState({ title, message, link, linkText }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#000_100%)] px-4 text-white">
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-white/4 p-6 text-center shadow-2xl shadow-black/40">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
          Rest Assured
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight">{title}</h1>

        <p className="mt-3 text-sm text-zinc-400">{message}</p>

        <Link
          href={link}
          className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200"
        >
          {linkText}
        </Link>
      </div>
    </main>
  );
}
