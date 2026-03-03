const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const postcss = require('postcss');
const prefixSelector = require('postcss-prefix-selector');

const DEFAULT_COMPONENTS_DIR = path.join(__dirname, '../src', 'components');
const PLACEHOLDER = '<!-- inject -->';

let sass;
function loadSass() {
  if (!sass) {
    try {
      sass = require('sass');
    } catch (_) {
      return null;
    }
  }
  return sass;
}

function loadComponentStyles(componentsDir, baseName) {
  const dir = path.join(componentsDir, baseName);
  const scssPath = path.join(dir, baseName + '.scss');
  const cssPath = path.join(dir, baseName + '.css');
  let rawCss = null;
  if (fs.existsSync(scssPath)) {
    const sassImpl = loadSass();
    if (sassImpl) {
      try {
        rawCss = sassImpl.compile(scssPath).css;
      } catch (err) {
        console.error(`Failed to compile ${baseName}/${baseName}.scss:`, err.message);
        return null;
      }
    } else {
      console.warn(`Found ${baseName}.scss but 'sass' not installed; run npm install`);
      return null;
    }
  } else if (fs.existsSync(cssPath)) {
    rawCss = fs.readFileSync(cssPath, 'utf8');
  }
  if (!rawCss) return null;

  const scope = `[data-component="${baseName}"]`;
  const result = postcss()
    .use(prefixSelector({ prefix: scope, skipGlobalSelectors: false }))
    .process(rawCss, { from: undefined });
  return result.css;
}

function getComponentNames(componentsDir) {
  const entries = fs.readdirSync(componentsDir, { withFileTypes: true });
  const subdirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  return subdirs
    .filter((name) => fs.existsSync(path.join(componentsDir, name, name + '.html')))
    .sort();
}

function parseComponentHtml(html) {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headInner = headMatch ? headMatch[1].trim() : '';

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return { headInner, bodyMarkup: '', scriptContent: null };
  const bodyInner = bodyMatch[1];

  const scriptMatch = bodyInner.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  const scriptContent = scriptMatch ? scriptMatch[1].trim() : null;
  const bodyMarkup = bodyInner
    .replace(/<script[^>]*>[\s\S]*?<\/script>/i, '')
    .trim();

  return { headInner, bodyMarkup, scriptContent };
}

const LAYOUT_CSS = `
  .games-container { display: flex; flex-wrap: wrap; gap: var(--tui-gap-lg); padding: var(--tui-pad-2); align-items: stretch; }
  .game-column { width: 320px; min-width: 320px; flex-shrink: 0; display: flex; flex-direction: column; gap: var(--tui-gap); padding: var(--tui-pad-2); border: var(--tui-bw) solid var(--tui-line-strong); min-height: 380px; }
  .game-column.game-ttt { justify-content: center; align-items: center; }
  .game-column.game-snake [data-component="snake"] { width: 100%; box-sizing: border-box; min-height: 0; }
  .game-column.game-snake .snake-panel { border: none; padding: 0; display: flex; flex-direction: column; gap: var(--tui-gap); flex: 1 1 auto; min-height: min-content; width: 100%; overflow: visible; }
  .game-column.game-snake #snake-canvas { border: var(--tui-bw) solid var(--tui-line-strong); background: var(--tui-bg); flex-shrink: 0; }
  .game-column.game-snake #snake-status { margin: 0; flex-shrink: 0; }
  .game-column.game-snake .snake-panel button { flex-shrink: 0; }
  .game-column.game-todo { justify-content: center; align-items: center; }
  .game-column.game-todo .todo-panel { border: none; padding: 0; display: flex; flex-direction: column; gap: var(--tui-gap); width: 100%; max-width: 100%; }
  .game-column.game-asteroids .asteroids-panel { border: none; padding: 0; display: flex; flex-direction: column; gap: var(--tui-gap); flex: 1; min-height: 0; justify-content: center; align-items: center; }
  .game-column.game-asteroids #asteroids-canvas { border: var(--tui-bw) solid var(--tui-line-strong); background: var(--tui-bg); flex-shrink: 0; }
  .game-column.game-asteroids #asteroids-status { margin: 0; }
  .game-column.game-movie-ranking { justify-content: flex-start; align-items: stretch; }
  .game-column.game-movie-ranking .movie-ranking-panel { border: none; padding: 0; display: flex; flex-direction: column; gap: var(--tui-gap); width: 100%; max-width: 100%; }
`;

