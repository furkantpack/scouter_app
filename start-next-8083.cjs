const { spawn } = require('node:child_process');
const { openSync } = require('node:fs');
const path = require('node:path');

const output = openSync(path.join(__dirname, 'next-8083.log'), 'a');
const error = openSync(path.join(__dirname, 'next-8083-error.log'), 'a');

const child = spawn(
  process.execPath,
  [path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', '8083'],
  {
    cwd: __dirname,
    detached: true,
    stdio: ['ignore', output, error],
    windowsHide: true,
  },
);

child.unref();
console.log(child.pid);
