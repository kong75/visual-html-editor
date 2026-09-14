import { describe, expect, it } from 'vitest';
import { DeckController } from './controller';
import { parseDeck, serializeDeck } from './serialization';
import type { HtmlDeck } from './types';

function deck(): HtmlDeck {
  return {
    schema: 'visual-html-deck',
    version: 1,
    id: 'demo-deck',
    title: 'Demo deck',
    width: 1600,
    height: 900,
    slides: [
      { id: 'intro', title: 'Intro', html: '<!doctype html><html><body><h1>Intro</h1></body></html>' },
      { id: 'details', title: 'Details', html: '<!doctype html><html><body><h1>Details</h1></body></html>' }
    ]
  };
}

describe('DeckController', () => {
  it('keeps snapshot identity stable until observable state changes', async () => {
    const controller = await DeckController.create({ deck: deck() });
    const initial = controller.getSnapshot();
    expect(controller.getSnapshot()).toBe(initial);

    controller.setActiveSlide('details');
    const updated = controller.getSnapshot();
    expect(updated).not.toBe(initial);
    expect(controller.getSnapshot()).toBe(updated);
  });

  it('recognizes saved deck contents after undo and redo, including unrecorded source edits', async () => {
    const controller = await DeckController.create({ deck: deck() });
    controller.addSlide();
    expect(controller.getSnapshot().dirty).toBe(true);
    controller.undo();
    expect(controller.getSnapshot().dirty).toBe(false);
    controller.redo();
    controller.createCheckpoint();
    controller.undo();
    expect(controller.getSnapshot().dirty).toBe(true);
    controller.redo();
    expect(controller.getSnapshot().dirty).toBe(false);
    controller.updateSlide('intro', { html: '<p>Unsaved source</p>' }, { recordHistory: false });
    controller.undo();
    controller.redo();
    expect(controller.getSnapshot().dirty).toBe(true);
  });

  it('falls back to the first slide and publishes active-slide changes', async () => {
    const controller = await DeckController.create({ deck: deck(), activeSlideId: 'missing' });
    let emissions = 0;
    const unsubscribe = controller.subscribe(() => { emissions += 1; });
    expect(controller.getSnapshot().activeSlideId).toBe('intro');
    expect(controller.setActiveSlide('missing')).toMatchObject({ ok: false, code: 'slide-not-found' });
    expect(controller.setActiveSlide('intro')).toMatchObject({ ok: true, description: 'Slide already active.' });
    expect(controller.setActiveSlide('details')).toMatchObject({ ok: true, slideId: 'details' });
    expect(emissions).toBe(1);
    unsubscribe();
    controller.setActiveSlide('intro');
    expect(emissions).toBe(1);
  });

  it('adds, navigates, duplicates, removes, and reorders slides', async () => {
    const controller = await DeckController.create({ deck: deck() });
    expect(controller.getSnapshot().activeSlideId).toBe('intro');

    const added = controller.addSlide({ afterSlideId: 'intro', slide: { id: 'middle', title: 'Middle', html: '<html><body>Middle</body></html>' } });
    expect(added.ok).toBe(true);
    expect(controller.getSnapshot().deck.slides.map((slide) => slide.id)).toEqual(['intro', 'middle', 'details']);
    expect(controller.getSnapshot().activeSlideId).toBe('middle');

    const duplicated = controller.duplicateSlide('middle');
    expect(duplicated.ok).toBe(true);
    expect(controller.getSnapshot().deck.slides).toHaveLength(4);

    controller.moveSlide('details', 0);
    expect(controller.getSnapshot().deck.slides[0].id).toBe('details');

    controller.removeSlide('intro');
    expect(controller.getSnapshot().deck.slides.some((slide) => slide.id === 'intro')).toBe(false);
  });

  it('preserves the latest slide content when an added slide is undone and redone', async () => {
    const controller = await DeckController.create({ deck: deck() });
    controller.addSlide({ slide: { id: 'new-slide', html: '<html><body>Blank</body></html>' } });
    controller.updateSlide('new-slide', { html: '<html><body>Edited</body></html>' }, { recordHistory: false });

    expect(controller.undo().ok).toBe(true);
    expect(controller.getSnapshot().deck.slides.some((slide) => slide.id === 'new-slide')).toBe(false);
    expect(controller.redo().ok).toBe(true);
    expect(controller.getSnapshot().deck.slides.find((slide) => slide.id === 'new-slide')?.html).toContain('Edited');
  });

  it('restores removed slides and active navigation through history', async () => {
    const controller = await DeckController.create({ deck: deck(), activeSlideId: 'details' });
    controller.removeSlide('details');
    expect(controller.getSnapshot().activeSlideId).toBe('intro');
    controller.undo();
    expect(controller.getSnapshot().activeSlideId).toBe('details');
    expect(controller.getSnapshot().deck.slides.map((slide) => slide.id)).toEqual(['intro', 'details']);
  });

  it('never removes the final slide', async () => {
    const single = { ...deck(), slides: [deck().slides[0]] };
    const controller = await DeckController.create({ deck: single });
    expect(controller.removeSlide('intro')).toMatchObject({ ok: false, code: 'last-slide' });
  });

  it('reports invalid slide targets and duplicate ids', async () => {
    const controller = await DeckController.create({ deck: deck() });
    expect(controller.addSlide({ afterSlideId: 'missing' })).toMatchObject({ ok: false, code: 'slide-not-found' });
    expect(controller.addSlide({ slide: { id: 'intro' } })).toMatchObject({ ok: false, code: 'duplicate-slide-id' });
    expect(controller.duplicateSlide('missing')).toMatchObject({ ok: false, code: 'slide-not-found' });
    expect(controller.removeSlide('missing')).toMatchObject({ ok: false, code: 'slide-not-found' });
    expect(controller.moveSlide('missing', 0)).toMatchObject({ ok: false, code: 'slide-not-found' });
    expect(controller.updateSlide('missing', { title: 'Nope' })).toMatchObject({ ok: false, code: 'slide-not-found' });
  });

  it('allocates collision-free ids and creates a complete blank slide', async () => {
    const source = deck();
    const collisionDeck = { ...source, slides: [source.slides[0], { ...source.slides[1], id: 'slide-3', title: undefined }] };
    const controller = await DeckController.create({ deck: collisionDeck });
    const result = controller.addSlide();
    expect(result).toMatchObject({ ok: true, slideId: 'slide-4' });
    const added = controller.getSnapshot().deck.slides.find((slide) => slide.id === 'slide-4')!;
    expect(added.title).toBe('Slide 3');
    expect(added.html).toContain('min-height: 900px');
    expect(controller.duplicateSlide('slide-3')).toMatchObject({ ok: true });
    expect(controller.getSnapshot().deck.slides.at(-1)?.title).toBe('Slide 3');
  });

  it('clamps moves, ignores no-op moves, and restores ordering through history', async () => {
    const controller = await DeckController.create({ deck: deck() });
    expect(controller.moveSlide('intro', -99)).toMatchObject({ ok: true, description: 'Slide already in position.' });
    expect(controller.moveSlide('intro', 99)).toMatchObject({ ok: true });
    expect(controller.getSnapshot().deck.slides.map((slide) => slide.id)).toEqual(['details', 'intro']);
    controller.undo();
    expect(controller.getSnapshot().deck.slides.map((slide) => slide.id)).toEqual(['intro', 'details']);
    controller.redo();
    expect(controller.getSnapshot().deck.slides.map((slide) => slide.id)).toEqual(['details', 'intro']);
  });

  it('updates metadata defensively, supports unrecorded updates, and tracks checkpoints', async () => {
    const controller = await DeckController.create({ deck: deck() });
    const metadata = { owner: 'team' };
    expect(controller.updateSlide('intro', { title: 'Intro' })).toMatchObject({ ok: true, description: 'Slide unchanged.' });
    expect(controller.updateSlide('intro', { metadata }, { description: 'Set owner' })).toMatchObject({ ok: true, description: 'Set owner' });
    metadata.owner = 'changed externally';
    expect(controller.getSnapshot().deck.slides[0].metadata).toEqual({ owner: 'team' });
    expect(controller.getSnapshot().dirty).toBe(true);
    controller.createCheckpoint();
    expect(controller.getSnapshot().dirty).toBe(false);
    controller.updateSlide('intro', { notes: 'Live edit' }, { recordHistory: false });
    expect(controller.getSnapshot().dirty).toBe(true);
    controller.undo();
    expect(controller.getSnapshot().deck.slides[0].metadata).toBeUndefined();
    expect(controller.getSnapshot().deck.slides[0].notes).toBe('Live edit');
    controller.redo();
    expect(controller.getSnapshot().deck.slides[0]).toMatchObject({ metadata: { owner: 'team' }, notes: 'Live edit' });
  });

  it('replaces a complete deck atomically and restores it through history', async () => {
    const controller = await DeckController.create({ deck: deck(), activeSlideId: 'details' });
    const imported: HtmlDeck = {
      schema: 'visual-html-deck',
      version: 1,
      id: 'imported',
      title: 'Imported deck',
      width: 1280,
      height: 720,
      slides: [
        { id: 'opening', html: '<html><body>Opening</body></html>' },
        { id: 'closing', html: '<html><body>Closing</body></html>' }
      ]
    };

    expect(controller.replaceDeck(imported, { activeSlideId: 'closing', description: 'Import deck' }))
      .toMatchObject({ ok: true, description: 'Import deck', slideId: 'closing' });
    expect(controller.getSnapshot()).toMatchObject({ activeSlideId: 'closing', dirty: true });
    expect(controller.getSnapshot().deck).toMatchObject({ id: 'imported', width: 1280, height: 720 });

    imported.slides[0].html = 'changed externally';
    expect(controller.getSnapshot().deck.slides[0].html).toContain('Opening');
    expect(controller.undo()).toMatchObject({ ok: true, slideId: 'details' });
    expect(controller.getSnapshot().deck.id).toBe('demo-deck');
    expect(controller.redo()).toMatchObject({ ok: true, slideId: 'closing' });
    expect(controller.getSnapshot().deck.id).toBe('imported');
    expect(controller.replaceDeck(controller.export(), { activeSlideId: 'closing' })).toMatchObject({ description: 'Deck unchanged.' });
  });

  it('returns explicit failures when history is empty', async () => {
    const controller = await DeckController.create({ deck: deck() });
    expect(controller.undo()).toMatchObject({ ok: false, code: 'nothing-to-undo' });
    expect(controller.redo()).toMatchObject({ ok: false, code: 'nothing-to-redo' });
  });

  it('exports a defensive normalized deck copy', async () => {
    const controller = await DeckController.create({ deck: deck() });
    const exported = controller.export();
    expect(exported).toEqual(deck());
    expect(exported).not.toBe(controller.getSnapshot().deck);
    expect(exported.slides).not.toBe(controller.getSnapshot().deck.slides);
  });

  it('round-trips the canonical JSON deck format', () => {
    expect(parseDeck(serializeDeck(deck()))).toEqual(deck());
  });
});
