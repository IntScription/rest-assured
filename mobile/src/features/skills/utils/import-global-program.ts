import { supabase } from "@/src/lib/supabase";

type GlobalProgramLike = {
  id: string;
  program_id: string;
  title: string;
  import_count: number | null;
};

export async function importGlobalProgramToTrain(
  userId: string,
  program: GlobalProgramLike
) {
  const { data: sourceProgram, error: programError } = await supabase
    .from("programs")
    .select("*")
    .eq("id", program.program_id)
    .maybeSingle();

  if (programError) throw programError;
  if (!sourceProgram) throw new Error("Source program not found.");

  const { data: sourceSplits, error: splitsError } = await supabase
    .from("splits")
    .select("*")
    .eq("program_id", program.program_id)
    .order("order_index", { ascending: true });

  if (splitsError) throw splitsError;

  const splitIds = new Set((sourceSplits ?? []).map((split: any) => split.id));

  const { data: sourceExercises, error: exercisesError } = await supabase
    .from("exercises")
    .select("*")
    .eq("user_id", sourceProgram.user_id)
    .order("order_index", { ascending: true });

  if (exercisesError) throw exercisesError;

  const filteredExercises = ((sourceExercises ?? []) as any[]).filter((exercise) =>
    splitIds.has(exercise.split_id)
  );

  const { data: importedProgram, error: createProgramError } = await supabase
    .from("programs")
    .insert({
      user_id: userId,
      name: program.title,
      is_active: false,
    })
    .select("*")
    .single();

  if (createProgramError) throw createProgramError;

  const splitIdMap = new Map<string, string>();

  for (const split of sourceSplits ?? []) {
    const { data: createdSplit, error: createSplitError } = await supabase
      .from("splits")
      .insert({
        user_id: userId,
        program_id: importedProgram.id,
        name: split.name,
        order_index: split.order_index,
      })
      .select("*")
      .single();

    if (createSplitError) throw createSplitError;
    splitIdMap.set(split.id, createdSplit.id);
  }

  for (const exercise of filteredExercises) {
    const mappedSplitId = splitIdMap.get(exercise.split_id);
    if (!mappedSplitId) continue;

    const { error: createExerciseError } = await supabase.from("exercises").insert({
      user_id: userId,
      split_id: mappedSplitId,
      name: exercise.name,
      target_sets: exercise.target_sets,
      target_reps: exercise.target_reps,
      order_index: exercise.order_index,
      notes: exercise.notes,
    });

    if (createExerciseError) throw createExerciseError;
  }

  const nextImportCount = (program.import_count ?? 0) + 1;

  const { error: globalUpdateError } = await supabase
    .from("global_programs")
    .update({ import_count: nextImportCount })
    .eq("id", program.id);

  if (globalUpdateError) throw globalUpdateError;

  // Rename this table if your schema uses a different import tracking table.
  await supabase.from("program_imports").insert({
    global_program_id: program.id,
    imported_by_user_id: userId,
    imported_program_id: importedProgram.id,
  });

  return {
    importedProgramId: importedProgram.id,
    nextImportCount,
  };
}
