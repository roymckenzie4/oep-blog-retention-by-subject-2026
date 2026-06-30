import * as Plot from "npm:@observablehq/plot";
import { html } from "npm:htl";
import { CHART_STYLE, GRID_COLOR, ANNOTATION_COLOR } from "./theme.js";
import { caption, chartHeader } from "./utils.js";

/**
 * Horizontal dumbbell chart. One row per item; each row shows two endpoints
 * (a "pre" value and a "post" value) connected by a line or arrow.
 *
 * DATA FORMAT
 * -----------
 * Rows must have:
 *   label      - row label (e.g. subject name)
 *   group      - coarse grouping for color and visual spacing
 *   valuePre   - first endpoint value (e.g. pre-pandemic rate)
 *   valuePost  - second endpoint value (e.g. recent rate)
 *   change     - optional; computed as valuePost − valuePre if not provided
 *
 * @param {Array}  data       - Rows of { label, group, valuePre, valuePost, change? }
 * @param {Array}  categories - [{ label, color }] for the group color scale
 * @param {Object} options
 *   @param {number}   [options.width=640]
 *   @param {number}   [options.height]              - Auto by row count if omitted
 *   @param {string}   [options.xLabel=""]
 *   @param {Array}    [options.xDomain]             - [min, max] override
 *   @param {Function} [options.xFormat]             - Tick format, default `d => d + "%"`
 *   @param {Object}   [options.reference]           - { value, label }: vertical
 *                                                     reference line + top annotation
 *   @param {boolean}  [options.showArrow=true]      - Arrowhead at the post endpoint
 *   @param {boolean}  [options.showValueLabels=true]- Print post value at each filled dot
 *   @param {boolean}  [options.showChangeLabel=true]- Print change at each open dot
 *   @param {Function} [options.valueFormat]         - Default: `${v.toFixed(1)}%`
 *   @param {Function} [options.changeFormat]        - Default: signed %, 1dp
 *   @param {boolean}  [options.groupSpacing=true]   - Insert blank rows between
 *                                                     groups for visual separation.
 *                                                     Off skips the spacer rows.
 *   @param {string|Node} [options.caption]
 */
export function dumbbellChart(data, categories, {
  width = 640,
  height,
  xLabel = "",
  xDomain,
  xFormat = (d) => d + "%",
  reference,
  showArrow = true,
  showValueLabels = true,
  showChangeLabel = true,
  valueFormat = (v) => `${v.toFixed(1)}%`,
  changeFormat = (c) => `${c >= 0 ? "+" : "−"}${Math.abs(c).toFixed(1)}%`,
  groupSpacing = true,
  caption: captionContent,
  title,
  subtitle,
} = {}) {
  const groupDomain = categories.map((c) => c.label);
  const groupRank = Object.fromEntries(groupDomain.map((g, i) => [g, i]));

  // Sort: by group rank, then by descending valuePost within group
  const sorted = [...data]
    .map((d) => ({
      ...d,
      change: d.change ?? +d.valuePost - +d.valuePre,
    }))
    .sort((a, b) => {
      const ga = groupRank[a.group] ?? 999;
      const gb = groupRank[b.group] ?? 999;
      if (ga !== gb) return ga - gb;
      return String(a.label).localeCompare(String(b.label));
    });

  // Build the y-axis domain. With groupSpacing, insert unique invisible
  // placeholder labels at group boundaries — Plot's band scale will reserve
  // a row for each, creating the visual gap. The tickFormat below hides
  // their text so the gap is empty.
  const SPACER_PREFIX = "   __SPACER__";
  const yDomain = [];
  let prevGroup = null;
  let spacerIdx = 0;
  for (const row of sorted) {
    if (groupSpacing && prevGroup !== null && row.group !== prevGroup) {
      yDomain.push(`${SPACER_PREFIX}${spacerIdx++}`);
    }
    yDomain.push(row.label);
    prevGroup = row.group;
  }

  const isSpacer = (l) => typeof l === "string" && l.startsWith(SPACER_PREFIX);

  // Auto-height: ~28px per row (data + spacer alike)
  const computedHeight = 80 + yDomain.length * 28;

  // Auto x-domain: pad min/max of all endpoints by 4 pp on each side
  let computedXDomain = xDomain;
  if (!computedXDomain) {
    const values = sorted.flatMap((d) => [+d.valuePre, +d.valuePost]);
    if (reference?.value != null) values.push(+reference.value);
    const min = Math.floor(Math.min(...values) - 4);
    const max = Math.ceil(Math.max(...values) + 4);
    computedXDomain = [min, max];
  }

  const SegmentMark = showArrow ? Plot.arrow : Plot.link;

  const chart = Plot.plot({
    width,
    height: height ?? computedHeight,
    marginLeft: 220,
    marginRight: 70,
    marginTop: reference?.label ? 40 : 20,
    marginBottom: 50,
    style: CHART_STYLE,
    x: {
      label: xLabel || null,
      labelAnchor: "center",
      labelArrow: "none",
      domain: computedXDomain,
      tickFormat: xFormat,
      tickSize: 0,
    },
    y: {
      label: null,
      domain: yDomain,
      tickFormat: (l) => (isSpacer(l) ? "" : l),
      tickSize: 0,
    },
    color: {
      domain: groupDomain,
      range: categories.map((c) => c.color),
    },
    marks: [
      Plot.gridX({
        stroke: GRID_COLOR,
        strokeWidth: 1,
        strokeOpacity: 1,
      }),
      // Reference line
      ...(reference?.value != null
        ? [
            Plot.ruleX([+reference.value], {
              stroke: ANNOTATION_COLOR,
              strokeWidth: 1.5,
              strokeDasharray: "5,4",
            }),
          ]
        : []),
      // Reference annotation at top of chart frame
      ...(reference?.value != null && reference?.label
        ? [
            Plot.text([{ x: +reference.value }], {
              x: "x",
              text: [reference.label],
              fill: ANNOTATION_COLOR,
              fontSize: 13,
              fontWeight: 600,
              textAnchor: "start",
              dx: 6,
              frameAnchor: "top",
              dy: -8,
            }),
          ]
        : []),
      // Connecting segment
      SegmentMark(sorted, {
        x1: "valuePre",
        x2: "valuePost",
        y1: "label",
        y2: "label",
        stroke: "group",
        strokeWidth: 1.5,
        ...(showArrow ? { headLength: 7, insetEnd: 6 } : {}),
      }),
      // Post endpoint (filled)
      Plot.dot(sorted, {
        x: "valuePost",
        y: "label",
        fill: "group",
        r: 4.5,
      }),
      // Post value label (colored, bold, LEFT of filled dot)
      ...(showValueLabels
        ? [
            Plot.text(sorted, {
              x: "valuePost",
              y: "label",
              text: (d) => valueFormat(+d.valuePost),
              fill: "group",
              fontSize: 13,
              fontWeight: 700,
              textAnchor: "end",
              dx: -8,
            }),
          ]
        : []),
      // Change label (grey, RIGHT of open dot)
      ...(showChangeLabel
        ? [
            Plot.text(sorted, {
              x: "valuePre",
              y: "label",
              text: (d) => changeFormat(d.change),
              fill: "#888",
              fontSize: 11,
              textAnchor: "start",
              dx: 8,
            }),
          ]
        : []),
    ],
  });

  const headerEl = chartHeader({ title, subtitle });
  const captionEl = caption(captionContent);

  return html`<div style="display: flex; flex-direction: column;">
    ${headerEl}${chart}${captionEl}
  </div>`;
}
