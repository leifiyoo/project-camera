import { BrandMark } from '@/components/ui/brand-mark';
import { site } from '@/lib/site';
import { CopyLinkButton } from './CopyLinkButton';
import { faq, features, steps } from './content';
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
      <h1 id="landing-title">Turn screenshots into 3D mockups and product shots</h1>
      <p className="landing-lead">
        {site.name} is a free mockup generator that runs in your browser. Frame a screenshot or
        product photo with a real 3D camera, add depth blur, a shadow and a background, and export a
        polished PNG up to 4K.
      </p>
      <div className="landing-desktop">
        <p>
          The studio is made for a larger screen, a mouse and a keyboard. Open this page on your
          computer to start editing.
        </p>
        <CopyLinkButton />
      </div>
      <section aria-labelledby="landing-features">
        <h2 id="landing-features">Everything a product shot needs</h2>
        <ul className="landing-features">
          {features.map((f) => (
            <li key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </li>
          ))}
        </ul>
      </section>
      {/* Below the fold and lazy, so the headline stays the first big paint and wide
          screens, which never show this page, never fetch it. */}
      <img
        className="landing-shot"
        src={showcase.src}
        width={showcase.width}
        height={showcase.height}
        alt="The Project Camera editor showing a web page in 3D perspective with depth blur, next to its focus, camera and background settings"
        loading="lazy"
        decoding="async"
      />
      <section aria-labelledby="landing-steps">
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
      <section aria-labelledby="landing-privacy">
        <h2 id="landing-privacy">Your images stay on your device</h2>
        <p>
          {site.name} runs entirely in your browser. Your images and projects are never uploaded:
          projects are stored in your browser, and every export is rendered on your own computer.
          There is no account to create and no watermark on your images.
        </p>
      </section>
      <section aria-labelledby="landing-faq">
        <h2 id="landing-faq">Frequently asked questions</h2>
        <div className="landing-faq">
          {faq.map((item) => (
            <div key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </div>
          ))}
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      </section>
      <footer className="landing-footer">
        <p>
          {site.name} is open source. <a href={site.repository}>View the code on GitHub</a>
        </p>
      </footer>
    </section>
  );
}
