// Runs after electron-builder packages each target.
// Copies .env from the project root into the output directory so the app
// can find it next to the executable without any manual step.

const fs = require('fs');
const path = require('path');

module.exports = async function afterPack({ appOutDir }) {
  const src = path.join(__dirname, '..', '.env');
  const dst = path.join(appOutDir, '.env');

  if (!fs.existsSync(src)) {
    console.warn('[afterPack] No .env found at project root – skipping copy. Create one from .env.example before packaging.');
    return;
  }

  fs.copyFileSync(src, dst);
  console.log(`[afterPack] Copied .env → ${dst}`);
};
