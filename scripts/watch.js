const path = require('path');
const { spawn } = require('child_process');
const { buildComponents } = require('./build-components.js');

const projectRoot = path.join(__dirname, '..');
const componentsDir = path.join(projectRoot, 'src', 'components');
const designSystemDir = path.join(projectRoot, 'design-system');
const buildScript = path.join(__dirname, 'build-components.js');

const watchPaths = [
  componentsDir,
  designSystemDir,
  buildScript,
];

function runBuild() {
  console.log('[watch] Rebuilding...');
  try {
    buildComponents(componentsDir);
    console.log('[watch] Build done.');
  } catch (err) {
    console.error('[watch] Build failed:', err.message);
  }
}

runBuild();

const chokidar = require('chokidar');
const watcher = chokidar.watch(watchPaths, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
});

watcher.on('change', (p) => {
  console.log('[watch] Changed:', path.relative(projectRoot, p));
  runBuild();
});

watcher.on('ready', () => {
  console.log('[watch] Watching:', watchPaths.map((p) => path.relative(projectRoot, p)).join(', '));
});

const browserSync = require('browser-sync');
browserSync.init({
  server: path.join(projectRoot, 'dist'),
  files: [path.join(projectRoot, 'dist', '**')],
  watch: true,
  open: true,
  logLevel: 'silent',
  notify: false,
});
