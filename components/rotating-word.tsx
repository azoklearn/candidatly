"use client";

import { useEffect, useState } from "react";

/**
 * Word that erases itself letter by letter and types the next one, as if someone were at
 * the keyboard. The first word is rendered on the server, so the headline reads correctly
 * without JavaScript; screen readers get the plain list instead of the animation.
 */

const TYPE_MS = 95;
const ERASE_MS = 55;
const HOLD_MS = 2200;

export function RotatingWord({ words }: { words: readonly [string, ...string[]] }) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(words[0]);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = words[index % words.length] ?? words[0];
    if (!erasing && text === target) {
      const hold = setTimeout(() => setErasing(true), HOLD_MS);
      return () => clearTimeout(hold);
    }
    if (erasing && text.length === 0) {
      // Short pause on the empty word, as a typist would take.
      const swap = setTimeout(() => {
        setErasing(false);
        setIndex((current) => (current + 1) % words.length);
      }, 220);
      return () => clearTimeout(swap);
    }
    const next = erasing ? text.slice(0, -1) : target.slice(0, text.length + 1);
    const timer = setTimeout(() => setText(next), erasing ? ERASE_MS : TYPE_MS);
    return () => clearTimeout(timer);
  }, [erasing, index, text, words]);

  return (
    <>
      <span className="sr-only">{words.join(" ou ")}</span>
      <span aria-hidden="true">
        {text}
        <span className="typed-caret" />
      </span>
    </>
  );
}
