/* ==========================================================
   Namespace the landing-page stylesheet so it only applies
   inside `.landing-root` on the landing page, instead of
   leaking app-wide (the app shares one <body> across routes).

   Source of truth for the landing styles is the static design
   at fe-poc/style.css (kept as the design reference). Run from
   apps/frontend:

     node scripts/prefix-landing-css.mjs

   Transforms applied:
     1. Every rule selector gets a `.landing-root ` ancestor
        (except the handful listed in SEL_MAP, which are
        element/:root/universal selectors that are remapped
        to `:has()` / wrapper-scoped equivalents).
     2. All @keyframes names are prefixed with `landing-` and
        their references inside `animation`/`animation-name`
        values are rewritten, so they cannot collide with
        Tailwind's own keyframes (spin, ping, pulse, ...).
     3. Relative asset URLs are rewritten to root-absolute
        public paths (Vite dev inlines imported CSS as a JS
        string, so `url('./x.png')` cannot resolve).
   ========================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(ROOT, 'fe-poc', 'style.css');
const OUT = path.join(ROOT, 'apps', 'frontend', 'src', 'lib', 'assets', 'landing.css');

// Namespace applied to every selector, and prefix for @keyframes names.
const NS = '.landing-root';
const KEYFRAMES_PREFIX = 'landing-';

// Selector remaps for global-ish selectors.
// Everything else simply becomes `${NS} <sel>`.
// `body` maps to the wrapper itself: the design tokens live on
// the wrapper (not `:root`), and `body` is an ancestor of the
// wrapper, so `var(--color-*)` would never resolve there.
const SEL_MAP = {
  ':root': NS,
  body: NS,
  html: 'html:has(.landing-root)',
  '*': `${NS}, ${NS} *`,
  '*::before': `${NS} *::before`,
  '*::after': `${NS} *::after`,
  '::selection': `${NS} ::selection`
};

const fixSelector = (sel) => {
  const s = sel.trim();
  if (Object.prototype.hasOwnProperty.call(SEL_MAP, s)) return SEL_MAP[s];
  return `${NS} ${s}`;
};

const isInsideKeyframes = (node) => {
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'atrule' && /^keyframes$/i.test(parent.name)) return true;
    parent = parent.parent;
  }
  return false;
};

const css = fs.readFileSync(SRC, 'utf8');

postcss((root) => {
  // 1. Rename keyframes and collect the mapping.
  const keyframeNames = new Map();
  root.walkAtRules(/^keyframes$/i, (at) => {
    const prefixed = `${KEYFRAMES_PREFIX}${at.params}`;
    keyframeNames.set(at.params.trim(), prefixed);
    at.params = prefixed;
  });

  // 2. Rewrite animation references inside rules (outside keyframes).
  const token = (name) => new RegExp(`(^|[\\s,])(${name})(?=[\\s,]|$)`, 'g');
  root.walkDecls(/^animation(-name)?$/i, (decl) => {
    for (const [plain, prefixed] of keyframeNames) {
      decl.value = decl.value.replace(token(plain), `$1${prefixed}`);
    }
  });

  // 3. Rewrite relative asset URLs to root-absolute public paths.
  const URL_MAP = [
    ['./Gemini_Generated_Image_x3ryvvx3ryvvx3ry.png', '/landing/arch-texture.png']
  ];

  root.walkDecls((decl) => {
    if (!decl.value.includes('url(')) return;
    let v = decl.value;
    for (const [from, to] of URL_MAP) {
      v = v.split(from).join(to);
    }
    decl.value = v;
  });

  // 4. Namespace selectors (never inside @keyframes blocks).
  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) return;
    rule.selectors = rule.selectors.map(fixSelector);
  });
})
  .process(css, { from: SRC })
  .then((result) => {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, result.css);
    console.log(`wrote ${OUT} (${result.css.length} bytes)`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });