"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

export default function ExerciseLogPage() {
  const { slug } = useParams();
  const router = useRouter();

  const [exercise, setExercise] = useState(null);
  const [logs, setLogs] = useState([]);
  const [newLog, setNewLog] = useState({ weight: "", reps: "", sets: "" });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data?.session?.user ?? null;
      if (!sessionUser) router.replace("/login");
      else setUser(sessionUser);
    };
    getUser();
  }, [router]);

  useEffect(() => {
    if (!slug) return;
    const fetchExercise = async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) console.error(error);
      setExercise(data || null);
      setLoading(false);
    };
    fetchExercise();
  }, [slug]);

  useEffect(() => {
    if (!exercise || !user) return;
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("exercise_id", exercise.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) console.warn(error);
      setLogs(data || []);
    };
    fetchLogs();
  }, [exercise, user]);

  /* ===== HANDLE LOG FORM ===== */
  const handleChange = (e) => setNewLog(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const calculateVolume = () => {
    const w = parseFloat(newLog.weight) || 0;
    const r = parseInt(newLog.reps) || 0;
    const s = parseInt(newLog.sets) || 0;
    return Math.max(1, w) * r * s;
  };

  const handleSave = async () => {
    if (!exercise || !user) return;

    // Treat empty weight as 0 → bodyweight
    const w = parseFloat(newLog.weight) || 0;
    const r = parseInt(newLog.reps) || 0;
    const s = parseInt(newLog.sets) || 0;
    const volume = Math.max(1, w) * r * s;

    const { data, error } = await supabase
      .from("logs")
      .insert([{
        weight: w,           // always a number (0 = bodyweight)
        reps: r,
        sets: s,
        exercise_id: exercise.id,
        user_id: user.id,
        volume
      }])
      .select()
      .maybeSingle();

    if (error) console.error(error);
    else {
      setLogs(prev => [...prev, data]);
      setNewLog({ weight: "", reps: "", sets: "" });
      setEditingId(null);
    }
  };

  const handleEdit = (log) => {
    setEditingId(log.id);
    setNewLog({ weight: log.weight, reps: log.reps, sets: log.sets });
  };

  const handleUpdate = async () => {
    if (!exercise || !editingId) return;

    const w = parseFloat(newLog.weight) || 0;
    const r = parseInt(newLog.reps) || 0;
    const s = parseInt(newLog.sets) || 0;
    const volume = Math.max(1, w) * r * s;

    const { data, error } = await supabase
      .from("logs")
      .update({
        weight: w,
        reps: r,
        sets: s,
        volume
      })
      .eq("id", editingId)
      .select()
      .maybeSingle();

    if (error) console.error(error);
    else {
      setLogs(prev => prev.map(l => l.id === editingId ? data : l));
      setNewLog({ weight: "", reps: "", sets: "" });
      setEditingId(null);
    }
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from("logs").delete().eq("id", id);
    if (error) console.error(error);
    else setLogs(prev => prev.filter(l => l.id !== id));
  };

  /* ===== DASHBOARD METRICS ===== */
  const dashboardMetrics = logs.reduce(
    (acc, log) => {
      acc.totalVolume += log.volume;
      acc.totalReps += log.reps * log.sets;
      acc.totalSets += log.sets;
      acc.prWeight = Math.max(acc.prWeight, log.weight || 0);
      return acc;
    },
    { prWeight: 0, totalVolume: 0, totalReps: 0, totalSets: 0 }
  );

  if (loading) return <main className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</main>;
  if (!exercise) return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <p>Exercise not found.</p>
      <Link href="/" className="ml-4 underline text-zinc-400">Back Home</Link>
    </main>
  );

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10 flex justify-center">
      <div className="max-w-4xl w-full space-y-8">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">{exercise.name}</h1>
          <Link href="/" className="text-zinc-400 hover:text-white text-sm underline">← Back</Link>
        </div>

        {/* DASHBOARD */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center">
            <div className="text-sm text-zinc-400">PR Weight</div>
            <div className="font-bold text-lg">{dashboardMetrics.prWeight || "Bodyweight"}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center">
            <div className="text-sm text-zinc-400">Total Volume</div>
            <div className="font-bold text-lg">{dashboardMetrics.totalVolume}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center">
            <div className="text-sm text-zinc-400">Total Reps</div>
            <div className="font-bold text-lg">{dashboardMetrics.totalReps}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center">
            <div className="text-sm text-zinc-400">Total Sets</div>
            <div className="font-bold text-lg">{dashboardMetrics.totalSets}</div>
          </div>
        </section>

        {/* NEW/EDIT FORM */}
        <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4">{editingId ? "Edit Log" : "New Log"}</h2>
          <div className="flex flex-wrap gap-3">
            <input name="weight" type="number" placeholder="Weight (kg, optional)" value={newLog.weight} onChange={handleChange} className="p-3 rounded-xl bg-zinc-800 border border-zinc-700 flex-1" />
            <input name="reps" type="number" placeholder="Reps" value={newLog.reps} onChange={handleChange} className="p-3 rounded-xl bg-zinc-800 border border-zinc-700 flex-1" />
            <input name="sets" type="number" placeholder="Sets" value={newLog.sets} onChange={handleChange} className="p-3 rounded-xl bg-zinc-800 border border-zinc-700 flex-1" />
            <span className="flex items-center text-zinc-400 font-medium">Volume: {calculateVolume()}</span>
            {editingId
              ? <button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl">Update</button>
              : <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl">Save</button>}
          </div>
        </div>

        {/* LOG LIST */}
        <div className="grid gap-4">
          {logs.length === 0 && <p className="text-zinc-500 text-center">No logs yet.</p>}
          {logs.map(log => (
            <div key={log.id} className="bg-zinc-900 p-4 rounded-3xl border border-zinc-800 flex justify-between items-center">
              <div>
                <p>{(log.weight || "Bodyweight")} kg × {log.reps} reps × {log.sets} sets</p>
                <p className="text-zinc-400 text-sm">Volume: {log.volume}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(log)} className="bg-yellow-500 hover:bg-yellow-600 px-3 py-1 rounded-xl text-black font-semibold">Edit</button>
                <button onClick={() => handleDelete(log.id)} className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded-xl text-white font-semibold">Delete</button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
