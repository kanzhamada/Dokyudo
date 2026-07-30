---
version: "1.0"
name: "Dokyudo Visual Identity"
description: "A practical design contract for creating Dokyudo product, marketing, developer, enterprise, and documentation experiences."
colors:
    black: "#0E0E0E"
    offblack: "#1A1616"
    off-white: "#FAFAFA"
    white: "#FFFFFF"
    orange: "#F04E23"
    graphite: "#3E3E3E"
    gray: "#676767"
    warm-gray: "#9C9996"
    ash: "#D9D9D9"
    yellow: "#FFF78B"
    amber: "#EA9E1A"
    lavender: "#C7ADFF"
    purple: "#A37AFF"
    periwinkle: "#B0BFE3"
    navy: "#4164B9"
    lime: "#E0E07B"
    olive: "#9D9D25"
typography:
    display:
        fontFamily: "Reckless Standard"
        fontWeight: 400
        usage: "Expressive headlines and large brand statements"
    interface:
        fontFamily: "FG Futurist"
        fontWeight: 400
        usage: "Sub-headlines, navigation, labels, metrics, and product-scale emphasis"
    body:
        fontFamily: "Ease Standard"
        fontWeight: 400
        usage: "Body copy, financial context views, controls, and calls to action"
shape:
    card-radius: "0px"
    control-radius-small: "6px"
    control-radius-default: "8px"
    circle: "50%"
    pill: "9999px"
spacing:
    card-gap: "5px"
    card-padding: "15px"
    card-group-gap: "20px"
    section-spacing: "80px"
    page-gutter: "max(3vw, 15px)"
components:
    card:
        radius: "{shape.card-radius}"
        padding: "{spacing.card-padding}"
        border: "1px solid rgba(185, 185, 185, 0.4)"
    button:
        radius: "{shape.control-radius-default}"
        duration: "200ms"
        easing: "cubic-bezier(0.37, 0, 0.63, 1)"
motion:
    level: "controlled"
    micro-duration: "200ms"
    standard-easing: "cubic-bezier(0.37, 0, 0.63, 1)"
---

# Dokyudo Design System

## Overview

Dokyudo is an enterprise-grade semantic document search and RAG Q&A platform designed for ultra-low latency contextual retrieval across dense financial reports and multi-tenant document sets. Its visual identity should feel precise, authoritative, responsive, spacious, and grounded in distributed systems performance.

The visual system combines:

- A vector & node mark that represents document embeddings, hybrid search, and semantic connections.
- Expressive editorial typography paired with precise, product-minded interface typography.
- A grounded black, off-white, and orange core palette.
- Sharp accents used for chunk nodes, similarity scores, vector graphs, financial metrics, and moments of emphasis.
- Spacious compositions that let search queries, document chunks, financial tables, streaming responses, and brand marks remain crystal clear.

The system bridges complex data retrieval and intuitive user experience. It can feel vivid and dynamic during live streaming and search interaction, but it should never become noisy or ornamental for its own sake.

## Brand Principles

### Semantic & Connected

Reference document nodes, vector embeddings, hybrid search scores (RRF), chunk relationships, and streaming tokens. The identity should suggest that every document chunk can yield instant, contextual answers.

### Precise & Low-Latency

Show speed, accuracy, and high-fidelity extraction without artificial delay. Clear metrics, structured data displays, and real-time streaming are more characteristic of Dokyudo than static decoration.

### Spacious

Use negative space as an active part of the design. Dense financial data, complex API payloads, document previews, and Q&A streams need room to breathe.

### Direct & Secure

Use short, confident language. Emphasize zero-cost distributed architecture, BYOK encryption (AES-256-GCM), and complete multi-tenant isolation without over-explaining.

### Product-grounded

Brand expressions should feel directly connected to the Dokyudo retrieval and Q&A workflow. Avoid generic tech visual metaphors that could belong to any arbitrary software company.


### Symbol

Use the symbol for compact placements such as avatars, favicons, app icons, and vector indicator nodes.

### Wordmark

Use the wordmark when the Dokyudo name must be read clearly without a larger brand frame.

### Horizontal lockup

Use the horizontal lockup by default for headers, footers, documentation headers, and platform header bars.

### Vertical lockup

Use the vertical lockup for centered brand moments, square-format cards, and landing page heroes.

### Logo rules

- Preserve the original proportions.
- Keep at least one symbol-height of clear space around the logo when possible.
- Use black on light surfaces and off-white on dark surfaces.
- Use orange only when the mark retains strong contrast.
- Do not stretch, rotate, outline, redraw, add shadows, or apply arbitrary gradients.
- Do not place the mark over visually busy imagery without a quiet field or sufficient contrast.

## Color

### Core palette

