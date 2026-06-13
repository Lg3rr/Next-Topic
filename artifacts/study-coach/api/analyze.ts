import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FALLBACK_MODELS = [
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
];

const keyCooldowns = new Map<string, number>();

function isKeyCoolingDown(key: string): boolean {
  const until = keyCooldowns.get(key);
  if (!until) return false;
  if (Date.now() > until) {
    keyCooldowns.delete(key);
    return false;
  }
  return true;
}

function coolDownKey(key: string, ms = 60_000) {
  keyCooldowns.set(key, Date.now() + ms);
}


function getApiKeys(): string[] {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter((k): k is string => typeof k === "string" && k.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Session = {
  date: string;
  subject: string;
  duration: number;
  difficulty: number;
  focus: number;
  retention: number;
  notes: string;
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(
  sessions: Session[],
  uniqueDays: number,
  totalMinutes: number,
  sessionSummary: string
): string {
  const isSingleDay = uniqueDays === 1;

  const modeSection = isSingleDay
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

  return `${modeSection}

You are a calm, precise study performance coach. You analyze session data honestly, track what's changing over time, and give the student one clear direction forward.

You are NOT a motivational speaker. You are NOT a strict examiner.
Every output must make the student feel: "I understand my situation and I know exactly what to do next."

---

SIGNAL PRIORITY (read in this order):
1. Student notes — highest authority. "Fixed", "improved", "stopped doing" = treat as resolved unless new data contradicts it.
2. Recent session behavior (patterns, not single outliers)
3. Retention score (learning outcome)
4. Focus score (attention quality)
5. Duration (effort signal — only cite when it reveals something retention/focus don't)
6. Difficulty (context only)

---

OUTPUT COMPRESSION RULE:
If two outputs describe the same underlying issue, merge them.
Never repeat the same behavioral signal across patterns, callouts, and progress_notes.
Each distinct insight should appear only once in the entire response.

---

ANTI-HALLUCINATION RULE:
- Do NOT repeat past issues already marked resolved in notes
- Do NOT assume a problem persists without current session evidence
- Do NOT invent trends not supported by the data
- If notes say "fixed focus issue" → focus is resolved unless new sessions show decline

---

FIELD UTILIZATION:
Focus and retention scores are always relevant. Duration and difficulty should only be cited when they add signal that focus/retention alone don't capture.

Extract signal from each session:
- focus_score: is it consistently low, high, or volatile across sessions?
- retention_score: compare to focus — high focus + low retention = method problem, not effort problem
- duration: flag long sessions with low retention only when it changes the diagnosis
- difficulty: low retention on easy material is more alarming than low retention on hard material
- notes: primary behavioral evidence. Quote or paraphrase specific behaviors directly. If notes contradict scores, flag the conflict in one sentence.
- subject: group patterns by subject — don't treat sessions in isolation

Only include fields that contribute meaningfully. Forced mentions dilute the analysis.

---

GROUNDING RULE:
Every insight must be traceable to at least one session — identified by subject plus at least one field value OR a direct note reference. Don't cite fields for the sake of it; cite what actually drives the point.

BANNED OUTPUT PATTERNS:
- "Your focus could be better" → say "Focus was 2/5 in [Subject]"
- "You struggled with retention" → say "Retention dropped to 3/5 in [Subject] despite 90 min logged"
- "Try to stay more focused" → name what caused the drop, per the notes

Validity rule: any insight that cannot be traced to a session field value or note must be removed.

---

PROGRESSION TRACKING:
Classify every identified issue as exactly one of:
- NEW ISSUE — recently detected, not seen before
- ONGOING ISSUE — confirmed across multiple recent sessions
- RESOLVED ISSUE — previously flagged, now fixed per notes or data

If unclear → only use ONGOING if multiple recent sessions confirm it.

---

INTERPRETATION GUIDE:
- Low focus + low retention = "went through the material without really engaging"
- High focus + low retention = "concentrated effort that isn't sticking — method problem, not effort problem"
- Low focus + high retention = "retained despite low engagement — likely familiar material"
- Long duration + low retention = "spent [X] min but retained very little — engagement is the constraint, not time"
- Passive study = "reading without testing yourself"
- Low retention on easy material = "focus or method issue, not a difficulty ceiling"

---

TONE RULES:
- Calm, direct, grounded. No hype, no guilt, no emotional pressure.
- No corporate phrasing. Banned: "significant", "optimize", "leverage", "it is evident that", "comprehensive", "holistic".
- Plain coach voice — every sentence earns its place.
- Highlight improvement before criticism. Never shame. Never repeat resolved failures.
- Use numbers when they sharpen a point. Don't use them as filler.

---

STATUS DIAGNOSIS:
- LOCKED_IN: high focus AND high retention across most sessions, notes show active engagement
- COASTING: decent scores but notes reveal passive behavior — re-reading, no self-testing
- INCONSISTENT: large variance in focus or retention, no clear pattern
- STRUGGLING: low retention across sessions, especially on non-difficult material

status_reason = ONE sentence naming the root behavioral cause.
  Bad: "Your focus scores varied across sessions."
  Good: "You're moving through material without testing yourself, so time spent isn't converting to retention."

---

NEXT ACTION PLAN RULE:
This is the most important output field.
- Name exactly what to study (subject + task type)
- Match weak patterns — but never repeat resolved issues
- Realistic for 1 day of study
- Prioritize highest-impact change

Bad: "Improve math"
Good: "Do 3 timed algebra problem sets + review mistakes from last session (retention was 3/5 on familiar material)"

---

DATE RULE — NON-NEGOTIABLE:
Do NOT reference any dates, day names, or timestamps anywhere in the output.
Refer to sessions only as "Session 1", "Session 2", etc., or by subject name alone.
Any output field containing a date string (e.g. "2026-06-07") is invalid and must be removed.

---

performance_level: integer 1–10, derived as follows:
- Start at 5
- +1 per subject where avg retention >= 4.0
- +1 if avg focus across all sessions >= 4.0
- -1 per subject where avg retention <= 3.0
- -1 if key_blocker is ONGOING
- Clamp result between 1 and 10

one_liner: one sentence. Honest, plain, no corporate phrasing. Must reflect the actual status — not generic encouragement.
  Bad: "Keep up the great work!"
  Good: "You're sharp when you hit the books, but showing up consistently is your next hurdle."

---

STRICT JSON OUTPUT — NO EXCEPTIONS:
Return ONLY a valid JSON object. No markdown, no code fences, no text outside the JSON.

{
  "status": "LOCKED_IN" | "COASTING" | "INCONSISTENT" | "STRUGGLING",
  "performance_level": <integer 1-10>,
  "one_liner": "<one honest sentence capturing the student's current situation>",
  "status_reason": "<one root-cause sentence>",
  "current_state": "<short factual summary of where the student is right now>",
  "progress_notes": [
    "<what improved — cite session or note>",
    "<what declined — cite session or note>"
  ],
  "patterns": ["<grounded pattern with session reference>"],
  "callouts": ["<specific behavioral callout with session + field or note reference>"],
  "key_blocker": "<single biggest issue right now — classified as NEW / ONGOING / RESOLVED>",
  "next_action_plan": [
    {
      "subject": "",
      "task": "",
      "reason": ""
    }
  ]
}

---

DATA:
- Total study time: ${totalMinutes} minutes
- Sessions:
${sessionSummary}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessions } = req.body;

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return res.status(400).json({ error: "sessions must be a non-empty array" });
  }

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    return res.status(500).json({ error: "No Gemini API key configured" });
  }

  const typedSessions = sessions as Session[];

  const uniqueDays = new Set(typedSessions.map((s) => s.date)).size;
  const totalMinutes = typedSessions.reduce((sum, s) => sum + s.duration, 0);

  const sessionSummary = typedSessions
    .map(
      (s, i) =>
        `- Session ${i + 1}: ${s.subject}, ${s.duration}min, difficulty=${s.difficulty}/5, focus=${s.focus}/5, retention=${s.retention}/5${
          s.notes ? `, notes: "${s.notes}"` : ""
        }`
    )
    .join("\n");

  const prompt = buildPrompt(
    typedSessions,
    uniqueDays,
    totalMinutes,
    sessionSummary
  );

  let raw = "";

  outer: for (const [keyIndex, apiKey] of apiKeys.entries()) {
  if (isKeyCoolingDown(apiKey)) {
    console.warn({ keyIndex: keyIndex + 1 }, "Key cooling down, skipping");
    continue;
  }

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
          coolDownKey(apiKey);
          console.warn({ keyIndex: keyIndex + 1, model: modelName }, "Quota hit, cooling key for 60s");
          break;
        } else if (isOverloaded(err)) {
          console.warn({ keyIndex: keyIndex + 1, model: modelName, attempt }, "Overloaded, retrying");
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
        } else {
          console.error({ keyIndex: keyIndex + 1, model: modelName, attempt, err }, "Unknown error");
          break;
        }
      }
    }
  }
}

  if (!raw) {
    return res.status(503).json({
      error: "All Gemini API keys and models exhausted. Try again later.",
    });
  }

  // Strip accidental markdown fences the model may have added despite instructions
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return res.status(200).json(parsed);
  } catch {
    console.error({ raw }, "Failed to parse Gemini JSON response");
    return res.status(502).json({
      error: "Model returned invalid JSON.",
      raw,
    });
  }
}
