#!/usr/bin/env node
import { runCli } from './visual-html-server.mjs';

runCli(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Unable to start Visual HTML.'}\n`);
  process.exitCode = 1;
});