| Role      | Value     | Usage                                                |
| --------- | --------- | ---------------------------------------------------- |
| Black     | `#0E0E0E` | Primary dark text, marks, and high-contrast surfaces |
| Off-black | `#1A1616` | Warm dark backgrounds and immersive brand moments    |
| Off-white | `#FAFAFA` | Primary light background and reversed text           |
| White     | `#FFFFFF` | Elevated light surfaces and utility contrast         |
| Orange    | `#F04E23` | Primary accent, action, focus, and brand emphasis    |

Black, off-white, and orange carry the highest brand recognition. Orange should lead primary actions, active search triggers, and focal moments rather than fill every surface.

### Neutral palette

| Role       | Value     | Usage                                |
| ---------- | --------- | ------------------------------------ |
| Graphite   | `#3E3E3E` | Dark secondary surfaces and text     |
| Gray       | `#676767` | Muted text and supporting UI         |
| Warm gray  | `#9C9996` | Quiet labels and neutral transitions |
| Gray light | `#B9B9B9` | Borders and subtle structure         |
| Ash        | `#D9D9D9` | Light supporting surfaces            |

For page borders, use `rgba(185, 185, 185, 0.4)` or the project token `--color-gray-light-2-faded`.

### Accent palette

| Color      | Value     | Usage                                                |
| ---------- | --------- | ---------------------------------------------------- |
| Yellow     | `#FFF78B` | Highlighting matched text tokens & chunk highlights  |
| Amber      | `#EA9E1A` | Rate-limit warnings, SIMULATE tier badges, status    |
| Lavender   | `#C7ADFF` | Vector distance tags and RAG node indicators         |
| Purple     | `#A37AFF` | INVESTOR tier badge, specialized gateway routing     |
| Periwinkle | `#B0BFE3` | Document metadata tags (PDF, DOCX, TXT)             |
| Navy       | `#4164B9` | Hybrid cloud node & MinIO storage indicators         |
| Lime       | `#E0E07B` | System health, active status, success metrics         |
| Olive      | `#9D9D25` | Neutral data indicators and auxiliary chart marks    |

Use accent colors purposefully for vector distance scores, chunk highlights, status indicators, and financial charts. They support the core palette; they do not replace it.

### Color rules

- Use color roles consistently instead of choosing accents arbitrarily.
- Maintain readable foreground and background contrast (WCAG AA minimum).
- Do not communicate document processing status or security flags through color alone.
- Avoid low-contrast recoloring of the logo.
- Prefer luminous combinations with warm and cool depth over flat rainbow treatments.

## Typography

Dokyudo uses three type families with distinct responsibilities. Do not collapse them into one generic sans-serif system.

### Reckless Standard

Reckless Standard is the expressive display face.

- Use for large headlines, key metrics, and brand statements.
- Use regular weight by default.
- Keep line-height tight, generally `1`.
- Use restrained negative tracking for the largest style.
- Avoid using it for dense document copy or code blocks.

Primary implementation styles:

| Token   | Desktop size | Line height | Tracking  |
| ------- | ------------ | ----------- | --------- |
| `t-h-1` | `3.5rem`     | `1`         | `-0.02em` |
| `t-h-2` | `2.625rem`   | `1`         | Default   |
| `t-h-3` | `2.25rem`    | `1`         | Default   |
| `t-h-4` | `1.7rem`     | `1`         | Default   |

### FG Futurist

FG Futurist provides structure and a technical, product-minded voice.

- Use for sub-headlines, navigation, labels, document tags, tier indicators, and display metrics.
- Use regular weight.
- Keep line-height compact.
- Use tighter tracking at larger sizes.

Primary implementation styles include `t-h-1--sans` through `t-h-5--sans`, `t-l-1`, `t-tag-usecase-1`, and `t-tag-usecase-2`.

### Ease Standard

Ease Standard is the utility and reading face.

- Use for document body copy, financial chunk text, descriptions, API payloads, controls, and streaming Q&A answers.
- Use regular weight for most copy and medium only when hierarchy requires it.
- Use body line-height around `1.2` to `1.4`.

Primary implementation styles:

| Token           | Desktop size | Line height | Tracking  |
| --------------- | ------------ | ----------- | --------- |
| `t-b-1`         | `1.1875rem`  | `1.4`       | `-0.04em` |
| `t-b-2`         | `0.85rem`    | `1.2`       | `-0.03em` |
| `t-b-3`         | `0.8rem`     | `1.2`       | `-0.03em` |
| `t-b-3-relaxed` | `0.75rem`    | `1.4`       | `-0.03em` |

### Responsive typography

Display type scales down at the `lg` and `sm` breakpoints. Preserve hierarchy instead of forcing desktop sizes onto smaller screens. Document chunk copy and search result text should remain readable and should not be reduced merely to make a layout fit.

