type MonthlyReviewInput = {
  stats: Record<string, unknown>;
};

type MonthlyAiFeedback = {
  headline: string;
  positives: string[];
  warnings: string[];
  nextMonthFocus: string[];
  deloadSuggestion: string | null;
  coachNote: string;
};

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init?.headers ?? {}),
    },
  });
}

function safeParseFeedback(raw: string): MonthlyAiFeedback {
  try {
    const parsed = JSON.parse(raw) as Partial<MonthlyAiFeedback>;

    return {
      headline: String(parsed.headline ?? "Monthly training review"),
      positives: Array.isArray(parsed.positives)
        ? parsed.positives.map(String)
        : [],
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.map(String)
        : [],
      nextMonthFocus: Array.isArray(parsed.nextMonthFocus)
        ? parsed.nextMonthFocus.map(String)
        : [],
      deloadSuggestion:
        parsed.deloadSuggestion == null ? null : String(parsed.deloadSuggestion),
      coachNote: String(parsed.coachNote ?? ""),
    };
  } catch {
    return {
      headline: "Monthly training review",
      positives: [],
      warnings: ["AI feedback could not be parsed."],
      nextMonthFocus: [],
      deloadSuggestion: null,
      coachNote: raw,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = (await req.json()) as MonthlyReviewInput;
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const groqModel = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";

    if (!groqKey) {
      return jsonResponse(
        { error: "GROQ_API_KEY is missing" },
        { status: 500 }
      );
    }

    const shapeDescription = JSON.stringify({
      headline: "string",
      positives: ["string"],
      warnings: ["string"],
      nextMonthFocus: ["string"],
      deloadSuggestion: "string or null",
      coachNote: "string",
    });

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          {
            role: "system",
            content:
              "You are a practical strength training coach. Give concise monthly feedback based only on the provided stats. Do not invent numbers. Avoid medical claims. Mention deload only as a training-load suggestion, not medical advice. " +
              `Respond with ONLY a JSON object matching this exact shape: ${shapeDescription}`,
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Give monthly training review feedback.",
              stats: body.stats ?? {},
            }),
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const result = await groqResponse.json();

    if (!groqResponse.ok) {
      return jsonResponse(
        {
          error: "Groq request failed",
          details: result,
        },
        { status: groqResponse.status }
      );
    }

    const rawText =
      result.choices?.[0]?.message?.content ??
      result.output_text ??
      "{}";

    const feedback = safeParseFeedback(rawText);

    return jsonResponse({ feedback });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});
