import { useState, useRef, useEffect } from "react";

export function useTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  function tick() {
    setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    rafRef.current = requestAnimationFrame(tick);
  }
  
  const start = () => {
    startRef.current = Date.now() - elapsed * 1000;
    setRunning(true);
    rafRef.current = requestAnimationFrame(tick);
  };
  
  const stop = () => {
    setRunning(false);
    cancelAnimationFrame(rafRef.current);
    return elapsed;
  };
  
  const reset = () => {
    setRunning(false);
    cancelAnimationFrame(rafRef.current);
    setElapsed(0);
  };
  
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  
  return { elapsed, running, start, stop, reset, fmt };
}
