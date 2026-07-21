/**
 * Production-ready notification service for Pomodoro timer
 * 
 * Strategy:
 * 1. Try Median's native notification API (window.median?.notification)
 * 2. Fallback to Web Notifications API with permission handling
 * 3. Gracefully handle unsupported platforms
 */

import { useEffect, useRef, useCallback } from "react";

export type NotificationType = "focus-end" | "break-end" | "stopwatch-running";

interface NotificationAPI {
  send(title: string, options?: { body?: string; tag?: string }): Promise<void>;
  cancel(tag: string): Promise<void>;
  isSupported(): boolean;
  hasPermission(): boolean;
}

/**
 * Median native notification wrapper
 * Works in Median WebView on iOS/Android
 */
function createMedianNotifications(): NotificationAPI {
  const median = (window as any).median?.notification;
  
  return {
    async send(title: string, options = {}) {
      try {
        if (median?.show) {
          await median.show({
            title,
            subtitle: options.body || "",
            ...options,
          });
        }
      } catch (err) {
        console.warn("Median notification failed:", err);
      }
    },
    async cancel(tag: string) {
      try {
        if (median?.cancel) {
          await median.cancel(tag);
        }
      } catch (err) {
        console.warn("Median cancel failed:", err);
      }
    },
    isSupported() {
      return !!(window as any).median?.notification;
    },
    hasPermission() {
      return true; // Median doesn't require permission
    },
  };
}

/**
 * Web Notifications API wrapper with permission handling
 * Works in modern browsers and progressive web apps
 */
function createWebNotifications(): NotificationAPI {
  return {
    async send(title: string, options = {}) {
      if (!("Notification" in window)) return;
      
      try {
        if (Notification.permission === "granted") {
          new Notification(title, {
            icon: "/favicon.svg",
            badge: "/favicon.svg",
            ...options,
            tag: options.tag || "pomodoro",
            requireInteraction: false,
          });
        }
      } catch (err) {
        console.warn("Web notification failed:", err);
      }
    },
    async cancel(tag: string) {
      if (!("Notification" in window)) return;
      const notifications = await (navigator as any).serviceWorker?.getRegistration?.();
      if (notifications) {
        const all = await notifications.getNotifications({ tag });
        all.forEach((n: any) => n.close());
      }
    },
    isSupported() {
      return "Notification" in window;
    },
    hasPermission() {
      return "Notification" in window && Notification.permission === "granted";
    },
  };
}

/**
 * Request notification permission (only once, when needed)
 */
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch {
    return false;
  }
}

/**
 * Hook: Manage Pomodoro notifications
 * Handles both countdown completion alerts and stopwatch live updates
 */
export function useNotifications() {
  const apiRef = useRef<NotificationAPI | null>(null);
  const platformRef = useRef<"median" | "web" | "none">("none");
  const stopwatchIntervalRef = useRef<number | undefined>(undefined);
  const permissionRequestedRef = useRef(false);

  useEffect(() => {
    // Initialize notification API (prefer Median, fallback to Web Notifications)
    const median = createMedianNotifications();
    const web = createWebNotifications();
    if (median.isSupported()) {
      apiRef.current = median;
      platformRef.current = "median";
    } else if (web.isSupported()) {
      apiRef.current = web;
      platformRef.current = "web";
    } else {
      apiRef.current = null;
      platformRef.current = "none";
    }
  }, []);

  /**
   * Notify timer completion (focus or break)
   */
  const notifyCompletion = useCallback(async (mode: "focus" | "break") => {
    const api = apiRef.current;
    if (!api) return;

    if (!api.hasPermission() && !permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      await requestNotificationPermission();
      if (!api.hasPermission()) return;
    }

    const title = mode === "focus" ? "🎉 Focus Session Complete!" : "🎉 Break Time Over!";
    const body = mode === "focus" ? "Great work! Ready for a break?" : "Ready to focus again?";
    
    await api.send(title, {
      body,
      tag: `pomodoro-${mode}`,
    });
  }, []);

  /**
   * Start stopwatch notification (live updates every second)
   */
  const startStopwatchNotification = useCallback((getElapsedDisplay: () => string) => {
    const api = apiRef.current;
    if (!api) return;

    // Cleanup previous interval
    if (stopwatchIntervalRef.current) {
      clearInterval(stopwatchIntervalRef.current);
    }

    // Request permission once
    if (!api.hasPermission() && !permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      requestNotificationPermission().catch(() => {});
    }

    // Update every second
    const updateNotification = () => {
      if (api.hasPermission()) {
        const elapsed = getElapsedDisplay();
        api.send("⏱️ Stopwatch Running", {
          body: `Elapsed: ${elapsed}`,
          tag: "pomodoro-stopwatch",
        });
      }
    };

    updateNotification(); // Send immediately
    stopwatchIntervalRef.current = window.setInterval(updateNotification, 1000);
  }, []);

  /**
   * Stop stopwatch notification
   */
  const stopStopwatchNotification = useCallback(async () => {
    if (stopwatchIntervalRef.current) {
      clearInterval(stopwatchIntervalRef.current);
      stopwatchIntervalRef.current = undefined;
    }
    
    const api = apiRef.current;
    if (api) {
      await api.cancel("pomodoro-stopwatch");
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
    };
  }, []);

  return {
    notifyCompletion,
    startStopwatchNotification,
    stopStopwatchNotification,
    isSupported: !!apiRef.current,
    platform: platformRef.current,
  };
}
