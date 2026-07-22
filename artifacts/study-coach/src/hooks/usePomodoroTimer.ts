import { useState, useEffect, useCallback, useRef } from "react";
import { useNotifications } from "./useNotifications";

// Architecture note:
// The timer's source of truth is NEVER "seconds remaining, decremented every tick."
// That approach drifts and resets the moment the tab/app is backgrounded or closed,
// because setInterval doesn't run in a suspended JS context.
//
// Instead we persist an anchor timestamp (`targetEndsAt` for countdown mode,
// `startedAt` for stopwatch/count-up mode) plus accumulated paused time.
// On every tick — and critically, on mount/rehydrate — we derive the displayed
// value as `now - anchor`, so the timer is correct immediately after a reload,
// even if the reload happens minutes later. The interval only exists to force
// a re-render; it holds no state of its own.

export type TimerMode = "focus" | "break";
export type TimerKind = "countdown" | "stopwatch";

interface PersistedTimerState {
  kind: TimerKind;
  mode: TimerMode;
  subject: string;
  sessionNumber: number;
  running: boolean;
  targetEndsAt: number | null;
  startedAt: number | null;
  accumulatedMs: number;
  durationMs: number;
}

const STORAGE_KEY = "study_coach_timer_v1";
const DEFAULT_FOCUS_MIN = 45;
const DEFAULT_BREAK_MIN = 10;

function loadState(): PersistedTimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to default */
  }
  return {
    kind: "countdown",
    mode: "focus",
    subject: "Maths",
    sessionNumber: 1,
    running: false,
    targetEndsAt: null,
    startedAt: null,
    accumulatedMs: 0,
    durationMs: DEFAULT_FOCUS_MIN * 60 * 1000,
  };
}

function persist(state: PersistedTimerState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function usePomodoroTimer() {
  const [state, setState] = useState<PersistedTimerState>(loadState);
  const [, forceTick] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  const notifications = useNotifications();
  const notificationSentRef = useRef<string | null>(null);

  useEffect(() => {
    persist(state);
  }, [state]);

  useEffect(() => {
    if (!state.running) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      forceTick((n) => n + 1);
      rafRef.current = window.setTimeout(tick, 250);
    };
    tick();
    return () => {
      cancelled = true;
      if (rafRef.current) window.clearTimeout(rafRef.current);
    };
  }, [state.running]);

  const elapsedMs = useCallback((): number => {
    if (state.kind === "stopwatch") {
      if (!state.running || state.startedAt === null) return state.accumulatedMs;
      return state.accumulatedMs + (Date.now() - state.startedAt);
    }
    if (!state.running || state.targetEndsAt === null) {
      return state.accumulatedMs;
    }
    const remaining = state.targetEndsAt - Date.now();
    const liveElapsed = state.durationMs - Math.max(remaining, 0);
    return liveElapsed;
  }, [state]);

  const remainingMs = useCallback((): number => {
    if (state.kind === "stopwatch") return 0;
    return Math.max(state.durationMs - elapsedMs(), 0);
  }, [state, elapsedMs]);

  const isFinished = state.kind === "countdown" && state.running && remainingMs() <= 0;

  // Notify on countdown completion
  useEffect(() => {
    if (isFinished && notificationSentRef.current !== `${state.mode}-${state.sessionNumber}`) {
      notificationSentRef.current = `${state.mode}-${state.sessionNumber}`;
      notifications.notifyCompletion(state.mode);
      setState((s) => ({
        ...s,
        running: false,
        accumulatedMs: s.durationMs,
        targetEndsAt: null,
        sessionNumber: s.mode === "focus" ? s.sessionNumber + 1 : s.sessionNumber,
      }));
    }
  }, [isFinished, state.mode, state.sessionNumber, notifications]);

  // Manage stopwatch notification
  useEffect(() => {
    if (state.kind !== "stopwatch") {
      notifications.stopStopwatchNotification();
      return;
    }
    
    if (state.running) {
      const getElapsedDisplay = () => {
        const totalSec = Math.round(elapsedMs() / 1000);
        const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
        const ss = String(totalSec % 60).padStart(2, "0");
        const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
        return hh !== "00" ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
      };
      notifications.startStopwatchNotification(getElapsedDisplay);
    } else {
      notifications.stopStopwatchNotification();
    }
  }, [state.kind, state.running, elapsedMs, notifications]);

  function start() {
    setState((s) => {
      if (s.kind === "stopwatch") {
        return { ...s, running: true, startedAt: Date.now() };
      }
      const remaining = s.durationMs - s.accumulatedMs;
      return { ...s, running: true, targetEndsAt: Date.now() + remaining };
    });
  }

  function pause() {
    setState((s) => {
      if (s.kind === "stopwatch") {
        const acc = s.startedAt ? s.accumulatedMs + (Date.now() - s.startedAt) : s.accumulatedMs;
        return { ...s, running: false, accumulatedMs: acc, startedAt: null };
      }
      const remaining = s.targetEndsAt ? s.targetEndsAt - Date.now() : s.durationMs - s.accumulatedMs;
      return { ...s, running: false, accumulatedMs: s.durationMs - Math.max(remaining, 0), targetEndsAt: null };
    });
  }

  function reset(kind: TimerKind = state.kind, mode: TimerMode = state.mode) {
    const durationMin = mode === "focus" ? DEFAULT_FOCUS_MIN : DEFAULT_BREAK_MIN;
    setState((s) => ({
      ...s,
      kind,
      mode,
      running: false,
      targetEndsAt: null,
      startedAt: null,
      accumulatedMs: 0,
      durationMs: durationMin * 60 * 1000,
    }));
    notificationSentRef.current = null;
  }

  function toggleMode() {
    const nextMode: TimerMode = state.mode === "focus" ? "break" : "focus";
    const wasRunning = state.running;
    setState((s) => {
      const durationMin = nextMode === "focus" ? DEFAULT_FOCUS_MIN : DEFAULT_BREAK_MIN;
      const newState = {
        ...s,
        kind: s.kind,
        mode: nextMode,
        running: false,
        targetEndsAt: null,
        startedAt: null,
        accumulatedMs: 0,
        durationMs: durationMin * 60 * 1000,
      };
      if (wasRunning) {
        const remaining = newState.durationMs - newState.accumulatedMs;
        return { ...newState, running: true, targetEndsAt: Date.now() + remaining };
      }
      return newState;
    });
    notificationSentRef.current = null;
  }

  function toggleKind() {
    const nextKind: TimerKind = state.kind === "countdown" ? "stopwatch" : "countdown";
    reset(nextKind, state.mode);
  }

  function setSubject(subject: string) {
    setState((s) => ({ ...s, subject }));
  }

  function setDurationMinutes(min: number) {
    setState((s) => ({
      ...s,
      durationMs: min * 60 * 1000,
      accumulatedMs: 0,
      running: false,
      targetEndsAt: null,
    }));
  }

  const remaining = remainingMs();
  const elapsed = elapsedMs();
  const displayMs = state.kind === "countdown" ? remaining : elapsed;
  const totalSec = Math.max(0, Math.round(displayMs / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  const progress = state.kind === "countdown" && state.durationMs > 0
    ? Math.min(1, Math.max(0, elapsed / state.durationMs))
    : 0;

  return {
    ...state,
    mm,
    ss,
    progress,
    isFinished,
    start,
    pause,
    reset,
    toggleMode,
    toggleKind,
    setSubject,
    setDurationMinutes,
  };
}
