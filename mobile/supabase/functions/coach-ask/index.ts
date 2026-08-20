import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type CoachAskContext = {
  profile: Record<string, unknown> | null;
  latestMeasurements: Record<string, unknown> | null;
  todayRecovery: Record<string, unknown> | null;
  recentLogs: Array<Record<string, unknown>>;
  recentSkillLogs: Array<Record<string, unknown>>;
  latestInsights: Array<Record<string, unknown>>;
};

type CoachAskPayload = {
  prompt: string;
  context: CoachAskContext;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

// --- Safety / moderation -----------------------------------------------
//
// Two layers, applied to both the user's prompt (before it ever reaches a
// model) and the generated reply (in case a provider is jailbroken past
// the system prompt):
//   1. A local pattern check — zero dependency, always runs, catches
//      blatant cases regardless of which provider is configured.
//   2. OpenAI's moderation endpoint, when OPENAI_API_KEY is available —
//      a real classifier, not just keyword matching. Best-effort: if it
//      fails or isn't configured, layer 1 still applies.
//
// A system prompt telling the model to "be safe" is a behavioral
// instruction, not a guardrail — this exists so there's an actual
// technical check independent of what the model decides to do.

const LOCAL_MODERATION_PATTERNS: { category: string; pattern: RegExp }[] = [
  {
    category: "self-harm",
    pattern: /\b(kill(ing)? myself|suicid\w*|end(ing)? my life|want(ed)? to die|self[\s-]?harm|cutting myself)\b/i,
  },
  {
    category: "violence",
    pattern: /\b(how to (make|build|create) a (bomb|explosive|gun|weapon)|mass shooting|kill (him|her|them|someone))\b/i,
  },
  {
    category: "sexual-content",
    pattern: /\b(porn(ography)?|sexually explicit|nude photos? of|child\s*(sexual|porn))\b/i,
  },
  {
    category: "illegal-drugs",
    pattern: /\b(how to (make|synthesize|cook) (meth|heroin|cocaine|fentanyl)|buy illegal drugs online)\b/i,
  },
];

function checkLocalModeration(text: string): { flagged: boolean; category?: string } {
  for (const { category, pattern } of LOCAL_MODERATION_PATTERNS) {
    if (pattern.test(text)) return { flagged: true, category };
  }
  return { flagged: false };
}

async function checkOpenAiModeration(text: string): Promise<{ flagged: boolean; category?: string } | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.results?.[0];
    if (!result) return null;

    if (result.flagged) {
      const category = Object.entries(result.categories ?? {}).find(([, v]) => v)?.[0];
      return { flagged: true, category: category ?? "flagged" };
    }

    return { flagged: false };
  } catch {
    // Best-effort — local pattern check already ran regardless.
    return null;
  }
}

async function moderateText(text: string): Promise<{ flagged: boolean; category?: string }> {
  const local = checkLocalModeration(text);
  if (local.flagged) return local;

  const remote = await checkOpenAiModeration(text);
  if (remote) return remote;

  return { flagged: false };
}

function safetyResponse(category?: string) {
  if (category === "self-harm") {
    return "I'm not able to help with that, but please know you don't have to go through this alone — reaching out to a mental health professional, a trusted person in your life, or a local crisis line can really help. I'm here whenever you want to talk about training again.";
  }

  return "I can't help with that request. I'm here specifically for training, recovery, and coaching questions — let me know what's going on with your workouts and I'll do my best to help.";
}

// -------------------------------------------------------------------------

function buildSystemPrompt() {
  return [
    "You are Coach inside a fitness app.",
    "Be practical, concise, safe, and conservative.",
    "Do not diagnose injuries or medical conditions.",
    "Do not prescribe dangerous training or extreme dieting.",
    "Prefer modest progression when data is incomplete.",
    "Use only the structured context provided.",
    "Stay strictly within training, recovery, nutrition-adjacent, and coaching topics.",
    "Refuse — briefly and politely, without lecturing — any request involving violence, weapons, self-harm, sexual content, illegal activity, or anything unrelated to fitness coaching, and redirect back to the user's training.",
    "End with one immediate next step.",
  ].join(" ");
}

function buildUserPrompt(payload: CoachAskPayload) {
  return [
    "User question:",
    payload.prompt,
    "",
    "Structured training context:",
    JSON.stringify(payload.context, null, 2),
    "",
    "Respond in short coaching language with:",
    "1) direct answer",
    "2) why",
    "3) immediate next step",
  ].join("\n");
}

async function askOpenAI(payload: CoachAskPayload) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-5.1-mini";

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt(payload),
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const data = await res.json();

  return {
    message: data.output_text ?? "No response generated.",
    model,
    provider: "openai",
  };
}

async function askGroq(payload: CoachAskPayload) {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  const model = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";

  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt(payload),
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq error ${res.status}: ${text}`);
  }

  const data = await res.json();

  return {
    message: data?.choices?.[0]?.message?.content ?? "No response generated.",
    model,
    provider: "groq",
  };
}

async function askOllama(payload: CoachAskPayload) {
  const baseUrl = Deno.env.get("OLLAMA_BASE_URL");
  const model = Deno.env.get("OLLAMA_MODEL") || "gemma3";

  if (!baseUrl) {
    throw new Error("Missing OLLAMA_BASE_URL");
  }

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt(payload),
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = await res.json();

  return {
    message: data?.message?.content ?? "No response generated.",
    model,
    provider: "ollama",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return json(
        { error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEY" },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing or invalid Authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return json({ error: "Missing bearer token" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: "Invalid JWT" }, 401);
    }

    const payload = (await req.json()) as CoachAskPayload;

    if (!payload?.prompt || typeof payload.prompt !== "string") {
      return json({ error: "Invalid prompt" }, 400);
    }

    const inputModeration = await moderateText(payload.prompt);
    if (inputModeration.flagged) {
      return json({
        message: safetyResponse(inputModeration.category),
        model: null,
        provider: "safety-filter",
        user_id: user.id,
      });
    }

    const provider = (Deno.env.get("COACH_PROVIDER") || "openai").toLowerCase();

    let result:
      | { message: string; model: string; provider: string }
      | undefined;

    if (provider === "openai") {
      result = await askOpenAI(payload);
    } else if (provider === "groq") {
      result = await askGroq(payload);
    } else if (provider === "ollama") {
      result = await askOllama(payload);
    } else {
      return json({ error: `Unsupported provider: ${provider}` }, 400);
    }

    const outputModeration = await moderateText(result.message);
    if (outputModeration.flagged) {
      result = { ...result, message: safetyResponse(outputModeration.category) };
    }

    return json({
      ...result,
      user_id: user.id,
    });
  } catch (error) {
    console.error("coach-ask error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return json({ error: message }, 500);
  }
});
