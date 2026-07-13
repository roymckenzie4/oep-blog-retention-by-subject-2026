```js
import { html } from "npm:htl";

const subjectRetention = FileAttachment("data/subject-retention.csv").csv({
  typed: true,
});
const msTransitions = FileAttachment("data/ms-transitions.csv").csv({
  typed: true,
});
const spedOutcomes = FileAttachment("data/sped-outcomes.csv").csv({
  typed: true,
});
const spedDestinations = FileAttachment("data/sped-destinations.csv").csv({
  typed: true,
});

// CSV download URLs for chart captions. Observable Framework data-loader
// outputs aren't reachable at plain ./data/ paths — go through .url().
const subjectRetentionCsvUrl = await FileAttachment(
  "data/subject-retention.csv",
).url();
const msTransitionsCsvUrl = await FileAttachment(
  "data/ms-transitions.csv",
).url();
const spedOutcomesCsvUrl = await FileAttachment("data/sped-outcomes.csv").url();
const spedDestinationsCsvUrl = await FileAttachment(
  "data/sped-destinations.csv",
).url();

const downloadLink = (href, filename) =>
  html`<a href="${href}" download="${filename}" style="color: inherit;"
    >Download chart data (CSV)</a
  >`;

// Year windows used across multiple charts. End-of-year fiscal years —
// "2026" = the 2025-26 school year.
const PRE_YEARS = new Set([2017, 2018, 2019]);
const RECENT_YEARS = new Set([2024, 2025, 2026]);

// Subject group palette used by the dumbbell + state-average row.
const SUBJECT_GROUPS = [
  { label: "Elementary", color: "#1F77B4" },
  { label: "Middle", color: "#4DD0E1" },
  { label: "High", color: "#FF8C42" },
  { label: "Special Education", color: "#D6463E" },
  { label: "Non-core", color: "#C0C0C0" },
  { label: "State Average", color: "#707070" },
];

// Compact display names — used for the stacked bar where the x-axis is dense.
function shortSubject(s) {
  return s
    .replace(/^Middle School All Core$/, "MS All Core")
    .replace(/^Middle School\s+/, "MS ")
    .replace(/^Secondary All Core$/, "Sec All Core")
    .replace(/^Secondary\s+/, "Sec ")
    .replace(/^Special Education$/, "Special Ed.")
    .replace(/^Physical Education & Health$/, "PE & Health")
    .replace(/^Career & Technical$/, "Career & Tech")
    .replace(/Social Studies/, "Soc. Studies");
}
```

# Arkansas Teacher Retention by Subject: Different Subjects, Different Stories

