import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Current stable Flash models, ordered from strongest to fallback.
const FALLBACK_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
];

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

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { sessions, allSessions, interviewContext } = req.body;

    if (!Array.isArray(sessions)) {
      return res.status(400).json({ error: "sessions must be an array" });
    }

    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
      return res.status(500).json({ error: "No Gemini API key configured" });
    }

    const uniqueDays = new Set((sessions as Session[]).map((s) => s.date.split("T")[0])).size;
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
- Do NOT mention or imply that studying only one day is a problem.
- Focus ONLY on session quality, focus, retention, difficulty vs. performance, and subject-wise patterns.
- Status must reflect the quality of today's sessions — not how often the student studies.`
      : `MULTI-DAY MODE:
- Active study days: ${uniqueDays} — evaluate consistency across the supplied history.
- Status should reflect both session quality and study frequency.`;

    const prompt = `You are the intelligence behind Next Topic, a serious study-analysis and study-planning system.

Your job is NOT to produce generic AI advice. Your job is to inspect the student's actual logged study sessions, identify what matters, and construct the student's next concrete workload from the evidence.

TONE & STYLE:
- Direct, sharp, human, and useful.
- No corporate filler, motivational fluff, or empty praise.
- Use numbers when they strengthen a conclusion.
- Never insult the student; judge behavior and study outcomes, not character.
- Do not repeat the same insight in different words.

EVIDENCE RULES:
- Treat the logged sessions as the source of truth.
- Use subject, date, duration, difficulty, focus, retention, notes, recency, repetition, and patterns when available.
- Repeated patterns matter more than isolated anomalies.
- Recent evidence generally deserves more weight than old evidence.
- Low retention should increase priority for retrieval practice, active recall, revision, and re-testing.
- High difficulty should increase priority for concept rebuilding, worked examples, and targeted problem solving.
- Low focus may justify shorter, more structured work, but do NOT automatically claim the student lacks knowledge.
- Strong performance should not be ignored; assign maintenance, spaced revision, or sensible progression where justified.
- Never invent topics, weaknesses, scores, trends, causes, or study history.
- Never assume a syllabus topic was studied merely because it exists.
- If evidence is insufficient for a strong conclusion, say so instead of making something up.

${consistencySection}

STATUS RULES:
- LOCKED_IN: strong recent study quality, with good focus/retention and useful effort.
- COASTING: study is happening, but effort, difficulty, retention, or depth suggests the student is under-pushing.
- INCONSISTENT: quality or frequency varies enough to be a clear pattern.
- STRUGGLING: meaningful evidence of weak retention, low focus, repeated difficulty, or poor outcomes.
Choose the status that best fits the evidence. Do not use status as a personality judgment.

NEXT ACTION PLAN — ABSOLUTE REQUIREMENTS:
- Generate EXACTLY 10 distinct study tasks.
- If usable study data exists, the array MUST contain exactly 10 objects. Do not return 1, 2, 3, 5, or any other number.
- These are actual pieces of academic work the student can sit down and perform. They are NOT generic advice, motivation, habits, or observations.
- Every task must specify WHAT to study/practice and HOW to do it.
- Every task must include a short reason grounded in the student's logged data.
- The 10 tasks must form a coherent workload, not ten random recommendations.
- Prioritize tasks in this order: repeated critical weaknesses, poor retention, high-difficulty material, recent mistakes/unresolved problems, spaced revision, maintenance of strong areas, then reasonable forward progression.
- Do not make ten versions of the same task. Vary the type of academic work when the evidence supports it: concept rebuilding, active recall, problem solving, error correction, spaced revision, mixed practice, self-testing, or progression.
- Do not force a category when the data does not justify it.
- Strong subjects may receive maintenance or progression tasks; they should not consume most of the workload when clear weaknesses exist.
- If a topic is repeatedly studied with poor retention, prioritize reinforcement and testing before assigning more new material.
- If difficulty is high but retention is good, do not automatically label the topic weak; consider targeted problem practice instead.
- If focus is low but retention is good, do not invent a knowledge problem; consider shorter or more structured work.
- If data is sparse, create different useful forms of work around the evidence you actually have rather than inventing unsupported weaknesses.

TASK QUALITY BAR:
BAD: "Revise Physics."
GOOD: "Physics — Rebuild the equations of motion from the basic kinematic relations without notes, then solve 10 mixed questions and mark every step where you needed help."

BAD: "Practice Chemistry."
GOOD: "Chemistry — Solve 15 Mole Concept problems focused on limiting reagent and concentration calculations, then redo every incorrect question without looking at the solution."

BAD: "Improve Biology retention."
GOOD: "Biology — Do a closed-book active-recall test on the classifications and defining characteristics from the recent Biology sessions; review only the items you failed to recall."

REASON QUALITY:
- The reason must explain the actual evidence behind the assignment.
- BAD: "Because this topic is important."
- GOOD: "Recent Physics retention stayed low despite adequate focus, so retrieval practice is more appropriate than another passive reread."
- Do not cite data that is not present.

FINAL SELF-CHECK BEFORE RETURNING JSON:
1. next_action_plan contains EXACTLY 10 objects.
2. Every object has subject, task, and reason.
3. Every task is concrete academic work.
4. Every task explains what and how.
5. Every reason is grounded in the supplied data.
6. No duplicate tasks.
7. No fabricated facts.
8. No generic filler.
9. The first tasks address the highest-value needs.
10. The complete ten-task plan makes sense as the student's next workload.

OUTPUT FORMAT:
Return STRICT JSON ONLY. No markdown. No code fences. No text before or after the JSON.

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
      "task": "specific academic work with a clear method",
      "reason": "evidence-based reason for assigning it"
    }
  ],
  "one_liner": "direct but respectful summary of current performance"
}

DATA:
- Total study time: ${totalMinutes} minutes
- Sessions:
${sessionSummary}${interviewContext ? `

