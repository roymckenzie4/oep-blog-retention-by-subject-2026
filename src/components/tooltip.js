import { html } from "npm:htl";
import { FONT } from "./theme.js";

/**
 * Attaches a custom HTML tooltip to an Observable Plot chart.
 *
 * Three modes, selected by the options you pass:
 *
 * 1. targetMap mode (geo/choropleth maps):
 *    Pass `targetMap` — a Map<SVGElement, datum>. The tooltip shows the datum
 *    for whichever path element the cursor is directly over. Perfectly accurate,
 *    no distance math. Tooltip follows the cursor.
 *
 * 2. 1D mode (line charts):
 *    Pass `points` + `x`. Snaps to the nearest point along the X axis.
 *
 * 3. 2D mode (scatter plots):
 *    Pass `points` + `x` + `y`. Uses Euclidean distance; hides beyond `maxDist`.
 *
 * @param {SVGElement} chart    - The Plot SVG element
 * @param {Array}      points   - Data array (not needed in targetMap mode, pass null)
 * @param {Object}     opts
 *   @param {Map}      [opts.targetMap]   - Map<SVGElement, datum> for exact geo hit-testing
 *   @param {string}   [opts.x]           - Field name for the x channel (1D/2D modes)
 *   @param {string}   [opts.y]           - Field name for the y channel (2D mode)
 *   @param {Function} opts.format        - (datum) => HTML string for tooltip content
 *   @param {number}   [opts.maxDist=40]  - 2D mode: hide tooltip beyond this pixel distance
 *   @param {boolean}  [opts.hideOnBackground=false] - Hide when hovering SVG background
 *
 * @returns {HTMLElement} A container wrapping the chart and tooltip, ready to display()
 */
export function attachTooltip(chart, points, { x, y = null, format, maxDist = 40, defaultTipY = 28, positions = null, hideOnBackground = false, targetMap = null }) {
  // --- Build positioned array (1D / 2D / positions modes) ---
  let positioned = [];
  if (!targetMap) {
    if (positions) {
      positioned = positions;
    } else {
      const xScale = chart.scale("x");
      const yScale = y ? chart.scale("y") : null;
      positioned = points.map((d) => ({
        datum: d,
        px: xScale.apply(d[x]),
        py: yScale ? yScale.apply(d[y]) : null,
      }));
    }
  }

  // 2D mode: when y is provided OR when pre-computed positions include py
  const is2D = positions ? true : !!y;

  function findNearest(mouseX, mouseY) {
    if (is2D) {
      return positioned.reduce((prev, curr) => {
        const dPrev = (prev.px - mouseX) ** 2 + (prev.py - mouseY) ** 2;
        const dCurr = (curr.px - mouseX) ** 2 + (curr.py - mouseY) ** 2;
        return dCurr < dPrev ? curr : prev;
      });
    } else {
      return positioned.reduce((prev, curr) =>
        Math.abs(curr.px - mouseX) < Math.abs(prev.px - mouseX) ? curr : prev
      );
    }
  }

  const tip = html`<div style="
    position: absolute;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px 12px;
    font-family: ${FONT};
    font-size: 13px;
    line-height: 1.6;
    width: 200px;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    display: none;
  "></div>`;

  const container = html`<div style="position: relative; display: block;">
    ${chart}${tip}
  </div>`;

  chart.addEventListener("pointermove", (event) => {
    if (hideOnBackground && event.target === chart) { tip.style.display = "none"; return; }

    let datum, tipX, tipY;

    if (targetMap) {
      // Exact hit-test: which path is the cursor over?
      datum = targetMap.get(event.target);
      if (!datum) { tip.style.display = "none"; return; }
      tipX = event.offsetX;
      tipY = event.offsetY;
    } else {
      if (!positioned.length) return;
      const rect = chart.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const nearest = findNearest(mouseX, mouseY);
      if (is2D) {
        const dist = Math.sqrt((nearest.px - mouseX) ** 2 + (nearest.py - mouseY) ** 2);
        if (dist > maxDist) { tip.style.display = "none"; return; }
      }
      datum = nearest.datum;
      tipX = nearest.px;
      tipY = nearest.py ?? defaultTipY;
    }

    tip.innerHTML = format(datum);
    tip.style.display = "block";

    // Horizontal: default right of cursor, flip left if near right edge.
    // Use getBoundingClientRect (reliable for SVG) rather than offsetWidth.
    const chartWidth = chart.getBoundingClientRect().width;
    const tipWidth = tip.offsetWidth || 200;
    let left = tipX + 14;
    if (left + tipWidth > chartWidth - 8) left = tipX - tipWidth - 14;
    // Clamp so the tooltip can never overflow either edge of the container.
    left = Math.max(4, Math.min(left, chartWidth - tipWidth - 4));
    tip.style.left = `${left}px`;

    // Vertical: above cursor, flip below if it would clip the top
    let top = tipY - tip.offsetHeight - 10;
    if (top < 8) top = tipY + 10;
    tip.style.top = `${top}px`;
  });

  chart.addEventListener("pointerleave", () => {
    tip.style.display = "none";
  });

  return container;
}
