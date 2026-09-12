import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorController } from '@visual-html/core';
import { DeckController, exportClaudeDesignDeck, importClaudeDesignDeck, type DeckSnapshot } from '@visual-html/deck';
import { DeckNavigator, VisualHtmlEditor, type HtmlImportAdapter } from '@visual-html/react';
import { showcaseProfiles, showcaseSlidesDeck, type ProfileId } from './samples';
import { BrandMark } from '../../../packages/react/src/brand-mark';

interface ControllerState {
  profileId: ProfileId;
  controller: EditorController;
  slideId?: string;
}

function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function EditorPage() {
  const [profileId, setProfileId] = useState<ProfileId>('email');
  const [controllerState, setControllerState] = useState<ControllerState | null>(null);
  const [deckController, setDeckController] = useState<DeckController | null>(null);
  const [deckSnapshot, setDeckSnapshot] = useState<DeckSnapshot | null>(null);
  const [isSwitching, setIsSwitching] = useState(true);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [deckWorkspaceEpoch, setDeckWorkspaceEpoch] = useState(0);
  const controllerCacheRef = useRef(new Map<string, EditorController>());
  const selected = showcaseProfiles[profileId];
  const activeSlideId = deckSnapshot?.activeSlideId;

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    DeckController.create({ deck: showcaseSlidesDeck }).then((controller) => {
      if (!active) return;
      setDeckController(controller);
      setDeckSnapshot(controller.getSnapshot());
      unsubscribe = controller.subscribe(() => setDeckSnapshot(controller.getSnapshot()));
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (profileId === 'slides' && (!deckController || !activeSlideId)) return;
    let active = true;
    setIsSwitching(true);

    const slide = profileId === 'slides'
      ? deckController?.getSnapshot().deck.slides.find((candidate) => candidate.id === activeSlideId)
      : undefined;
    if (profileId === 'slides' && !slide) return () => { active = false; };

    const cacheKey = profileId === 'slides' ? `slides:${slide!.id}` : `profile:${profileId}`;
    const cached = controllerCacheRef.current.get(cacheKey);
    if (cached) {
      setControllerState({ profileId, controller: cached, slideId: slide?.id });
      setIsSwitching(false);
      return () => { active = false; };
    }

    EditorController.create({ profile: selected.profile, html: slide?.html ?? selected.html }).then((controller) => {
      if (!active) return;
      controllerCacheRef.current.set(cacheKey, controller);
      setControllerState({ profileId, controller, slideId: slide?.id });
      setIsSwitching(false);
    });
    return () => { active = false; };
  }, [activeSlideId, deckController, deckWorkspaceEpoch, profileId, selected]);

  useEffect(() => {
    if (profileId !== 'slides' || controllerState?.profileId !== 'slides' || !controllerState.slideId || !deckController) return;
    const { controller, slideId } = controllerState;
    const syncSlide = () => {
      const html = controller.getSnapshot().html;
      const current = deckController.getSnapshot().deck.slides.find((slide) => slide.id === slideId);
      if (current && current.html !== html) {
        deckController.updateSlide(slideId, { html }, { recordHistory: false, description: 'Sync slide source' });
      }
    };
    syncSlide();
    return controller.subscribe(syncSlide);
  }, [controllerState, deckController, profileId]);

  const exportDeck = useCallback(async () => {
    if (!deckController) return;
    if (controllerState?.profileId === 'slides' && controllerState.slideId) {
      deckController.updateSlide(
        controllerState.slideId,
        { html: controllerState.controller.getSnapshot().html },
        { recordHistory: false, description: 'Sync slide before export' }
      );
    }
    const deck = deckController.export();
    for (const slide of deck.slides) {
      const controller = await EditorController.create({ html: slide.html, profile: showcaseProfiles.slides.profile });
      const blocking = controller.getSnapshot().issues.filter((issue) => issue.severity === 'blocking');
      if (blocking.length > 0) {
        throw new Error(`Export blocked: slide “${slide.title ?? slide.id}” has ${blocking.length} policy issue${blocking.length === 1 ? '' : 's'}. Fix them before exporting the deck.`);
      }
    }
    const html = exportClaudeDesignDeck(deck);
    downloadHtml(html, 'visual-html-deck.html');
    setExportMessage(`Exported ${deck.slides.length} slides as a standalone HTML deck.`);
  }, [controllerState, deckController]);

  const deckImportAdapter = useMemo<HtmlImportAdapter | undefined>(() => {
    if (!deckController || profileId !== 'slides') return undefined;
    return {
      prepare: ({ file, html }) => {
        const imported = importClaudeDesignDeck(html);
        const slideCount = imported.deck.slides.length;
        return {
          title: `Import ${imported.deck.title || file.name}`,
          description: `Replace the current deck with ${slideCount} slide${slideCount === 1 ? '' : 's'} from this HTML file.`,
          warnings: imported.warnings.map((warning) => warning.message),
          hasUnsavedChanges: Boolean(deckSnapshot?.dirty || controllerState?.controller.getSnapshot().dirty)
        };
      },
      apply: ({ file, html }) => {
        const imported = importClaudeDesignDeck(html);
        const result = deckController.replaceDeck(imported.deck, { description: `Import ${file.name}` });
        if (!result.ok) throw new Error(result.message);
        for (const cacheKey of controllerCacheRef.current.keys()) {
          if (cacheKey.startsWith('slides:')) controllerCacheRef.current.delete(cacheKey);
        }
        setDeckWorkspaceEpoch((current) => current + 1);
        setExportMessage(null);
        const slideCount = imported.deck.slides.length;
        return { message: `Imported ${slideCount} slide${slideCount === 1 ? '' : 's'} from ${file.name}.` };
      }
    };
  }, [controllerState, deckController, deckSnapshot?.dirty, profileId]);

  const profileSwitcher = (
    <div className="editor-profile-switcher" role="tablist" aria-label="Content profile">
      {(Object.keys(showcaseProfiles) as ProfileId[]).map((id) => {
        const option = showcaseProfiles[id];
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={profileId === id}
            data-testid={`profile-${id}`}
            onClick={() => { setExportMessage(null); setProfileId(id); }}
          >
            <strong>{option.shortLabel}</strong>
          </button>
        );
      })}
    </div>
  );

  const reconcileDeckHistory = () => {
    if (!deckController) return;
    let changed = false;
    for (const slide of deckController.getSnapshot().deck.slides) {
      const key = `slides:${slide.id}`;
      const cached = controllerCacheRef.current.get(key);
      // A restored imported deck may reuse IDs with different HTML. Do not
      // let a stale cached controller overwrite the recovered deck source.
      if (cached && cached.getSnapshot().html !== slide.html) {
        controllerCacheRef.current.delete(key);
        changed = true;
      }
    }
    if (changed) setDeckWorkspaceEpoch((current) => current + 1);
  };

  const navigationRail = controllerState?.profileId === 'slides' && deckController
    ? <DeckNavigator controller={deckController} onHistoryChange={reconcileDeckHistory} />
    : undefined;

  return (
    <div className="editor-page" id="editor">
      <main className="editor-page__workspace">
        {exportMessage && <div className="editor-page__export" role="status">{exportMessage}</div>}
        {controllerState ? (
          <div className="editor-page__surface">
            <VisualHtmlEditor
              controller={controllerState.controller}
              brandHref="#"
              documentTitle={controllerState.profileId === 'slides' ? deckSnapshot?.deck.title ?? 'HTML Deck' : selected.profile.label}
              toolbarContent={profileSwitcher}
              navigationRail={navigationRail}
              workspaceDirty={controllerState.profileId === 'slides' && deckSnapshot?.dirty}
              importAdapter={controllerState.profileId === 'slides' ? deckImportAdapter : undefined}
              onExportRequest={controllerState.profileId === 'slides' ? exportDeck : undefined}
              onExport={(html) => setExportMessage(`Exported ${html.length.toLocaleString()} characters of clean source HTML.`)}
            />
            {isSwitching && <div className="editor-page__switching" aria-live="polite"><span /> Loading {profileId === 'slides' ? 'slide' : `${selected.shortLabel.toLowerCase()} profile`}…</div>}
          </div>
        ) : (
          <div className="editor-page__loading">
            <span className="editor-page__loading-mark"><BrandMark /></span>
            <strong>Preparing your workspace</strong>
            <small>Loading the source-first editing surface…</small>
          </div>
        )}
      </main>
    </div>
  );
}
