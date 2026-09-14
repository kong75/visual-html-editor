export { DeckController } from './controller.js';
export { cloneSlide, createBlankSlideHtml, normalizeDeck, parseDeck, serializeDeck } from './serialization.js';
export { exportClaudeDesignDeck, importClaudeDesignDeck, isClaudeDesignDeck } from './claude-design.js';
export type {
  AddSlideOptions,
  ClaudeDesignImportResult,
  ClaudeDesignImportWarning,
  CreateDeckControllerOptions,
  DeckCommandFailure,
  DeckCommandResult,
  DeckCommandSuccess,
  DeckId,
  DeckSnapshot,
  HtmlDeck,
  HtmlDeckSlide,
  ReplaceDeckOptions,
  SlideId,
  UpdateSlideOptions
} from './types.js';
