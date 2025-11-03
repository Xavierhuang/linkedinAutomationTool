# AI Text Overlay – Implementation Plan (Do Not Start Yet)

Purpose: Upgrade image text-overlay quality (legibility, aesthetics, consistency) via content-aware placement, adaptive typography, templating, and vector export.

Status: planning only. Do not implement until approved.

## Phase 1 — Foundations and Guardrails
- [ ] Define overlay element schema (role, box, typography, effects)
- [ ] Introduce safe zones, margins, grid system, role-based typographic scale
- [ ] Brand kit tokens: fonts, colors, min contrast, spacing, panel style
- [ ] Scoring interface (pluggable metrics)

## Phase 2 — Content-Aware Placement
- [ ] Saliency/edge maps to avoid busy regions and faces/logos
- [ ] Candidate box generator (top/bottom/thirds/strapline variants aligned to grid)
- [ ] Local background sampler (luminance/texture) per candidate
- [ ] Adaptive contrast: auto light/dark text, dynamic stroke/shadow, optional gradient panel

## Phase 3 — Fit and Readability
- [ ] Iterative text fitting: font size, line-height, wrapping to box density targets
- [ ] Minimum brand sizes; long-text fallback (shorten CTA/hashtags before shrinking)
- [ ] (Optional) OCR confidence check; re-style if low readability

## Phase 4 — Scoring and Search
- [ ] Generate multiple candidates per image
- [ ] Composite score: saliency + contrast + grid alignment + hierarchy + overflow penalties
- [ ] Beam/best-first search, early stopping; keep top-N for preview

## Phase 5 — Templates and Hierarchy Consistency
- [ ] Template library keyed by composition (hero-left/right/top/bottom; aspect ratio)
- [ ] Role mapping per template (headline/subhead/CTA regions with constraints)
- [ ] Enforce typographic scale and spacing consistency

## Phase 6 — Palette and Color Quality
- [ ] Palette extraction (k-means) with brand overrides
- [ ] WCAG contrast checks under local background or panel
- [ ] Smart panels (blur/glass/gradient) selected by background busyness & brand style

## Phase 7 — Vector-First Pipeline
- [ ] Render text as vector (SVG/PDF), flatten to PNG when required
- [ ] Multi-ratio exports (LinkedIn, X, IG) with reflow while preserving tokens

## Phase 8 — UX and Controls
- [ ] Live preview with legibility heatmap
- [ ] "Improve" button to re-run search with stricter thresholds
- [ ] Brand kit management UI (fonts, colors, logo safe zones)
- [ ] Role knobs: max lines, min font, panel style, alignment

## Phase 9 — AI Roles Separation & Performance
- [ ] Separate prompts: copy vs. layout; cache copy results
- [ ] Memoize saliency/edge maps & palettes per asset
- [ ] Time budgets & deterministic fallback template

## Phase 10 — Quality Gates and Analytics
- [ ] Regression gallery with pass/fail assertions
- [ ] Track “no edits needed” acceptance rate
- [ ] A/B test templates and scoring weights; iterate from telemetry

## Deliverable Milestones
- [ ] M1: Grid/safe zones + adaptive contrast + single-template
- [ ] M2: Saliency-aware candidates + fit loop + scoring
- [ ] M3: Template library + brand tokens + multi-ratio reflow
- [ ] M4: Vector export + heatmap + Improve
- [ ] M5: Performance + analytics + A/B

## Dependencies / Notes
- Lightweight saliency/face/edge detection (no heavy GPU)
- Reliable font loading and text metrics
- Privacy: process locally; do not log user assets
- Rollout: feature flag per org; pilot first


