import * as Plot from "npm:@observablehq/plot";
import { html } from "npm:htl";
import { CHART_STYLE, GRID_COLOR, FONT, tickRotateFor } from "./theme.js";
import { makeLegend, caption, chartHeader } from "./utils.js";

/**
 * Grouped (dodged) bar chart. Each outer x category gets a cluster of bars,
 * one per group, side-by-side.
 *
 * DATA FORMAT
 * -----------
 * Rows must have these three columns:
 *   x        - outer category label (e.g. "Mathematics", "ELA")
 *   group    - inner dodge label, matches a `label` in `categories`
 *   value    - bar height as a percentage (0–100)
 *
 * Implementation note: uses a single band x scale over flattened
 * `${outerCategory}|${group}` keys, with invisible spacer keys between
 * groups. This keeps the y-scale (and its gridlines) continuous across
 * groups — Plot's `fx` faceting would draw gridlines per-facet, leaving
 * visible breaks at each group boundary. Outer-category labels are
 * rendered as an HTML grid row below the chart, with column widths
 * matching the band layout so labels line up under their clusters.
 * (Plot.text below the frame was tried; lineAnchor/dy/marginBottom
 * interactions made vertical placement too fragile to maintain.)
 *
 * @param {Array}  data       - Rows of { x, group, value }
 * @param {Array}  categories - [{ label, color }] in legend / dodge order
 * @param {Object} options
 *   @param {number}      [options.width=640]             - Chart width in px
 *   @param {number}      [options.height]                - Default width × 0.5
 *   @param {string}      [options.yLabel="Percent"]      - Y-axis label
 *   @param {Array}       [options.yDomain]               - [min, max] override
 *   @param {Function}    [options.valueFormat]           - Bar-label formatter,
 *                                                          default `${v.toFixed(0)}%`
 *   @param {string|Node} [options.caption]               - Optional caption
 */
