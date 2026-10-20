import { IconDeviceDesktop, IconShieldLock } from '@tabler/icons-react';
import { BrandMark } from '@/components/ui/brand-mark';
import { site } from '@/lib/site';
import { CopyLinkButton } from './CopyLinkButton';
import { facts, faq, features, steps } from './content';
import { HeroShot } from './HeroShot';
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

/**
 * What Project Camera is and how it works. Screens narrower than the studio show this page
 * instead of the editor; it is also the page search engines index, since they read the phone
 * layout.
 */
export default function Landing() {
  return (
    <section className="landing" aria-labelledby="landing-title">
      <p className="landing-brand">
        <span className="studio-mark" aria-hidden="true">
          <BrandMark size={15} />
        </span>
        {site.name}
      </p>
      <h1 id="landing-title">
        Turn screenshots into 3D mockups <span>and product shots</span>
      </h1>
      <p className="landing-lead">
        {site.name} is a free mockup generator that runs in your browser. Frame a screenshot or
        product photo with a real 3D camera, add depth blur, a shadow and a background, and export a
        polished PNG up to 4K.
      </p>
      <ul className="landing-facts">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <div className="landing-desktop">
        <IconDeviceDesktop className="landing-icon" size={20} stroke={1.75} aria-hidden="true" />
        <p>
          The studio is made for a larger screen, a mouse and a keyboard. Open this page on your
          computer to start editing.
        </p>
        <CopyLinkButton />
      </div>
      <HeroShot />
      <section aria-labelledby="landing-features">
        <p className="landing-kicker">Features</p>
        <h2 id="landing-features">Everything a product shot needs</h2>
        <ul className="landing-features">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon className="landing-icon" size={20} stroke={1.75} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="landing-steps">
        <p className="landing-kicker">How it works</p>
        <h2 id="landing-steps">How to make a 3D screenshot mockup</h2>
        <ol className="landing-steps">
          {steps.map((s) => (
            <li key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
      {/* Lazy and far enough down that phones fetch it only on the way there, after the first
          paint; wide screens, which never show this page, never fetch it. */}
      <div className="landing-shot">
        <img
          src={showcase.src}
          width={showcase.width}
          height={showcase.height}
          alt="The Project Camera editor showing a web page in 3D perspective with depth blur, next to its focus, camera and background settings"
          loading="lazy"
          decoding="async"
        />
      </div>
      <section className="landing-privacy" aria-labelledby="landing-privacy">
        <IconShieldLock className="landing-icon" size={20} stroke={1.75} aria-hidden="true" />
        <h2 id="landing-privacy">Your images stay on your device</h2>
        <p>
          {site.name} runs entirely in your browser. Your images and projects are never uploaded:
          projects are stored in your browser, and every export is rendered on your own computer.
          There is no account to create and no watermark on your images.
        </p>
      </section>
      <section aria-labelledby="landing-faq">
        <p className="landing-kicker">Good to know</p>
        <h2 id="landing-faq">Frequently asked questions</h2>
        <div className="landing-faq">
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
      <footer className="landing-footer">
        <span className="studio-mark" aria-hidden="true">
          <BrandMark size={13} />
        </span>
        <p>
          {site.name} is open source. <a href={site.repository}>View the code on GitHub</a>
        </p>
      </footer>
    </section>
  );
}
