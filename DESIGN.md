---
name: Lebanon Hockey
description: The official web presence of the Lebanese Ice Hockey Federation — an institutional record carried in jersey colours.
colors:
  cedar-red: "#c8102e"
  cedar-red-bright: "#e4142f"
  cedar-red-dark: "#96001f"
  cedar-red-deep: "#6b0016"
  cedar-red-tint: "#fdf0f2"
  cedar-red-tint-2: "#f9dde1"
  ink: "#0e1114"
  ink-deep: "#05070a"
  steel: "#1a2027"
  chrome: "#c9cdd2"
  muted: "#6a7178"
  muted-soft: "#6f767e"
  surface: "#ffffff"
  bone: "#f7f6f4"
  bone-2: "#efeeeb"
  line: "#e6e4e0"
  line-strong: "#d5d2cc"
  line-input: "#918b82"
  ok: "#0f7a43"
  warn: "#a05f00"
typography:
  display:
    fontFamily: "Archivo, Manrope, Segoe UI, Arial, sans-serif"
    fontSize: "clamp(44px, 7.4vw, 104px)"
    fontWeight: 900
    lineHeight: 0.94
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Archivo, Manrope, Segoe UI, Arial, sans-serif"
    fontSize: "clamp(32px, 4.4vw, 58px)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.022em"
  title:
    fontFamily: "Archivo, Manrope, Segoe UI, Arial, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope, Segoe UI, Arial, Helvetica, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Manrope, Segoe UI, Arial, Helvetica, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.16em"
rounded:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "22px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
  s-9: "96px"
components:
  button-primary:
    backgroundColor: "{colors.cedar-red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "13px 28px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.cedar-red-deep}"
    textColor: "{colors.surface}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-deep}"
    rounded: "{rounded.pill}"
    padding: "13px 28px"
    height: "50px"
  button-secondary:
    backgroundColor: "rgba(255, 255, 255, 0.07)"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "13px 28px"
    height: "50px"
  input:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "13px 14px"
  input-focus:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  feature-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.s-5}"
  nav-link:
    textColor: "{colors.ink}"
    rounded: "{rounded.xs}"
    padding: "9px 9px"
  eyebrow:
    textColor: "{colors.cedar-red}"
    typography: "{typography.label}"
---

# Design System: Lebanon Hockey

## Overview

**Creative North Star: "The Federation Record"**

This is an institution that keeps receipts. A decree year, an associate-membership date, seven named directors, seven partners sorted by tier — the Lebanese Ice Hockey Federation's claim is that it is *recognised*, and the design's whole job is to let that claim land without raising its voice. The system reads like an official register that happens to be printed in the colours of a jersey: facts set in heavy uppercase display type, given room, and left alone.

The atmosphere is assured, documentary and unfussy, and it is warm rather than corporate. Nothing here performs enthusiasm. The off-white panels, the soft warm neutrals and the civic tone place this as a community body with international standing — not a startup, not a brand campaign. Where other sporting sites reach for montage and urgency, this one reaches for whitespace and a date. The primary visitor is deciding whether to attach their organisation's name to the federation; credibility does that work, not atmosphere.

Red is the exception that proves it. The palette is overwhelmingly ink on warm paper, and the jersey red appears only where the visitor is meant to act or orient. That restraint is the system's single most load-bearing decision: a red button means something here because almost nothing else is red.

**Key Characteristics:**

- Heavy uppercase Archivo display type with negative leading (0.94) and tight tracking, set against a warm off-white
- A near-monochrome page with cedar red held to roughly a tenth of any screen
- Layered two-part shadows rather than one soft blur — depth that reads as printed, not floated
- An 8pt spacing scale and a 1360px shell, with a fluid gutter from 20px to 84px
- Self-hosted type and zero third-party requests, which is a published privacy commitment, not a performance tactic
- Motion exists only as a response to the visitor

## Colors

A jersey palette on warm paper: one saturated red, a near-black, and a family of warm greys that never go blue.

### Primary

