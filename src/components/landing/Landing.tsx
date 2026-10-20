import { BrandMark } from '@/components/ui/brand-mark';
import { site } from '@/lib/site';
import { AsciiCamera } from './AsciiCamera';
import { CopyLinkButton } from './CopyLinkButton';
import { facts, faq, features, steps } from './content';
import showcase from './showcase.webp';

// FAQPage data mirrors the visible questions. `<` is escaped so the JSON can never close the tag.
const faqJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
}).replace(/</g, '\\u003c');

const BANNER = String.raw`
 ██████╗ █████╗ ███╗   ███╗███████╗██████╗  █████╗
██╔════╝██╔══██╗████╗ ████║██╔════╝██╔══██╗██╔══██╗
██║     ███████║██╔████╔██║█████╗  ██████╔╝███████║
██║     ██╔══██║██║╚██╔╝██║██╔══╝  ██╔══██╗██╔══██║
╚██████╗██║  ██║██║ ╚═╝ ██║███████╗██║  ██║██║  ██║
 ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝`.slice(1);

const LOCK = String.raw`
   .-----.
  / .---. \
  | |   | |
 _| |___| |_
|  _______  |
| |  ___  | |
| | [___] | |
| |_______| |
|___________|`.slice(1);

/**
 * What Project Camera is and how it works. Screens narrower than the studio show this page
 * instead of the editor; it is also the page search engines index, since they read the phone
 * layout.
 */
export default function Landing() {
  return (
    <section className="landing" aria-labelledby="landing-title">
      <header className="lp-top">
        <span>
          <BrandMark size={14} />
          {site.name}
        </span>
        <a href={site.repository}>source ↗</a>
      </header>

      <pre className="lp-banner" aria-hidden="true">
        {BANNER}
      </pre>
      <h1 id="landing-title">
        Turn screenshots into <mark>3D mockups</mark> and product shots
      </h1>
      <p className="lp-lead">
        {site.name} is a free mockup generator that runs in your browser: point a real 3D camera at
        a screenshot or product photo, add depth blur, a shadow and a background, and export a PNG
        up to 4K.
      </p>
      <ul className="lp-facts">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>

      <AsciiCamera />

      <div className="lp-desktop">
        <p>
          <strong>Made for a big screen.</strong> The studio needs a mouse and a keyboard. Open this
          page on your computer to start editing.
        </p>
        <CopyLinkButton />
      </div>

      <section aria-labelledby="landing-features">
        <p className="lp-kicker">01 / features</p>
        <h2 id="landing-features">Everything a product shot needs</h2>
        <ul className="lp-features">
          {features.map(({ title, text }, i) => (
            <li key={title}>
              <h3>
                <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                {title}
              </h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="landing-steps">
        <p className="lp-kicker">02 / how it works</p>
        <h2 id="landing-steps">How to make a 3D screenshot mockup</h2>
        <ol className="lp-steps">
          {steps.map((s) => (
            <li key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
        {/* Lazy and far enough down that phones fetch it only on the way there, after the first
            paint; wide screens, which never show this page, never fetch it. */}
        <figure className="lp-shot">
          <img
            src={showcase.src}
            width={showcase.width}
            height={showcase.height}
            alt="The Project Camera editor showing a web page in 3D perspective with depth blur, next to its focus, camera and background settings"
            loading="lazy"
            decoding="async"
          />
          <figcaption>fig. 01: the studio, on a computer</figcaption>
        </figure>
      </section>

      <section className="lp-privacy" aria-labelledby="landing-privacy">
        <pre aria-hidden="true">{LOCK}</pre>
        <div>
          <p className="lp-kicker">03 / privacy</p>
          <h2 id="landing-privacy">Your images stay on your device</h2>
          <p>
            {site.name} runs entirely in your browser. Images and projects are never uploaded, every
            export is rendered on your own computer, and there is no account and no watermark.
          </p>
        </div>
      </section>

      <section aria-labelledby="landing-faq">
        <p className="lp-kicker">04 / faq</p>
        <h2 id="landing-faq">Frequently asked questions</h2>
        <div className="lp-faq">
          {faq.map((item) => (
            <details key={item.question}>
              <summary>
                <h3>{item.question}</h3>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      </section>

      <footer className="lp-footer">
        <p>
          {site.name} is open source. <a href={site.repository}>View the code on GitHub ↗</a>
        </p>
        <p aria-hidden="true">GPL-3.0 · no account · no uploads · EOF</p>
      </footer>
    </section>
  );
}
