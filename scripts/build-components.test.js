const fs = require('fs');
const path = require('path');
const os = require('os');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { buildComponents, getComponentNames, PLACEHOLDER } = require('./build-components.js');

describe('build-components', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-components-'));
  });

  after(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('injects bundled IIFE into HTML when component subdir has .js and .html and HTML has placeholder', () => {
    const widgetDir = path.join(tmpDir, 'widget');
    fs.mkdirSync(widgetDir, { recursive: true });
    const htmlPath = path.join(widgetDir, 'widget.html');
    fs.writeFileSync(path.join(widgetDir, 'widget.js'), "document.body.dataset.ready = 'yes';", 'utf8');
    fs.writeFileSync(
      htmlPath,
      `<body>\n${PLACEHOLDER}\n</body>`,
      'utf8'
    );

    const indexPath = path.join(tmpDir, 'index.html');
    buildComponents(tmpDir, indexPath);

    assert.ok(fs.readFileSync(htmlPath, 'utf8').includes(PLACEHOLDER), 'Source HTML should keep placeholder (build does not mutate source)');
    assert.ok(fs.existsSync(indexPath), 'Index file should be written');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    assert.ok(indexHtml.includes('<script id="widget">'), 'Index should contain script tag for widget');
    assert.ok(indexHtml.includes("dataset.ready = \"yes\""), 'Index should contain the bundled logic');
  });

  it('ignores subdirs that have .js but no matching .html', () => {
    const orphanDir = path.join(tmpDir, 'orphan');
    fs.mkdirSync(orphanDir, { recursive: true });
    fs.writeFileSync(path.join(orphanDir, 'orphan.js'), "console.log('orphan');", 'utf8');
    const names = getComponentNames(tmpDir);
    assert.ok(!names.includes('orphan'), 'getComponentNames should not include orphan when orphan.html is missing');
    assert.ok(!fs.existsSync(path.join(orphanDir, 'orphan.html')));
  });

  it('skips when HTML has no placeholder and does not overwrite file', () => {
    const noplaceDir = path.join(tmpDir, 'noplace');
    fs.mkdirSync(noplaceDir, { recursive: true });
    const htmlPath = path.join(noplaceDir, 'noplace.html');
    const originalHtml = '<body><p>No placeholder here</p></body>';
    fs.writeFileSync(path.join(noplaceDir, 'noplace.js'), "console.log('noplace');", 'utf8');
    fs.writeFileSync(htmlPath, originalHtml, 'utf8');

    buildComponents(tmpDir, path.join(tmpDir, 'index.html'));

    const html = fs.readFileSync(htmlPath, 'utf8');
    assert.strictEqual(html, originalHtml, 'HTML without placeholder should be unchanged');
  });

  it('does not throw when components directory does not exist', () => {
    const missingDir = path.join(tmpDir, 'nonexistent');
    assert.doesNotThrow(() => buildComponents(missingDir));
  });

  it('replaces only the first occurrence of placeholder', () => {
    const firstDir = path.join(tmpDir, 'first');
    fs.mkdirSync(firstDir, { recursive: true });
    fs.writeFileSync(path.join(firstDir, 'first.js'), "void 0;", 'utf8');
    fs.writeFileSync(
      path.join(firstDir, 'first.html'),
      `before\n${PLACEHOLDER}\nmiddle\n${PLACEHOLDER}\nafter`,
      'utf8'
    );

    const indexPath = path.join(tmpDir, 'index.html');
    buildComponents(tmpDir, indexPath);

    const sourceHtml = fs.readFileSync(path.join(firstDir, 'first.html'), 'utf8');
    assert.ok(sourceHtml.includes(PLACEHOLDER), 'Source should still contain placeholder (build does not mutate)');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    const scriptCount = (indexHtml.match(/<script id="first">/g) || []).length;
    assert.strictEqual(scriptCount, 1, 'Index should have exactly one script tag for first');
  });
});
