"use client";

import { Suspense, useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { FaUserCircle } from "react-icons/fa";
import { useSwipeable } from "react-swipeable";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

/* ===========================
   PAGE WRAPPER (Suspense Fix)
=========================== */
export default function HomePage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <HomeContent />
    </Suspense>
  );
}

/* ===========================
   MAIN CONTENT
=========================== */
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const [user, setUser] = useState(null);
  const [activeProgram, setActiveProgram] = useState(null);
  const [splits, setSplits] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [navGlow, setNavGlow] = useState(null);

  /* ===== AUTH ===== */
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace("/login");
      else setUser(data.session.user);
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) router.replace("/login");
        else setUser(session.user);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [router]);

  /* ===== ACTIVE PROGRAM ===== */
  useEffect(() => {
    if (!user) return;

    const checkProgram = async () => {
      const { data } = await supabase
        .from("programs")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!data) {
        if (window.location.hash.includes("type=recovery")) return;
        router.replace("/profile");
        return;
      }

      setActiveProgram(data);
    };

    checkProgram();
  }, [user, router]);

  /* ===== FETCH SPLITS ===== */
  useEffect(() => {
    if (!activeProgram) return;

    const fetchSplits = async () => {
      try {
        const { data, error } = await supabase
          .from("splits")
          .select("id, name, focus, order_index")
          .eq("program_id", activeProgram.id)
          .order("order_index", { ascending: true });

        if (error) throw error;

        setSplits(data || []);

        // set current index based on URL
        const splitFromUrl = searchParams.get("split");
        let index = 0;
        if (splitFromUrl) {
          index = data.findIndex((s) => s.id.toString() === splitFromUrl);
        }
        setCurrentIndex(index >= 0 ? index : 0);
      } catch (err) {
        console.error(err);
        setSplits([]);
      } finally {
        setLoading(false); // ✅ only after splits fetched
      }
    };

    fetchSplits();
  }, [activeProgram, searchParams]);

  const currentSplit = splits[currentIndex] || null;

  /* ===== FETCH EXERCISES ===== */
  useEffect(() => {
    if (!currentSplit) return;

    const fetchExercises = async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, slug")
        .eq("split_id", currentSplit.id)
        .order("id", { ascending: true });

      if (error) console.error(error);
      setExercises(data || []);
    };

    fetchExercises();
  }, [currentSplit]);

  /* ===== COMPLETION ===== */
  useEffect(() => {
    if (!user || !currentSplit) return;

    const fetchCompletion = async () => {
      const { data } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("split_id", currentSplit.id)
        .eq("workout_date", todayKey);

      setCompleted(data?.length > 0);
    };

    fetchCompletion();
  }, [user, currentSplit, todayKey]);

  const toggleComplete = async () => {
    if (!user || !currentSplit) return;

    if (completed) {
      await supabase
        .from("workout_sessions")
        .delete()
        .eq("user_id", user.id)
        .eq("split_id", currentSplit.id)
        .eq("workout_date", todayKey);
      setCompleted(false);
    } else {
      await supabase.from("workout_sessions").insert({
        user_id: user.id,
        split_id: currentSplit.id,
        workout_date: todayKey,
      });
      setCompleted(true);
    }
  };

  const handleNext = () => {
    if (!splits.length) return;
    setNavGlow("next");
    setTimeout(() => setNavGlow(null), 250);
    const next = currentIndex + 1 < splits.length ? currentIndex + 1 : 0;
    setCurrentIndex(next);
    router.replace(`/?split=${splits[next].id}`);
  };

  const handlePrev = () => {
    if (!splits.length) return;
    setNavGlow("prev");
    setTimeout(() => setNavGlow(null), 250);
    const prev = currentIndex - 1 >= 0 ? currentIndex - 1 : splits.length - 1;
    setCurrentIndex(prev);
    router.replace(`/?split=${splits[prev].id}`);
  };

  /* ===== RENDER ===== */
  if (loading) return <FullScreenLoader />;

  if (!loading && !splits.length)
    return (
      <EmptyState
        message="No splits added yet."
        link="/profile"
        linkText="Build Split"
        programName={activeProgram?.name}
      />
    );

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10 flex justify-center">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-10 gap-4">
          <h1 className="text-4xl font-bold">Today</h1>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrev}
              disabled={splits.length <= 1}
              className={`
                px-4 py-2 bg-zinc-800 rounded-xl transition-all duration-200
                hover:bg-zinc-700 hover:scale-105 active:scale-95 active:bg-zinc-600
                disabled:opacity-40 disabled:cursor-not-allowed
                ${navGlow === "prev" ? "ring-2 ring-white shadow-lg shadow-white/30" : ""}
              `}
            >
              <FiChevronLeft size={20} />
            </button>

            <button
              onClick={handleNext}
              disabled={splits.length <= 1}
              className={`
                px-4 py-2 bg-zinc-800 rounded-xl transition-all duration-200
                hover:bg-zinc-700 hover:scale-105 active:scale-95 active:bg-zinc-600
                disabled:opacity-40 disabled:cursor-not-allowed
                ${navGlow === "next" ? "ring-2 ring-white shadow-lg shadow-white/30" : ""}
              `}
            >
              <FiChevronRight size={20} />
            </button>

            <Link href="/profile">
              <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center text-xl">
                <FaUserCircle />
              </div>
            </Link>
          </div>
        </div>

        {/* Split Info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 mb-10">
          <h2 className="text-3xl font-semibold">{currentSplit.name}</h2>
          {currentSplit.focus && <p className="text-zinc-400 mt-2">Focus: {currentSplit.focus}</p>}

          <div className="flex flex-wrap gap-4 mt-6">
            <Link
              href="/exercise/new"
              className="px-6 py-3 bg-white text-black rounded-xl font-semibold"
            >
              Add Exercise
            </Link>

            <button
              onClick={toggleComplete}
              className={`px-6 py-3 rounded-xl font-semibold ${completed ? "bg-green-600" : "bg-zinc-700"}`}
            >
              {completed ? "Undo Complete" : "Mark Complete"}
            </button>
          </div>
        </div>

        {/* Exercises */}
        <ExercisesGrid exercises={exercises} currentSplit={currentSplit} />
      </div>
    </main>
  );
}

