---
name: dataviz
description: Use this skill whenever you are about to create ANY chart, graph,
  plot, dashboard, or data visualization, in ANY output medium — an HTML or
  React artifact, inline SVG, plotting code in any library (matplotlib,
  plotly, d3, Recharts, …), an image/PNG you will render and upload, or a
  chart shared into Slack. Read it BEFORE writing the first line of chart
  code, choosing chart colors, building a stat tile / meter / KPI row, or
  laying out a dashboard. Produces visualizations that read as one system —
  elegant, accessible, consistent in light and dark — using a brand-neutral
  placeholder palette you swap for your own. Teaches a design-system-agnostic
  method: a form heuristic, a color formula with a runnable validator, mark
  specs, and interaction rules. A validated default palette is documented in
  `references/palette.md` — swap that file's values for your brand's.
  Triggers on: "chart", "graph", "plot", "data viz", "visualization",
  "dashboard", "analytics", "visualize data", "categorical colors",
  "sequential / diverging palette", "stat tile", "sparkline", "heatmap",
  "legend", "axis", "tooltip", "chart colors", "color by series".
---

# Dataviz

This is CourtSide's project-local copy of the bundled `dataviz` skill,
installed so it's versioned with the repo and discoverable alongside our
other skills.

In this project it is ADVISORY ONLY, same as `ui-ux-pro-max` — use it for
chart form selection, mark specs, and interaction patterns. It must NEVER
override CourtSide's locked palette, fonts, spacing, or dark-mode
requirement from the `design-system` skill. Where `references/palette.md` in
this folder conflicts with `design-system`'s color tokens, `design-system`
wins — charts should use our sage primary and existing muted/border tokens,
not the placeholder palette's raw values, unless a categorical series
genuinely needs more than one hue.

See `references/` for the full method:
- `choosing-a-form.md` — form heuristic (when to use bar vs. line vs. etc.)
- `color-formula.md` + `scripts/validate_palette.*` — categorical/sequential
  color rules and a runnable validator
- `marks-and-anatomy.md` — mark specs (bar widths, radii, gridlines, ticks)
- `components.md` — stat tiles, sparklines, legends, KPI rows
- `interaction.md` — tooltip, hover, and legend interaction rules
- `anti-patterns.md` — common mistakes to avoid
- `palette.md` — the brand-neutral default palette (reference only here;
  CourtSide charts use `design-system` tokens instead)
