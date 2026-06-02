import { useState, useRef, useEffect } from "react";

export function useTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startTsRef = useRef(null); // absolute timestamp when timer started
  const intervalRef = useRef(null);

  const tick = () => {
    if (startTsRef.current) {
      setElapsed(Math.floor((Date.now() - startTsRef.current) / 1000));
    }
  };

  // When screen comes back from background, recalculate immediately
  useEffect(() => {
    const onVisible = () => {
      if (running && startTsRef.current) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [running]);

  const start = () => {
    // If resuming, adjust start time to account for already-elapsed seconds
    startTsRef.current = Date.now() - elapsed * 1000;
    setRunning(true);
    intervalRef.current = setInterval(tick, 1000);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    // Final accurate calculation
    const final = startTsRef.current ? Math.floor((Date.now() - startTsRef.current) / 1000) : elapsed;
    setElapsed(final);
    return final;
  };

  const reset = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    startTsRef.current = null;
    setElapsed(0);
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return { elapsed, running, start, stop, reset, fmt };
}
