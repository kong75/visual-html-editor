import React, { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { EditorProfile, InlineMark, InlineTextStyleProperty } from '@visual-html/core';
import { Bold, Italic, SlidersHorizontal, Strikethrough, Underline, type LucideIcon } from 'lucide-react';
import type { RichTextSelectionState } from '../canvas/selection.js';
import { fontFamilyOptionsFor } from '../inspector/font-options.js';

interface SelectionFormattingProps {
  profile: EditorProfile;
  selection: RichTextSelectionState;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  toggleInlineMark: (mark: InlineMark, selection?: RichTextSelectionState | null) => Promise<boolean>;
  setInlineStyles: (
    styles: Readonly<Partial<Record<InlineTextStyleProperty, string>>>,
    selection?: RichTextSelectionState | null
  ) => Promise<boolean>;
}

interface ToolbarPosition {
  left: number;
  top: number;
  placement: 'above' | 'below';
}

interface StyleFieldProps {
  label: string;
  property: InlineTextStyleProperty;
  value: string | null;
  placeholder: string;
  compact?: boolean;
  disabled?: boolean;
  onApply: (property: InlineTextStyleProperty, value: string) => void;
}

function StyleField({ label, property, value, placeholder, compact, disabled, onApply }: StyleFieldProps) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onApply(property, next);
  };
  return (
    <label className={`vhe-inline-format__field${compact ? ' vhe-inline-format__field--compact' : ''}`}>
      {!compact && <span>{label}</span>}
      <input
        type="text"
        value={draft}
        placeholder={value === null ? 'Mixed' : placeholder}
        aria-label={`${label} for selected text`}
        title={compact ? label : undefined}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      />
    </label>
  );
}

function FontStyleField({ value, disabled, onApply }: Pick<StyleFieldProps, 'value' | 'disabled' | 'onApply'>) {
  const options = fontFamilyOptionsFor(value);
  return (
    <label className="vhe-inline-format__field vhe-inline-format__field--compact">
      <select
        value={value ?? ''}
        aria-label="Font for selected text"
        title="Font"
        disabled={disabled}
        style={value ? { fontFamily: value } : undefined}
        onChange={(event) => onApply('font-family', event.target.value)}
      >
        <option value="" disabled>{value === null ? 'Mixed' : 'Font'}</option>
        {options.map((option) => <option key={option.value} value={option.value} style={{ fontFamily: option.fontFamily }}>{option.label}</option>)}
      </select>
    </label>
  );
}

