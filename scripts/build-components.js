const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const postcss = require('postcss');
const prefixSelector = require('postcss-prefix-selector');

const DEFAULT_COMPONENTS_DIR = path.join(__dirname, '../src', 'components');
const DEFAULT_LAYOUT_HTML_PATH = path.join(__dirname, '..', 'src', 'layout.html');
const PLACEHOLDER = '<!-- inject -->';
const HTML_IMPORT_NAMESPACE = 'html-import';

function createHtmlImportPlugin() {
  return {
    name: 'html-import',
    setup(build) {
      build.onResolve({ filter: /\.html$/ }, (args) => {
        const resolved = path.resolve(path.dirname(args.importer), args.path);
        return { path: resolved, namespace: HTML_IMPORT_NAMESPACE };
      });
      build.onLoad({ filter: /.*/, namespace: HTML_IMPORT_NAMESPACE }, (args) => {
        const html = fs.readFileSync(args.path, 'utf8');
        const { bodyMarkup } = parseComponentHtml(html);
        return {
          contents: `export default ${JSON.stringify(bodyMarkup)};`,
          loader: 'js',
        };
      });
    },
  };
}
const COMPONENT_TAG_PREFIX = 'vaper-';

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

const INCLUDE_PATTERN = /<!--\s*include:\s*([a-z0-9-]+)\s*-->/gi;

/**
 * Load layout from src/layout.html. Returns { headInner, bodyMarkup } or null
 * if the file is missing. bodyMarkup is used for the page body (component tags
 * are replaced with vaper-*). headInner is used for the generated index <head>.
 */
function loadLayoutHtml(layoutPath = DEFAULT_LAYOUT_HTML_PATH) {
  if (!fs.existsSync(layoutPath)) return null;
  try {
    const html = fs.readFileSync(layoutPath, 'utf8');
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!bodyMatch) return null;
    return {
      headInner: headMatch ? headMatch[1].trim() : '',
      bodyMarkup: bodyMatch[1].trim(),
    };
  } catch (e) {
    console.warn('Failed to load layout.html:', e.message);
    return null;
  }
}

function componentNameToTag(name) {
  return COMPONENT_TAG_PREFIX + name;
}

/**
 * Replace <!-- include: component-name --> with the component tag (with prefix for runtime).
 * so composition happens at runtime via custom elements.
 */
function replaceIncludeWithComponentTag(bodyMarkup) {
  return bodyMarkup.replace(INCLUDE_PATTERN, (match, name) => {
    const n = name.trim();
    return `<${componentNameToTag(n)}></${componentNameToTag(n)}>`;
  });
}

/**
 * Replace unprefixed component tags like <board></board> with <vaper-board></vaper-board>
 * so authors can write <board></board> in source. Custom elements require a hyphen in the name.
 */
function replaceUnprefixedComponentTags(bodyMarkup, componentNames) {
  const names = [...componentNames].sort((a, b) => b.length - a.length);
  let out = bodyMarkup;
  for (const name of names) {
    const open = new RegExp('<' + name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '(\\s|>|\\/)', 'g');
    const close = new RegExp('</' + name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '>', 'g');
    out = out.replace(open, '<' + componentNameToTag(name) + '$1');
    out = out.replace(close, '</' + componentNameToTag(name) + '>');
  }
  return out;
}

/**
 * Wrap bundled script so it runs with host as root; remove document root lookup;
 * replace document.getElementById with root.querySelector for use inside custom element.
 */
const VAPER_HOST_VAR = '__vaperHost';

function wrapScriptAsInit(bundledCode) {
  let code = bundledCode
    .replace(/const\s+root\s*=\s*document\.querySelector\s*\([^)]+\);?\s*\n?/g, '')
    .replace(/if\s*\(\s*!root\s*\)\s*return;?\s*\n?/g, '')
    .replace(/var\s+root\s*=\s*document\.querySelector\s*\([^)]+\);?\s*\n?/g, '')
    .replace(/var\s+root\s*=\s*\w+\.closest\s*\([^;]+\)\s*;?\s*\n?/g, '');
  code = code.replace(/document\.getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/g, VAPER_HOST_VAR + ".querySelector('#$1')");
  return "'use strict';var " + VAPER_HOST_VAR + "=host;var root=" + VAPER_HOST_VAR + ";\n" + code;
}

