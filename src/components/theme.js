// Design tokens for the OEP chart library.
//
// This file is the single place to tweak typography, gridlines, reference
// styling, and responsive breakpoints across every chart. Series colors
// (the data palette) are passed per-chart, not defined here.

// --- Typography ---

export const FONT = "Overpass, sans-serif";

// Spread into Plot.plot({ style: ... }) for consistent chart typography.
// `overflow: visible` lets rotated tick labels (and other marks anchored
// near the chart edge) extend past the SVG boundary instead of being
// clipped — almost always what you want at chart-author level.
export const CHART_STYLE = {
  fontFamily: FONT,
  fontSize: "14px",
  overflow: "visible",
};

// --- Gridlines (subordinate to data) ---

export const GRID_COLOR = "#ddd";
export const GRID_STROKE_WIDTH = 1;

// --- Annotations and reference lines ---

// Used for reference/baseline/state-average annotations across charts.
// One canonical color so all annotations read as the same visual layer.
export const ANNOTATION_COLOR = "#B84A00";

// --- Hover crosshair (Plot.pointerX/Y rules) ---

// Spread into Plot.ruleX/Plot.ruleY with Plot.pointerX/Y.
// NOTE: pair with `maxRadius: Infinity` on the pointer transform so the
// crosshair stays in sync with a custom tooltip across the full chart width.
export const POINTER_RULE = {
  stroke: "#999",
  strokeWidth: 0.5,
  strokeDasharray: "3,3",
};

// --- Title & subtitle ---

// Rendered above a chart via the chartHeader() helper in utils.js.
// Mirrors the R draft's plot.title / plot.subtitle styling.
export const TITLE_STYLE =
  "margin: 0 0 4px; font-size: 17px; font-weight: 700; color: #111; line-height: 1.25;";
export const SUBTITLE_STYLE =
  "margin: 0 0 14px; font-size: 13px; color: #555; line-height: 1.35;";

// --- Caption ---

// Small italic caption rendered beneath a chart. Use with the caption()
// helper in utils.js rather than inlining this style.
export const CAPTION_STYLE =
  "margin: 6px 0 0; font-size: 12px; color: #888; font-style: italic;";

// --- Responsive breakpoints ---

// Below this width, rotate x-axis tick labels. Charts with denser x-axes
// (more labels) may pass a larger value when calling Plot.plot.
export const TICK_ROTATE_BREAKPOINT = 600;
export const TICK_ROTATE_ANGLE = -30;

// Helper: returns the tickRotate value for a given chart width.
//
// Rotates when either:
//   - the chart is narrow (width < breakpoint), or
//   - the labels don't fit horizontally. Roughly estimates needed width as
//     (avgLabelChars * 7px) per label and compares to the per-label budget.
//
// Pass labelCount alone for "count many labels"; pass avgLabelChars too for
// long labels (e.g. multi-word destination categories).
export function tickRotateFor(
  width,
  breakpoint = TICK_ROTATE_BREAKPOINT,
  labelCount = 0,
  avgLabelChars = 8,
) {
  if (width < breakpoint) return TICK_ROTATE_ANGLE;
  if (labelCount > 0) {
    const widthPerLabel = width / labelCount;
    const estLabelPx = avgLabelChars * 7;
    if (estLabelPx > widthPerLabel * 0.75) return -45;
  }
  return 0;
}
