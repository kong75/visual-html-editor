import { EditorController, emailProfile, type TransactionCommittedEvent } from '@visual-html/core';

const controller = await EditorController.create({
  html: '<!doctype html><html><body><h1>Generated email</h1></body></html>',
  profile: emailProfile
});

let transaction: TransactionCommittedEvent | undefined;
controller.on('transactionCommitted', (event) => { transaction = event; });
const heading = controller.getSnapshot().nodes.find((node) => node.tagName === 'h1');
if (!heading) throw new Error('Expected a heading.');
await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'Edited email' });

if (!transaction || !(await controller.export()).html.includes('Edited email')) {
  throw new Error('Packed headless consumer did not complete an edit.');
}