function parseComponentHtml(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let bodyInner;
  let headInner = '';

  if (bodyMatch) {
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    headInner = headMatch ? headMatch[1].trim() : '';
    bodyInner = bodyMatch[1];
  } else {
    bodyInner = html;
  }

  const scriptMatch = bodyInner.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  const scriptContent = scriptMatch ? scriptMatch[1].trim() : null;
  const bodyMarkup = bodyInner
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .trim();

  return { headInner, bodyMarkup, scriptContent };
}

/**
 * Resolve <!-- include: component-name --> placeholders in markup.
 * Replaces each with the referenced component's body markup (recursive).
 * Wraps included markup in the component's scope so its scoped CSS still applies.
 * Detects circular includes and leaves the placeholder when missing component.
 */
function resolveIncludes(bodyMarkup, componentName, componentsByName, visited = new Set()) {
  if (visited.has(componentName)) {
    console.warn(`Circular include detected involving "${componentName}"; skipping.`);
    return bodyMarkup.replace(INCLUDE_PATTERN, () => '');
  }
  visited.add(componentName);
  const resolved = bodyMarkup.replace(INCLUDE_PATTERN, (match, includedName) => {
    const name = includedName.trim();
    const included = componentsByName[name];
    if (!included) {
      console.warn(`Unknown component in include: "${name}" (from ${componentName})`);
      return '';
    }
    const inner = resolveIncludes(included.bodyMarkup, name, componentsByName, new Set(visited));
    return `<div data-component="${name}">${inner}</div>`;
  });
  visited.delete(componentName);
  return resolved;
}

function stripSourceMapComment(code) {
  return code.replace(/\n?\/\/# sourceMappingURL=[^\n]*$/, '');
}

function buildWebComponentRegistry(componentsData) {
  const templates = {};
  const inits = {};
  for (const c of componentsData) {
    templates[c.baseName] = c.bodyMarkup;
    if (c.scriptContent) {
      const script = stripSourceMapComment(c.scriptContent);
      const body = wrapScriptAsInit(script);
      const escaped = body
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
      inits[c.baseName] = "new Function('host', '" + escaped + "')";
    } else {
      inits[c.baseName] = 'function(host){}';
    }
  }
  const templatesJson = JSON.stringify(templates);
  const initLines = componentsData.map((c, i) =>
    '  "' + c.baseName + '": ' + inits[c.baseName] + (i < componentsData.length - 1 ? ',' : ''));
  const lines = [
    'window.VAPER_TEMPLATES = ' + templatesJson + ';',
    'window.VAPER_INITS = {',
    ...initLines,
    '};',
    '(function(){',
    '  function register(){',
    '    for (var name in window.VAPER_TEMPLATES) {',
    "      var tag = 'vaper-' + name;",
    '      if (customElements.get(tag)) continue;',
    '      customElements.define(tag, function(name){',
    '        return class extends HTMLElement {',
    '          connectedCallback() {',
    '            if (this._vaperConnected) return;',
    '            this._vaperConnected = true;',
    '            this.setAttribute("data-component", name);',
    '            this.innerHTML = window.VAPER_TEMPLATES[name];',
    '            if (window.VAPER_INITS[name]) window.VAPER_INITS[name](this);',
    '          }',
    '        };',
    '      }(name));',
    '    }',
    '  }',
    '  register();',
    '})();'
  ];
  return lines.join('\n');
}

function combineToIndex(componentsDir, indexPath, componentsData = null, options = null) {
  const opts = options && typeof options === 'object' ? options : { includedOnlyNames: options };
  const includedOnlyNames = opts.includedOnlyNames;
  const layoutBody = opts.layoutBody;
  const layoutHead = opts.layoutHead;
  const layoutOrder = opts.layoutOrder;
  const useWebComponents = (typeof layoutBody === 'string' && layoutBody.length > 0) ||
    (Array.isArray(layoutOrder) && layoutOrder.length > 0);
  const skipCard = includedOnlyNames && typeof includedOnlyNames.has === 'function' ? (name) => includedOnlyNames.has(name) : () => false;
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
      if (!useWebComponents && c.scriptContent && !skipCard(c.baseName)) {
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
      if (!useWebComponents && scriptContent) {
        scriptTags.push(`<script id="${baseName}">\n${scriptContent}\n</script>`);
      }
    }
  }

  const useScope = componentsData && componentsData.length > 0;

  let bodyContent;
  if (useWebComponents) {
    if (typeof layoutBody === 'string' && layoutBody.length > 0) {
      bodyContent = layoutBody;
    } else {
      bodyContent = layoutOrder
        .filter((name) => names.includes(name))
        .map((name) => `<${componentNameToTag(name)}></${componentNameToTag(name)}>`)
        .join('\n');
    }
    scriptTags.length = 0;
    scriptTags.push('<script src="vaper-registry.js"></script>');
  } else if (useScope) {
    const cards = names
      .map((name, i) => (skipCard(name) ? null : wrapScope(name, bodyParts[i])))
      .filter(Boolean);
    bodyContent = cards.join('\n');
  } else {
    bodyContent = bodyParts.join('\n');
  }

  /* Scripts at top level at bottom of body, never inside containers */
  const bodyHtml = bodyContent + (scriptTags.length ? '\n' + scriptTags.join('\n') : '');

  const designSystemLink = '<link rel="stylesheet" href="design-system.css" />';
  const layoutLink = '\n  <link rel="stylesheet" href="layout.css" />';
  const headInner = typeof layoutHead === 'string' && layoutHead.length > 0
    ? layoutHead
    : firstHead;
  const headWithLayout = designSystemLink + layoutLink + '\n  ' + componentStylesHtml + headInner;
  const indexHtml =
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n  ' +
    headWithLayout +
    '\n</head>\n<body class="tui">\n' +
    bodyHtml +
    '\n</body>\n</html>';

  fs.writeFileSync(indexPath, indexHtml, 'utf8');
  console.log('Wrote index.html');
}

