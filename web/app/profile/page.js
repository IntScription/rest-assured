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

function getErrorMessage(error, fallback = "Something went wrong.") {
  return error?.message || fallback;
}

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
      className="group flex items-center justify-between rounded-3xl border border-white/10 bg-white/4 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur transition hover:border-emerald-400/40 hover:bg-white/[0.07]"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center gap-3 font-medium active:cursor-grabbing"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-lg text-zinc-400 transition group-hover:text-white">
          ≡
        </span>

        <div>
          <p>{split.name}</p>
          <p className="text-xs text-zinc-500">
            Drag to reorder your weekly split
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => onRename(split)}
          className="rounded-full border border-white/10 px-3 py-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
          title="Rename"
        >
          Rename
        </button>

        <button
          onClick={() => onDelete(split.id)}
          className="rounded-full border border-red-500/20 px-3 py-1.5 text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
          title="Delete"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor));

  const [user, setUser] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingProgram, setSavingProgram] = useState(false);
  const [savingSplit, setSavingSplit] = useState(false);

  const [newProgramName, setNewProgramName] = useState("");
  const [newSplitName, setNewSplitName] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!data?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser({
        id: data.user.id,
        email: data.user.email,
      });

      setLoading(false);
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let ignore = false;

    const fetchPrograms = async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (ignore) return;

      if (error) {
        console.error(error);
        alert(error.message);
        return;
      }

      setPrograms(data || []);
    };

    fetchPrograms();

    return () => {
      ignore = true;
    };
  }, [user]);

  const activeProgram = useMemo(
    () => programs.find((program) => program.is_active) || null,
    [programs]
  );

  useEffect(() => {
    if (!activeProgram) {
      setSplits([]);
      return;
    }

    let ignore = false;

    const fetchSplits = async () => {
      const { data, error } = await supabase
        .from("splits")
        .select("*")
        .eq("program_id", activeProgram.id)
        .order("order_index", { ascending: true });

      if (ignore) return;

      if (error) {
        console.error(error);
        alert(error.message);
        return;
      }

      setSplits(data || []);
    };

    fetchSplits();

    return () => {
      ignore = true;
    };
  }, [activeProgram]);

  const addProgram = async () => {
    const trimmedName = newProgramName.trim();

    if (!trimmedName || !user || savingProgram) return;

    setSavingProgram(true);

    try {
      const { error: deactivateError } = await supabase
        .from("programs")
        .update({ is_active: false })
        .eq("user_id", user.id);

      if (deactivateError) throw deactivateError;

      const { data, error } = await supabase
        .from("programs")
        .insert([
          {
            name: trimmedName,
            user_id: user.id,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setPrograms((prev) =>
        prev.map((program) => ({ ...program, is_active: false })).concat(data)
      );

      setNewProgramName("");
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to add program."));
    } finally {
      setSavingProgram(false);
    }
  };

  const activateProgram = async (id) => {
    if (!user) return;

    try {
      const { error: deactivateError } = await supabase
        .from("programs")
        .update({ is_active: false })
        .eq("user_id", user.id);

      if (deactivateError) throw deactivateError;

      const { error: activateError } = await supabase
        .from("programs")
        .update({ is_active: true })
        .eq("id", id)
        .eq("user_id", user.id);

      if (activateError) throw activateError;

      setPrograms((prev) =>
        prev.map((program) => ({
          ...program,
          is_active: program.id === id,
        }))
      );
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to activate program."));
    }
  };

  const renameProgram = async (program) => {
    const name = prompt("New program name?", program.name)?.trim();
    if (!name || name === program.name) return;

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
      prev.map((item) => (item.id === program.id ? { ...item, name } : item))
    );
  };

  const deleteProgram = async (id) => {
    const confirmed = confirm(
      "Delete this program? Its splits and exercises may also be affected depending on your database rules."
    );

    if (!confirmed) return;

    const { error } = await supabase.from("programs").delete().eq("id", id);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setPrograms((prev) => prev.filter((program) => program.id !== id));
  };

  const addSplit = async () => {
    const trimmedName = newSplitName.trim();

    if (!trimmedName || !activeProgram || savingSplit) return;

    setSavingSplit(true);

    try {
      const { data: existing, error: fetchError } = await supabase
        .from("splits")
        .select("order_index")
        .eq("program_id", activeProgram.id)
        .order("order_index", { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const nextIndex =
        existing && existing.length > 0 ? existing[0].order_index + 1 : 0;

      const { data, error } = await supabase
        .from("splits")
        .insert([
          {
            name: trimmedName,
            program_id: activeProgram.id,
            order_index: nextIndex,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setSplits((prev) => [...prev, data]);
      setNewSplitName("");
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to add split."));
    } finally {
      setSavingSplit(false);
    }
  };

  const renameSplit = async (split) => {
    const name = prompt("New split name?", split.name)?.trim();
    if (!name || name === split.name) return;

    const { error } = await supabase
      .from("splits")
      .update({ name })
      .eq("id", split.id);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setSplits((prev) =>
      prev.map((item) => (item.id === split.id ? { ...item, name } : item))
    );
  };

  const deleteSplit = async (id) => {
    if (!confirm("Delete this split?")) return;

    const { error } = await supabase.from("splits").delete().eq("id", id);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setSplits((prev) => prev.filter((split) => split.id !== id));
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = splits.findIndex((split) => split.id === active.id);
    const newIndex = splits.findIndex((split) => split.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(splits, oldIndex, newIndex);
    setSplits(reordered);

    const results = await Promise.all(
      reordered.map((split, index) =>
        supabase
          .from("splits")
          .update({ order_index: index })
          .eq("id", split.id)
      )
    );

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      console.error(failed.error);
      alert(failed.error.message);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="rounded-3xl border border-white/10 bg-white/4 px-6 py-4 text-sm text-zinc-300">
          Loading profile...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <div className="w-full max-w-md rounded-4xl border border-white/10 bg-white/4 p-6 text-center shadow-2xl shadow-black/40">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
            Rest Assured
          </p>

          <h1 className="mt-3 text-3xl font-black">Login Required</h1>

          <p className="mt-3 text-sm text-zinc-400">
            You need to be logged in to manage programs and splits.
          </p>

          <button
            onClick={() => router.push("/login")}
            className="mt-6 rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200"
          >
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#000_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => router.push("/")}
            className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            ← Home
          </button>

          <button
            onClick={logout}
            className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            Logout
          </button>
        </div>

        <section className="rounded-4xl border border-white/10 bg-linear-to-br from-white/8 to-white/2 p-6 shadow-2xl shadow-black/40">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
            Rest Assured
          </p>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight">
                Training Setup
              </h1>

              <p className="mt-3 max-w-2xl text-sm text-zinc-400">
                Manage your active program, reorder your splits, and keep your
                training structure clean.
              </p>
            </div>

            {user.email && (
              <div className="w-fit rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs text-zinc-400">
                {user.email}
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Programs
              </p>
              <p className="mt-1 text-3xl font-black">{programs.length}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Active
              </p>
              <p className="mt-1 truncate text-xl font-bold">
                {activeProgram?.name || "None"}
              </p>
            </div>

            <div className="col-span-2 rounded-3xl border border-white/10 bg-black/30 p-4 sm:col-span-1">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Splits
              </p>
              <p className="mt-1 text-3xl font-black">{splits.length}</p>
            </div>
          </div>
        </section>

        <section className="rounded-4xl border border-white/10 bg-white/4 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
              Programs
            </p>

            <h2 className="mt-2 text-2xl font-black">Training Programs</h2>

            <p className="mt-1 text-sm text-zinc-400">
              Create blocks like Push Pull Legs, Upper Lower, or Strength Phase.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={newProgramName}
              onChange={(event) => setNewProgramName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addProgram();
              }}
              placeholder="New program name"
              className="min-h-12 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
            />

            <button
              onClick={addProgram}
              disabled={!newProgramName.trim() || savingProgram}
              className="min-h-12 rounded-2xl bg-white px-5 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingProgram ? "Adding..." : "Add Program"}
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {programs.length === 0 && (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
                <p className="font-semibold">No programs yet</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Create your first training program to start organizing your
                  workouts.
                </p>
              </div>
            )}

            {programs.map((program) => (
              <div
                key={program.id}
                className={`flex flex-col gap-4 rounded-3xl border p-4 shadow-xl shadow-black/20 transition sm:flex-row sm:items-center sm:justify-between ${program.is_active
                  ? "border-emerald-400/40 bg-emerald-400/10"
                  : "border-white/10 bg-black/20 hover:border-white/20"
                  }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{program.name}</p>

                    {program.is_active && (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                        Active
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-zinc-500">
                    {program.is_active
                      ? "Exercises will be added to splits inside this program."
                      : "Activate this program to manage its splits."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                  {!program.is_active && (
                    <button
                      onClick={() => activateProgram(program.id)}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    >
                      Activate
                    </button>
                  )}

                  <button
                    onClick={() => renameProgram(program)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  >
                    Rename
                  </button>

                  <button
                    onClick={() => deleteProgram(program.id)}
                    className="rounded-full border border-red-500/20 px-3 py-1.5 text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-4xl border border-white/10 bg-white/4 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
              Splits
            </p>

            <h2 className="mt-2 text-2xl font-black">
              {activeProgram ? activeProgram.name : "No Active Program"}
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              Add and reorder your weekly split structure.
            </p>
          </div>

          {!activeProgram && (
            <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
              <p className="font-semibold">No active program selected</p>
              <p className="mt-1 text-sm text-zinc-500">
                Create or activate a program first, then add splits.
              </p>
            </div>
          )}

          {activeProgram && (
            <>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input
                  value={newSplitName}
                  onChange={(event) => setNewSplitName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addSplit();
                  }}
                  placeholder="New split name, e.g. Push A"
                  className="min-h-12 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                />

                <button
                  onClick={addSplit}
                  disabled={!newSplitName.trim() || savingSplit}
                  className="min-h-12 rounded-2xl bg-white px-5 font-bold text-black transition hover:scale-[1.01] hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingSplit ? "Adding..." : "Add Split"}
                </button>
              </div>

              <div className="mt-5">
                {splits.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
                    <p className="font-semibold">No splits yet</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Add splits like Push, Pull, Legs, Upper, or Lower.
                    </p>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={splits.map((split) => split.id)}
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
                )}
              </div>
            </>
          )}
        </section>

        <section className="rounded-4xl border border-red-500/20 bg-red-500/4 p-5 text-center">
          <p className="text-sm font-semibold text-red-300">Danger Zone</p>

          <p className="mt-1 text-sm text-zinc-500">
            Permanently delete your account and training data.
          </p>

          <button
            onClick={deleteAccount}
            className="mt-4 rounded-full border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
          >
            Permanently Delete Account
          </button>
        </section>
      </div>
    </main>
  );
}
