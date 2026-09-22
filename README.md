# Nova Weaver

An interactive 3D portfolio — a luxury digital art gallery crossed with a futuristic
creative studio. Light lavender, glassmorphic, cinematic, and built to feel alive.

**To view it:** open `index.html`. That's it.

---

## Architecture

A **plain static site**. No build step, no bundler, no package manager, no framework.
All application code lives in three files:

```
index.html      all markup
style.css       all styling
script.js       all behaviour
assets/         images + favicon (static assets only, never code)
vercel.json     deployment headers and caching
.gitignore
README.md
```

There is no `src/`, no components directory, no TypeScript, no JSX, and no build
configuration. Anything new goes inside one of those three files.

Two dependencies load from a CDN at runtime:

| Dependency | Purpose |
| --- | --- |
| [Three.js r150](https://threejs.org) (UMD build) | the hero orb and the contact orb |
| Google Fonts — Space Grotesk, Inter, Instrument Serif | display, body, and italic accent type |

Both are plain `<script>` / `<link>` tags, so the page also runs straight from the
filesystem with no server.

---

## Deploying to Vercel

There is nothing to build, so Vercel just serves the folder.

### Option A — Git (recommended)

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. When asked for a framework preset, choose **Other**.
4. Leave **Build Command** empty and set **Output Directory** to `./` (the root).
5. Deploy. Every push to `main` redeploys automatically.

### Option B — CLI

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

Run it from this folder. Vercel detects a static site and uploads the files as-is.

> **Do not add a `package.json`.** If one exists, Vercel will try to run a build
> and fail. This project has no build.

### What `vercel.json` does

- `cleanUrls` — serves the site at `/` rather than `/index.html`
- **Security headers** — `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`, and a Content-Security-Policy scoped to
  exactly what the page uses: scripts from `cdn.jsdelivr.net`, styles from
  `fonts.googleapis.com`, fonts from `fonts.gstatic.com`, and images from this
  origin plus `data:` URIs.
- **Caching** — images in `assets/` are cached for a week with
  `stale-while-revalidate`; `index.html`, `style.css` and `script.js` revalidate on
  every request, because their filenames carry no content hash and must update the
  moment you redeploy.

The CSP was verified in a real browser against these exact headers: fonts, Three.js,
images, the JSON-LD block and every interaction work with zero violations. If you
later add an analytics script, an embedded video or a form endpoint, **you must add
its origin to the CSP** or the browser will block it.

### Other hosts

Netlify, Cloudflare Pages, GitHub Pages and plain nginx all work the same way —
upload the folder, no build step. Only `vercel.json` is Vercel-specific; the
equivalents are `netlify.toml` or `_headers` elsewhere.

---

## Running locally

```bash
python -m http.server 8000     # then open http://localhost:8000
npx serve .                    # or any equivalent
```

---

## What's in the page

| Section | Notable behaviour |
| --- | --- |
| Hero | WebGL glass orb with real refraction, an inner sculptural core, glowing rings, floating shards and a particle field. Rotates slowly, eases toward the cursor, and can be dragged to orbit with damped momentum. |
| About | Split layout with a parallax stage, a profile card that tilts to the cursor and flips on click, floating typography and clipped orbit rings. |
| Selected work | Horizontal gallery where cards sit in real perspective. Scroll, drag, swipe, or use the arrow keys. Each project expands into a full-screen case study. |
| Skills | A constellation of floating nodes joined by lines that light up. Hover or focus reveals the note; nodes reflow into a readable grid on small screens. |
| Experience | Vertical timeline whose connecting line fills and glows as you scroll. |
| Services | Glass cards with individual minimal icons and a holographic edge on hover. |
| Testimonials | Depth carousel with autoplay, swipe, arrows, dots and keyboard control. |
| Contact | A large lavender orb that drifts toward the cursor, plus a validated inquiry form. |

Throughout: a cursor-following glow, magnetic buttons, 3D card tilt, scroll-triggered
reveals, word-by-word text reveals, and a scroll progress bar.

### The contact form

There is no backend. On a valid submit, the form composes the message and hands it to
the visitor's mail client via a `mailto:` link. To post it to a service instead,
replace the `window.location.href = "mailto:…"` line in `script.js` with a `fetch()`
to your endpoint — and add that endpoint to `connect-src` in the CSP.

---

## Performance, accessibility and SEO

- **One `requestAnimationFrame` loop** drives every animation on the page.
- WebGL scenes render **only while their canvas is on screen** and pause when the tab
  is hidden. Device pixel ratio is capped, and geometry, particle counts and material
  features are reduced on touch devices.
- If WebGL is unavailable the hero keeps a CSS gradient stand-in and nothing breaks.
- **`prefers-reduced-motion` is honoured everywhere**: the custom cursor, magnetic
  buttons, tilt, autoplay and the animated 3D scenes all stand down, and the WebGL
  scenes render a single static frame.
- Semantic landmarks, a skip link, visible focus rings, a focus-trapped case study
  dialog, labelled controls, `aria-live` form status, and full keyboard support for
  the gallery, carousel, menu and dialog.
- Descriptive `<title>`/meta description, Open Graph and Twitter cards, canonical URL,
  and `Person` JSON-LD.
- Verified with no horizontal overflow and no console errors from 320px to 1920px.

---

## Customising

- **Colour, type and spacing** are CSS custom properties in the `:root` block at the
  top of `style.css`. Change them there and the whole page follows.
- **Projects** are markup in `index.html`. Each `<li class="project">` holds the
  visible card plus a `<template data-case>` with its case study; copy a block to add
  a project.
- **Skills** carry their position as inline `--x` / `--y` percentages, so moving a
  node is a one-line edit.

### Before you publish

Replace the placeholders:

- `https://nova-weaver.example/` — the canonical, `og:url` and JSON-LD URLs in
  `index.html` (set these to your real Vercel domain)
- `hello@novaweaver.studio` — the contact address in `index.html` and in the
  `mailto:` fallback in `script.js`
- the social links in the footer and in the JSON-LD `sameAs` array
