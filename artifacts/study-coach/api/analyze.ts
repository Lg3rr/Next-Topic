import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

function getApiKeys(): string[] {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter((k): k is string => typeof k === "string" && k.trim().length > 0);
}

function isOverloaded(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("503") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("Service Unavailable")
  );
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("rate limit") ||
    msg.includes("out of tokens") ||
    msg.includes("billing")
  );
}

type Session = {
  date: string;
  subject: string;
  duration: number;
  difficulty: number;
  focus: number;
  retention: number;
  notes: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessions, interviewContext } = req.body;

  if (!Array.isArray(sessions)) {
    return res.status(400).json({ error: "sessions must be an array" });
  }

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    return res.status(500).json({ error: "No Gemini API key configured" });
  }

  const uniqueDays = new Set((sessions as Session[]).map((s) => s.date)).size;
  const totalMinutes = (sessions as Session[]).reduce((sum, s) => sum + s.duration, 0);

  const sessionSummary = (sessions as Session[])
    .map(
      (s) =>
        `- ${s.date}: ${s.subject}, ${s.duration}min, difficulty=${s.difficulty}/5, focus=${s.focus}/5, retention=${s.retention}/5${s.notes ? `, notes: "${s.notes}"` : ""}`
    )
    .join("\n");

  const isSingleDay = uniqueDays === 1;

  const consistencySection = isSingleDay
    ? `SINGLE-DAY MODE — STRICT RULES:
- All sessions are from the same day. This is a single-day performance snapshot, not a weekly review.
- Do NOT evaluate consistency, active days, or study frequency.
- Do NOT assign status based on weekly behavior or session count.
- Do NOT mention or imply that studying only one day is a problem.
- Focus ONLY on: session quality, focus scores, retention scores, difficulty vs. performance, and subject-wise patterns.
- Status (LOCKED_IN / INCONSISTENT / STRUGGLING / COASTING) must reflect the quality of today's sessions — not how often the student studies.`
    : `MULTI-DAY MODE:
- Active study days: ${uniqueDays}/7 — evaluate consistency across the week.
- Status should reflect both session quality and study frequency.`;

  const prompt = `You are a sharp, no-nonsense study coach. You give honest, concise feedback that cuts straight to what matters.

---

TONE & STYLE RULES:
- Be concise and sharp. Every sentence must earn its place.
- No corporate or academic phrasing. No words like "it is evident that", "significant", "it is crucial to note", "comprehensive", "optimize", "leverage".
- Write like a smart coach talking to a student — plain, direct, human.
- Do NOT list 5 observations when 2 strong ones will do. Quality over quantity.
- Do NOT repeat the same idea in different words across patterns, callouts, or improvement points. If two issues are related, combine them into one clear statement.
- Identify the single most critical issue and make sure it stands out clearly.
- If the student's notes mention a specific mistake or behavior (e.g. "kept losing focus", "just went through formulas", "couldn't solve without help"), call it out explicitly by name in simple language.
- Never insult. Focus on behavior, not character.
- Use numbers when they make a point stronger (e.g. "focus was 1/5 in 2 out of 3 Physics sessions").
- The "status_reason" field must be a single core diagnosis sentence — one sentence that names the root cause behind all the patterns, not just a surface observation. Example: "You're putting in time but studying passively, which means hours spent aren't translating into retention."

---

INTERPRETATION RULE:
Don't label behavior harshly. Instead describe it plainly:
- Low focus + low retention = "went through the material without really engaging"
- Passive study = "reading without testing yourself"
- Inefficient time = "spent X minutes but retained very little"

CONFIDENCE & CONSISTENCY RULES:
- Be confident in your analysis even if the data has minor inconsistencies. Don't hedge or second-guess — give a clear verdict.
- Focus on behavioral patterns across sessions, not just subject labels.
- If a session's notes clearly don't match the subject (e.g. chemistry notes logged under Math), mention it briefly in one sentence — don't dwell on it. Example: "One Math session looks like it might have been a Chemistry revision — minor logging inconsistency, doesn't change the overall picture."

---

${consistencySection}

---

OUTPUT FORMAT (strict JSON only, no markdown, no code fences):

{
  "status": "LOCKED_IN | INCONSISTENT | STRUGGLING | COASTING",
  "level": 1-10,
  "status_reason": "one clear sentence",
  "patterns": ["string", "string", "string"],
  "callouts": ["string", "string"],
  "weak_subjects": ["string"],
  "improvement_points": ["string"],
  "tomorrow_plan": [
    {
      "subject": "string",
      "duration_minutes": number,
      "priority": "HIGH | MEDIUM | LOW",
      "focus_tip": "how to study this properly in one sentence"
    }
  ],
  "one_liner": "direct but respectful summary of current performance"
}

---

${interviewContext ? `
USER INTERVIEW CONTEXT:
${interviewContext}
` : ""}

DATA:
- Total study time: ${totalMinutes} minutes
- Sessions:
${sessionSummary}`;

  let raw = "";

  outer: for (const [keyIndex, apiKey] of apiKeys.entries()) {
    const genAI = new GoogleGenerativeAI(apiKey);

    for (const modelName of FALLBACK_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.info({ keyIndex: keyIndex + 1, model: modelName, attempt }, "Calling Gemini");
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          raw = result.response.text();
          break outer;
        } catch (err: unknown) {
          if (isQuotaError(err)) {
            console.warn({ keyIndex: keyIndex + 1, model: modelName }, "Quota exhausted, trying next key");
            break;
          } else if (isOverloaded(err)) {
            console.warn({ keyIndex: keyIndex + 1, model: modelName, attempt }, "Overloaded, retrying");
            if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
          } else {
            throw err;
          }
        }
      }
    }
  }

  if (!raw) {
    return res.status(503).json({
      error: "All API keys are currently exhausted or unavailable. Please try again later or add more API keys.",
    });
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("Failed to extract JSON from Gemini response:", raw);
    return res.status(500).json({ error: "Failed to parse analysis response. Please try again." });
  }

  try {
    const analysis = JSON.parse(jsonMatch[0]);
    return res.status(200).json({
  received: req.body,
});
  } catch {
    return res.status(500).json({ error: "Failed to parse analysis response. Please try again." });
  }
}