The fonts are licensed assets and are not included in this public brand package. Use properly licensed copies or approved fallbacks.

## Layout and Spacing

Dokyudo layouts are content-led, data-dense, and responsive.

- Use `max(3vw, 15px)` as the adaptive page gutter.
- Use `80px` as the standard large section-spacing reference.
- Use `15px` for card padding in compact document/chunk views.
- Use `5px` between closely related document panels or search hit cards.
- Use `20px` between larger card groups and dashboard grids.
- Prefer structured grids for multi-tenant analytics and side-by-side RAG document viewports.
- Use full-bleed media intentionally; keep text and financial tables within readable containers.
- Preserve generous negative space around primary search inputs and key platform metrics.

Do not introduce near-duplicate spacing values when an existing token fits.

## Shape and Surfaces

Cards and document preview panels use square outer corners (`0px`) by default. Do not add decorative card radius.

Rounded geometry is reserved for:

- Buttons and compact interface controls.
- Pills, tier badges (FREE, PRO, INVESTOR), and metadata tags.
- Intentional circles such as status indicators, vector node dots, and user avatars.
- Media whose art direction explicitly requires a shaped mask.

Surface hierarchy should come primarily from color, spacing, borders, subtle contrast, and clean layout grid structure rather than heavy shadow.

### Cards

- Default padding: `15px`.
- Default border: `1px solid rgba(185, 185, 185, 0.4)`.
- Default outer radius: `0`.
- Internal gap: `5px`.
- Group gap: `20px`.
- Avoid unnecessary nested borders.
- Keep chunk content and similarity scores aligned to the same spacing logic.

### Borders

Use the shared gray-light border treatment for quiet structure. Strong white or black borders should be reserved for active document selection, highlighted search hits, or high-contrast architecture diagrams.

## Components

### Buttons

Buttons are compact, direct, and visibly interactive.

- Default transition duration: `200ms`.
- Default easing: `cubic-bezier(0.37, 0, 0.63, 1)`.
- Use orange for primary search and upload actions.
- Use black or off-black for strong neutral actions.
- Use white for actions on dark backgrounds where appropriate.
- Use a border treatment for secondary actions and filter toggles.
- Preserve visible focus states.
- Avoid hover effects that alter layout dimensions.

Typical control radii are `6px` and `8px`. Pills are intentional exceptions, not the default shape for every control.

### Semantic Search & Query Input

The search & question bar is a core Dokyudo product cue.

- Use a dark, high-contrast surface.
- Keep the search lens, vector status tag, BYOK badge, and send/search action visually balanced.
- Reserve enough container height for SSE streaming responses to avoid layout shifts during answer generation.
- Animate active search status and token stream indicators cleanly.
- Stop decorative motion when reduced motion is requested.

### Document & Chunk Cards

- Display document title, file type tag (PDF, DOCX, TXT), file size, and upload timestamp.
- Highlight chunk similarity rank, Reciprocal Rank Fusion (RRF) score, and tenant isolation scope.
- Support inline text selection and copy with visual confirmation.

### Navigation & Tier Badges

- Keep navigation labels short and scannable (`Search`, `Documents`, `API Keys`, `Webhooks`, `Analytics`).
- Display active tier status cleanly (`FREE`, `PRO SIMULATE`, `PRO INVESTOR`, `PRO REAL`).
- Use orange for active tab emphasis when appropriate.
- Horizontal navigation below desktop should scroll smoothly without moving surrounding layout.
- Keep navigation fully keyboard accessible with visible focus rings.

### Color Swatches & Status Indicators

- Display canonical hexadecimal values for design tokens.
- Show active system statuses clearly (`document.ready`, `status: pending`, `circuit: closed`).
- When clicking copies a value or API key mask, provide visible and screen-reader confirmation.

## Art Direction

Dokyudo imagery and technical diagrams show the architecture of semantic search, vector embeddings, and zero-cost distributed infrastructure. It should feel sharp, spacious, and systematically structured.

### Subject families

- Financial report analytics and balance sheet extraction views.
- Vector graph networks, HNSW similarity clusters, and RRF rank visualization.
- Hybrid cloud topology (Cloudflare Pages, Deno Deploy, On-Premise MinIO, Supabase, Upstash Vector).

### Color

Let orange lead when action or search focus is the story, supported by cool blues, dark graphites, or clean neutrals. Avoid flat single-color scenes. The visual system should feel luminous, precise, and layered.

### Distortion & Motion

Use subtle glow, scan lines, or token pulse effects to suggest active vector search and stream generation. Effects should add technical energy without obscuring text or data tables.

### Gradation

Use chromatic shifts, dark surface gradients, and sharp edge highlights to create architectural depth.