- **Cedar Red** (`#c8102e`): The jersey body colour, and the system's only true accent. It carries eyebrows and tags, primary buttons, the active nav underline, the focus border on every field, and the single gradient word in a hero headline. Nothing decorative is red.
- **Cedar Red Bright** (`#e4142f`): Hover and highlight states, and the gradient's leading stop. Never a resting colour.
- **Cedar Red Dark** (`#96001f`): Pressed states.
- **Cedar Red Deep** (`#6b0016`): The far anchor of both brand gradients, where red turns toward the near-black.
- **Cedar Red Tint** (`#fdf0f2`) and **Tint 2** (`#f9dde1`): Washes. Tint 2 is the 4px focus halo around a focused field — the only place a pale red is permitted to sit at rest.

### Neutral

- **Ink Deep** (`#05070a`): Near-black. Dark surfaces, the footer, the gradient terminus, and ghost-button text.
- **Ink** (`#0e1114`): Charcoal. All body copy and nav links.
- **Steel** (`#1a2027`): The secondary dark surface, used where two dark panels must separate.
- **Muted** (`#6a7178`) and **Muted Soft** (`#6f767e`): Secondary and supporting text. Muted Soft is the contrast-safe one at 4.60:1 on white.
- **Chrome** (`#c9cdd2`): Helmet cage and skate hardware — cool grey, used sparingly against dark surfaces.
- **Surface** (`#ffffff`): Cards, inputs at focus, the header.
- **Bone** (`#f7f6f4`): The warm off-white panel. The resting background of tinted sections and of every form field.
- **Bone 2** (`#efeeeb`): One step deeper, for a panel inside a panel.
- **Line** (`#e6e4e0`), **Line Strong** (`#d5d2cc`), **Line Input** (`#918b82`): The border ladder. Line Input is deliberately darker at 3.38:1 so a control boundary meets WCAG 1.4.11.

### Status

- **Ok** (`#0f7a43`) and **Warn** (`#a05f00`): Confirmation and caution. Warn is chosen at 5.08:1 on white rather than a brighter amber, because it has to be read, not noticed.

### Named Rules

**The Ten Percent Rule.** Cedar Red covers roughly a tenth of any screen and never more. It belongs to eyebrows, primary actions, the active nav state, field focus, and one gradient word per hero. A red-backed section, a red card, or a red heading breaks it — and every one of those weakens the primary button, which is the only thing on the page the federation actually needs clicked.

**The Warm Neutral Rule.** Every grey in this system is warm. A cool grey background (`#f5f5f5`, `#fafafa`, anything with a blue cast) next to Bone reads as a mistake, not a variant. Chrome is the single cool exception and only ever appears on dark.

## Typography

**Display Font:** Archivo (falling back to Manrope, Segoe UI, Arial)
**Body Font:** Manrope (falling back to Segoe UI, Arial, Helvetica)

Both are self-hosted in `assets/fonts/` as latin and latin-ext woff2. No font CDN is contacted — this is a privacy commitment the site publishes in its own policies, not a preference.

**Character:** Archivo at 800–900 with negative tracking is a stencil-adjacent grotesque that reads as signage and officialdom; Manrope underneath is humanist and quiet. The pairing is a plaque and the paragraph explaining it.

### Hierarchy

- **Display** (900, `clamp(44px, 7.4vw, 104px)`, line-height 0.94, tracking -0.025em, uppercase): Page titles only, one per page. The sub-1.0 leading is deliberate — lines interlock into a block rather than stacking.
- **Headline** (800, `clamp(32px, 4.4vw, 58px)`, line-height 1.02, tracking -0.022em, uppercase): Section openers.
- **Title** (700, 21px, line-height 1.22, tracking -0.01em): Card and subsection headings. Sentence case, not uppercase — this is where the shouting stops.
- **Body** (400, 16px, line-height 1.6): All running copy.
- **Label** (800, 12px, tracking 0.16em, uppercase): Eyebrows and tags, always in Cedar Red.
- **Action** (800, 13px, tracking 0.09em, uppercase): Button text, in Manrope rather than Archivo.

### Named Rules

**The One Gradient Word Rule.** Exactly one word in an `h1` may take the red gradient (`h1 .accent`, a 100° ramp from `#ff5a70` through Cedar Red to Cedar Red Deep, via `background-clip: text`). One word, `h1` only, once per page. It is a signature, and a signature used twice is a pattern. Gradient text anywhere else — `h2`, metrics, body, buttons — is forbidden.

