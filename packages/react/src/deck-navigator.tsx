import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, MoreHorizontal, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import type { DeckController, HtmlDeckSlide, SlideId } from '@visual-html/deck';
import { useDeckSnapshot } from './use-deck-snapshot.js';

export interface DeckNavigatorProps {
  controller: DeckController;
  className?: string;
  onSlideChange?: (slideId: SlideId) => void;
  onHistoryChange?: () => void;
}

function slideName(slide: HtmlDeckSlide, index: number): string {
  return slide.title?.trim() || slide.label?.trim() || `Slide ${index + 1}`;
}

export function DeckNavigator({ controller, className = '', onSlideChange, onHistoryChange }: DeckNavigatorProps) {
  const snapshot = useDeckSnapshot(controller);
  const [draggingId, setDraggingId] = useState<SlideId | null>(null);
  const [menuSlideId, setMenuSlideId] = useState<SlideId | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const previewWidth = 164;
  const previewScale = previewWidth / snapshot.deck.width;
  const previewHeight = snapshot.deck.height * previewScale;

  const select = (slideId: SlideId) => {
    const result = controller.setActiveSlide(slideId);
    if (result.ok) onSlideChange?.(slideId);
  };

  const add = () => {
    const result = controller.addSlide({ afterSlideId: snapshot.activeSlideId });
    if (result.ok && result.slideId) onSlideChange?.(result.slideId);
    navigationRef.current?.focus();
  };

  const runHistory = (direction: 'undo' | 'redo') => {
    const result = controller[direction]();
    if (result.ok) {
      onHistoryChange?.();
      if (result.slideId) onSlideChange?.(result.slideId);
    }
    setMenuSlideId(null);
    navigationRef.current?.focus();
  };

  useEffect(() => {
    if (!menuSlideId) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuSlideId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuSlideId(null);
    };
    document.addEventListener('pointerdown', closeOnPointerDown, true);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown, true);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [menuSlideId]);

  const runMenuAction = (action: () => void) => {
    action();
    setMenuSlideId(null);
    navigationRef.current?.focus();
  };

  return (
    <nav ref={navigationRef} tabIndex={-1} className={`vhe-deck-nav ${className}`} aria-label="Slides" onKeyDown={(event) => {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || !['z', 'y'].includes(event.key.toLowerCase())) return;
      if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      runHistory(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo');
    }}>
      <header className="vhe-deck-nav__header">
        <div><strong>Slides</strong><span>{snapshot.deck.slides.length}</span></div>
        <div className="vhe-deck-nav__actions" role="group" aria-label="Deck history and slides">
          <button type="button" disabled={!snapshot.canUndo} onClick={() => runHistory('undo')} aria-label="Undo deck change" title="Undo deck change · Ctrl/Cmd+Z in Slides"><Undo2 size={14} aria-hidden="true" /></button>
          <button type="button" disabled={!snapshot.canRedo} onClick={() => runHistory('redo')} aria-label="Redo deck change" title="Redo deck change · Ctrl/Cmd+Shift+Z in Slides"><Redo2 size={14} aria-hidden="true" /></button>
          <button type="button" onClick={add} aria-label="Add slide"><Plus size={14} aria-hidden="true" /></button>
        </div>
      </header>

      <div className="vhe-deck-nav__list" role="listbox" aria-label="Deck slides">
        {snapshot.deck.slides.map((slide, index) => {
          const active = slide.id === snapshot.activeSlideId;
          return (
            <div
              key={slide.id}
              className={`vhe-deck-item${active ? ' vhe-deck-item--active' : ''}${draggingId === slide.id ? ' vhe-deck-item--dragging' : ''}`}
              draggable
              onDragStart={(event) => {
                setDraggingId(slide.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', slide.id);
              }}
              onDragEnd={() => setDraggingId(null)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => {
                event.preventDefault();
                const slideId = draggingId ?? event.dataTransfer.getData('text/plain');
                if (slideId) controller.moveSlide(slideId, index);
                setDraggingId(null);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                select(slide.id);
                setMenuSlideId(slide.id);
              }}
            >
              <button
                type="button"
                className="vhe-deck-item__card"
                role="option"
                aria-selected={active}
                aria-label={`${index + 1}. ${slideName(slide, index)}`}
                onClick={() => select(slide.id)}
                onKeyDown={(event) => {
                  if ((event.key === 'Delete' || event.key === 'Backspace') && snapshot.deck.slides.length > 1) {
                    event.preventDefault();
                    controller.removeSlide(slide.id);
                    navigationRef.current?.focus();
                  }
                  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
                    event.preventDefault();
                    controller.duplicateSlide(slide.id);
                    navigationRef.current?.focus();
                  }
                }}
                title={slideName(slide, index)}
              >
                <span className="vhe-deck-item__number">{index + 1}</span>
                <span className="vhe-deck-item__preview" style={{ height: previewHeight }}>
                  <iframe
                    title={`Preview of ${slideName(slide, index)}`}
                    srcDoc={slide.html}
                    sandbox=""
                    tabIndex={-1}
                    style={{ width: snapshot.deck.width, height: snapshot.deck.height, transform: `scale(${previewScale})` }}
                  />
                </span>
              </button>

              <div className="vhe-deck-item__menu-wrap" ref={menuSlideId === slide.id ? menuRef : undefined}>
                <button
                  type="button"
                  className="vhe-deck-item__menu-trigger"
                  aria-label={`Slide actions for ${slideName(slide, index)}`}
                  aria-expanded={menuSlideId === slide.id}
                  aria-haspopup="menu"
                  onClick={() => setMenuSlideId((current) => current === slide.id ? null : slide.id)}
                >
                  <MoreHorizontal size={14} aria-hidden="true" />
                </button>
                {menuSlideId === slide.id && (
                  <div className="vhe-deck-item__menu" role="menu" aria-label={`Actions for ${slideName(slide, index)}`}>
                    <button type="button" role="menuitem" disabled={index === 0} onClick={() => runMenuAction(() => controller.moveSlide(slide.id, index - 1))}><ChevronUp size={13} aria-hidden="true" /><span>Move up</span></button>
                    <button type="button" role="menuitem" disabled={index === snapshot.deck.slides.length - 1} onClick={() => runMenuAction(() => controller.moveSlide(slide.id, index + 1))}><ChevronDown size={13} aria-hidden="true" /><span>Move down</span></button>
                    <span className="vhe-deck-item__menu-separator" role="separator" />
                    <button type="button" role="menuitem" onClick={() => runMenuAction(() => controller.duplicateSlide(slide.id))}><Copy size={13} aria-hidden="true" /><span>Duplicate slide</span><kbd>Ctrl D</kbd></button>
                    <button type="button" role="menuitem" className="vhe-deck-item__menu-delete" disabled={snapshot.deck.slides.length === 1} onClick={() => runMenuAction(() => controller.removeSlide(slide.id))}><Trash2 size={13} aria-hidden="true" /><span>Delete slide</span><kbd>Del</kbd></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </nav>
  );
}