async function buildComponents(componentsDir = DEFAULT_COMPONENTS_DIR, outputIndexPath = null) {
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
        const result = await esbuild.build({
          entryPoints: [jsPath],
          bundle: true,
          format: 'iife',
          write: false,
          sourcemap: true,
          sourcesContent: true,
          plugins: [createHtmlImportPlugin()],
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
  const layout = loadLayoutHtml();
  let layoutBody = layout ? layout.bodyMarkup : null;
  const layoutHead = layout ? layout.headInner : null;
  const useWebComponents = typeof layoutBody === 'string' && layoutBody.length > 0;
  const componentNames = componentsData.map((c) => c.baseName);
  if (useWebComponents && layoutBody) {
    layoutBody = replaceUnprefixedComponentTags(layoutBody, componentNames);
  }

  const componentsByName = Object.fromEntries(componentsData.map((c) => [c.baseName, c]));
  const includedOnlyNames = new Set();
  for (const c of componentsData) {
    let m;
    INCLUDE_PATTERN.lastIndex = 0;
    while ((m = INCLUDE_PATTERN.exec(c.bodyMarkup)) !== null) includedOnlyNames.add(m[1].trim());
  }
  for (const c of componentsData) {
    if (useWebComponents) {
      c.bodyMarkup = replaceIncludeWithComponentTag(c.bodyMarkup);
      c.bodyMarkup = replaceUnprefixedComponentTags(c.bodyMarkup, componentNames);
    } else {
      c.bodyMarkup = resolveIncludes(c.bodyMarkup, c.baseName, componentsByName);
    }
  }

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
    if (useWebComponents) {
      const registryPath = path.join(distDir, 'vaper-registry.js');
      fs.writeFileSync(registryPath, buildWebComponentRegistry(componentsData), 'utf8');
      console.log('Wrote vaper-registry.js');
    }
  } else {
    const outDir = path.dirname(outputIndexPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  }

  combineToIndex(componentsDir, indexPath, componentsData, {
    includedOnlyNames: useWebComponents ? null : includedOnlyNames,
    layoutBody: useWebComponents ? layoutBody : null,
    layoutHead: useWebComponents ? layoutHead : null,
  });
}

if (require.main === module) {
  buildComponents().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  buildComponents,
  combineToIndex,
  getComponentNames,
  parseComponentHtml,
  resolveIncludes,
  loadLayoutHtml,
  componentNameToTag,
  replaceIncludeWithComponentTag,
  buildWebComponentRegistry,
  PLACEHOLDER
};