**The Uppercase Ceiling Rule.** Uppercase stops at Title. Display, Headline, Label and Action are uppercase; Title and Body never are. Uppercase running text is unreadable and is the fastest way to make a credibility-first page look like a promotion.

## Layout

A single centred shell of **1360px** with a fluid gutter of `clamp(20px, 6vw, 84px)`, so the page breathes on a wide monitor without the measure ever running long.

Vertical rhythm comes from an **8pt scale** (`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`). Sections are padded `clamp(64px, 8vw, 112px)` block and one gutter inline, which is what gives the documentary pacing — content arrives in discrete, well-separated statements rather than a scroll of texture.

Density is low by intent. A section typically carries one heading, one paragraph and one group of cards. Tinted sections (`Bone` background) alternate with white to segment the page without rules or dividers.

Breakpoints, in the order they fire: **1440px** (nav padding tightens to 6px, type to 14px), **1250px** (the brand wordmark drops to the crest alone), **1100px** (the hamburger appears and the nav collapses), **760px**, **560px**. Tables collapse to cards below 760px via `data-label` attributes on every cell rather than horizontal scroll.

### Named Rules

**The Alternating Panel Rule.** Sections separate by background, not by border. White, then Bone, then white. A horizontal rule between two sections is redundant and is not used.

## Elevation & Depth

This system is **layered, not lifted**. Every shadow is two shadows: a tight contact shadow and a wide ambient one, both in the same near-black at low alpha. One large soft blur is explicitly rejected — it reads as a floating rectangle, where a paired shadow reads as an object resting on paper.

Surfaces are flat at rest with a 1px `Line` border. Shadow is a resting property of cards (at `sm`) and escalates only on hover.

### Shadow Vocabulary

- **xs** (`0 1px 2px rgba(5,7,10,0.06), 0 1px 1px rgba(5,7,10,0.04)`): Barely-there separation for chips and small controls.
- **sm** (`0 2px 4px rgba(5,7,10,0.04), 0 6px 14px rgba(5,7,10,0.06)`): The resting state of every card.
- **md** (`0 4px 8px rgba(5,7,10,0.05), 0 14px 30px rgba(5,7,10,0.09)`): Raised panels and the sticky header once scrolled.
- **lg** (`0 8px 16px rgba(5,7,10,0.06), 0 28px 60px rgba(5,7,10,0.14)`): Card hover, modals.
- **red** (`0 8px 18px rgba(200,16,46,0.22), 0 18px 40px rgba(200,16,46,0.16)`): Reserved for the primary button. It is the only coloured shadow in the system and the only place colour is used to signal elevation.

### Named Rules

**The Two-Shadow Rule.** Every shadow has a contact layer and an ambient layer. A single-value `box-shadow` is not part of this system.

## Shapes

Two radii do almost all the work, and they mean different things.

**Pills** (`999px`) are for things you act on: buttons, the hero badge, chips. **Panels** (`16px`) are for things you read: cards, media, sections. The remaining steps are supporting — `6px` for a nav link's hover plate, `10px` for form fields, `22px` for the largest feature surfaces.

Borders are 1px and hairline-warm. Nothing in the system uses a thick border as decoration; the one bold edge is the 4px stripe on a feature card, and it is a moving part rather than a frame.

### Named Rules

**The Pill-and-Panel Rule.** If the visitor clicks it, it is a pill. If the visitor reads it, it is a 16px panel. A rounded-rectangle button or a pill-shaped content card both break the vocabulary.

## Components

Components feel **precise and quietly physical**. They respond to touch with a small, eased lift — never a bounce, never a spin. Easing is `cubic-bezier(0.22, 1, 0.36, 1)` for entrances and state changes, `cubic-bezier(0.65, 0, 0.35, 1)` where a motion must settle symmetrically.

### Buttons

