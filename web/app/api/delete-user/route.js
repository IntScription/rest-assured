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

    await deleteStep(
      supabaseAdmin.from("logs").delete().eq("user_id", userId),
      "Failed to delete logs"
    );

    await deleteStep(
      supabaseAdmin
        .from("workout_sessions")
        .delete()
        .eq("user_id", userId),
      "Failed to delete workout sessions"
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
