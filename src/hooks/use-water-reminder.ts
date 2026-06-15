import { useEffect } from "react";
import { toast } from "sonner";
import { randomWaterNudge } from "@/lib/quotes";

const STORAGE_KEY = "lumen:lastWaterNudge";
const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

function fire() {
  toast(randomWaterNudge(), {
    duration: 8000,
    description: "Take a sip — your next 30 minutes will thank you.",
  });
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {}
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("💧 Time to drink water", { body: randomWaterNudge() });
    } catch {}
  }
}

/**
 * Fires a hydration reminder every 30 minutes while the app is open.
 * Persists last-fired time across reloads so reminders stay spaced.
 */
export function useWaterReminder() {
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    let last = 0;
    try {
      last = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    } catch {}

    const elapsed = Date.now() - last;
    const firstDelay = last > 0 && elapsed < INTERVAL_MS ? INTERVAL_MS - elapsed : INTERVAL_MS;

    const firstTimer = setTimeout(() => {
      fire();
      const interval = setInterval(fire, INTERVAL_MS);
      // store on element so cleanup can clear
      (firstTimer as unknown as { _interval: ReturnType<typeof setInterval> })._interval = interval;
    }, firstDelay);

    return () => {
      clearTimeout(firstTimer);
      const i = (firstTimer as unknown as { _interval?: ReturnType<typeof setInterval> })._interval;
      if (i) clearInterval(i);
    };
  }, []);
}
