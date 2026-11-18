/**
 * The handwritten note and its looped dashed arrow, pointing at the drop zone
 * (docs/QUESTIONS.md C98). Decorative: hidden from screen readers, no pointer events.
 */
export function DropCue() {
  return (
    <div className="drop-cue" aria-hidden>
      <span className="drop-cue-label">dépose ton CV</span>
      <svg className="drop-cue-arrow" viewBox="0 0 230 170" focusable="false" aria-hidden>
        <path
          className="drop-cue-line"
          d="M214 24C170 6 128 18 118 48c-8 24 18 38 32 24 12-14-8-30-34-20C86 64 64 102 56 146"
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          className="drop-cue-head"
          d="M44 126 L57 149 L70 133"
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