function colorInputValue(value: string | null): string {
  if (!value) return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const rgb = value.match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
  if (!rgb) return '#000000';
  return `#${rgb.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
}

const marks: ReadonlyArray<{
  mark: InlineMark;
  label: string;
  tag: InlineMark;
  title: string;
  icon: LucideIcon;
}> = [
  { mark: 'strong', label: 'Bold selected text', tag: 'strong', title: 'Bold · Ctrl/Cmd+B', icon: Bold },
  { mark: 'em', label: 'Italicize selected text', tag: 'em', title: 'Italic · Ctrl/Cmd+I', icon: Italic },
  { mark: 'u', label: 'Underline selected text', tag: 'u', title: 'Underline · Ctrl/Cmd+U', icon: Underline },
  { mark: 's', label: 'Strike selected text', tag: 's', title: 'Strikethrough', icon: Strikethrough }
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function useToolbarPosition(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  toolbarRef: RefObject<HTMLElement | null>,
  selection: RichTextSelectionState,
  expanded: boolean
): ToolbarPosition | null {
  const [position, setPosition] = useState<ToolbarPosition | null>(null);

  useLayoutEffect(() => {
    const frame = iframeRef.current;
    const root = frame?.closest<HTMLElement>('.vhe-root');
    const doc = frame?.contentDocument;
    if (!frame || !root || !doc) return;
    let animationFrame: number | null = null;

    const update = () => {
      animationFrame = null;
      const browserSelection = doc.defaultView?.getSelection();
      if (!browserSelection || browserSelection.rangeCount === 0 || browserSelection.isCollapsed) return;
      const rangeRect = browserSelection.getRangeAt(0).getBoundingClientRect();
      if (!rangeRect.width && !rangeRect.height) return;
      const frameRect = frame.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const scaleX = frameRect.width / Math.max(1, frame.clientWidth);
      const scaleY = frameRect.height / Math.max(1, frame.clientHeight);
      const toolbarWidth = toolbarRef.current?.offsetWidth ?? 390;
      const toolbarHeight = toolbarRef.current?.offsetHeight ?? 40;
      const anchorLeft = frameRect.left - rootRect.left + (rangeRect.left + rangeRect.width / 2) * scaleX;
      const anchorTop = frameRect.top - rootRect.top + rangeRect.top * scaleY;
      const anchorBottom = frameRect.top - rootRect.top + rangeRect.bottom * scaleY;
      const left = clamp(anchorLeft, toolbarWidth / 2 + 8, rootRect.width - toolbarWidth / 2 - 8);
      const expandedHeight = expanded ? 82 : 0;
      const placement = anchorTop - toolbarHeight - expandedHeight - 10 >= 8 ? 'above' : 'below';
      setPosition({ left, top: placement === 'above' ? anchorTop - 8 : anchorBottom + 8, placement });
    };
    const schedule = () => {
      if (animationFrame === null) animationFrame = requestAnimationFrame(update);
    };

    update();
    doc.addEventListener('selectionchange', schedule);
    doc.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    const observer = window.ResizeObserver ? new ResizeObserver(schedule) : null;
    observer?.observe(frame);
    if (toolbarRef.current) observer?.observe(toolbarRef.current);
    return () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      doc.removeEventListener('selectionchange', schedule);
      doc.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [expanded, iframeRef, selection.nodeKey, selection.range.end, selection.range.start, toolbarRef]);

  return position;
}

export function SelectionFormatting({
  profile, selection, iframeRef, toggleInlineMark, setInlineStyles
}: SelectionFormattingProps) {
  const toolbarRef = useRef<HTMLElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const position = useToolbarPosition(iframeRef, toolbarRef, selection, moreOpen);
  const apply = (property: InlineTextStyleProperty, value: string) => void setInlineStyles({ [property]: value });
  const canInlineStyle = profile.capabilities.editStyles
    && profile.html.allowedTags.includes('span')
    && profile.html.allowedAttributes.includes('style');
  const canApply = (property: InlineTextStyleProperty) => canInlineStyle
    && profile.html.allowedCssProperties.includes(property);

  useEffect(() => setMoreOpen(false), [selection.nodeKey, selection.range.end, selection.range.start]);

  return (
    <section
      ref={toolbarRef}
      className="vhe-inline-format"
      aria-label="Selected text formatting"
      data-placement={position?.placement}
      style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && moreOpen) {
          event.stopPropagation();
          setMoreOpen(false);
        }
      }}
    >
      <div className="vhe-inline-format__bar" role="toolbar" aria-label="Selected text controls">
        {marks.map(({ mark, label, tag, title, icon: Icon }) => (
          <button
            key={mark}
            type="button"
            className="vhe-inline-format__button"
            data-active={selection.activeMarks[mark] || undefined}
            disabled={!profile.html.allowedTags.includes(tag)}
            aria-label={label}
            aria-pressed={selection.activeMarks[mark]}
            title={title}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => void toggleInlineMark(mark)}
          ><Icon size={15} strokeWidth={2} aria-hidden={true} /></button>
        ))}
        <span className="vhe-inline-format__divider" aria-hidden="true" />
        <FontStyleField disabled={!canApply('font-family')} value={selection.activeStyles['font-family']} onApply={apply} />
        <StyleField compact disabled={!canApply('font-size')} label="Size" property="font-size" value={selection.activeStyles['font-size']} placeholder="Size" onApply={apply} />
        <label className="vhe-inline-format__color" title="Text color">
          <span className="vhe-inline-format__color-glyph">A<i style={{ backgroundColor: colorInputValue(selection.activeStyles.color) }} /></span>
          <input
            type="color"
            value={colorInputValue(selection.activeStyles.color)}
            aria-label="Color for selected text"
            disabled={!canApply('color')}
            onChange={(event) => apply('color', event.target.value)}
          />
        </label>
        <button
          type="button"
          className="vhe-inline-format__button"
          aria-label="More text options"
          aria-expanded={moreOpen}
          title="More text options"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setMoreOpen((current) => !current)}
        ><SlidersHorizontal size={15} strokeWidth={1.9} aria-hidden={true} /></button>
      </div>
      {moreOpen && (
        <div className="vhe-inline-format__more" aria-label="More selected text options">
          <StyleField disabled={!canApply('font-weight')} label="Weight" property="font-weight" value={selection.activeStyles['font-weight']} placeholder="400" onApply={apply} />
          <StyleField disabled={!canApply('line-height')} label="Line height" property="line-height" value={selection.activeStyles['line-height']} placeholder="1.4" onApply={apply} />
          <StyleField disabled={!canApply('letter-spacing')} label="Tracking" property="letter-spacing" value={selection.activeStyles['letter-spacing']} placeholder="0px" onApply={apply} />
        </div>
      )}
    </section>
  );
}
