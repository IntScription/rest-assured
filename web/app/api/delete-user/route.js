import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getAdminClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function deleteStep(query, label) {
  const { error } = await query;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

// Tables with no internal foreign-key dependents (safe to delete any time,
// in any order, before the user's row itself goes away).
const INDEPENDENT_USER_TABLES = [
  "coach_conversations",
  "coach_insights",
  "coach_profiles",
  "recovery_checkins",
  "body_measurement_logs",
  "health_sync_daily",
  "monthly_training_reviews",
  "notifications",
  "user_notice_dismissals",
  "user_achievements",
  "user_challenges",
  "global_program_likes",
];

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = getAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = user.id;

    // None of these tables have a foreign key back to auth.users (verified
    // directly against the schema), so nothing here cascades automatically
    // when the auth user is deleted below — every user-owned table has to
    // be cleared explicitly, in dependency order (children before the
    // parents they reference), or this "delete my account and all data"
    // request silently leaves most of that data behind forever.

    await deleteStep(
      supabaseAdmin.from("exercise_prs").delete().eq("user_id", userId),
      "Failed to delete exercise PRs"
    );

    await deleteStep(
      supabaseAdmin.from("exercise_tut_logs").delete().eq("user_id", userId),
      "Failed to delete time-under-tension logs"
    );

    await deleteStep(
      supabaseAdmin.from("skill_logs").delete().eq("user_id", userId),
      "Failed to delete skill logs"
    );

    await deleteStep(
      supabaseAdmin.from("user_skill_milestones").delete().eq("user_id", userId),
      "Failed to delete skill milestones"
    );

    await deleteStep(
      supabaseAdmin.from("logs").delete().eq("user_id", userId),
      "Failed to delete logs"
    );

    await deleteStep(
      supabaseAdmin.from("workout_sessions").delete().eq("user_id", userId),
      "Failed to delete workout sessions"
    );

    await deleteStep(
      supabaseAdmin.from("user_skills").delete().eq("user_id", userId),
      "Failed to delete skills"
    );

    await deleteStep(
      supabaseAdmin.from("program_imports").delete().eq("imported_by_user_id", userId),
      "Failed to delete program imports"
    );

    await deleteStep(
      supabaseAdmin
        .from("program_shares")
        .delete()
        .or(`shared_by_user_id.eq.${userId},shared_with_user_id.eq.${userId}`),
      "Failed to delete program shares"
    );

    await deleteStep(
      supabaseAdmin.from("program_cycles").delete().eq("user_id", userId),
      "Failed to delete program cycles"
    );

    await deleteStep(
      supabaseAdmin.from("exercises").delete().eq("user_id", userId),
      "Failed to delete exercises"
    );

    const { data: programs, error: programFetchError } = await supabaseAdmin
      .from("programs")
      .select("id")
      .eq("user_id", userId);

    if (programFetchError) {
      throw new Error(`Failed to fetch programs: ${programFetchError.message}`);
    }

    const programIds = programs?.map((program) => program.id) || [];

    if (programIds.length > 0) {
      await deleteStep(
        supabaseAdmin.from("splits").delete().in("program_id", programIds),
        "Failed to delete splits"
      );
    }

    await deleteStep(
      supabaseAdmin.from("programs").delete().eq("user_id", userId),
      "Failed to delete programs"
    );

    for (const table of INDEPENDENT_USER_TABLES) {
      await deleteStep(
        supabaseAdmin.from(table).delete().eq("user_id", userId),
        `Failed to delete ${table}`
      );
    }

    await deleteStep(
      supabaseAdmin.from("profiles").delete().eq("id", userId),
      "Failed to delete profile"
    );

    const { error: deleteAuthError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      return NextResponse.json(
        { error: deleteAuthError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Account deleted successfully." },
      { status: 200 }
    );
  } catch (err) {
    console.error("DELETE USER ERROR:", err);

    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