/* ===== SWIPEABLE GRID WITH RENAME & DELETE ===== */
function ExercisesGrid({ exercises, currentSplit, onUpdate }) {
  const [swipeIndex, setSwipeIndex] = useState(0);

  // Initialize localExercises lazily and update only if exercises change (without useEffect)
  const localExercises = React.useMemo(() => exercises || [], [exercises]);

  const handlers = useSwipeable({
    onSwipedLeft: () =>
      setSwipeIndex((prev) =>
        prev + 1 < localExercises.length ? prev + 1 : 0
      ),
    onSwipedRight: () =>
      setSwipeIndex((prev) =>
        prev - 1 >= 0 ? prev - 1 : localExercises.length - 1
      ),
    trackMouse: true,
  });

  const handleRename = async (exercise) => {
    const newName = prompt("Rename exercise:", exercise.name);
    if (!newName || newName.trim() === exercise.name) return;

    const { error } = await supabase
      .from("exercises")
      .update({ name: newName.trim() })
      .eq("id", exercise.id);

    if (!error && onUpdate) onUpdate();
  };

  const handleDelete = async (exerciseId) => {
    if (!confirm("Are you sure you want to delete this exercise?")) return;

    const { error } = await supabase
      .from("exercises")
      .delete()
      .eq("id", exerciseId);

    if (!error && onUpdate) onUpdate();
  };

  if (!localExercises.length)
    return <p className="text-zinc-500">No exercises added for this split.</p>;

  return (
    <div className="sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6" {...handlers}>
      {localExercises.map((exercise, index) => (
        <div
          key={exercise.id}
          className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 relative ${index !== swipeIndex && "hidden sm:block"
            }`}
        >
          <Link href={`/exercise/${exercise.slug}?split=${currentSplit.id}`}>
            <p className="text-lg font-medium mb-4">{exercise.name}</p>
          </Link>

          <div className="flex gap-3 text-sm">
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleRename(exercise);
              }}
              className="px-3 py-1 bg-zinc-800 rounded-lg hover:bg-zinc-700"
            >
              Rename
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDelete(exercise.id);
              }}
              className="px-3 py-1 bg-red-600 rounded-lg hover:bg-red-500"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===== HELPERS ===== */
function FullScreenLoader() {
  return <main className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</main>;
}

function EmptyState({ message, link, linkText, programName }) {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center space-y-4">
        {programName && <h1 className="text-3xl font-bold">{programName}</h1>}
        <h1 className="text-3xl font-bold">{message}</h1>
        <Link href={link} className="px-6 py-3 bg-white text-black rounded-xl font-semibold">{linkText}</Link>
      </div>
    </main>
  );
}