- **Shape:** Full pill (999px), minimum height 50px, padding 13px 28px.
- **Type:** Manrope 800 at 13px, uppercase, 0.09em tracking.
- **Primary:** The brand gradient (115°, Cedar Red Bright → Cedar Red → Cedar Red Deep → Ink Deep) sized to 200% and parked at 0%, carrying the red shadow.
- **Primary hover:** The gradient slides to 100% while the button rises 2px and its red shadow deepens. The colour shift and the lift are one gesture.
- **Secondary:** For dark and photographic backgrounds — a 7% white fill with a 45% white border and a 6px backdrop blur.
- **Ghost:** White fill, `Line Input` border, Ink Deep text. The default on light backgrounds.
- **Dark:** Ink Deep fill, used where a white button would disappear.
- **Disabled:** Reduced opacity, pointer events retained for `aria-disabled`.

### Cards

- **Corner:** 16px panel.
- **Background:** Surface white on a Bone section.
- **Border:** 1px `Line`, moving to `Line Strong` on hover.
- **Shadow:** `sm` at rest, `lg` on hover.
- **Padding:** 24px.
- **Signature:** a 4px vertical stripe pinned to the left edge, filled with the red gradient and scaled to a quarter of its height at rest. On hover it grows to full height over 0.45s while the card lifts 6px. This is the system's one piece of ornament and it only exists in motion.

### Inputs

- **Shape:** 10px radius, 1px `Line Input` border, Bone fill, padding 13px 14px, 15px text.
- **Focus:** Border becomes Cedar Red, fill goes white, and a 4px `Cedar Red Tint 2` halo appears. The native outline is suppressed only because this halo replaces it — it is wider and higher-contrast than the default.
- **Textarea:** Vertical resize only, 120px minimum.

### Navigation

- **Type:** Manrope 700 at 15.5px, Ink.
- **Hover and active:** A 2px red gradient underline grows from the left over 0.3s, inset to exactly the link's own horizontal padding via a shared `--nav-pad-x` variable so the two can never drift apart when a breakpoint changes one of them.
- **Mobile:** Below 1100px the row collapses to a hamburger; below 1250px the wordmark drops and the crest stands alone.

### Named Rules

**The Response-Only Motion Rule.** Motion in this system answers the visitor — hover, focus, press, reveal on scroll. Nothing animates on its own. The one pre-existing exception is the 8px pulsing dot on the hero registration badge (`pulse-dot`, 2.4s, infinite); it is inherited, it is not a pattern, and no second ambient animation should join it.

**The Shared Variable Rule.** When two properties must stay aligned across breakpoints — a link's padding and its underline inset, a tile's width and its scroll step — they read from one custom property. Duplicating the number is how they drift.

## Do's and Don'ts

### Do:

- **Do** keep Cedar Red to roughly 10% of a screen: eyebrows, primary action, active nav, field focus, one hero word.
- **Do** pair every shadow — a contact layer and an ambient layer, per the Two-Shadow Rule.
- **Do** use pills for actions and 16px panels for content.
- **Do** separate sections by alternating white and Bone backgrounds rather than by rules or dividers.
- **Do** set every spacing value from the 8pt scale (`--s-1` … `--s-9`), and every radius from the four named steps.
- **Do** keep uppercase to Display, Headline, Label and Action; Title and Body stay sentence case.
- **Do** self-host every font and asset. Zero third-party requests is a published commitment, and adding an external origin means updating `cookies.html` and introducing a consent requirement — it is a decision to raise, never a quiet addition.
- **Do** run `npm run contrast` after any colour change; it reads the live tokens out of `assets/styles.css`, so it cannot drift from this file.
- **Do** give collapsed tables a `data-label` on every cell so they become cards below 760px.

### Don't:

- **Don't** put gradient text anywhere but a single word in an `h1`. Not on `h2`, not on metrics, not on buttons.
- **Don't** introduce a cool grey. Every neutral in this system is warm; Chrome is the only cool value and only on dark surfaces.
- **Don't** add a second ambient animation. Motion responds to the visitor; the inherited pulsing badge dot is an exception, not a precedent.
- **Don't** use a single-value `box-shadow`.
- **Don't** substitute the identity assets — the inline `#cedar-mark` SVG, the LIHF logo (`assets/LIHF-01_edited.png`), the flag strip, or the Archivo + Manrope pairing. These are fixed.
- **Don't** fabricate proof. No testimonials, attendance figures, sponsorship prices, media lists or registration numbers exist in this project; a design pass does not get to invent them to fill a layout.
- **Don't** let a red surface compete with the primary button.
- **Don't** hardcode a hex that already exists as a token.
