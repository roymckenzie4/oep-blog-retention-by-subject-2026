// See https://observablehq.com/framework/config for documentation.
export default {
  title: "Arkansas Teacher Retention by Subject and Grade",

  head: `
    <link rel="icon" href="observable.png" type="image/png" sizes="32x32">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Overpass:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      :root {
        --sans-serif: "Overpass", sans-serif;
        --serif: "Overpass", sans-serif;
      }
      main {
        max-width: 950px !important;
        margin-left: auto;
        margin-right: auto;
      }
      /* Override the air theme's built-in prose column width */
      main p,
      main h1, main h2, main h3, main h4, main h5, main h6,
      main ul, main ol, main li, main blockquote,
      main .observablehq, main .observablehq--block {
        max-width: none !important;
      }
      /* Heading anchor links: disable hover/click behavior */
      main h2 a, main h3 a, main h4 a {
        pointer-events: none;
        text-decoration: none;
      }
      /* When embedded in WordPress iframe: remove all padding/margins */
      html.iframe-embed #observablehq-center {
        margin: 0 !important;
      }
    </style>
  <script>
    // Run immediately (before load) so CSS takes effect before first paint
    if (window.self !== window.top) {
      document.documentElement.classList.add("iframe-embed");
    }
    function reportHeight() {
      window.parent.postMessage(
        { type: "setHeight", height: document.documentElement.scrollHeight },
        "*"
      );
    }
    window.addEventListener("load", function() {
      if (window.self !== window.top) {
        const title = document.querySelector("h1");
        if (title) title.style.display = "none";
        const center = document.getElementById("observablehq-center");
        if (center) center.style.margin = "0";
        const main = document.querySelector("main");
        if (main) { main.style.maxWidth = "none"; main.style.margin = "0"; }
        document.body.style.fontSize = "18px";
        document.body.style.color = "#565656";
        const firstP = document.querySelector("main p");
        if (firstP) firstP.style.marginTop = "0";
        document.querySelectorAll("p a").forEach(a => a.style.color = "#9d2235");
      }
      reportHeight();
      new ResizeObserver(reportHeight).observe(document.body);
    });
  </script>
`,

  root: "src",
  theme: "air",
  sidebar: false,
  footer: "",
  toc: false,
};
