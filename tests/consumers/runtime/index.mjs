import assert from 'node:assert/strict';
import { EditorController, emailProfile } from '@visual-html/core';
import { emailProfile as subpathProfile } from '@visual-html/core/profiles/email';
import { DeckController, parseDeck, serializeDeck } from '@visual-html/deck';
import { isClaudeDesignDeck } from '@visual-html/deck/adapters/claude-design';

assert.equal(subpathProfile.id, emailProfile.id);
const html = '<p>Hello &amp; welcome</p>';
const editor = await EditorController.create({ html, profile: emailProfile });
assert.equal((await editor.export()).html, html);
const paragraph = editor.getSnapshot().nodes.find((node) => node.tagName === 'p');
assert.ok(paragraph);
assert.equal((await editor.dispatch({ type: 'setText', nodeKey: paragraph.key, text: 'Updated & saved' })).ok, true);
assert.match((await editor.export()).html, /Updated &amp; saved/);
await editor.undo();
assert.equal((await editor.export()).html, html);
const deck = await DeckController.create({ deck: {
  schema: 'visual-html-deck', version: 1, id: 'runtime-test', title: 'Runtime test',
  width: 1280, height: 720, slides: [{ id: 'first', html: '<h1>First slide</h1>' }]
} });
deck.addSlide();
const serialized = serializeDeck(deck.export());
assert.equal(parseDeck(serialized).slides.length, 2);
assert.equal(serializeDeck(parseDeck(serialized)), serialized);
assert.equal(isClaudeDesignDeck('<p>Not a deck</p>'), false);
console.log('Core edit/export/history and deck serialization/subpaths passed.');
