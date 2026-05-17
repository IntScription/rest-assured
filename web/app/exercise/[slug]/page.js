"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

export default function ExerciseLogPage() {
  return (
    <Suspense fallback={<PageLoader text="Loading exercise..." />}>
      <ExerciseLogContent />
    </Suspense>
  );
}

function ExerciseLogContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const slugParam = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const splitIdFromUrl = searchParams.get("split");

  const [exercise, setExercise] = useState(null);
  const [logs, setLogs] = useState([]);
  const [newLog, setNewLog] = useState({
    weight: "",
    reps: "",
    sets: "",
  });

  const [editingId, setEditingId] = useState(null);
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let mounted = true;

    async function getUser() {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data?.session?.user ?? null;

      if (!mounted) return;

      if (!sessionUser) {
        router.replace("/login");
        return;
      }

      setUser(sessionUser);
    }

    getUser();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!slugParam || !user) return;

    let ignore = false;

    async function fetchExercise() {
      setLoading(true);
      setErrorMsg("");

      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, slug, user_id, split_id")
        .eq("slug", slugParam)
        .eq("user_id", user.id)
        .maybeSingle();

      if (ignore) return;

      if (error) {
        console.error(error);
        setErrorMsg(error.message);
      }

      setExercise(data || null);
      setLoading(false);
    }

    fetchExercise();

    return () => {
      ignore = true;
    };
  }, [slugParam, user]);

  async function fetchLogs() {
    if (!exercise || !user) return;

    setLogsLoading(true);

    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .eq("exercise_id", exercise.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setLogs([]);
    } else {
      setLogs(data || []);
    }

    setLogsLoading(false);
  }

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise, user]);

  const sortedLogsNewest = useMemo(() => {
    return [...logs].reverse();
  }, [logs]);

  const latestLog = logs[logs.length - 1] || null;

  const dashboardMetrics = useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        const weight = Number(log.weight) || 0;
        const reps = Number(log.reps) || 0;
        const sets = Number(log.sets) || 0;
        const volume = Number(log.volume) || 0;

        acc.totalVolume += volume;
        acc.totalReps += reps * sets;
        acc.totalSets += sets;
        acc.prWeight = Math.max(acc.prWeight, weight);
        acc.bestVolume = Math.max(acc.bestVolume, volume);

        return acc;
      },
      {
        prWeight: 0,
        totalVolume: 0,
        totalReps: 0,
        totalSets: 0,
        bestVolume: 0,
      }
    );
  }, [logs]);

  const recentBars = useMemo(() => {
    const recent = logs.slice(-6);
    const maxVolume = Math.max(...recent.map((log) => Number(log.volume) || 0), 1);

    return recent.map((log) => ({
      ...log,
      height: `${Math.max(10, ((Number(log.volume) || 0) / maxVolume) * 100)}%`,
    }));
  }, [logs]);

  const isFormInvalid =
    !newLog.reps ||
    !newLog.sets ||
    Number(newLog.reps) <= 0 ||
    Number(newLog.sets) <= 0 ||
    Number(newLog.weight) < 0;

  function handleChange(event) {
    setNewLog((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));

    setErrorMsg("");
  }

  function parseLogInput() {
    const weight = parseFloat(newLog.weight) || 0;
    const reps = parseInt(newLog.reps, 10) || 0;
    const sets = parseInt(newLog.sets, 10) || 0;
    const volume = Math.max(1, weight) * reps * sets;

    return { weight, reps, sets, volume };
  }

  function validateLog() {
    const { weight, reps, sets } = parseLogInput();

    if (weight < 0) {
      setErrorMsg("Weight cannot be negative.");
      return false;
    }

    if (reps <= 0 || sets <= 0) {
      setErrorMsg("Reps and sets must be greater than 0.");
      return false;
    }

    return true;
  }

  function resetForm() {
    setNewLog({ weight: "", reps: "", sets: "" });
    setEditingId(null);
    setErrorMsg("");
  }

  async function handleSave() {
    if (!exercise || !user || saving) return;
    if (!validateLog()) return;

    setSaving(true);

    const { weight, reps, sets, volume } = parseLogInput();

    const { data, error } = await supabase
      .from("logs")
      .insert([
        {
          weight,
          reps,
          sets,
          exercise_id: exercise.id,
          user_id: user.id,
          volume,
        },
      ])
      .select()
      .maybeSingle();

    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    if (data) {
      setLogs((prev) => [...prev, data]);
    }

    resetForm();
    setSaving(false);
  }

  function handleEdit(log) {
    setEditingId(log.id);
    setNewLog({
      weight: log.weight ? String(log.weight) : "",
      reps: String(log.reps),
      sets: String(log.sets),
    });
    setErrorMsg("");
  }

  async function handleUpdate() {
    if (!editingId || saving) return;
    if (!validateLog()) return;

    setSaving(true);

    const { weight, reps, sets, volume } = parseLogInput();

    const { data, error } = await supabase
      .from("logs")
      .update({
        weight,
        reps,
        sets,
        volume,
      })
      .eq("id", editingId)
      .select()
      .maybeSingle();

    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    if (data) {
      setLogs((prev) =>
        prev.map((log) => (log.id === editingId ? data : log))
      );
    }

    resetForm();
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this log?")) return;

    const { error } = await supabase.from("logs").delete().eq("id", id);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setLogs((prev) => prev.filter((log) => log.id !== id));

    if (editingId === id) {
      resetForm();
    }
  }

  function formatLoad(weight) {
    const value = Number(weight) || 0;
    return value > 0 ? `${value} kg` : "Bodyweight";
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-IN").format(Number(value) || 0);
  }

  function formatDate(date) {
    if (!date) return "No date";

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  }

  function backHref() {
    if (splitIdFromUrl) return `/?split=${splitIdFromUrl}`;
    if (exercise?.split_id) return `/?split=${exercise.split_id}`;
    return "/";
  }

  if (loading) return <PageLoader text="Loading exercise..." />;

  if (!exercise) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#000_100%)] px-4 text-white">
        <div className="w-full max-w-md rounded-4xl border border-white/10 bg-white/4 p-6 text-center shadow-2xl shadow-black/40">
          <p className="text-sm uppercase tracking-[0.3em] text-red-400">
            Not Found
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight">
            Exercise not found
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            This exercise may not exist, or it may belong to another account.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200"
          >
            Back Home
          </Link>
        </div>
      </main>
    );
  }

  const currentVolume = parseLogInput().volume;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#000_100%)] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={backHref()}
            className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            ← Dashboard
          </Link>

          <Link
            href="/profile"
            className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            Training Setup
          </Link>
        </div>

        <section className="rounded-4xl border border-white/10 bg-linear-to-br from-white/8 to-white/2 p-6 shadow-2xl shadow-black/40 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
                Exercise Log
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                {exercise.name}
              </h1>

              <p className="mt-3 max-w-2xl text-sm text-zinc-400">
                Track your working sets, volume, and progressive overload.
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-300">
                Latest Entry
              </p>

              {latestLog ? (
                <>
                  <p className="mt-2 text-xl font-black">
                    {formatLoad(latestLog.weight)} × {latestLog.reps} ×{" "}
                    {latestLog.sets}
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    Volume: {formatNumber(latestLog.volume)} ·{" "}
                    {formatDate(latestLog.created_at)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">
                  No logs yet. Add your first entry below.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard
              label="PR Weight"
              value={
                dashboardMetrics.prWeight
                  ? `${dashboardMetrics.prWeight} kg`
                  : "Bodyweight"
              }
            />
            <StatCard label="Best Volume" value={formatNumber(dashboardMetrics.bestVolume)} />
            <StatCard label="Total Volume" value={formatNumber(dashboardMetrics.totalVolume)} />
            <StatCard label="Total Reps" value={formatNumber(dashboardMetrics.totalReps)} />
            <StatCard label="Total Sets" value={formatNumber(dashboardMetrics.totalSets)} />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-4xl border border-white/10 bg-white/4 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
                  {editingId ? "Editing" : "New Log"}
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {editingId ? "Update Entry" : "Add Entry"}
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  Leave weight empty for bodyweight movements.
                </p>
              </div>

              {editingId && (
                <button
                  onClick={resetForm}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-zinc-300">
                Weight
                <input
                  name="weight"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  placeholder="kg optional"
                  value={newLog.weight}
                  onChange={handleChange}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-zinc-300">
                  Reps
                  <input
                    name="reps"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    placeholder="8"
                    value={newLog.reps}
                    onChange={handleChange}
                    className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                  />
                </label>

                <label className="block text-sm font-medium text-zinc-300">
                  Sets
                  <input
                    name="sets"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    placeholder="3"
                    value={newLog.sets}
                    onChange={handleChange}
                    className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                  />
                </label>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Calculated Volume
                </p>

                <p className="mt-1 text-3xl font-black">
                  {formatNumber(currentVolume)}
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {errorMsg}
                </div>
              )}

              {editingId ? (
                <button
                  onClick={handleUpdate}
                  disabled={saving || isFormInvalid}
                  className="min-h-12 w-full rounded-2xl bg-white px-5 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Updating..." : "Update Log"}
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving || isFormInvalid}
                  className="min-h-12 w-full rounded-2xl bg-white px-5 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Log"}
                </button>
              )}
            </div>
          </section>

          <section className="rounded-4xl border border-white/10 bg-white/4 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
                  Progress
                </p>

                <h2 className="mt-2 text-2xl font-black">Recent Volume</h2>
              </div>

              {logsLoading && (
                <p className="text-sm text-zinc-500">Refreshing...</p>
              )}
            </div>

            {recentBars.length > 0 ? (
              <div className="mt-6 flex h-52 items-end gap-3 rounded-3xl border border-white/10 bg-black/20 p-4">
                {recentBars.map((log) => (
                  <div
                    key={log.id}
                    className="flex h-full flex-1 flex-col justify-end gap-2"
                  >
                    <div
                      className="rounded-t-2xl bg-emerald-400/70 transition-all"
                      style={{ height: log.height }}
                      title={`Volume: ${formatNumber(log.volume)}`}
                    />
                    <p className="truncate text-center text-xs text-zinc-600">
                      {formatLoad(log.weight)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
                <p className="font-bold">No progress data yet</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Save a few logs to see your recent volume trend.
                </p>
              </div>
            )}
          </section>
        </div>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
                History
              </p>

              <h2 className="mt-2 text-2xl font-black">Log History</h2>
            </div>
          </div>

          {sortedLogsNewest.length === 0 ? (
            <div className="rounded-4xl border border-dashed border-white/10 bg-white/3 p-8 text-center">
              <p className="font-bold">No logs yet</p>
              <p className="mt-1 text-sm text-zinc-500">
                Your entries will appear here after you save your first log.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sortedLogsNewest.map((log, index) => (
                <article
                  key={log.id}
                  className="flex flex-col gap-4 rounded-4xl border border-white/10 bg-white/4 p-4 shadow-xl shadow-black/20 transition hover:border-emerald-400/30 hover:bg-white/6 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm font-black text-zinc-300">
                      #{sortedLogsNewest.length - index}
                    </div>

                    <div>
                      <p className="font-bold">
                        {formatLoad(log.weight)} × {log.reps} reps × {log.sets}{" "}
                        sets
                      </p>

                      <p className="mt-1 text-sm text-zinc-400">
                        Volume: {formatNumber(log.volume)} ·{" "}
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(log)}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDelete(log.id)}
                      className="rounded-full border border-red-500/20 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
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

function PageLoader({ text }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="rounded-3xl border border-white/10 bg-white/4 px-6 py-4 text-sm text-zinc-300">
        {text}
      </div>
    </main>
  );
}