export function groupedBarChart(data, categories, {
  width = 640,
  height,
  yLabel = "Percent",
  yDomain,
  valueFormat = (v) => `${Math.round(v)}%`,
  caption: captionContent,
  title,
  subtitle,
} = {}) {
  const outerDomain = [...new Set(data.map((d) => d.x))];
  const groupDomain = categories.map((c) => c.label);

  // Reasonable default y domain: zero to max value with 12% headroom for labels
  const dataMax = Math.max(...data.map((d) => +d.value));
  const computedYMax = Math.ceil((dataMax * 1.12) / 5) * 5;

  // Build a flat x-domain: for each outer category, append every group key
  // in legend order, then a unique spacer between outer categories. The
  // spacer takes one band-width — wide enough to read as a group gap.
  const SPACER_PREFIX = "​__GBC_SP__";
  const makeKey = (outer, group) => `${outer}${group}`;
  const xDomain = [];
  let spacerIdx = 0;
  for (let i = 0; i < outerDomain.length; i++) {
    if (i > 0) xDomain.push(`${SPACER_PREFIX}${spacerIdx++}`);
    for (const g of groupDomain) xDomain.push(makeKey(outerDomain[i], g));
  }

  // Flatten data into rows with a flat x key, preserving group for fill/hover.
  const flatData = data.map((d) => ({
    ...d,
    _xkey: makeKey(d.x, d.group),
  }));

  // Auto-rotate cluster labels when dense or long, mirroring tickRotate.
  const avgLabelChars = outerDomain.length
    ? outerDomain.reduce((s, x) => s + String(x).length, 0) / outerDomain.length
    : 0;
  const labelRotate = tickRotateFor(
    width,
    600,
    outerDomain.length,
    avgLabelChars,
  );
  const MARGIN_LEFT = 70;
  const MARGIN_RIGHT = 20;
  // Cluster labels live outside the SVG in an HTML grid row below, so
  // marginBottom only needs to clear the y-axis 0 tick label.
  const marginBottom = 20;

  const chart = Plot.plot({
    width,
    height: height ?? Math.round(width * 0.5),
    marginLeft: MARGIN_LEFT,
    marginRight: MARGIN_RIGHT,
    marginBottom,
    marginTop: 20,
    style: CHART_STYLE,
    x: {
      label: null,
      type: "band",
      domain: xDomain,
      padding: 0,
      tickSize: 0,
      tickFormat: () => "",
    },
    y: {
      label: yLabel,
      labelAnchor: "center",
      labelArrow: "none",
      domain: yDomain ?? [0, computedYMax],
      tickFormat: (d) => d + "%",
      tickSize: 0,
      grid: false,
      ticks: 5,
    },
    color: {
      domain: groupDomain,
      range: categories.map((c) => c.color),
    },
    marks: [
      Plot.gridY({
        stroke: GRID_COLOR,
        strokeWidth: 1,
        strokeOpacity: 1,
      }),
      Plot.barY(flatData, {
        x: "_xkey",
        y: "value",
        fill: "group",
        title: (d) => d.group,
      }),
      Plot.text(flatData, {
        x: "_xkey",
        y: "value",
        text: (d) => valueFormat(+d.value),
        fontSize: 12,
        fill: "#333",
        dy: -8,
        title: (d) => d.group,
      }),
    ],
  });

  // Outer-category labels: an HTML grid row below the chart with column
  // widths matching the band layout (${groupDomain.length}fr per cluster,
  // 1fr per spacer between clusters). Padded by marginLeft/marginRight so
  // columns line up with bars by construction. Rotated labels pivot around
  // their right end, anchored at the cluster's horizontal center.
  const gridCols = [];
  const cells = [];
  for (let i = 0; i < outerDomain.length; i++) {
    if (i > 0) {
      gridCols.push("1fr");
      cells.push(html`<div></div>`);
    }
    gridCols.push(`${groupDomain.length}fr`);
    cells.push(html`<div>${outerDomain[i]}</div>`);
  }
  const labelRow = html`<div style="
    display: grid;
    grid-template-columns: ${gridCols.join(" ")};
    padding-left: ${MARGIN_LEFT}px;
    padding-right: ${MARGIN_RIGHT}px;
    margin-top: -8px;
    font-family: ${FONT};
    font-size: 13px;
    color: #222;
    text-align: center;
    ${labelRotate !== 0 ? `min-height: 80px;` : ""}
  ">${cells.map((c) =>
    labelRotate === 0
      ? c
      : html`<div style="display: flex; justify-content: center;">
          <div style="position: relative; width: 0;">
            <div style="
              position: absolute;
              top: 0;
              right: 0;
              transform: rotate(${labelRotate}deg);
              transform-origin: top right;
              white-space: nowrap;
            ">${c}</div>
          </div>
        </div>`,
  )}</div>`;

  // --- Hover fade: dim non-hovered groups across bars, labels, and legend ---
  for (const el of chart.querySelectorAll("rect, text")) {
    const titleEl = el.querySelector("title");
    if (titleEl) {
      el.dataset.group = titleEl.textContent;
      titleEl.remove();
    }
  }

  const uid = `gbc-${Math.random().toString(36).slice(2, 8)}`;
  const fadeStyle = html`<style></style>`;

  function highlight(group) {
    fadeStyle.textContent = group
      ? `
        #${uid} svg rect[data-group]:not([data-group="${group}"]) { opacity: 0.18; transition: opacity 0.2s; }
        #${uid} svg text[data-group]:not([data-group="${group}"]) { opacity: 0.18; transition: opacity 0.2s; }
        #${uid} div[data-category]:not([data-category="${group}"]) { opacity: 0.4; transition: opacity 0.2s; }
        #${uid} div[data-category="${group}"] span { font-weight: 700; }
      `
      : "";
  }

  chart.addEventListener("mouseover", (e) => {
    highlight(e.target.closest("[data-group]")?.dataset.group ?? null);
  });
  chart.addEventListener("mouseleave", () => highlight(null));

  const legendEl = makeLegend(
    categories.map(({ label, color }) => ({ label, color })),
    { onHover: highlight },
  );

  const headerEl = chartHeader({ title, subtitle });
  const captionEl = caption(captionContent);

  return html`<div id="${uid}" style="display: flex; flex-direction: column;">
    ${fadeStyle}${headerEl}${chart}${labelRow}${legendEl}${captionEl}
  </div>`;
}
