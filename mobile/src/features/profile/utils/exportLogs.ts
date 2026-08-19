import { supabase } from "@/src/lib/supabase";

// Dynamic imports (matching the loadExpoImagePicker pattern elsewhere in
// profile.tsx): a top-level `import` of a native module that isn't linked
// into the currently-installed binary throws at module-evaluation time and
// takes the whole app down with it, not just this feature. Deferring the
// import to call-time means a stale binary only breaks the export button.
async function loadFileSystem() {
  try {
    return await import("expo-file-system");
  } catch {
    return null;
  }
}

async function loadSharing() {
  try {
    return await import("expo-sharing");
  } catch {
    return null;
  }
}

function csvEscape(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const CSV_HEADERS = ["Date", "Exercise", "Weight", "Reps", "Sets", "Volume", "RPE", "Type", "Split/Day"];

export async function exportLogsAsCsv(userId: string): Promise<{ rowCount: number }> {
  const [FileSystem, Sharing] = await Promise.all([loadFileSystem(), loadSharing()]);

  if (!FileSystem || !Sharing) {
    throw new Error("Export isn't available in this build yet. Please update the app and try again.");
  }

  const { data, error } = await supabase
    .from("logs")
    .select("log_date, created_at, weight, reps, sets, volume, rpe, type, day, exercises(name)")
    .eq("user_id", userId)
    .order("log_date", { ascending: true });

  if (error) throw error;

  const rows = data ?? [];

  if (rows.length === 0) {
    throw new Error("No logged sets to export yet.");
  }

  const lines = [CSV_HEADERS.join(",")];

  for (const row of rows) {
    const exerciseName = (row.exercises as { name?: string } | null)?.name ?? "Exercise";

    lines.push(
      [
        csvEscape(row.log_date ?? row.created_at?.slice(0, 10) ?? ""),
        csvEscape(exerciseName),
        csvEscape(row.weight),
        csvEscape(row.reps),
        csvEscape(row.sets),
        csvEscape(row.volume),
        csvEscape(row.rpe),
        csvEscape(row.type),
        csvEscape(row.day),
      ].join(",")
    );
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing isn't available on this device.");
  }

  const file = new FileSystem.File(FileSystem.Paths.cache, `rest-assured-export-${Date.now()}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(lines.join("\n"));

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "Export your Rest Assured data",
    UTI: "public.comma-separated-values-text",
  });

  return { rowCount: rows.length };
}
