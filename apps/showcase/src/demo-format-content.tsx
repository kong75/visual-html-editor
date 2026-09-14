import type { CSSProperties } from 'react';
import { BrandMark } from '../../../packages/react/src/brand-mark';
import './demo-format-content.css';

export interface FormatFrame {
  text: string; selected: boolean; editing: boolean; section: boolean;
  slideX: number; slideY: number; cardWidth: number; cardHeight: number;
  size: number; color: string; narrow: boolean;
}

function Selection({ label }: { label: string }) {
  return <div className="edit-selection"><i /><i /><i /><i /><b>{label}</b></div>;
}

export function SlideDemoDocument({ frame, time }: { frame: FormatFrame; time: number }) {
  return <div className="demo-deck">
    <div className="demo-deck-label"><span>VISUAL HTML / QUICKSTART</span><b>1600 × 900</b></div>
    <article className="edit-document demo-slide" data-serif="false">
      <div className="demo-slide-orb" />
      <div className={`demo-slide-heading edit-heading ${frame.selected && !frame.section ? 'is-selected' : ''}`} data-cursor="headline" style={{ left: `${frame.slideX / 16}%`, top: `${frame.slideY / 9}%` }}>
        <span className="demo-slide-kicker">01 / A MORE VISUAL WORKFLOW</span>
        <h3><span>Start with HTML.</span><span className={time >= 2.1 && time < 2.7 ? 'is-text-selected' : ''}>{frame.text}{frame.editing && time >= 2.7 && <i className="edit-caret" />}</span></h3>
        <p>Select. Shape. Export.</p>
        <Selection label={time >= 5.5 && time < 14.5 ? `X ${frame.slideX} · Y ${frame.slideY}` : 'Headline'} />
      </div>
      {time >= 7 && time < 10.5 && <div className="demo-slide-guide" style={{ left: `${frame.slideX / 16}%` }}><span>{frame.slideX} px</span></div>}
      <div className={`demo-slide-card ${frame.section ? 'is-selected' : ''}`} style={{ width: `${frame.cardWidth / 16}%`, height: `${frame.cardHeight / 9}%` }}>
        <span>YOUR SOURCE</span><strong>&lt;/&gt; <i>↗</i></strong><small>YOUR CANVAS</small>
        <Selection label={`${frame.cardWidth} × ${frame.cardHeight}`} /><i className="demo-slide-resize" data-cursor="resize-handle" />
      </div>
      <div className="demo-slide-footer"><span><BrandMark /> visualhtml</span><span>01 / 03</span></div>
    </article>
    <div className="demo-filmstrip"><div className="is-active"><b>01</b><span>Make it visual.</span></div><div><b>02</b><span>Shape the details.</span></div><div><b>03</b><span>Keep your source.</span></div></div>
    <div className="demo-deck-caption">Fixed canvas <span>•</span> Drag to position <span>•</span> Pull a handle to resize</div>
  </div>;
}

export function WebDemoDocument({ frame, time }: { frame: FormatFrame; time: number }) {
  const p = Math.max(0, Math.min(1, (time - 15.7) / .8));
  const progress = p * p * (3 - 2 * p);
  return <div className="demo-web-preview">
    <div className="demo-web-viewports"><span>RESPONSIVE PREVIEW</span><div><span className={!frame.narrow ? 'is-active' : ''}>▱ Desktop</span><span className={frame.narrow ? 'is-active' : ''} data-cursor="mobile-viewport">▯ Mobile</span></div><b>{Math.round(1200 - 810 * progress)} px</b></div>
    <article className={`edit-document demo-web ${time >= 16.1 ? 'is-narrow' : ''}`} data-serif="false" style={{ width: `${100 - progress * 15}%`, maxWidth: `${680 - progress * 360}px`, '--web-button': frame.color, '--web-radius': `${frame.size}px` } as CSSProperties}>
      <div className="demo-web-nav"><strong><BrandMark /> visualhtml</strong><span>Workspace <i>↗</i></span></div>
      <div className="demo-web-hero">
        <div className="demo-web-copy"><span>YOUR CONTENT. YOUR CANVAS.</span><h3>Your HTML.<br /><em>Your creative space.</em></h3><p>Build emails, slides, and pages in one visual workspace. Keep every detail of your source.</p>
          <div className={`demo-web-cta edit-heading ${frame.selected && !frame.section ? 'is-selected' : ''}`} data-cursor="web-cta"><span className={time >= 2.1 && time < 2.7 ? 'is-text-selected' : ''}>{frame.text}{frame.editing && time >= 2.7 && <i className="edit-caret" />}</span><b>↗</b><Selection label={frame.editing ? 'Editing button text' : 'a · Open workspace'} /></div>
          <small>No sign-up. Bring your ideas.</small>
        </div>
        <aside className="demo-web-card"><span>BUILT AROUND YOUR HTML</span><div className="demo-web-card-icon">&lt;/&gt;</div><h4>One workspace.<br />Every format.</h4><p>Email · Slides · Web</p><div><span>Source preserved</span><b>✓</b></div></aside>
      </div>
      <div className="demo-web-features"><div><span>01 /</span><h4>Select anything.</h4><p>Work right on your canvas.</p></div><div><span>02 /</span><h4>Shape the details.</h4><p>Type, color, and spacing.</p></div><div><span>03 /</span><h4>Keep your HTML.</h4><p>Your source stays yours.</p></div></div>
      <footer>VISUAL HTML <span>MADE FOR YOUR NEXT IDEA.</span></footer>
    </article>
  </div>;
}

export function FormatSource({ format, frame }: { format: 'slides' | 'web'; frame: FormatFrame }) {
  const lines = format === 'slides' ? [
    '<main class="slide">', '  <h1 style="position: absolute;', `    left: ${frame.slideX}px;`, `    top: ${frame.slideY}px;">`,
    '    Start with HTML.<br />', `    ${frame.text}`, '  </h1>', '  <aside class="source-card"',
    '    style="left: 1008px; top: 500px;', `           width: ${frame.cardWidth}px;`, `           height: ${frame.cardHeight}px;">`, '    Your source. Your canvas.', '  </aside>', '</main>'
  ] : [
    '<a href="#/editor" style="', `  background: ${frame.color};`, `  border-radius: ${frame.size}px;">`, `  ${frame.text}`, '</a>', '',
    '.hero {', '  display: grid;', '  grid-template-columns: 1.3fr 1fr;', '}', '@media (max-width: 600px) {', '  .hero { grid-template-columns: 1fr; }', '}'
  ];
  return <>{lines.map((line, i) => <div
    // biome-ignore lint/suspicious/noArrayIndexKey: These static source rows never reorder or retain component state.
    key={i}
    className={format === 'slides' ? [2, 3, 5, 9, 10].includes(i) ? 'is-changed' : '' : [1, 2, 3, 11].includes(i) ? 'is-changed' : ''}
  >{line || ' '}</div>)}</>;
}
