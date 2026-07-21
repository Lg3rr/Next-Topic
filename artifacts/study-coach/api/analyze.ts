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

function generateAdvancedInsights(sessions: Session[]) {
  const patterns: any[] = [];
  const recommendations: any[] = [];

  if (!sessions || sessions.length === 0) {
    return { patterns, recommendations, timestamp: Date.now() };
  }

  const subjectStats: Record<string, { focus: number[]; retention: number[]; count: number }> = {};
  sessions.forEach((s) => {
    if (!subjectStats[s.subject]) subjectStats[s.subject] = { focus: [], retention: [], count: 0 };
    subjectStats[s.subject].focus.push(s.focus);
    subjectStats[s.subject].retention.push(s.retention);
    subjectStats[s.subject].count += 1;
  });

  const subjectPerf = Object.entries(subjectStats)
    .map(([s, d]) => ({
      subject: s,
      avgFocus: d.focus.reduce((a, b) => a + b, 0) / d.focus.length,
      avgRetention: d.retention.reduce((a, b) => a + b, 0) / d.retention.length,
      count: d.count,
    }))
    .sort((a, b) => b.avgRetention - a.avgRetention);

  const weak = subjectPerf.filter((p) => p.avgRetention < 3);
  weak.forEach((w) => {
    patterns.push({
      type: "weak_subject",
      label: `${w.subject} needs attention`,
      value: w.avgRetention.toFixed(1),
      confidence: w.count >= 3 ? "High" : "Medium",
      explanation: `${w.subject} shows retention of ${w.avgRetention.toFixed(1)}/5 across ${w.count} session(s).`,
    });
    recommendations.push({
      priority: "HIGH",
      action: `Schedule focused revision for ${w.subject}`,
      rationale: "Retention is low; needs spaced repetition and active recall.",
      baselineData: `${w.count} session(s), avg retention ${w.avgRetention.toFixed(1)}`,
    });
  });

  if (subjectPerf.length > 0 && subjectPerf[0].avgRetention >= 4) {
    const strong = subjectPerf[0];
    patterns.push({
      type: "strong_subject",
      label: `${strong.subject} is solid`,
      value: strong.avgRetention.toFixed(1),
      confidence: "High",
      explanation: `Consistent high retention and focus in ${strong.subject}.`,
    });
  }

  const focusTrend = sessions.slice(-3).map((s) => s.focus).reduce((a, b) => a + b, 0) / Math.min(3, sessions.length);
  const focusPrev = sessions.slice(Math.max(0, sessions.length - 6), Math.max(0, sessions.length - 3));
  if (focusPrev.length > 0) {
    const prevFocus = focusPrev.map((s) => s.focus).reduce((a, b) => a + b, 0) / focusPrev.length;
    if (focusTrend < prevFocus - 1) {
      patterns.push({
        type: "focus_trend",
        label: "Focus is declining",
        value: focusTrend.toFixed(1),
        confidence: focusPrev.length >= 3 ? "High" : "Medium",
        explanation: `Recent sessions show focus dropping from ${prevFocus.toFixed(1)} to ${focusTrend.toFixed(1)}.`,
      });
      recommendations.push({
        priority: "MEDIUM",
        action: "Take longer breaks or reduce session length",
        rationale: "Declining focus suggests fatigue or distraction buildup.",
        baselineData: `Focus: ${focusTrend.toFixed(1)}/5 (recent) vs ${prevFocus.toFixed(1)}/5 (previous)`,
      });
    }
  }

  const studyDays = new Set(sessions.map((s) => s.date.split("T")[0])).size;
  if (studyDays <= 1) {
    patterns.push({
      type: "consistency",
      label: "Study frequency is low",
      value: studyDays,
      confidence: "High",
      explanation: `Only ${studyDays} study day(s) in recent history.`,
    });
    recommendations.push({
      priority: "MEDIUM",
      action: "Build consistent daily study habit",
      rationale: "Regular, shorter sessions beat sporadic long ones.",
      baselineData: `${studyDays} active study day(s)`,
    });
  }

  if (sessions.length > 10) {
    const daysActive = new Set(sessions.map((s) => s.date.split("T")[0])).size;
    const maxDays = Math.ceil(sessions.length / 2);
    if (daysActive < maxDays * 0.6) {
      patterns.push({
        type: "skipped_days",
        label: "Irregular study pattern",
        value: daysActive,
        confidence: "Medium",
        explanation: `Active ${daysActive} days with possible gaps in between.`,
      });
    }
  }

  return { patterns, recommendations, timestamp: Date.now() };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { sessions, allSessions, interviewContext } = req.body;

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
  "performance_level": 1-10,
  "status_reason": "one clear sentence",
  "current_state": "one clear sentence describing current habits",
  "progress_notes": ["string", "string"],
  "patterns": ["string", "string", "string"],
  "callouts": ["string", "string"],
  "key_blocker": "the single biggest thing stopping progress",
  "weak_subjects": ["string"],
  "improvement_points": ["string"],
  "next_action_plan": [
    {
      "subject": "string",
      "task": "string",
      "reason": "string"
    }
  ],
  "one_liner": "direct but respectful summary of current performance"
}

---

DATA:
- Total study time: ${totalMinutes} minutes
- Sessions:
${sessionSummary}${interviewContext ? `

STUDENT SELF-REPORT (from post-session interview — treat this as high-signal context):
${interviewContext}` : ""}`;

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

    let analysis;
    try {
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Gemini returned invalid JSON:", raw);
      return res.status(500).json({ error: "Gemini returned invalid JSON." });
    }

    const insightsData = Array.isArray(allSessions) ? allSessions : sessions;
    const insights = generateAdvancedInsights(insightsData);

    return res.status(200).json({ analysis, insights });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("Analyze route error:", err);
    return res.status(500).json({ error: msg });
  }
}
