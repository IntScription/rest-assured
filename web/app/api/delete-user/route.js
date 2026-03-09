// app/api/delete-user/route.js

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = user.id;

    // 1️⃣ Delete logs first (depends on exercises)
    await supabaseAdmin.from("logs").delete().eq("user_id", userId);

    // 2️⃣ Delete workout sessions
    await supabaseAdmin.from("workout_sessions").delete().eq("user_id", userId);

    // 3️⃣ Delete exercises
    await supabaseAdmin.from("exercises").delete().eq("user_id", userId);

    // 4️⃣ Delete splits (via programs)
    const { data: programs } = await supabaseAdmin
      .from("programs")
      .select("id")
      .eq("user_id", userId);

    if (programs && programs.length > 0) {
      const programIds = programs.map((p) => p.id);

      await supabaseAdmin
        .from("splits")
        .delete()
        .in("program_id", programIds);
    }

    // 5️⃣ Delete programs
    await supabaseAdmin.from("programs").delete().eq("user_id", userId);

    // 6️⃣ Delete profile
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // 7️⃣ Delete auth user
    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
