import { cloneSlide, createBlankSlideHtml, normalizeDeck } from './serialization.js';
import type {
  AddSlideOptions,
  CreateDeckControllerOptions,
  DeckCommandResult,
  DeckSnapshot,
  HtmlDeck,
  HtmlDeckSlide,
  ReplaceDeckOptions,
  SlideId,
  UpdateSlideOptions
} from './types.js';

interface DeckHistoryEntry {
  description: string;
  undo: () => void;
  redo: () => void;
}

function replaceAt<T>(items: readonly T[], index: number, value: T): T[] {
  const next = [...items];
  next[index] = value;
  return next;
}

function contentSignature(deck: HtmlDeck): string {
  return JSON.stringify(deck, (_key, value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
  });
}

function restoreUpdatedFields(
  current: HtmlDeckSlide,
  recorded: HtmlDeckSlide,
  fields: readonly (keyof Omit<HtmlDeckSlide, 'id'>)[]
): HtmlDeckSlide {
  const next = { ...current };
  for (const field of fields) {
    if (field === 'metadata') next.metadata = recorded.metadata ? { ...recorded.metadata } : undefined;
    else (next as Record<string, unknown>)[field] = recorded[field];
  }
  return next;
}

export class DeckController {
  private deck: HtmlDeck;
  private activeSlideId: SlideId;
  private revision = 0;
  private currentContent: string;
  private checkpointContent: string;
  private idCounter = 0;
  private history: DeckHistoryEntry[] = [];
  private historyCursor = -1;
  private listeners = new Set<() => void>();

  private constructor(options: CreateDeckControllerOptions) {
    this.deck = normalizeDeck(options.deck);
    this.currentContent = contentSignature(this.deck);
    this.checkpointContent = this.currentContent;
    this.activeSlideId = options.activeSlideId && this.deck.slides.some((slide) => slide.id === options.activeSlideId)
      ? options.activeSlideId
      : this.deck.slides[0].id;
    this.idCounter = this.deck.slides.length;
  }

