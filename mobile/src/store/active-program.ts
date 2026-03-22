// src/store/active-program.ts
import type { Database } from "@/src/types/supabase";

export type Program = Database["public"]["Tables"]["programs"]["Row"];

type Listener = (program: Program | null) => void;

type ActiveProgramStore = {
  value: Program | null;
  listeners: Set<Listener>;
};

declare global {
  var __REST_ASSURED_ACTIVE_PROGRAM_STORE__: ActiveProgramStore | undefined;
}

function getStore(): ActiveProgramStore {
  if (!globalThis.__REST_ASSURED_ACTIVE_PROGRAM_STORE__) {
    globalThis.__REST_ASSURED_ACTIVE_PROGRAM_STORE__ = {
      value: null,
      listeners: new Set<Listener>(),
    };
  }
  return globalThis.__REST_ASSURED_ACTIVE_PROGRAM_STORE__;
}

export function getActiveProgramSnapshot() {
  return getStore().value;
}

export function publishActiveProgram(program: Program | null) {
  const store = getStore();
  store.value = program;
  store.listeners.forEach((listener) => {
    listener(program);
  });
}

export function subscribeActiveProgram(listener: Listener) {
  const store = getStore();
  store.listeners.add(listener);

  return () => {
    store.listeners.delete(listener);
  };
}

export function clearActiveProgram() {
  publishActiveProgram(null);
}
