#!/usr/bin/env node
import { runCli } from './visual-html-server.mjs';
import { registryHelp, runRegistryCli } from './visual-html-registry.mjs';

const args = process.argv.slice(2);
const sourceCommands = new Set(['init', 'add', 'diff', 'update']);
const operation = args.length === 0 || args[0] === '--help' || args[0] === '-h'
  ? Promise.resolve(process.stdout.write(registryHelp()))
  : sourceCommands.has(args[0])
    ? runRegistryCli(args)
    : runCli(args);

operation.catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Unable to start Visual HTML.'}\n`);
  process.exitCode = 1;
});
