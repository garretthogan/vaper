# Vaper

A small, script-based framework for building web apps. Add components in `src/components/`, and the build combines them into a single app. No framework runtime—just HTML, CSS, and JavaScript.

This README explains how to follow the existing pattern and build your own web apps.

---

## Quick start

```bash
npm install
npm run build    # Build once → output in dist/
npm run dev      # Watch files and serve dist/ with live reload
```

Open the URL shown by `npm run dev` (e.g. http://localhost:3000) to view the app.

---

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In the repo: **Settings → Pages → Build and deployment → Source** choose **GitHub Actions**.
3. Deploys run automatically on every push to `main`, or run manually from the **Actions** tab (workflow “Deploy to GitHub Pages” → “Run workflow”).

If your default branch is `master` instead of `main`, edit `.github/workflows/deploy-pages.yml` and change `branches: [main]` to `branches: [master]`.

---

## The component pattern

Every **component** is a folder under `src/components/` with a specific structure. The build script discovers components and merges them into `dist/index.html`.

### What counts as a component?

A folder is treated as a component only if it contains a **matching HTML file**:

- Folder: `src/components/my-app/`
- Required file: `src/components/my-app/my-app.html`

The folder name and the HTML filename (without `.html`) must match. So `my-app` → `my-app.html`. No `my-app.html` means the folder is ignored.

### Files in a component

| File | Required? | Purpose |
|------|-----------|--------|
| `{name}.html` | **Yes** | Markup and structure. Can include `<head>` and `<body>`. Use `<!-- inject -->` if you want external JS bundled in. |
| `{name}.js` | No | Script. Bundled by esbuild (IIFE) and injected only when the HTML contains `<!-- inject -->`. |
| `{name}.css` or `{name}.scss` | No | Styles. Compiled (SCSS if present) and **scoped** to `[data-component="{name}"]` so they don’t leak. |

So for a component named `my-app` you can have:

- `my-app.html` (required)
- `my-app.js` (optional, used only with `<!-- inject -->`)
- `my-app.css` or `my-app.scss` (optional)

---

## Step-by-step: add a new app

### 1. Create the component folder

Use a **single name** (e.g. `calculator`, `puzzle`, `dashboard`). That name is the component’s **base name**.

```
src/components/
  calculator/
```

### 2. Add the HTML file

Create `calculator/calculator.html` with the same base name. Use a full document or at least `<body>` content. To wire in an external script, put `<!-- inject -->` where the script should go (typically at the end of `<body>`).

**Example: HTML-only (no JS bundle)**

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
    <div class="calc-buttons"><!-- buttons here --></div>
  </div>
</body>
</html>
```

**Example: HTML + bundled JS**

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

The comment `<!-- inject -->` must appear exactly where you want the bundled script tag. The build replaces it with the output of `calculator.js` (see below). Source HTML files are never modified on disk; only the combined `dist/index.html` is written.

### 3. (Optional) Add JavaScript

If you used `<!-- inject -->`, add `calculator/calculator.js`. The build bundles it with **esbuild** as an IIFE and injects it in place of the placeholder. You can use modern JS and `import`; esbuild will bundle dependencies.

**Example: minimal script**

```javascript
const display = document.getElementById('calc-display');
const clearBtn = document.getElementById('calc-clear');
if (display && clearBtn) {
  clearBtn.addEventListener('click', () => { display.textContent = '0'; });
}
```

- Use IDs or other selectors that match the markup in your `.html`.
- The script runs in the page once; no need to wrap in a DOMContentLoaded listener for elements that already exist in the combined page.

### 4. (Optional) Add styles

Add `calculator/calculator.css` or `calculator/calculator.scss`. The build:

- Compiles SCSS if you use `.scss`
- Prefixes all selectors with `[data-component="calculator"]` so styles are scoped to your component and don’t affect others

**Example: calculator.css**

```css
.calculator-panel {
  display: flex;
  flex-direction: column;
  gap: var(--tui-gap);
}
#calc-display {
  font-size: 1.5rem;
}
```

You can use design-system variables (e.g. `var(--tui-gap)`, `var(--tui-bg)`) from `design-system/design-system.css`; the build copies that file to `dist/design-system.css` and the combined page includes it.

### 5. Build and run

```bash
npm run build
```

Your new component is included automatically. Open `dist/index.html` in a browser or use:

```bash
npm run dev
```

to watch and serve with live reload.

---

## Build behavior (reference)

- **Discovery:** The build scans `src/components/` and treats every directory that contains `{dirname}/{dirname}.html` as a component (e.g. `snake/snake.html`).
- **Order:** Components are sorted by name and included in that order.
- **Output:** A single `dist/index.html` is generated. Each component’s body markup is wrapped in `<div data-component="{name}">...</div>`. Scoped CSS is inlined in `<style data-component="{name}">`, and each component’s script (if any) is a `<script id="{name}">` block.
- **JS:** Only components whose HTML contains `<!-- inject -->` and that have a matching `{name}.js` get a bundled script. Otherwise, any inline `<script>` in the HTML is kept as-is.
- **Design system:** If `design-system/design-system.css` exists, it is copied to `dist/design-system.css` and linked from the combined page.

---

## Checklist for a new app

1. Create `src/components/{your-app}/`.
2. Add `src/components/{your-app}/{your-app}.html` (same name as the folder).
3. In the HTML, add `<!-- inject -->` where the script should go if you want a separate JS file.
4. If using `<!-- inject -->`, add `src/components/{your-app}/{your-app}.js`.
5. Optionally add `{your-app}.css` or `{your-app}.scss` for scoped styles.
6. Run `npm run build` or `npm run dev` and open the app.

---

## Examples in this repo

- **board** – HTML + CSS only (no `<!-- inject -->`, no `.js`); grid layout and styles.
- **tic-tac-toe** – HTML + `<!-- inject -->` + `tic-tac-toe.js`; game logic in a separate script.
- **snake** – HTML with inline `<style>`, `<!-- inject -->`, and `snake.js`; canvas game.
- **asteroids** – HTML + `<!-- inject -->` + `asteroids.js`; canvas game with more logic.
- **todo** – HTML + `<!-- inject -->` + `todo.js`; list and form handling.

Copy one of these folders, rename it to your app name, and adjust the markup and script to follow the same pattern. Then build and extend from there.

---

## Scripts

| Command | Description |
|--------|-------------|
| `npm run build` | Build all components → `dist/index.html` (and `dist/design-system.css` if present). |
| `npm run dev` | Run the build, watch `src/components/`, `design-system/`, and the build script; rebuild on change and serve `dist/` with BrowserSync. |
| `npm test` | Run the build script tests. |

---

## Tech stack

- **Build:** Node script (`scripts/build-components.js`) — discovers components, parses HTML, bundles JS with esbuild, compiles/scopes CSS (PostCSS + optional Sass).
- **Watch:** chokidar + BrowserSync (`scripts/watch.js`).
- **No front-end framework:** The output is static HTML, inline scoped CSS, and script tags. You write vanilla JS (or use small libraries that esbuild can bundle).

By following the component pattern above, you can add new apps alongside the existing ones and keep a single, predictable build and dev workflow.
