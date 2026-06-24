// Spawn Next in a fresh Node process whose cwd is the *canonical* (correctly
// cased, fully-resolved) project path. This sidesteps a Windows quirk where
// `C:\Repos` and `C:\repos` both resolve to the same folder, and Node's
// require cache + pnpm's symlinks end up loading every Next module twice
// — once under each casing. Two module instances ⇒ two React contexts
// ⇒ "invariant expected layout router to be mounted".
//
// chdir in-process doesn't help: Node has already cached its module paths
// by the time the wrapper runs. We need a clean child process.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const canonical = fs.realpathSync.native
  ? fs.realpathSync.native(process.cwd())
  : fs.realpathSync(process.cwd());

const nextBin = path.join(
  canonical,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

const result = spawnSync(
  process.execPath,
  [nextBin, ...process.argv.slice(2)],
  { cwd: canonical, stdio: "inherit" },
);

process.exit(result.status ?? 1);
