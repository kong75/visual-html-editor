export type DeckId = string;
export type SlideId = string;

export interface HtmlDeckSlide {
  id: SlideId;
  html: string;
  title?: string;
  label?: string;
  notes?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface HtmlDeck {
  schema: 'visual-html-deck';
  version: 1;
  id: DeckId;
  title?: string;
  width: number;
  height: number;
  slides: readonly HtmlDeckSlide[];
  themeCss?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface DeckSnapshot {
  revision: number;
  deck: HtmlDeck;
  activeSlideId: SlideId;
  activeSlideIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
}

export interface DeckCommandSuccess {
  ok: true;
  revision: number;
  description: string;
  slideId?: SlideId;
}

export interface DeckCommandFailure {
  ok: false;
  code: string;
  message: string;
}

export type DeckCommandResult = DeckCommandSuccess | DeckCommandFailure;

export interface CreateDeckControllerOptions {
  deck: HtmlDeck;
  activeSlideId?: SlideId;
}

export interface AddSlideOptions {
  afterSlideId?: SlideId;
  slide?: Partial<Omit<HtmlDeckSlide, 'id'>> & { id?: SlideId };
}

export interface UpdateSlideOptions {
  recordHistory?: boolean;
  description?: string;
}

export interface ReplaceDeckOptions {
  activeSlideId?: SlideId;
  recordHistory?: boolean;
  description?: string;
}

export interface ClaudeDesignImportWarning {
  code: string;
  message: string;
}

export interface ClaudeDesignImportResult {
  deck: HtmlDeck;
  warnings: readonly ClaudeDesignImportWarning[];
}
