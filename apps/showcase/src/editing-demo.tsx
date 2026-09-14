import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BrandMark } from '../../../packages/react/src/brand-mark';
import ribbonArtwork from './assets/chrome-ribbon.webp';
import './editing-demo.css';
import { SlideDemoDocument, WebDemoDocument, FormatSource } from './demo-format-content';

const DURATION = 27;
const emailChapters = [
  { title: 'Make it say you.', label: 'Rewrite', description: 'Edit the words, right on the canvas.', start: 0, still: 5 },
  { title: 'Find your character.', label: 'Restyle', description: 'A new typeface. A whole new feeling.', start: 5.5, still: 14 },
  { title: 'A little breathing room.', label: 'Refine', description: 'Fine-tune the space. See the difference.', start: 14.5, still: 18 },
  { title: 'Beautiful. Inside and out.', label: 'HTML', description: 'Your visual changes, reflected in the source.', start: 18.5, still: 22 }
];

const examples = {
  email: { label: 'Email templates', file: 'welcome-email.html', tag: 'WELCOME TO YOUR CREATIVE WORKSPACE', first: 'Meet your new', before: 'HTML editor.', after: 'creative space.', copy: 'Your first canvas is ready. Bring your HTML, refine every detail, and make it your own.', action: 'Open your workspace', paper: '#f9f5ee', accent: '#7851a9', initial: '#302735', number: '01' },
  slides: { label: 'Learning slides', file: 'visual-editing-deck.html', tag: 'VISUAL HTML / THE QUICKSTART', first: 'Start with HTML.', before: 'Make a change.', after: 'Make it visual.', copy: 'Select. Shape. Export.', action: 'SOURCE → CANVAS', paper: '#17151f', accent: '#b8aaff', initial: '#f6f3ff', number: '02' },
  web: { label: 'Web content', file: 'editor-workspace.html', tag: 'YOUR CONTENT. YOUR CANVAS.', first: 'Your HTML.', before: 'Learn more', after: 'Open the playground', copy: 'Build emails, slides, and pages in one visual workspace. Keep every detail of your source.', action: 'Open the playground', paper: '#f7f8f3', accent: '#24523b', initial: '#302735', number: '03' }
};
type Format = keyof typeof examples;
const chaptersByFormat = {
  email: emailChapters,
  slides: [
    { title: 'Give your idea a headline.', label: 'Rewrite', description: 'Edit a presentation directly on its canvas.', start: 0, still: 5 },
    { title: 'Put it in its place.', label: 'Move', description: 'Drag the headline. Watch its position update.', start: 5.5, still: 14 },
    { title: 'Give the visual more space.', label: 'Resize', description: 'Pull the corner handle to resize the card.', start: 14.5, still: 18 },
    { title: 'A slide you can keep editing.', label: 'HTML', description: 'Text, positions, and dimensions stay in HTML.', start: 18.5, still: 22 }
  ],
  web: [
    { title: 'Make the next step clear.', label: 'CTA', description: 'Rewrite the button where visitors will see it.', start: 0, still: 5 },
    { title: 'Make the action stand out.', label: 'Style', description: 'Refine the button’s corners and background.', start: 5.5, still: 14 },
    { title: 'One page. Every screen.', label: 'Reflow', description: 'Preview a narrow viewport. Watch the layout adapt.', start: 14.5, still: 18 },
    { title: 'Responsive by design.', label: 'HTML', description: 'Keep your button styles and responsive CSS.', start: 18.5, still: 22 }
  ]
};
type IconName = 'play' | 'pause' | 'replay' | 'arrow' | 'code' | 'check' | 'pointer';
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = { play: 'm8 5 11 7-11 7Z', pause: 'M8 5v14M16 5v14', replay: 'M4 10a8 8 0 1 1 1 8M4 4v6h6', arrow: 'M5 19 19 5M5 5h14v14', code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18', check: 'm5 12 4 4 10-10', pointer: 'm4 2 16 14-8 1-4 7Z' };
  return <svg viewBox="0 0 24 24" fill={name === 'play' || name === 'pointer' ? 'currentColor' : 'none'} aria-hidden="true"><path d={paths[name]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const reveal = (time: number, start: number, end = Infinity): CSSProperties => {
  const amount = Math.min(ease((time - start) / .22), ease((end - time) / .18));
  return { opacity: amount, transform: `translateY(${(1 - amount) * 8}px)` };
};

function hsvFromHex(hex: string) {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const hue = delta === 0 ? 0 : max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: (hue * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

function hexFromHsv(h: number, s: number, v: number) {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}

// The production inspector commits typed CSS values on Enter/blur.
function numberEdit(time: number, start: number, before: number, after: number) {
  const age = time - start;
  const committed = age >= 1.65;
  return {
    value: committed ? after : before,
    draft: age < .65 ? `${before}px` : age < .9 ? String(after)[0] : age < 1.15 ? String(after) : age < 1.3 ? `${after}p` : `${after}px`,
    active: age >= 0 && age < 2.3,
    selected: age >= .15 && age < .65,
    typing: age >= .65 && age < 1.65,
    committed
  };
}

function NumberDemo({ label, target, edit, time }: { label: string; target: string; edit: ReturnType<typeof numberEdit>; time: number }) {
  return <div className={`edit-field edit-field--number ${target === 'padding' ? 'edit-field--padding' : ''} ${edit.active ? 'is-focused' : ''}`} data-cursor={target}>
    <small>{label}</small>
    <strong><span className={`edit-number-value ${edit.selected ? 'is-selected' : ''}`}>{edit.active ? edit.draft : `${edit.value}px`}{edit.typing && <i className="edit-number-caret" style={{ opacity: Math.floor(time * 3) % 2 ? 0 : 1 }} />}</span></strong>
    {edit.active && <div className="edit-input-hint">{edit.committed ? <><Icon name="check" /> Applied</> : edit.selected ? <><kbd>Ctrl</kbd><kbd>A</kbd> Select value</> : edit.typing ? <><kbd>↵</kbd> Enter to apply</> : 'Click to edit'}</div>}
  </div>;
}

// One seekable clock owns every edit, highlight, keystroke, and cursor gesture.
// State is derived from time so replay and chapter navigation cannot drift.
function frameAt(time: number, format: Format) {
  const example = examples[format];
  const serif = format === 'email' && time >= 7.2;
  const sizeEdit = numberEdit(time, 8.6, format === 'web' ? 4 : 36, format === 'web' ? 12 : 56);
  const paddingEdit = numberEdit(time, 15.6, 22, 38);
  const from = hsvFromHex(example.initial), to = hsvFromHex(example.accent);
  const hueProgress = ease((time - 12.2) / .35), colorProgress = ease((time - 12.75) / .6);
  const hsv = { h: from.h + (to.h - from.h) * hueProgress, s: from.s + (to.s - from.s) * colorProgress, v: from.v + (to.v - from.v) * colorProgress };
  const typed = time < 2.7 ? example.before : example.after.slice(0, Math.floor(clamp((time - 2.7) / 1.8) * example.after.length));
  return { serif, size: sizeEdit.value, padding: paddingEdit.value, sizeEdit, paddingEdit, hsv, text: typed, color: hexFromHsv(hsv.h, hsv.s, hsv.v), selected: time >= 1.3 && time < 23.5, editing: time >= 2.1 && time < 4.9, code: time >= 19.1 && time < 23.5, section: time >= 14.9 && time < 18.5, fontMenu: format === 'email' && time >= 6.4 && time < 7.6, colorMenu: format !== 'slides' && time >= 11.9 && time < 14.2, slideX: 96 + Math.round(48 * ease((time - 7) / 2.3)), slideY: 145 + Math.round(60 * ease((time - 7) / 2.3)), cardWidth: 340 + Math.round(130 * ease((time - 15.6) / 1.7)), cardHeight: 220 + Math.round(70 * ease((time - 15.6) / 1.7)), narrow: time >= 15.7 };
}

// Cursor keyframes target the actual responsive layout, including the mobile inspector.
const cursorKeys = [
  { t: 0, target: 'canvas', x: .68, y: .75 },
  { t: .45, target: 'canvas', x: .68, y: .75 },
  { t: 1.3, target: 'headline', x: .55, y: .7 },
  { t: 4.9, target: 'headline', x: .55, y: .7 },
  { t: 6.25, target: 'font', x: .55, y: .6 },
  { t: 6.55, target: 'font', x: .55, y: .6 },
  { t: 7.1, target: 'font-option', x: .5, y: .5 },
  { t: 7.55, target: 'font-option', x: .5, y: .5 },
  { t: 8.6, target: 'size', x: .5, y: .55 },
  { t: 10.7, target: 'size', x: .5, y: .55 },
  { t: 11.75, target: 'color', x: .55, y: .5 },
  { t: 12.2, target: 'hue', x: 0, y: .5 },
  { t: 12.55, target: 'hue', x: 1, y: .5 },
  { t: 12.75, target: 'spectrum', x: 0, y: 0 },
  { t: 13.35, target: 'spectrum', x: 1, y: 1 },
  { t: 13.95, target: 'spectrum', x: 1, y: 1 },
  { t: 14.85, target: 'section', x: .9, y: .9 },
  { t: 15.6, target: 'padding', x: .45, y: .5 },
  { t: 17.9, target: 'padding', x: .45, y: .5 },
  { t: 18.9, target: 'code', x: .5, y: .5 },
  { t: 22.7, target: 'code', x: .5, y: .5 },
  { t: 23.4, target: 'design', x: .5, y: .5 },
  { t: 24.3, target: 'canvas', x: .87, y: .78 },
  { t: DURATION, target: 'canvas', x: .87, y: .78 }
];
const clicks = [1.3, 2.1, 6.25, 7.1, 8.6, 11.75, 12.2, 12.75, 14.85, 15.6, 18.9, 23.4];
const slideCursorKeys = [...cursorKeys.filter(key => key.t <= 4.9),
  { t: 7, target: 'headline', x: .4, y: .5 }, { t: 9.3, target: 'headline', x: .4, y: .5 },
  { t: 10.8, target: 'headline', x: .4, y: .5 }, { t: 12, target: 'canvas', x: .8, y: .72 },
  { t: 15.6, target: 'resize-handle', x: .5, y: .5 }, { t: 17.3, target: 'resize-handle', x: .5, y: .5 },
  { t: 17.9, target: 'resize-handle', x: .5, y: .5 }, ...cursorKeys.filter(key => key.t >= 18.9)];
const webCursorKeys = [...cursorKeys.filter(key => key.t <= 4.9).map(key => key.target === 'headline' ? { ...key, target: 'web-cta' } : key),
  { t: 7.5, target: 'size', x: .5, y: .55 }, ...cursorKeys.filter(key => key.t >= 8.6 && key.t <= 13.95),
  { t: 15.7, target: 'mobile-viewport', x: .5, y: .5 }, { t: 17.9, target: 'mobile-viewport', x: .5, y: .5 }, ...cursorKeys.filter(key => key.t >= 18.9)];

export function EditingDemo() {
  const [format, setFormat] = useState<Format>('email');
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [time, setTime] = useState(() => reduced ? DURATION : 0);
  const [playing, setPlaying] = useState(() => !reduced);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [announcement, setAnnouncement] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const positionCursorRef = useRef<() => void>(() => {});
  const progressRef = useRef(time);
  const frame = frameAt(time, format);
  const example = examples[format];
  const chapters = chaptersByFormat[format];
  const activeCursorKeys = format === 'slides' ? slideCursorKeys : format === 'web' ? webCursorKeys : cursorKeys;
  const chapter = chapters.reduce((index, item, i) => time >= item.start ? i : index, 0);
  const complete = time >= DURATION;
  const running = playing && inView && visible && !complete;
  const font = frame.serif ? 'Instrument Serif' : 'Manrope';
  const dirty = format === 'slides' ? (time >= 2.7 && time < 4.8) || (time >= 7 && time < 9.6) || (time >= 15.6 && time < 17.6) : (time >= 2.7 && time < 4.8) || (time >= 7.2 && time < 7.8) || (time >= 10.25 && time < 10.8) || (time >= 12.2 && time < 13.7) || (format === 'email' && time >= 17.25 && time < 17.8);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => {
      setReduced(query.matches);
      if (query.matches) { setPlaying(false); progressRef.current = DURATION; setTime(DURATION); }
    };
    const onVisibility = () => setVisible(!document.hidden);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio >= .4), { threshold: .4 });
    if (stageRef.current) observer.observe(stageRef.current);
    query.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { observer.disconnect(); query.removeEventListener('change', onMotion); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  useEffect(() => {
    if (!running) return;
    let previous: number | undefined;
    let request = 0;
    const tick = (now: number) => {
      if (previous !== undefined) progressRef.current = Math.min(DURATION, progressRef.current + (now - previous) / 1000);
      previous = now;
      setTime(progressRef.current);
      if (progressRef.current < DURATION) request = requestAnimationFrame(tick);
      else { setPlaying(false); setAnnouncement('Demo complete. Replay a chapter or try the editor.'); }
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [running]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const cursor = cursorRef.current;
    if (!stage || !cursor) return;
    const place = () => {
      const bounds = stage.getBoundingClientRect();
      const next = activeCursorKeys.findIndex((key) => key.t > time);
      const from = activeCursorKeys[Math.max(0, next < 0 ? activeCursorKeys.length - 1 : next - 1)];
      const to = activeCursorKeys[next < 0 ? activeCursorKeys.length - 1 : next];
      const point = (key: typeof from) => {
        const element = stage.querySelector(`[data-cursor="${key.target}"]`);
        const fallback = stage.querySelector(`[data-cursor="${key.target === 'font-option' ? 'font' : 'color'}"]`);
        const rect = (element ?? fallback ?? stage).getBoundingClientRect();
        const initial = hsvFromHex(examples[format].initial), final = hsvFromHex(examples[format].accent);
        const color = key.x === 0 ? initial : final;
        const x = key.target === 'hue' ? color.h / 360 : key.target === 'spectrum' ? color.s : key.x;
        const y = key.target === 'spectrum' ? 1 - color.v : key.y;
        return { x: rect.left - bounds.left + rect.width * x, y: rect.top - bounds.top + rect.height * y };
      };
      const a = point(from), b = point(to);
      const ratio = from.t === to.t ? 1 : ease((time - from.t) / (to.t - from.t));
      cursor.style.transform = `translate3d(${a.x + (b.x - a.x) * ratio}px, ${a.y + (b.y - a.y) * ratio}px, 0)`;
    };
    positionCursorRef.current = place;
    place();
  }, [time, format]);

  useEffect(() => {
    const observer = new ResizeObserver(() => positionCursorRef.current());
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  function seek(value: number, play = playing) {
    progressRef.current = value;
    setTime(value);
    setPlaying(play);
    setAnnouncement('');
  }
  function chooseChapter(index: number) {
    const item = chapters[index];
    seek(reduced ? item.still : item.start, !reduced);
    setAnnouncement(`${item.label}: ${item.description}`);
  }

  const activeClicks = format === 'slides' ? [1.3, 2.1, 7, 15.6, 18.9, 23.4] : format === 'web' ? [1.3, 2.1, 8.6, 11.75, 12.2, 12.75, 15.7, 18.9, 23.4] : clicks;
  const clickAge = time - ([...activeClicks].reverse().find((at) => at <= time) ?? -1);
  const cursorHidden = reduced || time < .2 || (time > 2.2 && time < 4.8) || time > 25;
  const documentStyle = { '--demo-color': frame.color, '--demo-paper': example.paper, '--demo-size': `${frame.size}px`, '--demo-padding': `${frame.padding}px` } as CSSProperties;

  return <div className="editing-demo" ref={rootRef} data-playing={running} data-chapter={chapter} data-format={format}>
    <div className="demo-controls">
      <div className="landing-example-tabs" role="group" aria-label="Preview content format">{(Object.keys(examples) as Format[]).map((id) => <button key={id} type="button" aria-pressed={format === id} onClick={() => { setFormat(id); seek(reduced ? DURATION : 0, !reduced); setAnnouncement(`Previewing ${examples[id].label.toLowerCase()}.`); }}><span>{examples[id].number}</span>{examples[id].label}</button>)}</div>
      <span className="demo-controls__hint"><span /> WATCH THE EDIT. SEE THE DIFFERENCE.</span>
    </div>
    <div className="demo-story">
      <div className="demo-story__number" aria-hidden="true">0{chapter + 1}<span>/ 04</span></div>
      <div className="demo-story__copy"><h3>{chapters[chapter].title}</h3><p>{chapters[chapter].description}</p></div>
      <span className="demo-story__badge"><i className={running ? 'is-running' : ''} />{complete ? 'THE FINISHED LOOK' : running ? 'LIVE DEMO' : 'DEMO PAUSED'}</span>
    </div>
    <div className="landing-motion" role="img" aria-label={`Animated editing demonstration. ${chapters[chapter].description} ${format === 'slides' ? `Headline: ${example.first} ${frame.text} Position: ${frame.slideX}, ${frame.slideY}. Card: ${frame.cardWidth} by ${frame.cardHeight}.` : format === 'web' ? `Button: ${frame.text} Background: ${frame.color}. Corner radius: ${frame.size} pixels. ${frame.narrow ? 'Mobile' : 'Desktop'} preview.` : `Headline: ${example.first} ${frame.text} Font: ${font}, ${frame.size} pixels. Color: ${frame.color}. Padding: ${frame.padding} pixels.`}`}>
      <div className="landing-motion__window edit-stage" ref={stageRef} aria-hidden="true" style={documentStyle}>
        <div className="edit-topbar"><div className="demo-brand"><BrandMark /><strong>visualhtml</strong><span>/</span><small>{example.file}</small></div><div className="edit-modes"><span className={!frame.code ? 'is-active' : ''} data-cursor="design"><Icon name="pointer" /> Design</span><span className={frame.code ? 'is-active' : ''} data-cursor="code"><Icon name="code" /> HTML</span></div><span className="edit-export">Export <Icon name="arrow" /></span></div>
        <div className="edit-workspace">
          <aside className="edit-layers"><div className="edit-panel-heading">Layers <span>5</span></div><div className="edit-layer">⌄ <span>▱</span> {format === 'slides' ? 'Slide 01' : format === 'email' ? 'Email' : 'Page'}</div><div className={`edit-layer is-nested ${frame.section && format === 'email' ? 'is-selected' : ''}`}>⌄ <span>▱</span> {format === 'slides' ? 'Slide content' : 'Hero section'}</div><div className={`edit-layer is-leaf ${frame.selected && !frame.section ? 'is-selected' : ''}`}><span>{format === 'web' ? '↗' : 'T'}</span> {format === 'web' ? 'Open workspace' : 'Headline'} <code>{format === 'web' ? 'a' : 'h1'}</code></div><div className="edit-layer is-leaf"><span>≡</span> Description</div><div className={`edit-layer is-leaf ${format === 'slides' && frame.section ? 'is-selected' : ''}`}><span>▧</span> {format === 'slides' ? 'Source card' : format === 'web' ? 'Feature cards' : 'Artwork'}</div><div className="edit-layer-note"><span>✳</span><p>Your content.<br /><em>Your creative space.</em></p><small>YOUR CANVAS. YOUR RULES.</small></div></aside>
          <div className="edit-canvas" data-cursor="canvas">
            <div className="edit-canvas-meta"><span>{example.file}</span><span>100% <i>⌘ 0</i></span></div>
            {format === 'slides' ? <SlideDemoDocument frame={frame} time={time} /> : format === 'web' ? <WebDemoDocument frame={frame} time={time} /> : (<article className="edit-document" data-serif={frame.serif}>
              <div className="edit-document-nav"><strong>visualhtml<span>↗</span></strong><span>YOUR WORKSPACE IS READY. <Icon name="arrow" /></span></div>
              <div className={`edit-document-content ${frame.section ? 'is-section-selected' : ''}`} data-cursor="section">
                {frame.section && <div className="edit-spacing-guide"><span>{frame.padding}</span></div>}
                <span className="edit-tag">{example.tag}</span>
                <div className={`edit-heading ${frame.selected && !frame.section ? 'is-selected' : ''}`} data-cursor="headline"><h3><span>{example.first}</span><span className={time >= 2.1 && time < 2.7 ? 'is-text-selected' : ''}>{frame.text}{frame.editing && time >= 2.7 && <i className="edit-caret" style={{ opacity: Math.floor(time * 3) % 2 ? 0 : 1 }} />}</span></h3><div className="edit-selection"><i /><i /><i /><i /><b>{frame.editing ? 'Editing text' : `h1 · ${frame.size} px`}</b></div></div>
                <p>{example.copy}</p><span className="edit-cta">{example.action} <Icon name="arrow" /></span>
              </div>
              <div className="edit-artwork"><img src={ribbonArtwork} alt="" width="1536" height="1024" /><span>YOUR HTML.<br /><em>A new perspective.</em></span><small>SELECT. SHAPE. MAKE IT YOURS.</small></div>
            </article>)}
            <div className="edit-canvas-foot"><span><i />{dirty ? 'Updating source…' : 'All changes in sync'}</span><span>HTML, with a human touch.</span></div>
            <div className={`edit-code-panel ${frame.code ? 'is-visible' : ''}`} style={reveal(time, 19.1, 23.5)}><div className="edit-code-heading"><span><Icon name="code" /> {example.file}</span><span>LIVE HTML <i /></span></div><div className="edit-code-lines">{format !== 'email' ? <FormatSource format={format} frame={frame} /> : <><div><span>&lt;section</span></div><div>  style=<em>"padding: <b>{frame.padding}px</b> 30px"</em><span>&gt;</span></div><div>  <span>&lt;h1</span> style=<em>"</em></div><div className="is-changed">    font-family: <b>'{font}'</b>;</div><div className="is-changed">    font-size: <b>{frame.size}px</b>;</div><div>    font-style: <b>{frame.serif ? 'italic' : 'normal'}</b>;</div><div>    font-weight: <b>{frame.serif ? '400' : '500'}</b>;</div><div className="is-changed">    color: <b>{frame.color}</b>;<em>"</em><span>&gt;</span></div><div>    {example.first}<span>&lt;br /&gt;</span></div><div className="is-changed">    {frame.text}</div><div>  <span>&lt;/h1&gt;</span></div><div>  <span>&lt;p&gt;</span>{example.copy}<span>&lt;/p&gt;</span></div><div>  <span>…</span></div><div><span>&lt;/section&gt;</span></div></>}</div><div className="edit-code-foot"><Icon name="check" /><span>Your changes. Your HTML.<small>No editor markup added.</small></span></div></div>
            <div className={`edit-finish ${time >= 24 ? 'is-visible' : ''}`} style={format === 'email' ? reveal(time, 24) : { display: 'none' }}><span><Icon name="check" /></span><div>Unmistakably yours.<small>Every detail. Already in your HTML.</small></div></div>
          </div>
          <aside className={`edit-inspector ${format === 'slides' ? 'demo-slide-inspector' : ''}`}><div className="edit-panel-heading">Design <code>{format === 'web' ? 'a' : frame.section ? format === 'slides' ? 'aside' : 'section' : 'h1'}</code></div><div className="edit-inspector-label">{format === 'slides' ? 'Transform' : format === 'web' ? 'Button' : 'Typography'} <span>↗</span></div>
{format === 'slides' ? <><div className="edit-properties">{[['X', frame.section ? 1008 : frame.slideX], ['Y', frame.section ? 500 : frame.slideY], ['Width', frame.section ? frame.cardWidth : 944], ['Height', frame.section ? frame.cardHeight : 'Auto']].map(([label, value], index) => <div key={label} className={`edit-field ${((index < 2 && time >= 7 && time < 10.5) || (index >= 2 && frame.section)) ? 'is-focused' : ''}`}><small>{label}</small><strong>{value}{typeof value === 'number' && <span>px</span>}</strong></div>)}<div className="edit-drag-state">{time >= 7 && time < 9.3 ? '↖ Dragging headline' : time >= 15.6 && time < 17.3 ? '↘ Resizing card' : 'Drag directly on the canvas'}</div></div><div className="demo-position-readout">Canvas: 1600 × 900<br />{frame.section ? 'Selected: Source card' : 'Selected: Headline'}<br />Position and size stay in your HTML.</div></> : <>            <div className="edit-properties">
{format === 'email' ? <>              <div className={`edit-field edit-field--font ${frame.fontMenu ? 'is-focused' : ''}`} data-cursor="font"><small>Font family</small><strong>{font}<span>⌄</span></strong><div className={`edit-font-menu ${frame.fontMenu ? 'is-open' : ''}`} style={reveal(time, 6.4, 7.6)}><span>Manrope <i>Aa</i></span><span data-cursor="font-option">Instrument Serif <i>Aa</i><b>✓</b></span><span>Georgia <i>Aa</i></span></div></div>
</> : <div className="edit-field edit-field--font"><small>Link destination</small><strong>#/editor <span>↗</span></strong></div>}
              <NumberDemo label={format === 'web' ? 'Radius' : 'Size'} target="size" edit={frame.sizeEdit} time={time} />
              <div className="edit-field edit-field--weight"><small>Weight</small><strong>{frame.serif ? '400' : '500'}<span>⌄</span></strong></div>
              <div className={`edit-field edit-field--color ${frame.colorMenu ? 'is-focused' : ''}`} data-cursor="color"><small>{format === 'web' ? 'Background' : 'Text color'}</small><strong><i style={{ background: frame.color }} />{frame.color.toUpperCase()}</strong>
                <div className={`edit-color-picker ${frame.colorMenu ? 'is-open' : ''}`} style={reveal(time, 11.9, 14.2)}>
                  <div className="edit-picker-title">Choose a color <span>RGB</span></div>
                  <div className="edit-picker-spectrum" data-cursor="spectrum" style={{ backgroundColor: `hsl(${frame.hsv.h} 100% 50%)` }}><i style={{ left: `${frame.hsv.s * 100}%`, top: `${(1 - frame.hsv.v) * 100}%`, backgroundColor: frame.color }} /></div>
                  <div className="edit-picker-tools"><span className="edit-picker-preview" style={{ background: frame.color }} /><div className="edit-picker-hue" data-cursor="hue"><i style={{ left: `${frame.hsv.h / 3.6}%` }} /></div></div>
                  <div className="edit-picker-rgb">{[1, 3, 5].map((offset, index) => <div key={offset}><b>{parseInt(frame.color.slice(offset, offset + 2), 16)}</b><span>{['R', 'G', 'B'][index]}</span></div>)}</div>
                  <div className="edit-picker-hex"><span>HEX</span><b>{frame.color.toUpperCase()}</b><Icon name="check" /></div>
                </div>
              </div>
              {format === 'email' ? <NumberDemo label="Padding" target="padding" edit={frame.paddingEdit} time={time} /> : <div className="edit-field edit-field--padding"><small>Preview viewport</small><strong>{frame.narrow ? '390px' : '1200px'}</strong></div>}
            </div>
{format === 'web' ? <div className="edit-inspector-details"><div className="edit-inspector-label">Responsive flow</div><div className="demo-position-readout">{frame.narrow ? '1 column · stacked layout' : '2 columns · side by side'}<br />Breakpoint: 600px<br />Grid adapts to the viewport.</div></div> : <>            <div className="edit-inspector-details"><div className="edit-align"><b>≡</b><span>≡</span><span>≡</span><span>↔</span></div><div className="edit-inspector-label">Layout <span>+</span></div><div className="edit-box-model"><span>margin</span><div><span>{frame.padding}</span><b>padding</b><span>{frame.padding}</span></div></div><div className="edit-inspector-label">Selection <span>⌘</span></div><div className="edit-selection-info"><span>{frame.section ? 'Hero section' : 'Headline'}</span><code>{frame.section ? '<section>' : '<h1>'}</code></div></div>
</>}</>}
            <div className="edit-inspector-foot"><Icon name="check" />{dirty ? 'Applying changes' : 'Source in sync'}</div>
          </aside>
        </div>
        <div ref={cursorRef} className="edit-cursor" style={{ opacity: cursorHidden ? 0 : 1 }}><Icon name="pointer" /><span>You</span>{clickAge >= 0 && clickAge < .45 && <i className="edit-click-ring" style={{ transform: `scale(${.4 + clickAge * 3})`, opacity: 1 - clickAge / .45 }} />}</div>
      </div>
    </div>
    <div className="demo-player">
      <div className="demo-player__transport"><button type="button" className="demo-play" onClick={() => { if (complete) seek(0, true); else setPlaying(!playing); }} aria-label={complete ? 'Replay editing demo' : playing ? 'Pause editing demo' : 'Play editing demo'}><Icon name={complete ? 'replay' : playing ? 'pause' : 'play'} /></button><button type="button" className="demo-replay" onClick={() => seek(0, !reduced)} aria-label="Restart editing demo"><Icon name="replay" /></button><span className="demo-time">{String(Math.floor(time)).padStart(2, '0')}<i>/ {DURATION}s</i></span></div>
      <div className="demo-chapters" role="group" aria-label="Demo chapters">{chapters.map((item, index) => <button key={item.label} type="button" aria-pressed={chapter === index} onClick={() => chooseChapter(index)}><span>0{index + 1}</span>{item.label}<i style={{ transform: `scaleX(${clamp((time - item.start) / ((chapters[index + 1]?.start ?? DURATION) - item.start))})` }} /></button>)}</div>
      <a className="demo-player__try" href="#/editor">Your turn <Icon name="arrow" /></a>
    </div>
    <p className="sr-only" role="status">{announcement}</p>
  </div>;
}

