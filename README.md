# Vaper

A small, script-based framework for building web apps. Add components in `src/components/`, compose the page in `src/layout.html`, and the build produces a single app. Supports **web components** (custom elements), **composition** (use one component inside another), and **HTML imports in JS**. No framework runtime—just HTML, CSS, and JavaScript.

---

## Quick start

```bash
npm install
npm run build    # Build once → output in dist/
npm run dev      # Watch files and serve dist/ with live reload
```

Open the URL shown by `npm run dev` (e.g. http://localhost:3000) to view the app.

---

## Layout

The **page layout** is defined by **`src/layout.html`**. Use component tags to arrange what appears on the page.

**Example: `src/layout.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Layout</title>
</head>
<body>
  <tic-tac-toe></tic-tac-toe>
  <todo></todo>
  <snake></snake>
  <asteroids></asteroids>
  <movie-ranking></movie-ranking>
  <three-keyframes></three-keyframes>
</body>
</html>
```

- When `src/layout.html` exists, the build runs in **web component mode**: each component is registered as a custom element (`vaper-tic-tac-toe`, `vaper-todo`, etc.), and the layout body is the page. Unprefixed tags like `<todo>` are rewritten to `<vaper-todo>` at build time (custom elements require a hyphen).
- If `layout.html` is missing, the build falls back to the legacy behavior: one card per component, in folder order.

---

## Components

### What counts as a component?

A folder under `src/components/` is a component if it contains a matching HTML file:

- Folder: `src/components/my-app/`
- Required file: `src/components/my-app/my-app.html`

The folder name and the HTML filename (without `.html`) must match.

### Component files

| File | Required? | Purpose |
|------|-----------|--------|
| `{name}.html` | **Yes** | Markup. Can be a full document (`<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`) or **partial** (just the fragment you need, e.g. a single `<li>`). Use `<!-- inject -->` if you want the JS bundle injected. |
| `{name}.js` | No | Script. Bundled by esbuild and injected only when the HTML contains `<!-- inject -->`. Supports `import` (including `.html` imports). |
| `{name}.css` or `{name}.scss` | No | Styles. Compiled (SCSS if present) and **scoped** to `[data-component="{name}"]`. |

### Partial HTML

Component HTML does not need a full document. You can write only the body content:

**Example: partial `todo-item/todo-item.html`**

```html
<li>
  <input type="checkbox" class="todo-item-checkbox" aria-label="Toggle done" />
  <label class="todo-item-label"></label>
  <button type="button" class="todo-item-delete">Delete</button>
</li>
```

The build uses this as the component’s markup (no `<html>` or `<body>` wrapper). Script blocks are still stripped and handled separately if present.

### Composition

Use one component inside another in two ways.

**1. Component tags in HTML**

In a component’s HTML, use the other component by tag name. The build rewrites these to the real custom element name (e.g. `vaper-board`).

**Example: tic-tac-toe uses the board**

```html
<div id="game">
  <board></board>
  <p id="status">Player X's turn</p>
  <button type="button" id="restart">Restart</button>
</div>
<!-- inject -->
```

Or use the comment form: `<!-- include: board -->` (replaced with `<vaper-board></vaper-board>` when using web components).

**2. Import HTML in JavaScript**

Import another component’s markup as a string and use it in your script (e.g. to clone for list items).

**Example: todo imports the todo-item markup**

```javascript
import itemMarkup from '../todo-item/todo-item.html';

(function () {
  const listEl = root.querySelector('#todo-list');
  // ...
  function getItemEl() {
    if (!itemTemplateEl) {
      const wrap = document.createElement('div');
      wrap.innerHTML = itemMarkup;
      itemTemplateEl = wrap.firstElementChild;
    }
    return itemTemplateEl;
  }
  // For each item: getItemEl().cloneNode(true), then fill in data
})();
```

- Imports are resolved relative to the importing file.
- The imported value is the **body markup** of that HTML file (full or partial).
- The build uses an esbuild plugin to turn `import x from '*.html'` into a string export.

### Scripts and the host element

When using **web component mode** (layout present), each component’s script runs with a **host** element: the custom element instance. The build wraps your script so that:

- `document.getElementById('id')` is rewritten to `root.querySelector('#id')` (or `__vaperHost.querySelector('#id')`) so each instance only sees its own DOM.
- `root` (and `__vaperHost`) refer to the host element.

Write your script to use `root` (or the injected host variable) when querying the DOM so multiple instances work correctly.

### Full document example

**Example: `calculator/calculator.html` (full document + JS)**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Calculator</title>
</head>
<body>
  <div class="calculator-panel">
    <output id="calc-display" aria-live="polite">0</output>
    <button type="button" id="calc-clear">Clear</button>
  </div>
  <!-- inject -->
</body>
</html>
```

The comment `<!-- inject -->` is replaced by the bundled output of `calculator.js`.

---

## Build behavior (reference)

- **Discovery:** The build scans `src/components/` and treats every directory that contains `{dirname}/{dirname}.html` as a component.
- **Layout:** If `src/layout.html` exists, its `<body>` content is used as the page body. Component tags (e.g. `<todo>`) are rewritten to custom element tags (`<vaper-todo>`).
- **Web component mode (when layout exists):**
  - Each component is registered as a custom element (`vaper-{name}`).
  - A single script, `dist/vaper-registry.js`, holds templates and init functions; it is loaded by the combined page.
  - Components that are only used inside others (e.g. `board` inside tic-tac-toe) still register so they can be used as tags; they don’t need to appear in the layout.
- **Legacy mode (no layout):**
  - Each component’s body is wrapped in `<div data-component="{name}">...</div>` and emitted in folder order. Include comments are resolved at build time (markup inlined).
- **JS:** Components with `<!-- inject -->` and a matching `{name}.js` get their script bundled (esbuild, IIFE). The build supports an **HTML import** plugin: `import x from 'relative/path.html'` inlines that file’s body markup as a string.
- **CSS:** Optional `{name}.css` or `{name}.scss` is compiled (SCSS if present) and scoped to `[data-component="{name}"]`, then inlined in the combined page.
- **Design system:** `design-system/design-system.css` and `design-system/layout.css` are copied to `dist/` and linked from the combined page.

---

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In the repo: **Settings → Pages → Build and deployment → Source** choose **GitHub Actions**.
3. Deploys run automatically on every push to `main`, or run manually from the **Actions** tab (workflow “Deploy to GitHub Pages” → “Run workflow”).

If your default branch is `master` instead of `main`, edit `.github/workflows/deploy-pages.yml` and change `branches: [main]` to `branches: [master]`.

---

## Project structure

```
src/
  layout.html          # Page layout (component tags). Optional.
  components/
    my-app/
      my-app.html      # Required. Full document or partial.
      my-app.js        # Optional. Bundled when HTML has <!-- inject -->
      my-app.css       # Optional. Scoped styles.
design-system/
  design-system.css    # Global design tokens and base styles.
  layout.css           # Page layout (cards, grid).
scripts/
  build-components.js  # Main build.
  watch.js             # Watch + serve (dev).
dist/                  # Output (index.html, vaper-registry.js, *.css).
```

---

## Scripts

| Command | Description |
|--------|-------------|
| `npm run build` | Build all components and layout → `dist/index.html`, `dist/vaper-registry.js` (if layout), and design-system CSS. |
| `npm run dev` | Build, watch `src/components/`, `src/layout.html`, and `design-system/`, rebuild on change, and serve `dist/` with live reload. |
| `npm test` | Run the build script tests. |

---

## Tech stack

- **Build:** Node script (`scripts/build-components.js`) — discovers components, parses HTML (full or partial), bundles JS with esbuild (including HTML import plugin), compiles/scopes CSS (PostCSS + optional Sass), and when layout exists registers custom elements and emits the registry script.
- **Watch:** chokidar + BrowserSync (`scripts/watch.js`).
- **No front-end framework:** The output is static HTML, scoped CSS, and script. You write vanilla JS (or use libraries that esbuild can bundle).

---

## Examples in this repo

- **board** – HTML + CSS. Grid of cells; used inside tic-tac-toe via `<board></board>`.
- **tic-tac-toe** – Composes `<board></board>`, uses `<!-- inject -->` and `tic-tac-toe.js` for game logic.
- **todo** – Imports todo-item markup in JS (`import itemMarkup from '../todo-item/todo-item.html'`) and clones it for each item; no `<todo-item>` tag in the DOM.
- **todo-item** – Partial HTML (single `<li>`) only; used as imported markup by todo.
- **snake**, **asteroids** – Canvas games with `<!-- inject -->` and scoped scripts.
- **movie-ranking**, **three-keyframes** – List and 3D demos.

Copy a component folder, rename it to your app name, add it to `src/layout.html`, and adjust markup and script as needed.
