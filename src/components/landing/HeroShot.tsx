/**
 * The hero picture, drawn instead of loaded so the headline stays the first big paint: a page
 * tilted like the logo's screen, sharp at its focus point and softening toward the far edge.
 */
export function HeroShot() {
  return (
    <div className="landing-stage" aria-hidden="true">
      <div className="landing-screen">
        <svg viewBox="0 0 320 200">
          <defs>
            <linearGradient id="landing-band" x2="1" y2="1">
              <stop className="lp-band-a" />
              <stop className="lp-band-b" offset="1" />
            </linearGradient>
            <g id="landing-page">
              <rect className="lp-page" width="320" height="200" />
              <rect className="lp-soft" width="320" height="22" />
              <circle className="lp-line" cx="13" cy="11" r="3" />
              <circle className="lp-line" cx="23" cy="11" r="3" />
              <circle className="lp-line" cx="33" cy="11" r="3" />
              <rect className="lp-page" x="110" y="6" width="100" height="10" rx="5" />
              <rect fill="url(#landing-band)" x="14" y="34" width="292" height="88" rx="8" />
              <circle className="lp-glow" cx="66" cy="78" r="26" />
              <rect className="lp-ink" x="112" y="56" width="128" height="11" rx="5.5" />
              <rect className="lp-ink" x="112" y="73" width="92" height="11" rx="5.5" />
              <rect className="lp-glow" x="112" y="93" width="150" height="5" rx="2.5" />
              <rect className="lp-soft" x="14" y="134" width="90" height="52" rx="6" />
              <rect className="lp-soft" x="115" y="134" width="90" height="52" rx="6" />
              <rect className="lp-soft" x="216" y="134" width="90" height="52" rx="6" />
              <rect className="lp-line" x="24" y="166" width="54" height="5" rx="2.5" />
              <rect className="lp-line" x="125" y="166" width="62" height="5" rx="2.5" />
              <rect className="lp-line" x="226" y="166" width="48" height="5" rx="2.5" />
            </g>
            <filter id="landing-blur">
              <feGaussianBlur stdDeviation="3.2" />
            </filter>
            <linearGradient id="landing-falloff">
              <stop offset="0.36" stopColor="#000" />
              <stop offset="0.9" stopColor="#fff" />
            </linearGradient>
            <mask id="landing-far">
              <rect width="320" height="200" fill="url(#landing-falloff)" />
            </mask>
          </defs>
          <use href="#landing-page" />
          <use href="#landing-page" filter="url(#landing-blur)" mask="url(#landing-far)" />
          <g className="landing-focus">
            <circle cx="66" cy="78" r="12" />
            <path d="M66 61v5M66 90v5M49 78h5M78 78h5" />
            <circle cx="66" cy="78" r="2.5" />
          </g>
        </svg>
      </div>
    </div>
  );
}
