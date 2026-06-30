import * as Plot from "npm:@observablehq/plot";
import { html } from "npm:htl";
import { CHART_STYLE, GRID_COLOR, tickRotateFor } from "./theme.js";
import { makeLegend, caption, chartHeader } from "./utils.js";

/**
 * Renders an interactive stacked bar chart with hover highlighting.
 *
 * DATA FORMAT
 * -----------
 * Rows must have:
 *   x         - the band-axis label (e.g. a subject, a year)
 *   category  - the stack segment, must match a `label` in `categories`
 *   value     - segment height as a percentage (0–100)
 *   group     - (optional) outer grouping for facet rendering (see groupBy)
 *
 * CATEGORIES — array of stack-segment definitions, bottom-to-top order:
 *   - label:     matches `category` in the data
 *   - color:     segment fill
 *   - textColor: color of the percentage label printed inside the segment
 *   - showLabel: optional, default true. Set false to hide value labels for
 *                this category entirely.
 *
 * GROUPING — when `groupBy` is set, the chart renders one sub-plot per
 * group (side-by-side, sharing one y-axis), with a group header above
 * each. Width is allocated proportionally to subject count per group.
 * Bars MUST be pre-sorted by group rank then within-group desired order.
 *
 * @param {Array}  data       - Rows of { x, category, value, group? }
 * @param {Array}  categories - [{ label, color, textColor, showLabel? }]
 * @param {Object} options
 *   @param {number}      [options.width=640]
 *   @param {number}      [options.height]            - Default width × 0.55
 *   @param {string}      [options.yLabel="Percent"]
 *   @param {Function}    [options.valueFormat]       - Bar-label formatter,
 *                                                      default `v.toFixed(1)`
 *   @param {string}      [options.groupBy]           - Field name to facet by
 *   @param {Array}       [options.groupOrder]        - Explicit facet order;
 *                                                      defaults to data order
 *   @param {number}      [options.groupSpacing=1]    - Number of spacer bands
 *                                                      inserted between groups.
 *                                                      Each spacer takes one
 *                                                      band-width; pass 2 or
 *                                                      3 for wider gaps, 0
 *                                                      to butt groups together.
 *   @param {string|Node} [options.caption]
 */
