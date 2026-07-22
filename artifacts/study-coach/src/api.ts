import type { Session, AnalysisResult, AISummary, AdvancedInsights } from "./storage";

export interface AnalyzeResponse {
  analysis: AnalysisResult;
  insights?: AdvancedInsights;
}

export async function analyzeStudy(
  sessions: Session[],
  interviewContext?: string,
  aiSummary?: AISummary | null
): Promise<AnalyzeResponse> {
  console.log("[API] analyzeStudy called");
  console.log("[API] sessions count:", sessions.length);
  console.log("[API] interviewContext:", interviewContext);
  console.log("[API] aiSummary:", aiSummary);
  
  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const recentSessions = sessions.filter((s) => new Date(s.date).getTime() >= twoDaysAgo);
  const allSessions = sessions;
  
  console.log("[API] recentSessions count:", recentSessions.length);
  console.log("[API] allSessions count:", allSessions.length);

  const payload = {
    sessions: recentSessions,
    allSessions: allSessions,
    allSessionsCount: sessions.length,
    interviewContext,
    aiSummary,
  };
  
  console.log("[API] Request payload:", JSON.stringify(payload, null, 2));

  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  console.log("[API] Fetch completed");
  console.log("[API] Response status:", response.status);
  console.log("[API] Response ok:", response.ok);
  console.log("[API] Response headers:", response.headers);

  if (!response.ok) {
  console.log("[API] Response not ok, attempting to parse error");

  let errorMsg = `Server error ${response.status}`;

  try {
    const text = await response.text();
    console.log("[API] Raw error response:", text);

    if (text) {
      try {
        const json = JSON.parse(text);
        errorMsg = json.error || errorMsg;
      } catch {
        errorMsg = text;
      }
    }
  } catch (e) {
    console.error("[API] Failed to read error response:", e);
  }

  console.error("[API] Throwing error:", errorMsg);
  throw new Error(errorMsg);
  }
  console.log("[API] Response is ok, parsing JSON");
  const data = await response.json();
  console.log("[API] Parsed response:", data);
  console.log("[API] response.analysis:", data.analysis);
  console.log("[API] response.insights:", data.insights);
  
  return data;
}
