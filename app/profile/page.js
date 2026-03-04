"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

/* ================= SORTABLE SPLIT ITEM ================= */
function SortableItem({ split, onRename, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: split.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 flex justify-between items-center hover:shadow-lg transition-shadow"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing font-medium flex items-center gap-2"
      >
        <span className="text-zinc-400 text-lg">≡</span>
        {split.name}
      </div>

      <div className="flex gap-3 text-sm text-zinc-400">
        <button
          onClick={() => onRename(split)}
          className="hover:underline"
          title="Rename"
        >
          ✏️
        </button>
        <button
          onClick={() => onDelete(split.id)}
          className="hover:text-red-300 text-red-400"
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

/* ================= PROFILE PAGE ================= */
export default function ProfilePage() {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor));

  const [user, setUser] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newProgramName, setNewProgramName] = useState("");
  const [newSplitName, setNewSplitName] = useState("");

  /* ================= LOAD USER ================= */
  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data?.user ?? null);
      setLoading(false);
    };
    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  /* ================= LOAD PROGRAMS ================= */
  useEffect(() => {
    if (!user) return;
    let ignore = false;

    const fetchPrograms = async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at");

      if (ignore) return;

      if (error) console.error(error);
      else setPrograms(data || []);
    };

    fetchPrograms();
    return () => {
      ignore = true;
    };
  }, [user]);

  const activeProgram = useMemo(
    () => programs.find((p) => p.is_active) || null,
    [programs]
  );

  /* ================= LOAD SPLITS ================= */
  useEffect(() => {
    if (!activeProgram) return;
    let ignore = false;

    const fetchSplits = async () => {
      const { data, error } = await supabase
        .from("splits")
        .select("*")
        .eq("program_id", activeProgram.id)
        .order("order_index");

      if (ignore) return;
      if (error) console.error(error);
      else setSplits(data || []);
    };

    fetchSplits();
    return () => {
      ignore = true;
    };
  }, [activeProgram]);

  /* ================= PROGRAM ACTIONS ================= */
  const addProgram = async () => {
    if (!newProgramName.trim() || !user) return;

    await supabase.from("programs").update({ is_active: false }).eq(
      "user_id",
      user.id
    );

    const { data, error } = await supabase
      .from("programs")
      .insert([
        {
          name: newProgramName.trim(),
          user_id: user.id,
          is_active: true,
        },
      ])
      .select();

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setPrograms((prev) =>
      prev.map((p) => ({ ...p, is_active: false })).concat(data[0])
    );
    setNewProgramName("");
  };

  const activateProgram = async (id) => {
    await supabase.from("programs").update({ is_active: false }).eq(
      "user_id",
      user.id
    );
    await supabase.from("programs").update({ is_active: true }).eq("id", id);
    setPrograms((prev) =>
      prev.map((p) => ({ ...p, is_active: p.id === id }))
    );
  };

  const renameProgram = async (program) => {
    const name = prompt("New program name?", program.name);
    if (!name) return;

    const { error } = await supabase
      .from("programs")
      .update({ name })
      .eq("id", program.id);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setPrograms((prev) =>
      prev.map((p) => (p.id === program.id ? { ...p, name } : p))
    );
  };

  const deleteProgram = async (id) => {
    if (!confirm("Delete this program?")) return;
    await supabase.from("programs").delete().eq("id", id);
    setPrograms((prev) => prev.filter((p) => p.id !== id));
  };

  /* ================= SPLIT ACTIONS ================= */
  const addSplit = async () => {
    if (!newSplitName.trim() || !activeProgram) return;

    const { data: existing, error: fetchError } = await supabase
      .from("splits")
      .select("order_index")
      .eq("program_id", activeProgram.id)
      .order("order_index", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error(fetchError);
      alert(fetchError.message);
      return;
    }

    const nextIndex =
      existing && existing.length > 0 ? existing[0].order_index + 1 : 0;

    const { data, error } = await supabase
      .from("splits")
      .insert([
        {
          name: newSplitName.trim(),
          program_id: activeProgram.id,
          order_index: nextIndex,
        },
      ])
      .select();

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setSplits((prev) => [...prev, data[0]]);
    setNewSplitName("");
  };

  const renameSplit = async (split) => {
    const name = prompt("New name?", split.name);
    if (!name) return;
    await supabase.from("splits").update({ name }).eq("id", split.id);
    setSplits((prev) =>
      prev.map((s) => (s.id === split.id ? { ...s, name } : s))
    );
  };

  const deleteSplit = async (id) => {
    if (!confirm("Delete this split?")) return;
    await supabase.from("splits").delete().eq("id", id);
    setSplits((prev) => prev.filter((s) => s.id !== id));
  };

  /* ================= DRAG & DROP ================= */
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = splits.findIndex((s) => s.id === active.id);
    const newIndex = splits.findIndex((s) => s.id === over.id);

    const reordered = arrayMove(splits, oldIndex, newIndex);
    setSplits(reordered);

    await Promise.all(
      reordered.map((split, index) =>
        supabase.from("splits").update({ order_index: index }).eq("id", split.id)
      )
    );
  };

  /* ================= LOGOUT ================= */
  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  /* ================= DELETE ACCOUNT ================= */
  const deleteAccount = async () => {
    const confirmed = confirm(
      "This will permanently delete your account and all workouts, programs, and progress. This cannot be undone.\n\nAre you sure?"
    );

    if (!confirmed) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      alert("Session expired. Please login again.");
      return;
    }

    const response = await fetch("/api/delete-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      alert(data.error || "Failed to delete account.");
      return;
    }

    await supabase.auth.signOut();
    alert("Account deleted successfully.");
    router.push("/");
  };

  if (loading)
    return (
      <div className="p-10 text-white flex justify-center items-center">
        Loading...
      </div>
    );

  return (
    <main className="min-h-screen bg-black text-white px-6 py-8 max-w-3xl mx-auto flex flex-col gap-12">
      <button
        onClick={() => router.push("/")}
        className="px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 w-fit"
      >
        ← Back to Home
      </button>

      <h1 className="text-3xl font-bold text-center">Profile</h1>

      {/* PROGRAMS */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold">Programs</h2>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={newProgramName}
            onChange={(e) => setNewProgramName(e.target.value)}
            placeholder="New program name"
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm"
          />
          <button
            onClick={addProgram}
            className="bg-white text-black px-4 py-2 rounded-lg text-sm hover:scale-105 transition"
          >
            Add
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {programs.map((program) => (
            <div
              key={program.id}
              className={`bg-zinc-900 border ${program.is_active ? "border-green-400" : "border-zinc-800"
                } rounded-xl p-4 flex justify-between items-center hover:shadow-lg transition`}
            >
              <div>
                <div className="font-medium">{program.name}</div>
                {program.is_active && (
                  <div className="text-xs text-green-400 mt-1">Active</div>
                )}
              </div>

              <div className="flex gap-3 text-sm text-zinc-400">
                {!program.is_active && (
                  <button
                    onClick={() => activateProgram(program.id)}
                    className="hover:underline"
                  >
                    Activate
                  </button>
                )}
                <button
                  onClick={() => renameProgram(program)}
                  className="hover:underline"
                >
                  Rename
                </button>
                <button
                  onClick={() => deleteProgram(program.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SPLITS */}
      {activeProgram && (
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Splits – {activeProgram.name}</h2>

          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <input
              value={newSplitName}
              onChange={(e) => setNewSplitName(e.target.value)}
              placeholder="New split name"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm"
            />
            <button
              onClick={addSplit}
              className="bg-white text-black px-4 py-2 rounded-lg text-sm hover:scale-105 transition"
            >
              Add
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={splits.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {splits.map((split) => (
                  <SortableItem
                    key={split.id}
                    split={split}
                    onRename={renameSplit}
                    onDelete={deleteSplit}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      )}

      <div className="pt-12 border-t border-zinc-800 mt-16 text-center flex flex-col gap-4 items-center">

        <button
          onClick={logout}
          className="text-zinc-400 hover:text-white text-sm"
        >
          Logout
        </button>

        <button
          onClick={deleteAccount}
          className="text-red-500 hover:text-red-400 text-sm font-medium"
        >
          Permanently Delete Account
        </button>

      </div>
    </main>
  );
}
