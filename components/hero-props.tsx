import type { ReactNode } from "react";

/**
 * Small pastel objects floating around the CV drop zone, and the looped dashed arrow that
 * points at it (docs/QUESTIONS.md C98). Everything is inline SVG: no image to download, no
 * pointer events, and the whole scene is decorative, so it is hidden from screen readers.
 */

function Prop({ name, children }: { name: string; children: ReactNode }) {
  return (
    <span className="hero-prop" data-prop={name}>
      <svg viewBox="0 0 100 100" focusable="false" aria-hidden>
        {children}
      </svg>
    </span>
  );
}

/** The soft shadow every object casts, so they read as volumes and not stickers. */
function Shadow({ cx = 50, rx = 26, cy = 92 }: { cx?: number; rx?: number; cy?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry="4.5" fill="#673d28" opacity="0.07" />;
}

function PaperPlane() {
  return (
    <Prop name="plane">
      <defs>
        <linearGradient id="hp-plane-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffede4" />
        </linearGradient>
        <linearGradient id="hp-plane-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbddcf" />
          <stop offset="1" stopColor="#f3c1a8" />
        </linearGradient>
      </defs>
      <Shadow cx={52} rx={22} />
      <path d="M94 9 L7 43 L44 57 Z" fill="url(#hp-plane-a)" />
      <path d="M94 9 L44 57 L55 88 Z" fill="url(#hp-plane-b)" />
      <path d="M94 9 L44 57 L50 71 Z" fill="#fbe6dc" opacity="0.85" />
    </Prop>
  );
}

function Laptop() {
  return (
    <Prop name="laptop">
      <defs>
        <linearGradient id="hp-lap-lid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff5ea" />
          <stop offset="1" stopColor="#f7e0c8" />
        </linearGradient>
        <linearGradient id="hp-lap-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6ddff" />
          <stop offset="1" stopColor="#efd3b7" />
        </linearGradient>
      </defs>
      <Shadow cx={50} rx={34} cy={90} />
      <path d="M22 18h56a5 5 0 0 1 5 5v39H17V23a5 5 0 0 1 5-5z" fill="url(#hp-lap-lid)" />
      <rect x="23" y="24" width="54" height="31" rx="3" fill="#fffcfb" />
      <rect x="29" y="31" width="27" height="3.6" rx="1.8" fill="#f8ccb7" />
      <rect x="29" y="39" width="19" height="3.6" rx="1.8" fill="#faeae2" />
      <rect x="29" y="47" width="24" height="3.6" rx="1.8" fill="#faeae2" />
      <path d="M12 62h76l6 11a4 4 0 0 1-3.5 6H9.5A4 4 0 0 1 6 73z" fill="url(#hp-lap-base)" />
      <rect x="39" y="68" width="22" height="5" rx="2.5" fill="#ffffff" opacity="0.65" />
    </Prop>
  );
}

function Desk() {
  return (
    <Prop name="desk">
      <defs>
        <linearGradient id="hp-desk-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffeede" />
          <stop offset="1" stopColor="#f7d9bd" />
        </linearGradient>
      </defs>
      <Shadow cx={50} rx={38} cy={94} />
      <path d="M50 16 L93 40 L50 64 L7 40 Z" fill="url(#hp-desk-top)" />
      <path d="M7 40 L7 46 L50 70 L50 64 Z" fill="#e8c6a6" />
      <path d="M93 40 L93 46 L50 70 L50 64 Z" fill="#dcb795" />
      <path d="M11 44 L11 74 L16 77 L16 47 Z" fill="#e8c6a6" />
      <path d="M89 44 L89 74 L84 77 L84 47 Z" fill="#dcb795" />
      <path d="M48 69 L48 92 L54 89 L54 66 Z" fill="#edd0b4" />
      <rect x="31" y="30" width="24" height="9" rx="2" fill="#ffffff" opacity="0.8" />
    </Prop>
  );
}

function Notebook() {
  return (
    <Prop name="notebook">
      <defs>
        <linearGradient id="hp-note" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d8f2e4" />
          <stop offset="1" stopColor="#a9ddc2" />
        </linearGradient>
      </defs>
      <Shadow cx={50} rx={26} cy={93} />
      <g transform="rotate(-7 50 52)">
        <rect x="26" y="18" width="52" height="68" rx="6" fill="#ffffff" />
        <rect x="20" y="14" width="52" height="68" rx="6" fill="url(#hp-note)" />
        <rect x="30" y="30" width="30" height="4.5" rx="2.2" fill="#ffffff" opacity="0.85" />
        <rect x="30" y="41" width="22" height="4.5" rx="2.2" fill="#ffffff" opacity="0.6" />
        <rect x="30" y="52" width="26" height="4.5" rx="2.2" fill="#ffffff" opacity="0.6" />
        <rect x="60" y="14" width="5" height="68" fill="#ffc7d6" opacity="0.9" />
      </g>
    </Prop>
  );
}

function Coffee() {
  return (
    <Prop name="coffee">
      <defs>
        <linearGradient id="hp-cup" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe3d2" />
          <stop offset="1" stopColor="#ffc3a4" />
        </linearGradient>
      </defs>
      <Shadow cx={48} rx={24} cy={90} />
      <path
        d="M68 46a11 11 0 1 1-3 21"
        fill="none"
        stroke="#ffc3a4"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M26 36h44l-5 42a9 9 0 0 1-9 8H40a9 9 0 0 1-9-8z" fill="url(#hp-cup)" />
      <ellipse cx="48" cy="36" rx="22" ry="6.5" fill="#fff6f0" />
      <ellipse cx="48" cy="36" rx="16" ry="4" fill="#f0c3a6" opacity="0.5" />
      <path
        d="M41 24c4-4-3-7 1-12M55 24c4-4-3-7 1-12"
        fill="none"
        stroke="#ffd6c2"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </Prop>
  );
}

function Pencil() {
  return (
    <Prop name="pencil">
      <defs>
        <linearGradient id="hp-pencil" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffeec2" />
          <stop offset="1" stopColor="#f6d888" />
        </linearGradient>
      </defs>
      <Shadow cx={50} rx={22} cy={94} />
      <g transform="rotate(33 50 50)">
        <rect x="41" y="12" width="18" height="8" rx="3" fill="#ffc0d2" />
        <rect x="41" y="19" width="18" height="4" fill="#f6e9e3" />
        <rect x="41" y="22" width="18" height="46" fill="url(#hp-pencil)" />
        <rect x="52" y="22" width="7" height="46" fill="#e8c372" opacity="0.6" />
        <path d="M41 68h18l-9 18z" fill="#ffeed6" />
        <path d="M45.5 78h9l-4.5 8z" fill="#855d4a" />
      </g>
    </Prop>
  );
}

function Folder() {
  return (
    <Prop name="folder">
      <defs>
        <linearGradient id="hp-folder-back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe7db" />
          <stop offset="1" stopColor="#f7ceb9" />
        </linearGradient>
        <linearGradient id="hp-folder-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffdfcf" />
          <stop offset="1" stopColor="#f2c0a7" />
        </linearGradient>
      </defs>
      <Shadow cx={50} rx={34} cy={88} />
      <path
        d="M12 26h24l6 8h46a5 5 0 0 1 5 5v36a5 5 0 0 1-5 5H12a5 5 0 0 1-5-5V31a5 5 0 0 1 5-5z"
        fill="url(#hp-folder-back)"
      />
      <rect x="24" y="30" width="52" height="34" rx="3" fill="#fffdf8" />
      <rect x="31" y="39" width="26" height="4" rx="2" fill="#f6e0d6" />
      <rect x="31" y="48" width="34" height="4" rx="2" fill="#f9efea" />
      <path
        d="M7 46h86a4 4 0 0 1 4 4.6l-4 25a5 5 0 0 1-5 4.4H12a5 5 0 0 1-5-4.4z"
        fill="url(#hp-folder-front)"
      />
    </Prop>
  );
}

function Clock() {
  return (
    <Prop name="clock">
      <defs>
        <linearGradient id="hp-clock" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe0ea" />
          <stop offset="1" stopColor="#f7b8cd" />
        </linearGradient>
      </defs>
      <Shadow cx={50} rx={24} cy={88} />
      <circle cx="50" cy="48" r="32" fill="url(#hp-clock)" />
      <circle cx="50" cy="48" r="24" fill="#fffdf8" />
      <path
        d="M50 32v16h12"
        fill="none"
        stroke="#8d6755"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="48" r="3.2" fill="#8d6755" />
    </Prop>
  );
}

function Envelope() {
  return (
    <Prop name="envelope">
      <defs>
        <linearGradient id="hp-env" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1e2" />
          <stop offset="1" stopColor="#c8b9f3" />
        </linearGradient>
      </defs>
      <Shadow cx={50} rx={32} cy={86} />
      <rect x="26" y="16" width="48" height="32" rx="4" fill="#fffdf8" />
      <rect x="33" y="24" width="26" height="4" rx="2" fill="#dcd2f7" />
      <rect x="33" y="33" width="18" height="4" rx="2" fill="#ece7fb" />
      <path
        d="M10 34h80a4 4 0 0 1 4 4v34a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V38a4 4 0 0 1 4-4z"
        fill="url(#hp-env)"
      />
      <path
        d="M8 38l42 26 42-26"
        fill="none"
        stroke="#fffdf8"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Prop>
  );
}

function GraduationCap() {
  return (
    <Prop name="cap">
      <defs>
        <linearGradient id="hp-cap" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbdecf" />
          <stop offset="1" stopColor="#efb89d" />
        </linearGradient>
      </defs>
      <Shadow cx={50} rx={28} cy={90} />
      <path d="M30 44v16c0 7 9 12 20 12s20-5 20-12V44L50 56z" fill="#f2cab6" />
      <path d="M50 18 L94 38 L50 58 L6 38 Z" fill="url(#hp-cap)" />
      <path d="M50 26 L78 38 L50 50 L22 38 Z" fill="#ffffff" opacity="0.35" />
      <path d="M88 41v18" fill="none" stroke="#f7b8cd" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="88" cy="63" r="5" fill="#f7b8cd" />
    </Prop>
  );
}

function Plant() {
  return (
    <Prop name="plant">
      <defs>
        <linearGradient id="hp-pot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd9c4" />
          <stop offset="1" stopColor="#f3b795" />
        </linearGradient>
      </defs>
      <Shadow cx={50} rx={22} cy={92} />
      <path d="M50 60C38 50 34 32 48 20c14 9 12 31 2 40z" fill="#a9ddc2" />
      <path d="M48 60C38 56 28 46 32 34c12 2 18 14 16 26z" fill="#c4e9d6" />
      <path d="M52 60c8-5 17-4 20 4-10 6-17 3-20-4z" fill="#8ccfae" />
      <path d="M35 62h30l-4 23a6 6 0 0 1-6 5H45a6 6 0 0 1-6-5z" fill="url(#hp-pot)" />
      <rect x="31" y="56" width="38" height="9" rx="4.5" fill="#ffe3d2" />
    </Prop>
  );
}

function StickyNote() {
  return (
    <Prop name="sticky">
      <defs>
        <linearGradient id="hp-sticky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3cd" />
          <stop offset="1" stopColor="#fbe29a" />
        </linearGradient>
      </defs>
      <Shadow cx={50} rx={26} cy={90} />
      <g transform="rotate(6 50 52)">
        <path d="M18 18h64v48L64 84H18z" fill="url(#hp-sticky)" />
        <path d="M64 84V66h18z" fill="#eacd7e" />
        <path
          d="M30 44l9 9 18-19"
          fill="none"
          stroke="#7a9b5e"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </Prop>
  );
}

/** Every object around the drop zone, back to front. */
export function HeroProps() {
  return (
    <div className="hero-props" aria-hidden>
      <PaperPlane />
      <Clock />
      <Notebook />
      <Desk />
      <Pencil />
      <StickyNote />
      <Laptop />
      <Coffee />
      <Folder />
      <Envelope />
      <GraduationCap />
      <Plant />
    </div>
  );
}

/** The handwritten note and its looped dashed arrow, pointing at the drop zone. */
export function DropCue() {
  return (
    <div className="drop-cue" aria-hidden>
      <span className="drop-cue-label">dépose ton CV</span>
      <svg className="drop-cue-arrow" viewBox="0 0 230 170" focusable="false" aria-hidden>
        <path
          className="drop-cue-line"
          d="M214 24C170 6 128 18 118 48c-8 24 18 38 32 24 12-14-8-30-34-20C86 64 64 102 56 146"
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          className="drop-cue-head"
          d="M44 126 L57 149 L70 133"
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
