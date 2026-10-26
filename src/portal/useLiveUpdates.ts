import { useEffect, useState } from "react";
export type LiveStatus = "connecting" | "live" | "reconnecting" | "signed-out";
export function useLiveUpdates(sessionKey: string | undefined, refresh: () => Promise<void>, onExpired: () => void) {
  const [status, setStatus] = useState<LiveStatus>("signed-out");
  useEffect(() => {
    if (!sessionKey) {
      setStatus("signed-out");
      return;
    }
    setStatus("connecting");
    const source = new EventSource("/api/events/stream");
    let dirty = false,
      running = false,
      closed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = async () => {
      if (closed) return;
      if (running) {
        dirty = true;
        return;
      }
      running = true;
      try {
        await refresh();
      } catch {
      } finally {
        running = false;
        if (dirty && !closed) {
          dirty = false;
          timer = setTimeout(() => void sync(), 150);
        }
      }
    };
    source.onopen = () => setStatus("live");
    source.onerror = () => setStatus("reconnecting");
    source.addEventListener("change", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void sync(), 100);
    });
    source.addEventListener("session-expired", () => {
      source.close();
      onExpired();
    });
    const fallback = setInterval(() => void sync(), 30000);
    return () => {
      closed = true;
      source.close();
      if (timer) clearTimeout(timer);
      clearInterval(fallback);
    };
  }, [sessionKey, refresh, onExpired]);
  return status;
}
