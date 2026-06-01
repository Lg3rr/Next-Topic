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

  const sessionSummary = sessions
    .map(
      (s: { date: string; subject: string; duration: number; difficulty: number; focus: number; retention: number; notes: string }) =>
        `- ${s.date}: ${s.subject}, ${s.duration}min, difficulty=${s.difficulty}/5, focus=${s.focus}/5, retention=${s.retention}/5${s.notes ? `, notes: "${s.notes}"` : ""}`
    )
    .join("\n");

  const prompt = `You are a brutally honest, data-driven study coach AI. Analyze these study sessions and return a JSON object.

Study sessions:
${sessionSummary}

Return ONLY a valid JSON object (no markdown, no code fences) with exactly these fields:
{
  "status": one of "LOCKED_IN" | "INCONSISTENT" | "STRUGGLING" | "COASTING",
  "status_reason": short one-line explanation of the status,
  "level": integer 1-10 overall performance score,
  "one_liner": a short punchy honest sentence about their study habits (be direct, no sugarcoating),
  "fake_study_warning": true if sessions look like fake/distracted studying (high duration but low focus/retention),
  "fake_study_reason": explanation if fake_study_warning is true, empty string otherwise,
  "callouts": array of 2-4 specific honest critiques or observations,
  "weak_subjects": array of subject names where performance is consistently poor,
  "tomorrow_plan": array of 1-3 objects with { subject, duration_minutes, priority ("HIGH"|"MEDIUM"|"LOW"), focus_tip }
}

Be specific and data-driven. Reference actual numbers from the sessions. Do not be generic.`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();

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