STUDENT SELF-REPORT (high-signal context from post-session interview):
${interviewContext}` : ""}`;

    let raw = "";

    outer: for (const [keyIndex, apiKey] of apiKeys.entries()) {
      const genAI = new GoogleGenerativeAI(apiKey);

      for (const modelName of FALLBACK_MODELS) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.info({ keyIndex: keyIndex + 1, model: modelName, attempt }, "Calling Gemini");
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                responseMimeType: "application/json",
              },
            });
            const result = await model.generateContent(prompt);
            raw = result.response.text();
            break outer;
          } catch (err: unknown) {
            if (isQuotaError(err)) {
              console.warn({ keyIndex: keyIndex + 1, model: modelName }, "Quota exhausted, trying next key");
              break;
            }

            if (isOverloaded(err)) {
              console.warn({ keyIndex: keyIndex + 1, model: modelName, attempt }, "Overloaded, retrying");
              if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
              else break;
              continue;
            }

            // Model unavailable / retired / unsupported: move to the next model.
            const msg = err instanceof Error ? err.message : String(err);
            if (
              msg.includes("404") ||
              msg.includes("NOT_FOUND") ||
              msg.includes("not found") ||
              msg.includes("not supported") ||
              msg.includes("Unsupported")
            ) {
              console.warn({ keyIndex: keyIndex + 1, model: modelName }, "Model unavailable, trying next model");
              break;
            }

            throw err;
          }
        }
      }
    }

    if (!raw) {
      return res.status(503).json({
        error: "All Gemini models/API keys are currently unavailable. Please try again later or add another API key.",
      });
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to extract JSON from Gemini response:", raw);
      return res.status(500).json({ error: "Failed to parse analysis response. Please try again." });
    }

    let analysis: any;
    try {
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Gemini returned invalid JSON:", raw);
      return res.status(500).json({ error: "Gemini returned invalid JSON." });
    }

    // Enforce the core product contract server-side. If the model ignores the
    // prompt and returns fewer than 10 tasks, reject the result instead of
    // silently showing an incomplete plan.
    if (!Array.isArray(analysis.next_action_plan) || analysis.next_action_plan.length !== 10) {
      console.error("Gemini returned an invalid next_action_plan length:", analysis.next_action_plan?.length);
      return res.status(500).json({
        error: "Gemini returned an incomplete study plan. Please try the analysis again.",
      });
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
