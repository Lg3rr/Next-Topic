import { Router, type IRouter } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router: IRouter = Router();

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

function getApiKeys(): string[] {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter((k): k is string => typeof k === "string" && k.trim().length > 0);
  return keys;
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

router.post("/analyze", async (req, res): Promise<void> => {
  try {
    const { sessions } = req.body;

    if (!Array.isArray(sessions)) {
      res.status(400).json({ error: "sessions must be an array" });
      return;
    }

    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
      res.status(500).json({ error: "No Gemini API key configured" });
      return;
    }

    type Session = {
      date: string; subject: string; duration: number;
      difficulty: number; focus: number; retention: number; notes: string;
    };

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

    const prompt = `You are a strict but respectful AI study performance analyst.

Your job is to analyze a student's study sessions and return a structured JSON report with honest feedback and an actionable plan.

---

RULES:
- Be direct and honest, but NEVER insult the student.
- Do NOT use words like: pathetic, disaster, garbage, useless, failure, fake studying.
- Focus on behavior and patterns, not character.
- Always use measurable language (focus/5, retention/5, duration, etc.).
- If criticizing, always include what to improve in the same point.
- No emotional shaming. No exaggeration.

---

INTERPRETATION RULE:
Instead of labeling "fake studying", detect and describe:
- "low focus + low retention pattern"
- "passive study behavior"
- "inefficient time-to-learning ratio"

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
            req.log.info({ keyIndex: keyIndex + 1, model: modelName, attempt }, "Calling Gemini");
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            raw = result.response.text();
            break outer;
          } catch (err: unknown) {
            if (isQuotaError(err)) {
              req.log.warn({ keyIndex: keyIndex + 1, model: modelName }, "Quota exhausted, trying next key");
              break; // skip remaining models for this key, try next key
            } else if (isOverloaded(err)) {
              req.log.warn({ keyIndex: keyIndex + 1, model: modelName, attempt }, "Overloaded, retrying or falling back");
              if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
            } else {
              throw err;
            }
          }
        }
      }
    }

    if (!raw) {
      res.status(503).json({
        error: `All API keys are currently exhausted or unavailable. Please try again later or add more API keys.`,
      });
      return;
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error({ raw }, "Failed to extract JSON from Gemini response");
      res.status(500).json({ error: "Failed to parse analysis response. Please try again." });
      return;
    }

    const analysis = JSON.parse(jsonMatch[0]);
    res.json(analysis);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    req.log.error({ err }, "Analyze route error");
    res.status(500).json({ error: msg });
  }
});

export default router;
