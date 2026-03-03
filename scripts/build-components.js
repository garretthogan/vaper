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
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .trim();

  return { headInner, bodyMarkup, scriptContent };
}

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

  const useScope = componentsData && componentsData.length > 0;
  const tttNames = ['board', 'tic-tac-toe'];
  const hasTtt = tttNames.every((n) => names.includes(n));

  let bodyContent;
  if (useScope) {
    const cards = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (name === 'tic-tac-toe' && hasTtt) continue; /* emitted with board as one app */
      if (name === 'board' && hasTtt) {
        const boardMarkup = bodyParts[i];
        const tttMarkup = bodyParts[names.indexOf('tic-tac-toe')];
        cards.push(`<div data-app="ttt">${wrapScope('board', boardMarkup)}${wrapScope('tic-tac-toe', tttMarkup)}</div>`);
      } else {
        cards.push(wrapScope(name, bodyParts[i]));
      }
    }
    bodyContent = cards.join('\n');
  } else {
    const cards = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (name === 'tic-tac-toe' && hasTtt) continue;
      if (name === 'board' && hasTtt) {
        cards.push(`<div data-app="ttt">${bodyParts[i]}${bodyParts[names.indexOf('tic-tac-toe')]}</div>`);
      } else {
        cards.push(bodyParts[i]);
      }
    }
    bodyContent = cards.join('\n');
  }

  /* Scripts at top level at bottom of body, never inside containers */
  const bodyHtml = bodyContent + (scriptTags.length ? '\n' + scriptTags.join('\n') : '');

  const designSystemLink = '<link rel="stylesheet" href="design-system.css" />';
  const layoutLink = '\n  <link rel="stylesheet" href="layout.css" />';
  const headWithLayout = designSystemLink + layoutLink + '\n  ' + componentStylesHtml + firstHead;
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
          sourcemap: true,
          sourcesContent: true,
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
    const layoutSrc = path.join(projectRoot, 'design-system', 'layout.css');
    const layoutDest = path.join(distDir, 'layout.css');
    if (fs.existsSync(layoutSrc)) {
      fs.copyFileSync(layoutSrc, layoutDest);
      console.log('Copied layout.css to dist/');
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