export function stackedBarChart(data, categories, {
  width = 640,
  height,
  yLabel = "Percent",
  valueFormat = (v) => `${(+v).toFixed(1)}`,
  groupBy,
  groupOrder,
  groupSpacing = 1,
  caption: captionContent,
  title,
  subtitle,
} = {}) {
  const textColorMap = Object.fromEntries(
    categories.map((c) => [c.label, c.textColor ?? "white"]),
  );
  const showLabelMap = Object.fromEntries(
    categories.map((c) => [c.label, c.showLabel !== false]),
  );
  const categoryLabels = new Set(categories.map((c) => c.label));

  // --- Faceted mode: one sub-plot per group ---
  if (groupBy) {
    return renderFaceted();
  }

  // --- Simple mode: one plot ---
  return renderSimple();

  // ----------------------------------------------------------------------
  function renderSimple() {
    const xDomain = [...new Set(data.map((d) => d.x))];
    const avgLabelChars = xDomain.length
      ? xDomain.reduce((s, x) => s + String(x).length, 0) / xDomain.length
      : 0;
    const tickRotate = tickRotateFor(width, 600, xDomain.length, avgLabelChars);
    const marginBottom = tickRotate !== 0 ? 90 : 40;

    const chart = makePlot({
      data,
      xDomain,
      width,
      height: height ?? Math.round(width * 0.55),
      marginLeft: 60,
      marginBottom,
      yAxis: true,
      tickRotate,
    });

    return assembleContainer([chart]);
  }

  // ----------------------------------------------------------------------
  // Single Plot.plot with one shared y-scale. Bar heights are aligned by
  // construction. Visual grouping comes from spacer entries inserted between
  // groups in the x-domain (band scale gives them equal width to bars), with
  // group headers rendered as Plot.text marks anchored to the top frame.
  function renderFaceted() {
    const groups = groupOrder ?? [...new Set(data.map((d) => d[groupBy]))];
    const subjectsByGroup = new Map(
      groups.map((g) => [
        g,
        [...new Set(data.filter((d) => d[groupBy] === g).map((d) => d.x))],
      ]),
    );
    const groupsWithData = groups.filter(
      (g) => subjectsByGroup.get(g).length > 0,
    );

    // Build x-domain with unique spacer placeholders between groups. Each
    // spacer takes one band-width; pass `groupSpacing > 1` for wider gaps.
    const SPACER_PREFIX = "​__SP__";
    const xDomain = [];
    const headerData = [];
    let spacerIdx = 0;
    for (let i = 0; i < groupsWithData.length; i++) {
      if (i > 0) {
        for (let s = 0; s < groupSpacing; s++) {
          xDomain.push(`${SPACER_PREFIX}${spacerIdx++}`);
        }
      }
      const subjects = subjectsByGroup.get(groupsWithData[i]);
      const startPos = xDomain.length;
      xDomain.push(...subjects);
      // Anchor header at the middle subject of this group
      const midIdx = startPos + Math.floor((subjects.length - 1) / 2);
      headerData.push({ x: xDomain[midIdx], label: groupsWithData[i] });
    }
    const isSpacer = (l) => typeof l === "string" && l.startsWith(SPACER_PREFIX);

    const realLabels = xDomain.filter((l) => !isSpacer(l));
    const avgLabelChars = realLabels.length
      ? realLabels.reduce((s, l) => s + String(l).length, 0) / realLabels.length
      : 0;
    const tickRotate = tickRotateFor(
      width,
      600,
      realLabels.length,
      avgLabelChars,
    );
    const marginBottom = tickRotate === 0 ? 40 : 130;

    const chart = Plot.plot({
      width,
      height: height ?? Math.round(width * 0.55),
      marginLeft: 70,
      marginRight: 20,
      marginTop: 50,  // room for group headers above the chart frame
      marginBottom,
      style: CHART_STYLE,
      x: {
        label: null,
        type: "band",
        domain: xDomain,
        tickSize: 0,
        tickRotate,
        tickFormat: (l) => (isSpacer(l) ? "" : l),
      },
      y: {
        label: yLabel,
        labelAnchor: "center",
        labelArrow: "none",
        domain: [0, 100],
        ticks: [0, 25, 50, 75, 100],
        tickFormat: (d) => d + "%",
      },
      color: {
        domain: categories.map((c) => c.label),
        range: categories.map((c) => c.color),
      },
      marks: [
        Plot.gridY([0, 25, 50, 75, 100], {
          stroke: GRID_COLOR,
          strokeWidth: 1,
          strokeOpacity: 1,
        }),
        Plot.barY(data, {
          x: "x",
          y: "value",
          fill: "category",
          order: categories.map((c) => c.label),
          title: (d) => d.category,
        }),
        Plot.text(
          data,
          Plot.stackY({
            x: "x",
            y: "value",
            z: "category",
            order: categories.map((c) => c.label),
            text: (d) =>
              !showLabelMap[d.category] || +d.value < 4
                ? ""
                : valueFormat(+d.value),
            fontSize: 12,
            fill: (d) => textColorMap[d.category] ?? "white",
            title: (d) => d.category,
          }),
        ),
        // Group headers — frameAnchor "top" puts them at the top of the
        // chart frame; x is the middle-subject band, so they horizontally
        // center over each group.
        Plot.text(headerData, {
          x: "x",
          text: "label",
          frameAnchor: "top",
          dy: -30,
          fontSize: 14,
          fontWeight: 700,
          fill: "#222",
        }),
      ],
    });

    return assembleContainer([chart]);
  }

  // ----------------------------------------------------------------------
  function makePlot({
    data: subset,
    xDomain,
    width: w,
    height: h,
    marginLeft,
    marginRight = 20,
    marginBottom,
    yAxis,
    tickRotate,
    padInner,
    padOuter,
  }) {
    return Plot.plot({
      width: w,
      height: h,
      marginLeft,
      marginRight,
      marginBottom,
      marginTop: 20,
      style: CHART_STYLE,
      x: {
        label: null,
        type: "band",
        tickSize: 0,
        tickRotate,
        domain: xDomain,
        ...(padInner != null ? { paddingInner: padInner } : {}),
        ...(padOuter != null ? { paddingOuter: padOuter } : {}),
      },
      y: {
        label: yAxis ? yLabel : null,
        labelAnchor: "center",
        labelArrow: "none",
        domain: [0, 100],
        ticks: [0, 25, 50, 75, 100],
        tickFormat: (d) => d + "%",
        axis: yAxis ? "left" : null,
      },
      color: {
        domain: categories.map((c) => c.label),
        range: categories.map((c) => c.color),
      },
      marks: [
        Plot.barY(subset, {
          x: "x",
          y: "value",
          fill: "category",
          order: categories.map((c) => c.label),
          title: (d) => d.category,
        }),
        Plot.text(
          subset,
          Plot.stackY({
            x: "x",
            y: "value",
            z: "category",
            order: categories.map((c) => c.label),
            text: (d) =>
              !showLabelMap[d.category] || +d.value < 4
                ? ""
                : valueFormat(+d.value),
            fontSize: 12,
            fill: (d) => textColorMap[d.category] ?? "white",
            title: (d) => d.category,
          }),
        ),
      ],
    });
  }

  // ----------------------------------------------------------------------
  function assembleContainer(chartNodes, plotsForHover) {
    // Walk each Plot SVG, lift category titles onto data-category attrs
    // for the scoped hover-fade CSS. Skip non-category titles (group
    // headers don't carry a title, but be defensive).
    const allCharts = plotsForHover ?? chartNodes;
    for (const chart of allCharts) {
      for (const el of chart.querySelectorAll("rect, text")) {
        const titleEl = el.querySelector("title");
        if (titleEl && categoryLabels.has(titleEl.textContent)) {
          el.dataset.category = titleEl.textContent;
          titleEl.remove();
        }
      }
    }

    const uid = `sbc-${Math.random().toString(36).slice(2, 8)}`;
    const fadeStyle = html`<style></style>`;

    function highlight(category) {
      fadeStyle.textContent = category
        ? `
          #${uid} svg rect[data-category]:not([data-category="${category}"]) { opacity: 0.15; transition: opacity 0.2s; }
          #${uid} svg text[data-category]:not([data-category="${category}"]) { opacity: 0.15; transition: opacity 0.2s; }
          #${uid} div[data-category]:not([data-category="${category}"]) { opacity: 0.4; transition: opacity 0.2s; }
          #${uid} div[data-category="${category}"] span { font-weight: 700; }
        `
        : "";
    }

    for (const chart of allCharts) {
      chart.addEventListener("mouseover", (e) => {
        highlight(e.target.closest("[data-category]")?.dataset.category ?? null);
      });
      chart.addEventListener("mouseleave", () => highlight(null));
    }

    const legendEl = makeLegend(
      categories.map(({ label, color }) => ({ label, color })),
      { onHover: highlight },
    );
    const headerEl = chartHeader({ title, subtitle });
    const captionEl = caption(captionContent);

    return html`<div id="${uid}" style="display: flex; flex-direction: column;">
      ${fadeStyle}${headerEl}${chartNodes}${legendEl}${captionEl}
    </div>`;
  }
}