In our [previous post](https://oep.uark.edu/arkansas-teacher-retention-2025-26-a-new-normal/), we discussed how statewide teacher retention may have stabilized at a rate that is lower than pre-pandemic levels. But looking at how many teachers stay in the classroom explores only one part of the story. Another important question is which classrooms are they staying in?

Some subjects and grade levels struggle more to retain teachers than others, and these struggles can persist even while statewide retention rates appear stable. The Arkansas Department of Education works with OEP to identify [subject-level teacher shortage areas](https://dese.ade.arkansas.gov/Offices/educator-effectiveness/educator-workforce-data): specific subject and grade-level combinations where a high proportion of the teaching workforce must be replaced annually. These shortages aren't driven only by retention - certification gaps and teacher supply matter too - but they're one signal of where staffing problems are concentrated. Still, identifying _which_ subjects are shortage areas doesn't tell us _why_ these subjects struggle to retain teachers.

To better understand these challenges, this blog post looks at within-subject retention rates - how often teachers stay in the same subject from one year to the next. Two subjects, both identified shortage areas, stood out. **Core subject middle school teachers** left Arkansas public school classrooms at a higher rate than any other type of teacher in the state. **Special education teachers** displayed the largest decline in retention compared to the pre-pandemic era. For both these subjects, the story turns out to be less about teachers leaving Arkansas public schools and more about how they move between roles.

## Teacher retention isn't uniform across subjects and grade levels.

Teacher retention varies across subjects and grade levels in Arkansas. Over the last three years, about 77 percent of Arkansas teachers taught in the same subject from one year to the next. But within-subject retention varied considerably across individual subjects. The figure below shows teacher retention rates across subjects, along with their pre-pandemic rates. Middle school subjects sat at the low end of average teacher retention during the 2024 to 2026 school years - approximately 10 percentage points below the state average. At the high end, 84 percent of elementary teachers were retained - 7 points above the state average.

```js
import { dumbbellChart } from "./components/dumbbell-chart.js";
import * as d3 from "npm:d3";

// Weighted pre/post averages per subject: sum(retained) / sum(teachers_before)
// across the years in each window, matching the R draft's aggregation.
function weightedAvgByPeriod(rows, yearSet) {
  const subset = rows.filter((d) => yearSet.has(+d.fiscal_year));
  const byKey = d3.rollup(
    subset,
    (group) => {
      const num = d3.sum(group, (r) => +r.stayers_movers_same_subject);
      const denom = d3.sum(group, (r) => +r.teachers_before);
      return denom > 0 ? (num / denom) * 100 : null;
    },
    (d) => `${d.prior_subject}|${d.group}`,
  );
  return byKey;
}

const preByKey = weightedAvgByPeriod(subjectRetention, PRE_YEARS);
const postByKey = weightedAvgByPeriod(subjectRetention, RECENT_YEARS);

// State-average reference: weighted across all subjects EXCLUDING the
// "All Core" aggregates (which would double-count their constituent rows).
function stateAverage(rows, yearSet) {
  const subset = rows.filter(
    (d) => yearSet.has(+d.fiscal_year) && !/All Core/.test(d.prior_subject),
  );
  const num = d3.sum(subset, (r) => +r.stayers_movers_same_subject);
  const denom = d3.sum(subset, (r) => +r.teachers_before);
  return (num / denom) * 100;
}

const stateAvgPre = stateAverage(subjectRetention, PRE_YEARS);
const stateAvgPost = stateAverage(subjectRetention, RECENT_YEARS);

const groupLabels = new Set(SUBJECT_GROUPS.map((g) => g.label));

const dumbbellData = [...preByKey.keys()]
  .map((key) => {
    const [label, group] = key.split("|");
    const valuePre = preByKey.get(key);
    const valuePost = postByKey.get(key);
    if (valuePre == null || valuePost == null) return null;
    return { label, group, valuePre, valuePost };
  })
  .filter((d) => d !== null)
  // Drop the "All Core" aggregate rows — redundant with the individual
  // subject rows and clutter the visual grouping.
  .filter((d) => !/All Core/.test(d.label))
  .filter((d) => groupLabels.has(d.group));

// State Average row, rendered at the bottom of the chart as its own group.
dumbbellData.push({
  label: "State Average",
  group: "State Average",
  valuePre: stateAvgPre,
  valuePost: stateAvgPost,
});

display(
  dumbbellChart(dumbbellData, SUBJECT_GROUPS, {
    width,
    xLabel: "Within-Subject Retention (2024–2026, with change from 2017–2019)",
    reference: {
      value: stateAvgPost,
      label: `State average: ${stateAvgPost.toFixed(1)}%`,
    },
    title: "Within-subject retention varies sharply across Arkansas teachers",
    subtitle:
      "Subject-level retention ran from 65% to 84% over the last three years. Middle school subjects and special education sit furthest below the state average.",
    caption: html`Dot = 2024–2026 average. Arrow tail = 2017–2019 average. Grey
    label = percentage-point change. ·
    ${downloadLink(
      subjectRetentionCsvUrl,
      "OEP-Arkansas-Subject-Retention.csv",
    )}`,
  }),
);
```

Different grade levels and subjects have also seen different levels of retention recovery since the COVID-19 pandemic, comparing with the 2017 to 2019 school years average. Across all subjects, within-subject retention is sitting roughly 3 percentage points below pre-pandemic levels. But subject-level retention in middle schools fell by over 4 percentage points, widening existing pre-pandemic gaps. Special education retention fell even further - by 6 percentage points - the largest decline of any subject. Before the pandemic, SPED had one of the highest retention rates in the state; after this drop, SPED retention rates sit slightly below the state average.

For these teachers, however, exiting their subject classroom does not necessarily mean exiting the Arkansas public school workforce. While some teachers do leave Arkansas schools entirely, others move to non-classroom roles or move to teach in another subject area. The figure below shows the breakdown of these different paths by subjects. Stayers in the same subject continue teaching the same subject as the prior year somewhere in Arkansas public schools - whether in the same school or a different school. Stayers in a new subject remain teaching somewhere in Arkansas public schools but in a different subject than in the prior year. Of the remaining teachers, Switchers change to non-teaching roles within Arkansas public schools, while Exiters exit the Arkansas public education workforce entirely.

```js
import { stackedBarChart } from "./components/stacked-bar-chart.js";

// Recent 3-year breakdown: sum counts across 2024–26, then convert to
// percentages of teachers_before per subject. Long-form for the chart.
// Diverging palette inspired by colorspace::scale_fill_discrete_diverging
// "Red Green" with h1=340 (magenta), h2=105 (green), low lightness on extremes.
const PATTERN_CATEGORIES = [
  { label: "Stayers — Same Subject", color: "#154B27", textColor: "white" },
  { label: "Stayers — New Subject", color: "#8FAB55", textColor: "#0B2E18" },
  { label: "Switchers", color: "#D58EAE", showLabel: false },
  { label: "Exiters", color: "#5D2A4C", textColor: "white" },
];

const recentRows = subjectRetention.filter((d) =>
  RECENT_YEARS.has(+d.fiscal_year),
);

// Map each subject to its coarse group (Elementary / MS / Secondary / SPED /
// Other) by looking at any matching row in the CSV. The CSV emits "Special
// Education"; we shorten to "Special Ed." for the header (narrow facet).
const remapGroup = (g) => (g === "Special Education" ? "Special Ed." : g);
const subjectGroupMap = new Map(
  recentRows.map((d) => [d.prior_subject, remapGroup(d.group)]),
);

const subjectTotals = d3.rollup(
  recentRows,
  (rows) => ({
    teachers_before: d3.sum(rows, (r) => +r.teachers_before),
    same: d3.sum(rows, (r) => +r.stayers_movers_same_subject),
    new_: d3.sum(rows, (r) => +r.stayers_movers_new_subject),
    sw: d3.sum(rows, (r) => +r.switchers),
    ex: d3.sum(rows, (r) => +r.exiters),
  }),
  (d) => d.prior_subject,
);

// Build long-form rows with group attached. Sort by group rank, then by
// retention rate descending within group — matches image #9 layout.
const STACKED_GROUP_ORDER = [
  "Elementary",
  "Middle",
  "High",
  "Special Ed.",
  "Non-core",
];
const stackedGroupRank = Object.fromEntries(
  STACKED_GROUP_ORDER.map((g, i) => [g, i]),
);

const subjectRows = [...subjectTotals.entries()]
  .map(([subject, t]) => {
    if (!t.teachers_before) return null;
    const group = subjectGroupMap.get(subject);
    if (!stackedGroupRank.hasOwnProperty(group)) return null;
    return {
      subject,
      x: shortSubject(subject),
      group,
      retention: t.same / t.teachers_before,
      totals: t,
    };
  })
  .filter(Boolean)
  .sort((a, b) => {
    const ga = stackedGroupRank[a.group];
    const gb = stackedGroupRank[b.group];
    if (ga !== gb) return ga - gb;
    return a.subject.localeCompare(b.subject);
  });

const patternData = subjectRows.flatMap((row) => {
  const denom = row.totals.teachers_before;
  return [
    {
      x: row.x,
      group: row.group,
      category: "Stayers — Same Subject",
      value: (row.totals.same / denom) * 100,
    },
    {
      x: row.x,
      group: row.group,
      category: "Stayers — New Subject",
      value: (row.totals.new_ / denom) * 100,
    },
    {
      x: row.x,
      group: row.group,
      category: "Switchers",
      value: (row.totals.sw / denom) * 100,
    },
    {
      x: row.x,
      group: row.group,
      category: "Exiters",
      value: (row.totals.ex / denom) * 100,
    },
  ];
});

display(
  stackedBarChart(patternData, PATTERN_CATEGORIES, {
    width,
    height: Math.round(width * 0.55),
    yLabel: "% of Prior-Year Teachers Retained in Subject",
    valueFormat: (v) => `${Math.round(v)}%`,
    groupBy: "group",
    groupOrder: STACKED_GROUP_ORDER,
    title: "Most teachers who leave a subject stay in Arkansas public schools",
    subtitle:
      "Each bar shows what happened in the following year to the teachers of that subject, averaged across 2024, 2025, and 2026 school-year outcomes.",
    caption: downloadLink(
      subjectRetentionCsvUrl,
      "OEP-Arkansas-Subject-Retention.csv",
    ),
  }),
);
```

Over the past three years, true exit rates for each subject varied from 7 to 11 percent, too narrow a range to explain the large gaps in within-subject retention. The remaining attrition reflects movement to other roles within Arkansas public schools; either to instructional roles in a different subject or to non-instructional roles.

For example, since 2024, middle school teachers have changed subjects more often than teachers in any other subject. Special education teachers, on the other hand, have switched to non-teaching roles more than any other type of teacher. For both cases, we need to take a closer look at where these teachers are going to understand what low within-subject retention means in practice.

## Middle School: Same Teachers, Different Subjects

Core-subject middle school teachers have the lowest within-subject retention of any subject. Over the last three years, over one in three middle school teachers ceased teaching in the same middle school subject from one year to the next. But only about 10 percent of these teachers exit Arkansas public schools entirely, a similar rate to all other subjects. Instead, switching between subjects drives these low retention rates, accounting for around two-thirds of within-subject attrition - 20 percent of all core middle school teachers.

Most of this switching is between middle school-level subjects. In 2025-26, around 8 percent of all 2024-25 middle school teachers switched to another middle school-level subject. By comparison, 3 percent of those same teachers moved down to teach elementary, and 4 percent moved up to teach high school.

```js
import { groupedBarChart } from "./components/grouped-bar-chart.js";

const MS_OUTCOMES = [
  { label: "Switched within middle school", color: "#1A9850" },
  { label: "Moved to secondary", color: "#2166AC" },
  { label: "Moved to elementary", color: "#92C5DE" },
  { label: "Taught a non-core subject", color: "#969696" },
];

// Subject-name cleanup: strip "Middle School " prefix and shorten ELA.
function cleanMsSubject(s) {
  return s
    .replace(/^Middle School\s+/, "")
    .replace(/English Language Arts/, "ELA")
    .replace(/Mathematics/, "Math");
}

const MS_SUBJECT_ORDER = ["ELA", "Math", "Science", "Social Studies"];
const MS_OUTCOME_LABELS = new Set(MS_OUTCOMES.map((c) => c.label));

const msData = msTransitions
  .filter((d) => +d.fiscal_year === 2026)
  .filter(
    (d) =>
      /^Middle School /.test(d.prior_subject) &&
      d.prior_subject !== "Middle School All Core",
  )
  .filter((d) => MS_OUTCOME_LABELS.has(d.ms_outcome))
  .map((d) => ({
    x: cleanMsSubject(d.prior_subject),
    group: d.ms_outcome,
    value: +d.rate_pct,
  }))
  .sort(
    (a, b) => MS_SUBJECT_ORDER.indexOf(a.x) - MS_SUBJECT_ORDER.indexOf(b.x),
  );

display(
  groupedBarChart(msData, MS_OUTCOMES, {
    width,
    yLabel: "% of 2024–25 teachers",
    title:
      "Most middle school teachers who change subjects stay in middle school",
    subtitle:
      "Of 2024–25 core middle school teachers in each subject, share who took each path in 2025–26. Excludes the 65–75% who stayed in their subject and the ~13% who switched to non-teaching roles or left Arkansas public schools entirely.",
    caption: downloadLink(
      msTransitionsCsvUrl,
      "OEP-Arkansas-MS-Subject-Transitions.csv",
    ),
  }),
);
```

[Arkansas's effective teacher licensure](https://dese.ade.arkansas.gov/Offices/educator-effectiveness/licensure-exceptions/effective-teacher-licensure-etl) rules allow teachers to teach one grade above and one grade below the grade range for which they are licensed. Uniquely, this policy allows middle school certified teachers to both teach down to elementary students and teach up to high school students. This flexibility has led to speculation that low retention among middle school subjects reflects teachers using middle school as an "on ramp" into teaching: they begin with a middle school license, establish themselves in a district, and then move into elementary or high school jobs. The data show otherwise. Low within-subject retention in middle school represents churn between middle school subjects.

## Special Education: A Large Post-Pandemic Shift

Special education saw the sharpest post-pandemic decline in within-subject retention, falling by more than 6 percentage points. This decline was not driven by teachers leaving Arkansas public schools. From 2023-24 to 2025-26, special education teachers exited Arkansas public schools at an annual rate of 11 percent, up only 1 percentage point from pre-pandemic levels. The larger change was among those who remained in the workforce: Arkansas's SPED teachers are increasingly switching to non-classroom roles.

Over the past three years, around 7 percent of SPED teachers left the classroom for non-instructional roles within Arkansas public schools, more than double the 3 percent pre-pandemic rate. This increase accounts for most of the decline in SPED retention. Exits and movement to other teaching roles have increased only slightly.

```js
const PERIOD_CATEGORIES = [
  { label: "Pre-COVID (2017-2019)", color: "#BBBBBB" },
  { label: "Post-COVID (2024-2026)", color: "#C73E1D" },
];

const SPED_OUTCOME_ORDER = [
  "Moved to core teaching",
  "Taught a non-core subject",
  "Switcher",
  "Exiter",
];

const spedTwoPeriodData = spedOutcomes
  .filter((d) => d.sped_outcome !== "Stayed in SPED")
  .map((d) => ({
    x: d.sped_outcome,
    group: d.period,
    value: +d.rate_pct,
  }))
  .sort(
    (a, b) => SPED_OUTCOME_ORDER.indexOf(a.x) - SPED_OUTCOME_ORDER.indexOf(b.x),
  );

display(
  groupedBarChart(spedTwoPeriodData, PERIOD_CATEGORIES, {
    width,
    yLabel: "% of SPED teachers",
    title:
      "Special education teachers are increasingly leaving the classroom — but not Arkansas public schools",
    subtitle:
      "Of SPED teachers in each time period, share who took each non-retention path the next year. The ~80% who stayed in SPED are not shown.",
    caption: downloadLink(spedOutcomesCsvUrl, "OEP-Arkansas-SPED-Outcomes.csv"),
  }),
);
```

What types of non-classroom roles are these SPED teachers moving to? Most SPED switches were to instructional coaching and curriculum leadership roles. Nearly 2 percent of SPED teachers in the state moved into these types of roles, more than 4 times the pre-pandemic rate.

```js
// Shorter labels — the long names overflow even when rotated.
function shortDestination(s) {
  return s
    .replace(/Non-academic role \(99 series\)/, "Non-academic (99)")
    .replace(/Coaching & curriculum leadership/, "Instructional coaching")
    .replace(/Interventionist \/ specialist/, "Interventionist")
    .replace(/Other teaching roles/, "Other teaching")
    .replace(/Counseling & student support/, "Counseling support");
}

// Order final_category bars by post-COVID rate descending — the headline
// post-COVID growth in coaching/curriculum sits on the left.
const detailOrder = [
  ...new Set(
    spedDestinations
      .filter((d) => d.period === "Post-COVID (2024-2026)")
      .sort((a, b) => +b.rate_pct - +a.rate_pct)
      .map((d) => shortDestination(d.final_category)),
  ),
];

const spedDetailData = spedDestinations
  .map((d) => ({
    x: shortDestination(d.final_category),
    group: d.period,
    value: +d.rate_pct,
  }))
  .sort((a, b) => detailOrder.indexOf(a.x) - detailOrder.indexOf(b.x));

display(
  groupedBarChart(spedDetailData, PERIOD_CATEGORIES, {
    width,
    yLabel: "% of SPED teachers",
    valueFormat: (v) => `${v.toFixed(1)}%`,
    title:
      "Where SPED switchers go: curriculum and instructional coaching roles dominate",
    subtitle:
      "Instructional coaching and curriculum leadership grew nearly 4× — faster than overall switching — accounting for most of the post-COVID increase in identifiable destinations. Non-academic (99 series) reflects switchers whose destination role isn't identifiable from the data.",
    caption: downloadLink(
      spedDestinationsCsvUrl,
      "OEP-Arkansas-SPED-Destinations.csv",
    ),
  }),
);
```

The remaining movement is driven by an increase in SPED teachers who are assigned to only specifically non-academic courses, such as study halls. Districts may use this categorization to represent a variety of on-the-ground jobs. These cases represent a data quality issue which doesn't allow us to accurately categorize those new teachers' roles within their districts.

That said, the share of SPED teachers assigned to these unidentifiable jobs grew at the same pace as switching overall. These hard-to-categorize teachers made up roughly one third of all switchers both before and after the pandemic. In contrast, the movement to curriculum and instructional coaching roles grew faster than the overall switcher rate. Before the pandemic, these roles accounted for only 20 percent of switchers. After the pandemic, that share climbed to 27 percent.

## What's next

While both middle school core subjects and special education experience issues with retention, the causes behind these struggles are not the same. For middle school, the high turnover rate reflects churn between middle school subjects. For SPED, it reflects greater movement to non-classroom roles in the post-COVID era. In neither case does low within-subject retention reflect above-average exit rates from the Arkansas public school workforce.

These flows help us reframe low within-subject retention and better understand what solutions could look like. For middle school, where the net pool of middle school teachers remains more stable, teacher assignment may play a larger role than teacher recruitment. Similarly, for special education, districts focus more on retaining SPED teachers in special education classrooms than on keeping those teachers in the Arkansas public school workforce.

As the Arkansas policy context evolves, it is more important than ever to track these movements. For example, the [merit pay program](https://oep.uark.edu/explaining-the-2025-arkansas-merit-teacher-incentive-fund-program/) created by the LEARNS Act specifically rewards teachers in shortage area subjects, creating another incentive for between-subject movement. Early evidence doesn't show differential movement away from non-shortage subjects (like middle school ELA and social studies), but further monitoring will allow us to better understand the impact of these policies.

In our next post in this series, we'll zoom out from subject-level movement to examine the broader flows of teachers into and out of the Arkansas public school workforce.
