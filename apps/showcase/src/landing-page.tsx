import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '../../../packages/react/src/brand-mark';
import ribbonArtwork from './assets/chrome-ribbon.webp';
import { EditingDemo } from './editing-demo';

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h15m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Pointer() {
  return <svg viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="M3 2.5 20.5 18l-8.1 1.1L8 26 3 2.5Z" fill="currentColor" stroke="#fff" strokeWidth="1.5" /></svg>;
}

function Wordmark({ footer = false }: { footer?: boolean }) {
  return <a className={`wordmark${footer ? ' wordmark--footer' : ''}`} href="#top" aria-label="Visual HTML home"><BrandMark /><span>visual<span className="wordmark__html">html</span><sup>↗</sup></span></a>;
}

export function LandingPage() {
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const heroRef = useRef<HTMLElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);


  useEffect(() => () => clearTimeout(copyTimer.current), []);

  async function copyInstall() {
    try {
      await navigator.clipboard.writeText('pnpm install && pnpm dev');
      setCopied(true);
      setCopyMessage('Setup command copied.');
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => { setCopied(false); setCopyMessage(''); }, 2400);
    } catch {
      setCopyMessage('Select the command to copy it.');
    }
  }

  return (
    <div className="landing-page">
      <a className="skip-link" href="#top">Skip to content</a>
      <div className="landing-opening">
        <header className="landing-nav">
          <Wordmark />
          <nav aria-label="Main navigation">
            <a href="#playground">The canvas</a>
            <a href="#principles">The philosophy</a>
            <a href="#developers">For developers <span className="nav-code" aria-hidden="true">&lt;/&gt;</span></a>
          </nav>
          <a className="nav-open" href="#/editor">Open editor <Arrow diagonal /></a>
        </header>

        <main id="top">
          <section className="landing-hero" ref={heroRef} onPointerMove={(event) => {
            if (event.pointerType !== 'mouse') return;
            const bounds = event.currentTarget.getBoundingClientRect();
            event.currentTarget.style.setProperty('--art-x', `${(event.clientX - bounds.left - bounds.width / 2) / 70}px`);
            event.currentTarget.style.setProperty('--art-y', `${(event.clientY - bounds.top - bounds.height / 2) / 70}px`);
          }} onPointerLeave={() => {
            heroRef.current?.style.setProperty('--art-x', '0px');
            heroRef.current?.style.setProperty('--art-y', '0px');
          }}>
            <div className="hero-art" aria-hidden="true"><img src={ribbonArtwork} width="1536" height="1024" alt="" fetchPriority="high" /></div>
            <div className="hero-art-label" aria-hidden="true"><span className="crosshair">+</span><span>FORM WITHOUT LIMITS<br /><small>V / 001 — THE POSSIBILITIES ARE OPEN.</small></span></div>
            <div className="landing-hero__copy">
              <p className="eyebrow hero-eyebrow"><span className="live-dot" /> THE SOURCE IS YOURS. SO IS THE POSSIBILITY.</p>
              <h1>Make HTML<br /><em>feel alive.</em><span className="hero-period" aria-hidden="true">✳</span></h1>
              <p className="landing-hero__lede">Step out of the code. Into your creative element.<br />A visual playground for emails, slides, and the web.</p>
              <div className="landing-hero__actions"><a className="button-light" href="#/editor">Start editing <Arrow diagonal /></a><a className="hero-explore" href="#playground"><span className="play-icon" aria-hidden="true">▷</span> Watch it in motion</a></div>
              <div className="hero-fineprint"><span>No sign-up. Just start.</span><span className="fineprint-line" /><span>Free & open source</span></div>
            </div>
            <div className="hero-bottom"><span>BUILT FOR THE WAY YOU CREATE.</span><div><span>HTML, with a human touch.</span><a href="#playground" aria-label="Explore the canvas below">↓</a></div></div>
          </section>

          <section className="format-strip" aria-label="Supported formats"><span>ONE EDITOR.<br /><b>ENDLESS EXPRESSIONS.</b></span><div><span className="format-strip__icon" aria-hidden="true">↗</span>Emails that connect.</div><div><span className="format-strip__icon" aria-hidden="true">▧</span>Slides that resonate.</div><div><span className="format-strip__icon" aria-hidden="true">⌘</span>Websites with character.</div></section>

          <section className="landing-demo section-wrap" id="playground">
            <div className="section-heading"><div><p className="eyebrow"><span className="section-index">01 /</span> THE CREATIVE WORKSPACE</p><h2>A familiar canvas.<br /><em>An unfamiliar freedom.</em></h2></div><p>Click the thing you want to change.<br />Then make it yours. It really is that direct.</p></div>
            <EditingDemo />
            <div className="landing-demo__caption"><span><span className="caption-cross" aria-hidden="true">✳</span> What you see is what you shape.</span><a href="#/editor">Take it for a spin <Arrow /></a></div>
          </section>

          <section className="landing-principles section-wrap" id="principles">
            <div className="section-heading"><div><p className="eyebrow"><span className="section-index">02 /</span> LESS BETWEEN YOU AND YOUR IDEAS</p><h2>Designed to get<br /><em>out of your way.</em></h2></div><p>Powerful where it matters.<br />Quiet everywhere else.</p></div>
            <div className="principles-grid">
              <article className="principle-card principle-card--direct"><div className="principle-art direct-art" aria-hidden="true"><span className="direct-art__text">Make it <em>yours.</em><i /><i /><i /><i /></span><span className="direct-art__cursor"><Pointer /><b>You</b></span><span className="direct-art__tag">font-style: inspired;</span></div><div className="principle-card__copy"><span>01 — DIRECT BY DESIGN</span><h3>A little click. A big difference.</h3><p>Edit right where your content lives. Refine type, color, and spacing without losing the bigger picture.</p></div></article>
              <article className="principle-card principle-card--source"><div className="principle-art source-art" aria-hidden="true"><div className="source-art__header"><span /> YOUR ORIGINAL HTML <b>✓</b></div><code><span>&lt;section</span> class=<i>"your-ideas"</i><span>&gt;</span><br />&nbsp; <span>&lt;h1&gt;</span>Unmistakably you.<span>&lt;/h1&gt;</span><br />&nbsp; <span>&lt;p&gt;</span>Every detail, preserved.<span>&lt;/p&gt;</span><br /><span>&lt;/section&gt;</span></code><div className="source-art__badge">✓ &nbsp; Clean source. Always.</div></div><div className="principle-card__copy"><span>02 — THE SOURCE STAYS YOURS</span><h3>All the expression. Clean HTML.</h3><p>Your original source stays in charge. Make visual changes and export without carrying editor markup along.</p></div></article>
              <article className="principle-card principle-card--control"><div className="principle-art control-art" aria-hidden="true"><div><span>Text & typography</span><b className="fake-toggle" /></div><div><span>Colors & spacing</span><b className="fake-toggle" /></div><div><span>Source editing</span><b className="fake-toggle fake-toggle--off" /></div><small>YOUR WORKSPACE. YOUR PARAMETERS.</small></div><div className="principle-card__copy"><span>03 — FREEDOM WITH INTENTION</span><h3>Your canvas. Your ground rules.</h3><p>Define what can change with editing profiles. Give your users creative room and the boundaries they need.</p></div></article>
            </div>
          </section>

          <section className="developer-section section-wrap" id="developers"><div><p className="eyebrow"><span className="section-index">03 /</span> MADE TO MAKE IT YOURS</p><h2>Your next feature.<br /><em>Already taking shape.</em></h2><p>Bring visual editing into your own product.<br />A React workspace. A framework-neutral core.<br />Your imagination from there.</p><div className="developer-tags"><span>React</span><span>TypeScript</span><span>MIT licensed</span></div></div><div className="install-card"><div className="install-card__header"><span>↳ &nbsp; START THE LOCAL WORKSPACE</span><span>01</span></div><div className="install-command"><span>$</span><code>pnpm install && pnpm dev</code><button type="button" onClick={copyInstall} aria-label={copied ? 'Copied setup command' : 'Copy setup command'} title="Copy setup command">{copied ? '✓' : '⧉'}</button></div><p className="install-feedback" role="status">{copyMessage}</p><div className="install-code"><code><span>import</span> {'{ HtmlEditor }'} <span>from</span><br /><i>'@visual-html/react'</i>;<br /><br /><span>&lt;HtmlEditor</span><br />&nbsp; value={'{yourHtml}'}<br />&nbsp; profile={'{yourProfile}'}<br />&nbsp; onChange={'{handleChange}'}<br /><span>/&gt;</span></code></div><div className="install-card__footer"><span className="live-dot" /> YOUR APP. A WHOLE NEW DIMENSION.</div></div></section>

          <section className="landing-closing"><div className="closing-orbit" aria-hidden="true" /><p className="eyebrow">A BLANK CANVAS IS A BEAUTIFUL BEGINNING.</p><h2>What will you<br /><em>make of it?</em></h2><a className="button-light" href="#/editor">Make something yours <Arrow diagonal /></a><span className="closing-footnote">NO SIGN-UP. NO LIMITS ON YOUR IMAGINATION.</span></section>
        </main>
        <footer className="landing-footer section-wrap"><div className="footer-top"><Wordmark footer /><span>Code is the beginning.<br /><em>Creation is the point.</em></span><a href="#top">Back to the top <Arrow diagonal /></a></div><div className="footer-bottom"><span>INDEPENDENT TOOLS FOR INDEPENDENT MINDS.</span><a href="https://opensource.org/license/mit" target="_blank" rel="noreferrer">OPEN SOURCE · MIT LICENSE ↗</a><span>© 2026 VISUAL HTML</span></div></footer>
      </div>
    </div>
  );
}