function combineToIndex(componentsDir, indexPath, componentsData = null) {
  let names;
  let firstHead = '';
  const bodyParts = [];
  const scriptTags = [];

  const wrapScope = (name, markup) => `<div data-component="${name}">${markup}</div>`;
  let componentStylesHtml = '';

  if (componentsData && componentsData.length > 0) {
    names = componentsData.map((c) => c.baseName);
    for (const c of componentsData) {
      if (firstHead === '' && c.headInner) firstHead = c.headInner;
      bodyParts.push(c.bodyMarkup);
      if (c.scriptContent) {
        scriptTags.push(`<script id="${c.baseName}">\n${c.scriptContent}\n</script>`);
      }
      if (c.styleContent) {
        componentStylesHtml += `<style data-component="${c.baseName}">\n${c.styleContent}\n</style>\n  `;
      }
    }
  } else {
    names = getComponentNames(componentsDir);
    if (names.length === 0) return;

    for (const baseName of names) {
      const htmlPath = path.join(componentsDir, baseName, baseName + '.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      const { headInner, bodyMarkup, scriptContent } = parseComponentHtml(html);

      if (firstHead === '' && headInner) firstHead = headInner;
      bodyParts.push(bodyMarkup);
      if (scriptContent) {
        scriptTags.push(`<script id="${baseName}">\n${scriptContent}\n</script>`);
      }
    }
  }

  let bodyHtml;
  const tttNames = ['board', 'tic-tac-toe'];
  const snakeName = 'snake';
  const todoName = 'todo';
  const asteroidsName = 'asteroids';
  const movieRankingName = 'movie-ranking';
  const hasTtt = tttNames.every((n) => names.includes(n));
  const hasSnake = names.includes(snakeName);
  const hasTodo = names.includes(todoName);
  const hasAsteroids = names.includes(asteroidsName);
  const hasMovieRanking = names.includes(movieRankingName);
  const useScope = componentsData && componentsData.length > 0;
  const part = (name) => useScope ? wrapScope(name, bodyParts[names.indexOf(name)]) : bodyParts[names.indexOf(name)];

  if (hasTtt && hasSnake && hasTodo && hasAsteroids && hasMovieRanking) {
    const tttParts = tttNames.map((n) => part(n)).join('\n');
    bodyHtml =
      '<div class="games-container">' +
      '<div class="game-column game-ttt">' + tttParts + '</div>' +
      '<div class="game-column game-snake">' + part(snakeName) + '</div>' +
      '<div class="game-column game-todo">' + part(todoName) + '</div>' +
      '<div class="game-column game-asteroids">' + part(asteroidsName) + '</div>' +
      '<div class="game-column game-movie-ranking">' + part(movieRankingName) + '</div>' +
      '</div>\n' +
      scriptTags.join('\n');
  } else if (hasTtt && hasSnake && hasTodo && hasAsteroids) {
    const tttParts = tttNames.map((n) => part(n)).join('\n');
    bodyHtml =
      '<div class="games-container">' +
      '<div class="game-column game-ttt">' + tttParts + '</div>' +
      '<div class="game-column game-snake">' + part(snakeName) + '</div>' +
      '<div class="game-column game-todo">' + part(todoName) + '</div>' +
      '<div class="game-column game-asteroids">' + part(asteroidsName) + '</div>' +
      '</div>\n' +
      scriptTags.join('\n');
  } else if (hasTtt && hasSnake && hasTodo) {
    const tttParts = tttNames.map((n) => part(n)).join('\n');
    const snakePart = part(snakeName);
    const todoPart = part(todoName);
    bodyHtml =
      '<div class="games-container">' +
      '<div class="game-column game-ttt">' + tttParts + '</div>' +
      '<div class="game-column game-snake">' + snakePart + '</div>' +
      '<div class="game-column game-todo">' + todoPart + '</div>' +
      '</div>\n' +
      scriptTags.join('\n');
  } else if (hasTtt && hasSnake) {
    const tttParts = tttNames.map((n) => part(n)).join('\n');
    const snakePart = part(snakeName);
    bodyHtml =
      '<div class="games-container">' +
      '<div class="game-column game-ttt">' + tttParts + '</div>' +
      '<div class="game-column game-snake">' + snakePart + '</div>' +
      '</div>\n' +
      scriptTags.join('\n');
  } else {
    bodyHtml = (useScope ? names.map((n, i) => wrapScope(n, bodyParts[i])) : bodyParts).join('\n') + '\n' + scriptTags.join('\n');
  }

  const designSystemLink = '<link rel="stylesheet" href="design-system.css" />';
  const headWithLayout = designSystemLink + '\n  ' + componentStylesHtml + firstHead + (bodyHtml.includes('games-container') ? '\n  <style>' + LAYOUT_CSS + '</style>' : '');
  const indexHtml =
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n  ' +
    headWithLayout +
    '\n</head>\n<body class="tui">\n' +
    bodyHtml +
    '\n</body>\n</html>';

  fs.writeFileSync(indexPath, indexHtml, 'utf8');
  console.log('Wrote index.html');
}

function buildComponents(componentsDir = DEFAULT_COMPONENTS_DIR, outputIndexPath = null) {
  if (!fs.existsSync(componentsDir)) {
    console.warn('components/ directory not found; nothing to build.');
    return;
  }

  const names = getComponentNames(componentsDir);
  const componentsData = [];

  for (const baseName of names) {
    const htmlPath = path.join(componentsDir, baseName, baseName + '.html');
    const jsPath = path.join(componentsDir, baseName, baseName + '.js');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const { headInner, bodyMarkup, scriptContent: parsedScript } = parseComponentHtml(html);

    let scriptContent = parsedScript;
    if (html.includes(PLACEHOLDER) && fs.existsSync(jsPath)) {
      try {
        const result = esbuild.buildSync({
          entryPoints: [jsPath],
          bundle: true,
          format: 'iife',
          write: false,
        });
        scriptContent = result.outputFiles[0].text;
        console.log(`Bundled ${baseName}/${baseName}.js for index`);
      } catch (err) {
        console.error(`Failed to bundle ${baseName}/${baseName}.js:`, err.message);
      }
    }

    const styleContent = loadComponentStyles(componentsDir, baseName);
    if (styleContent) {
      console.log(`Scoped styles from ${baseName}/${baseName}.css or .scss`);
    }
    componentsData.push({ baseName, headInner, bodyMarkup, scriptContent, styleContent: styleContent || null });
  }

  const projectRoot = path.join(__dirname, '..');
  const distDir = path.join(projectRoot, 'dist');
  const indexPath = typeof outputIndexPath === 'string'
    ? outputIndexPath
    : path.join(distDir, 'index.html');

  if (typeof outputIndexPath !== 'string') {
    if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
    const designSystemSrc = path.join(projectRoot, 'design-system', 'design-system.css');
    const designSystemDest = path.join(distDir, 'design-system.css');
    if (fs.existsSync(designSystemSrc)) {
      fs.copyFileSync(designSystemSrc, designSystemDest);
      console.log('Copied design-system.css to dist/');
    }
  } else {
    const outDir = path.dirname(outputIndexPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  }

  combineToIndex(componentsDir, indexPath, componentsData);
}

if (require.main === module) {
  buildComponents();
}

module.exports = { buildComponents, combineToIndex, getComponentNames, parseComponentHtml, PLACEHOLDER };
