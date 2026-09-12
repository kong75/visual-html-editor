import React from 'react';
import type { EditorProfile, ParsedNode } from '@visual-html/core';
import { Code2 } from 'lucide-react';
import type { useCanvasSelection } from '../canvas/use-selection.js';
import type { useCanvasLayout } from '../canvas/use-layout.js';

interface EditorStageProps {
  documentTitle: string;
  mode: 'visual' | 'source';
  setMode: (mode: 'visual' | 'source') => void;
  profile: EditorProfile;
  selectedNode: ParsedNode | undefined;
  selection: ReturnType<typeof useCanvasSelection>;
  layout: ReturnType<typeof useCanvasLayout>;
  sourceDraft: string;
  setSourceDraft: (source: string) => void;
  applySource: () => Promise<void>;
}

export function EditorStage({ documentTitle, mode, setMode, profile, selectedNode, selection, layout, sourceDraft, setSourceDraft, applySource }: EditorStageProps) {
  const { overlay, runtime: { iframeRef, overlayRef, resizeHandleRef } } = selection;
  const { aspect, canvasScale, stageViewportRef, startResize } = layout;
  return (
    <main className={`vhe-stage${mode === 'source' ? ' vhe-stage--source' : ''}`}>
      <div className="vhe-canvas-bar">
        <div className="vhe-canvas-bar__document"><Code2 size={14} aria-hidden="true" /><span>{documentTitle}</span><span className="vhe-canvas-bar__divider">/</span><strong>{mode === 'visual' ? 'Canvas' : 'Source'}</strong></div>
        <div className="vhe-canvas-bar__info"><span>{aspect.width} × {aspect.height}</span>{mode === 'visual' && <span className="vhe-canvas-bar__scale">{Math.round(canvasScale * 100)}%</span>}</div>
      </div>
      {mode === 'visual' ? (
        <div ref={stageViewportRef} className="vhe-stage__viewport">
          <div className="vhe-frame-sizer" style={{ width: aspect.width * canvasScale, height: aspect.height * canvasScale }}>
            <div className="vhe-frame-shell" style={{ width: aspect.width, height: aspect.height, transform: `scale(${canvasScale})` }}>
              <iframe ref={iframeRef} title="Visual HTML canvas" className="vhe-frame" sandbox="allow-same-origin allow-scripts" />
              {selectedNode && overlay && (
                <div
                  ref={overlayRef}
                  className="vhe-selection"
                  style={{
                    transform: `translate3d(${overlay.left}px, ${overlay.top}px, 0)`,
                    width: overlay.width,
                    height: overlay.height,
                    '--vhe-overlay-stroke': `${1.5 / canvasScale}px`,
                    '--vhe-overlay-halo': `${2.5 / canvasScale}px`
                  } as React.CSSProperties}
                />
              )}
              {selectedNode && overlay && profile.capabilities.resizeElements && (
                <button
                  ref={resizeHandleRef}
                  type="button"
                  className="vhe-selection__resize"
                  style={{
                    transform: `translate3d(${overlay.left + overlay.width}px, ${overlay.top + overlay.height}px, 0) translate(-50%, -50%)`,
                    '--vhe-overlay-handle-size': `${10 / canvasScale}px`,
                    '--vhe-overlay-handle-stroke': `${2 / canvasScale}px`
                  } as React.CSSProperties}
                  onPointerDown={startResize}
                  aria-label="Resize element"
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <section className="vhe-source">
          <div className="vhe-source__header">
            <div><strong>HTML source</strong><p>Source changes are applied as one revision.</p></div>
            <div><button type="button" className="vhe-button" onClick={() => setMode('visual')}>Cancel</button><button type="button" className="vhe-button vhe-button--primary" onClick={applySource}>Apply</button></div>
          </div>
          <textarea aria-label="HTML source" value={sourceDraft} onChange={(event) => setSourceDraft(event.target.value)} spellCheck={false} />
        </section>
      )}
    </main>
  );
}
