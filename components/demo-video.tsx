"use client";

import { useEffect, useRef } from "react";

/**
 * The product demo of the landing page (docs/QUESTIONS.md C119). It plays by itself, muted
 * and in a loop, only while it is on screen: nothing is downloaded before that, which
 * matters on a phone. Visitors who asked for less motion or for data saving get the poster
 * and the controls, and start it themselves.
 */
export function DemoVideo({ src, poster }: { src: string; poster: string }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ===
      true;
    if (saveData || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Once the visitor has paused it, it stays paused: the page does not fight them.
    let stopped = false;
    const onPause = () => {
      if (!element.ended && element.dataset.auto !== "pausing") stopped = true;
    };
    element.addEventListener("pause", onPause);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting && !stopped) {
          void element.play().catch(() => {});
        } else if (!element.paused) {
          element.dataset.auto = "pausing";
          element.pause();
          delete element.dataset.auto;
        }
      },
      { threshold: 0.55 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      element.removeEventListener("pause", onPause);
    };
  }, []);

  return (
    <video
      ref={video}
      className="demo-video"
      src={src}
      poster={poster}
      width={1280}
      height={720}
      muted
      loop
      playsInline
      controls
      preload="none"
      aria-label="Démonstration de JobGPT en vidéo"
    />
  );
}