  static async create(options: CreateDeckControllerOptions): Promise<DeckController> {
    return new DeckController(options);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private touch(): void {
    this.revision += 1;
    this.currentContent = contentSignature(this.deck);
    this.emit();
  }

  private success(description: string, slideId?: SlideId): DeckCommandResult {
    return { ok: true, revision: this.revision, description, slideId };
  }

  private failure(code: string, message: string): DeckCommandResult {
    return { ok: false, code, message };
  }

  private record(entry: DeckHistoryEntry): void {
    this.history = this.history.slice(0, this.historyCursor + 1);
    this.history.push(entry);
    this.historyCursor = this.history.length - 1;
  }

  private allocateSlideId(): SlideId {
    do {
      this.idCounter += 1;
    } while (this.deck.slides.some((slide) => slide.id === `slide-${this.idCounter}`));
    return `slide-${this.idCounter}`;
  }

  private insertSlide(slide: HtmlDeckSlide, index: number): void {
    const slides = [...this.deck.slides];
    slides.splice(Math.max(0, Math.min(index, slides.length)), 0, cloneSlide(slide));
    this.deck = { ...this.deck, slides };
  }

  private takeSlide(slideId: SlideId): { slide: HtmlDeckSlide; index: number } | null {
    const index = this.deck.slides.findIndex((slide) => slide.id === slideId);
    if (index < 0) return null;
    const slide = cloneSlide(this.deck.slides[index]);
    this.deck = { ...this.deck, slides: this.deck.slides.filter((candidate) => candidate.id !== slideId) };
    return { slide, index };
  }

  getSnapshot(): DeckSnapshot {
    const activeSlideIndex = this.deck.slides.findIndex((slide) => slide.id === this.activeSlideId);
    return {
      revision: this.revision,
      deck: this.deck,
      activeSlideId: this.activeSlideId,
      activeSlideIndex,
      canUndo: this.historyCursor >= 0,
      canRedo: this.historyCursor < this.history.length - 1,
      dirty: this.currentContent !== this.checkpointContent
    };
  }

  setActiveSlide(slideId: SlideId): DeckCommandResult {
    if (!this.deck.slides.some((slide) => slide.id === slideId)) return this.failure('slide-not-found', `Slide ${slideId} does not exist.`);
    if (this.activeSlideId === slideId) return this.success('Slide already active.', slideId);
    this.activeSlideId = slideId;
    this.emit();
    return this.success('Changed active slide.', slideId);
  }

  addSlide(options: AddSlideOptions = {}): DeckCommandResult {
    const id = options.slide?.id?.trim() || this.allocateSlideId();
    if (this.deck.slides.some((slide) => slide.id === id)) return this.failure('duplicate-slide-id', `Slide ${id} already exists.`);
    const afterIndex = options.afterSlideId
      ? this.deck.slides.findIndex((slide) => slide.id === options.afterSlideId)
      : this.deck.slides.length - 1;
    if (options.afterSlideId && afterIndex < 0) return this.failure('slide-not-found', `Slide ${options.afterSlideId} does not exist.`);

    let storedSlide: HtmlDeckSlide = {
      id,
      html: options.slide?.html ?? createBlankSlideHtml(this.deck.width, this.deck.height),
      title: options.slide?.title ?? `Slide ${this.deck.slides.length + 1}`,
      label: options.slide?.label,
      notes: options.slide?.notes,
      metadata: options.slide?.metadata ? { ...options.slide.metadata } : undefined
    };
    const index = Math.max(0, afterIndex + 1);
    const previousActive = this.activeSlideId;
    this.insertSlide(storedSlide, index);
    this.activeSlideId = id;
    this.record({
      description: 'Add slide',
      undo: () => {
        const removed = this.takeSlide(id);
        if (removed) storedSlide = removed.slide;
        this.activeSlideId = this.deck.slides.some((slide) => slide.id === previousActive) ? previousActive : this.deck.slides[0].id;
      },
      redo: () => {
        this.insertSlide(storedSlide, index);
        this.activeSlideId = id;
      }
    });
    this.touch();
    return this.success('Add slide', id);
  }

  duplicateSlide(slideId: SlideId): DeckCommandResult {
    const index = this.deck.slides.findIndex((slide) => slide.id === slideId);
    if (index < 0) return this.failure('slide-not-found', `Slide ${slideId} does not exist.`);
    const source = this.deck.slides[index];
    const title = source.title ? `${source.title} copy` : `Slide ${index + 2}`;
    return this.addSlide({
      afterSlideId: slideId,
      slide: { ...cloneSlide(source), id: this.allocateSlideId(), title }
    });
  }

  removeSlide(slideId: SlideId): DeckCommandResult {
    if (this.deck.slides.length === 1) return this.failure('last-slide', 'A deck must contain at least one slide.');
    const previousActive = this.activeSlideId;
    const removed = this.takeSlide(slideId);
    if (!removed) return this.failure('slide-not-found', `Slide ${slideId} does not exist.`);
    let storedSlide = removed.slide;
    const afterActive = previousActive === slideId
      ? this.deck.slides[Math.min(removed.index, this.deck.slides.length - 1)].id
      : previousActive;
    this.activeSlideId = afterActive;
    this.record({
      description: 'Remove slide',
      undo: () => {
        this.insertSlide(storedSlide, removed.index);
        this.activeSlideId = previousActive;
      },
      redo: () => {
        const nextRemoved = this.takeSlide(slideId);
        if (nextRemoved) storedSlide = nextRemoved.slide;
        this.activeSlideId = afterActive;
      }
    });
    this.touch();
    return this.success('Remove slide', afterActive);
  }

  moveSlide(slideId: SlideId, toIndex: number): DeckCommandResult {
    const fromIndex = this.deck.slides.findIndex((slide) => slide.id === slideId);
    if (fromIndex < 0) return this.failure('slide-not-found', `Slide ${slideId} does not exist.`);
    const targetIndex = Math.max(0, Math.min(Math.trunc(toIndex), this.deck.slides.length - 1));
    if (fromIndex === targetIndex) return this.success('Slide already in position.', slideId);

    const move = (from: number, to: number) => {
      const slides = [...this.deck.slides];
      const [slide] = slides.splice(from, 1);
      slides.splice(to, 0, slide);
      this.deck = { ...this.deck, slides };
    };
    move(fromIndex, targetIndex);
    this.record({
      description: 'Move slide',
      undo: () => move(this.deck.slides.findIndex((slide) => slide.id === slideId), fromIndex),
      redo: () => move(this.deck.slides.findIndex((slide) => slide.id === slideId), targetIndex)
    });
    this.touch();
    return this.success('Move slide', slideId);
  }

  updateSlide(slideId: SlideId, patch: Partial<Omit<HtmlDeckSlide, 'id'>>, options: UpdateSlideOptions = {}): DeckCommandResult {
    const index = this.deck.slides.findIndex((slide) => slide.id === slideId);
    if (index < 0) return this.failure('slide-not-found', `Slide ${slideId} does not exist.`);
    const before = cloneSlide(this.deck.slides[index]);
    const after: HtmlDeckSlide = {
      ...before,
      ...patch,
      id: slideId,
      metadata: patch.metadata ? { ...patch.metadata } : before.metadata
    };
    if (JSON.stringify(before) === JSON.stringify(after)) return this.success('Slide unchanged.', slideId);
    this.deck = { ...this.deck, slides: replaceAt(this.deck.slides, index, after) };

    if (options.recordHistory !== false) {
      const fields = Object.keys(patch) as (keyof Omit<HtmlDeckSlide, 'id'>)[];
      this.record({
        description: options.description ?? 'Update slide',
        undo: () => {
          const currentIndex = this.deck.slides.findIndex((slide) => slide.id === slideId);
          if (currentIndex >= 0) {
            const restored = restoreUpdatedFields(this.deck.slides[currentIndex], before, fields);
            this.deck = { ...this.deck, slides: replaceAt(this.deck.slides, currentIndex, restored) };
          }
        },
        redo: () => {
          const currentIndex = this.deck.slides.findIndex((slide) => slide.id === slideId);
          if (currentIndex >= 0) {
            const restored = restoreUpdatedFields(this.deck.slides[currentIndex], after, fields);
            this.deck = { ...this.deck, slides: replaceAt(this.deck.slides, currentIndex, restored) };
          }
        }
      });
    }
    this.touch();
    return this.success(options.description ?? 'Update slide', slideId);
  }

  replaceDeck(deckInput: HtmlDeck, options: ReplaceDeckOptions = {}): DeckCommandResult {
    const before = normalizeDeck(this.deck);
    const beforeActive = this.activeSlideId;
    const after = normalizeDeck(deckInput);
    const requestedActive = options.activeSlideId;
    const afterActive = requestedActive && after.slides.some((slide) => slide.id === requestedActive)
      ? requestedActive
      : after.slides[0].id;
    const description = options.description ?? 'Replace deck';

    if (JSON.stringify(before) === JSON.stringify(after) && beforeActive === afterActive) {
      return this.success('Deck unchanged.', afterActive);
    }

    const apply = (deck: HtmlDeck, activeSlideId: SlideId) => {
      this.deck = normalizeDeck(deck);
      this.activeSlideId = this.deck.slides.some((slide) => slide.id === activeSlideId)
        ? activeSlideId
        : this.deck.slides[0].id;
      this.idCounter = this.deck.slides.length;
    };

    apply(after, afterActive);
    if (options.recordHistory !== false) {
      this.record({
        description,
        undo: () => apply(before, beforeActive),
        redo: () => apply(after, afterActive)
      });
    }
    this.touch();
    return this.success(description, afterActive);
  }

  createCheckpoint(): void {
    this.checkpointContent = this.currentContent;
    this.emit();
  }

  undo(): DeckCommandResult {
    if (this.historyCursor < 0) return this.failure('nothing-to-undo', 'Nothing to undo.');
    const entry = this.history[this.historyCursor];
    entry.undo();
    this.historyCursor -= 1;
    this.touch();
    return this.success(`Undo: ${entry.description}`, this.activeSlideId);
  }

  redo(): DeckCommandResult {
    if (this.historyCursor >= this.history.length - 1) return this.failure('nothing-to-redo', 'Nothing to redo.');
    const entry = this.history[this.historyCursor + 1];
    entry.redo();
    this.historyCursor += 1;
    this.touch();
    return this.success(`Redo: ${entry.description}`, this.activeSlideId);
  }

  export(): HtmlDeck {
    return normalizeDeck(this.deck);
  }
}
