import { Router, type IRouter } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router: IRouter = Router();

router.post("/analyze", async (req, res): Promise<void> => {
  const { sessions } = req.body;

  if (!Array.isArray(sessions)) {
    res.status(400).json({ error: "sessions must be an array" });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    return;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  type Session = { date: string; subject: string; duration: number; difficulty: number; focus: number; retention: number; notes: string };

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
    ? `NOTE: All sessions are from the same day. Do NOT evaluate weekly consistency or penalize for low active-day count. Focus entirely on session quality, focus/retention patterns, and subject performance.`
    : `- Active study days: ${uniqueDays}/7 — evaluate consistency across the week.`;

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
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      raw = result.response.text();
      break;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < 3 && (msg.includes("503") || msg.includes("high demand") || msg.includes("overloaded"))) {
        req.log.warn({ attempt }, "Gemini temporarily unavailable, retrying...");
        await new Promise((r) => setTimeout(r, attempt * 1500));
      } else {
        throw err;
      }
    }
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    req.log.error({ raw }, "Failed to extract JSON from Gemini response");
    res.status(500).json({ error: "Failed to parse analysis response" });
    return;
  }

  const analysis = JSON.parse(jsonMatch[0]);
  res.json(analysis);
});

export default router;
