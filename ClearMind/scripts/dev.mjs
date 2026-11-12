// Runs the API and the Vite dev server together for `npm run dev`.
//
// This is a script rather than a dependency on purpose: `npm run install:all`
// installs server/ and client/ packages, and a root-level helper package would
// be missing at exactly the moment someone first tries `npm run dev`. Node's
// own child_process has everything this needs.

import { spawn } from 'node:child_process';
import process from 'node:process';

const targets = [
  { name: 'server', colour: '\u001b[36m', cwd: 'server' },
  { name: 'client', colour: '\u001b[35m', cwd: 'client' },
];

const RESET = '\u001b[0m';
const children = [];
let shuttingDown = false;

function prefixLines(stream, name, colour) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      process.stdout.write(`${colour}[${name}]${RESET} ${line}\n`);
    }
  });
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(code);
}

for (const target of targets) {
  const child = spawn('npm', ['run', 'dev'], {
    cwd: new URL(`../${target.cwd}/`, import.meta.url),
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  prefixLines(child.stdout, target.name, target.colour);
  prefixLines(child.stderr, target.name, target.colour);

  child.on('exit', (code) => {
    process.stdout.write(`${target.colour}[${target.name}]${RESET} exited (${code})\n`);
    shutdown(code ?? 0);
  });

  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.stdout.write(
  'ClearMind dev servers starting.\n' +
    '  API    http://localhost:4000\n' +
    '  Client http://localhost:5173   <- open this one\n\n'
);