### Image & Diagram rules

- Preserve a clear subject or focal data point.
- Use motion and highlight effects with restraint.
- Keep enough quiet space for copy when text overlays background graphics.
- Avoid generic stock illustrations or ungrounded futuristic eye candy.
- Do not use visual effects that obscure document readability or API data payloads.

## Copy

Dokyudo copy is concise, confident, precise, and technically grounded.

- Prefer active voice.
- Lead with performance, accuracy, and instant contextual answers.
- Highlight zero-cost architecture, BYOK security, and financial-grade retrieval.
- Keep headlines short and impactful.
- Use product terms such as document, chunk, vector embedding, hybrid search, RAG, tenant, BYOK, streaming, and circuit breaker naturally.
- Avoid generic AI fluff, inflated claims, and vague technical buzzwords.

Example tone:

> Instant financial context across your entire document library.

## Motion

Motion should communicate real-time search, streaming token generation, vector indexing, and state changes.

- Use approximately `200ms` for common interface transitions.
- Use `cubic-bezier(0.37, 0, 0.63, 1)` for balanced on-screen movement.
- Prefer transform and opacity for animated properties.
- Use restrained looping motion only for active streaming or vector indexing states.
- Keep hover behavior focused on color, opacity, stroke, or subtle scaling.
- Avoid layout-shifting animation.
- Respect `prefers-reduced-motion`.
- Ensure animations remain interruptible and never block search interaction.

Longer choreography may use GSAP or Motion when it communicates a meaningful sequence. Do not add scroll animation merely because a section enters the viewport.

## Accessibility

- Maintain WCAG AA contrast for text, metrics, and interactive controls.
- Preserve visible keyboard focus rings.
- Use semantic HTML elements (`<main>`, `<nav>`, `<article>`, `<button>`).
- Keep touch targets at least 44x44px for touch interfaces.
- Provide clear alternative text for diagrams and document icons.
- Do not rely on color, hover, or motion alone to communicate status or tier permissions.
- Reserve layout space for streaming and asynchronous content to prevent layout shifts.
- Respect `prefers-reduced-motion` settings across all components.

## Do and Don't

### Do

- Build visual concepts around document chunks, vector nodes, hybrid search, streaming tokens, and security badges.
- Use black, off-white, and orange as the recognizable core.
- Apply accent colors with clear semantic roles and restraint.
- Keep compositions spacious, legible, and data-dense where needed.
- Keep copy direct and technically grounded.
- Reuse existing typography, spacing, color, and motion tokens.
- Test responsive layouts, mobile scroll containers, and interaction states.

### Don't

- Do not redraw, stretch, rotate, outline, or freely recolor the logo.
- Do not crowd search bars or document viewer layouts.
- Do not add unrelated decorative ornaments.
- Do not mix arbitrary gradients into the core brand mark.
- Do not add decorative card border radius (`0px` outer radius for cards).
- Do not introduce one-off colors or arbitrary spacing values without a semantic need.
- Do not use motion that shifts page layout or competes with document reading.
- Do not make the brand feel generic or disconnected from document search.

## Implementation Tokens

The following CSS variables are canonical references in the Dokyudo web project:

```css
--color-black: rgb(14, 14, 14);
--color-offblack: rgb(26, 22, 22);
--color-white: rgb(250, 250, 250);
--color-orange: rgb(240, 78, 35);

--color-gray-dark-3: rgb(62, 62, 62);
--color-gray: rgb(103, 103, 103);
--color-gray-light-1: rgb(156, 153, 150);
--color-gray-light-2: rgb(185, 185, 185);
--color-gray-light-2-faded: rgba(185, 185, 185, 0.4);
--color-gray-light-3: rgb(217, 217, 217);

--color-yellow: rgb(255, 247, 139);
--color-amber: rgb(234, 158, 26);
--color-lavender: rgb(199, 173, 255);
--color-purple: rgb(163, 122, 255);
--color-periwinkle: rgb(176, 191, 227);
--color-navy: rgb(65, 100, 185);
--color-lime: rgb(224, 224, 123);
--color-olive: rgb(157, 157, 37);

--font-reckless-standard: "Reckless Standard", serif;
--font-fg-futurist: "FG Futurist", sans-serif;
--font-ease-standard: "Ease Standard", sans-serif;

--s-contain: max(3vw, 15px);
--s-section: 80px;
--ease-sin-in-out: cubic-bezier(0.37, 0, 0.63, 1);
```

For guideline-style document and card systems:

```css
--brand-guideline-border-color: var(--color-gray-light-2-faded);
--brand-guideline-card-padding: 15px;
--brand-guideline-card-gap: 5px;
--brand-guideline-card-group-gap: 20px;
```
