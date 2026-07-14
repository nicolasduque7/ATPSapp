---
name: design-system
description: Apply CourtSide's visual style to any UI work — building or
  restyling pages, components, or layouts. Use whenever creating or changing
  anything the user will see. Enforces our warm-minimal, sage-accent,
  whitespace-heavy design with full light/dark support.
---

# CourtSide Design System

## Reference (READ THIS FIRST)
Our look is derived from /design/reference-dashboard.png. That reference is a
FINANCE/property dashboard — copy its VISUAL LANGUAGE only (canvas color, white
rounded cards, sage accent, thin-line icons, bold numbers over muted labels,
pill sidebar with a black active dot). NEVER copy its content: no credit cards,
transfers, earnings, or banking widgets. Our content is coaching data.

## Feel
Warm, calm, professional, spacious. Soft neutral canvas, crisp white cards,
one restrained sage-green accent. Bold only for headings and key numbers;
everything secondary is muted and regular weight.

## Color tokens (light theme — set these as CSS variables / Tailwind theme)
- App background (canvas):   #EAE9E3  (warm greige)
- Card / surface:            #FFFFFF
- Text primary:              #0E0F0B  (near-black) — headings & key numbers
- Text muted:                #908F8B  — labels, captions, secondary text
- Primary (sage):            #758A7C  — buttons, active fills, highlight card
- Primary foreground:        #FFFFFF
- Positive badge:            bg #E4EFE4, text #4F7A52
- Negative badge:            bg #F3DEDD, text #B04A47
- Dark accent (sidebar dot): #111111
Dark theme: invert canvas to a warm near-black (~#1B1B18), cards ~#242420,
keep the SAME sage primary and badge hues.

## Shape, spacing, type
- Card radius: LARGE (~20–24px / rounded-3xl). Buttons: pill or rounded-full.
- Shadows: almost none — a very soft, low-opacity shadow at most. Separate
  cards with whitespace on the greige canvas, not borders.
- Spacing: 8px scale; err toward MORE padding. Cards breathe.
- Typography: headings & primary numbers bold; labels/secondary muted & regular.
  One clear size hierarchy, generous line-height.
- Icons: thin line icons (Lucide), stroke ~1.75. No filled/duotone icons.

## Sidebar
- Vertical white rounded-pill rail on the left. Inactive icons muted gray.
- Active item = a filled near-black (#111) circle with a white icon.
- User avatar pinned at the bottom.

## Badges / stats
- Percentage/status chips are small pills using the positive/negative tokens.
- Stat cards: small muted label on top, big bold number below, optional tiny
  sparkline to the right.

## Motion & micro-interactions
Motion should feel calm and purposeful — it guides attention, it doesn't show off.
- Transitions: 150–300ms, gentle ease (ease-out / ease-in-out). Nothing snappy or
  bouncy unless it's a deliberate, tiny delight.
- Hover/focus: every clickable element has a subtle hover state and a VISIBLE
  focus ring (keyboard users). Use `cursor-pointer` on all clickables.
- Entrances: fade/rise content in softly (small translate-y + opacity). Stagger
  lists slightly. Don't animate everything at once.
- Feedback: buttons, toggles, and theme switch animate their state change.
- Numbers on the dashboard may count up briefly on load (short, subtle).
- Calendar: smooth view transitions (month↔week↔day); gentle highlight on the
  current time / today.
- ALWAYS respect `prefers-reduced-motion` — disable non-essential animation.
- No gratuitous parallax, no long/looping animations, no motion that blocks
  interaction. When in doubt, less.

## Rules
- Every component must look intentional in BOTH light and dark themes.
- Empty states and loading states are required, and also styled minimally.
- Responsive: verify 390px, 768px, 1440px.
- No decorative gradients, heavy shadows, or emoji in the UI.

## Calendar-specific
- Event tiles are compact and airy: time, student name + level, location as a
  small sage outlined tag. Don't overfill tiles.

## Checklist before calling a screen done
- [ ] Matches reference screenshot (via two-pass loop)
- [ ] Light + dark both intentional
- [ ] Responsive at 3 breakpoints
- [ ] Empty + loading + error states present
