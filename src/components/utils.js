import { html } from "npm:htl";
import { FONT, CAPTION_STYLE, TITLE_STYLE, SUBTITLE_STYLE } from "./theme.js";

/**
 * Renders a horizontal legend row beneath a chart.
 *
 * @param {Array}  items            - [{ label, color }] in display order
 * @param {Object} opts
 *   @param {string}   [opts.type="swatch"] - "swatch" (14×14px square) or "line" (24×3px segment)
 *   @param {Function} [opts.onHover]       - Called with (label) on hover, (null) on leave.
 *                                            Enables coordinated chart highlighting.
 */
export function makeLegend(items, { type = "swatch", onHover = null } = {}) {
  return html`<div style="
    padding: 8px 0 4px;
    font-family: ${FONT};
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 20px;
    user-select: none;
  ">${items.map(({ label, color }) => html`<div
    data-category="${label}"
    style="display: flex; align-items: center; gap: ${type === "line" ? "8px" : "7px"}; cursor: default;"
    onmouseover=${() => onHover?.(label)}
    onmouseout=${() => onHover?.(null)}
  >${type === "line"
    ? html`<div style="width: 24px; height: 3px; background: ${color}; border-radius: 2px; flex-shrink: 0;"></div>`
    : html`<div style="width: 14px; height: 14px; background: ${color}; border-radius: 2px; flex-shrink: 0;"></div>`
  }<span style="font-size: 13px; color: #222;">${label}</span></div>`)}</div>`;
}

/**
 * Renders a small italic caption beneath a chart. Pass a string or an htl
 * template (e.g. one containing an <a> for a CSV download link).
 *
 * Returns null when no text is provided, so callers can spread it
 * unconditionally into a container template.
 */
export function caption(content) {
  if (content == null || content === "") return null;
  return html`<p style="${CAPTION_STYLE}">${content}</p>`;
}

/**
 * Renders a bold title with an optional muted subtitle above a chart.
 * Pass strings or htl templates. Returns null when both are empty so
 * callers can spread it unconditionally.
 */
export function chartHeader({ title, subtitle } = {}) {
  const hasTitle = title != null && title !== "";
  const hasSubtitle = subtitle != null && subtitle !== "";
  if (!hasTitle && !hasSubtitle) return null;
  return html`<div style="font-family: ${FONT};">
    ${hasTitle ? html`<p style="${TITLE_STYLE}">${title}</p>` : null}
    ${hasSubtitle ? html`<p style="${SUBTITLE_STYLE}">${subtitle}</p>` : null}
  </div>`;
}
