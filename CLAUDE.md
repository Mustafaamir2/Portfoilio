# Portfolio site — rules for any AI assistant working in this repo

These are standing constraints from the site owner. Follow them even if a
request doesn't repeat them explicitly — they only get lifted if the owner
explicitly asks to change *this specific thing* (e.g. "change the 3D orb
to blue").

## 1. The hero/contact 3D scene's color theme is locked

The Three.js scene in `script.js` (`heroScene`, `contactScene`) must stay
**violet/lavender** — the glass orb, the faceted icosahedron core, the
orbit rings, and the orbit beads. Concretely:

- Core (`coreMat`): low metalness (~0.15), violet `color` + violet
  `emissive`. Do **not** raise metalness back up — high metalness makes
  the surface show the *reflected environment* instead of its own tint,
  which is what previously made it look washed-out/white instead of
  purple. Do not add `iridescence` to the outer orb — it shifts hue with
  viewing angle, breaking "always purple".
- Rings (`ringMaterial`) and beads (`beadMat`): keep moderate metalness
  (~0.4) with a violet `emissive`, for the same reason.
- Orb (`orbMaterial`): keep the base `color` a light violet tint
  (currently `0xf1ecff`), never pure white.

If asked to fix performance, sizing, camera framing, tiering, or any
non-color aspect of this scene, change that and leave the above color
values alone unless told otherwise.

**Do not re-enable real `transmission` on `orbMaterial`.** It was tried
twice (desktop-only, then more broadly) and both times caused a visible
frame-to-frame flicker between purple and washed-out white — three.js
resolves `transmission` through its own internal render target on its
own schedule, which is inherently unstable here and was the direct
cause of the "sometimes purple sometimes white" bug the owner reported.
The orb now uses a flat `clearcoat` + tinted, low-opacity glass
material instead (no transmission, no render-target dependency) — it
draws identically every frame on every device. If asked to make the
orb "more glassy" again, improve *that* material (clearcoat, roughness,
opacity, tint) rather than turning transmission back on.

## 2. Mobile/tablet must match desktop, not a stripped-down version

The site's design intent is one consistent experience: same 3D animation
quality bar, same header behavior (glass "island" that shrinks on scroll
and expands on tap/hover), same visual language — adapted for touch
input and smaller viewports, not swapped for a simpler placeholder.
When fixing a mobile-only bug, check whether the fix should also apply
at tablet widths, and prefer adjusting the shared logic (camera framing,
material opacity, tier heuristics) over hiding features behind
`state.mobile` checks.

## 3. Performance guardrails already in place — don't casually reverse them

- The contact-section 3D scene is skipped entirely on phones/coarse
  pointers (`state.mobile || state.coarse`) — running two concurrent
  WebGL scenes on a phone GPU is avoidable jank for a decorative
  background.
- DPR is capped low on touch/mobile regardless of the computed device
  tier (`cores`/`deviceMemory` are unreliable signals on phones).
- Geometry/particle counts stay at the cheap end on any touch/mobile
  device regardless of the tier heuristic (`onPhone` in `heroScene`).
- There's an adaptive fallback in `heroScene`'s ticker that measures
  real FPS and drops the pixel ratio further if a device is still
  struggling after ~2.5s.

If you need to raise visual fidelity, prefer cheap wins (clearcoat
tuning, emissive tint, geometry segment counts) over dropping the DPR
cap or reintroducing `transmission`.
