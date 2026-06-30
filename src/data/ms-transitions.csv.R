# ms-transitions.csv.R
# Observable Framework data loader.
#
# Where 2024-25 middle school teachers ended up in 2025-26, broken down by
# their prior subject (ELA / Math / Science / Social Studies). The grouped
# bar chart slices this for fiscal_year 2026 and drops the same-subject /
# switcher / exiter outcomes.
#
# Output columns:
#   fiscal_year      - end-of-year fiscal year
#   prior_subject    - 2024-25 middle school subject taught
#   ms_outcome       - 2025-26 outcome (mutually exclusive)
#   n_teachers       - count for this cell
#   teachers_before  - denominator: # teachers with this prior_subject
#   rate_pct         - n_teachers / teachers_before, 0-100, 1dp

suppressPackageStartupMessages({
  library(dplyr)
  library(tidyr)
})

source("src/data/_load-and-prep.R")

middle_school_outcomes <- ar_teachers_w_sub %>%
  select(-subject) %>%
  distinct() %>%
  left_join(
    prior_year_subjects,
    by = c("research_id", "fiscal_year" = "next_year")
  ) %>%
  # individual middle school subjects only — the "All Core" bucket is
  # a higher-level aggregate we don't want to double-count here.
  filter(
    grepl("Middle School", prior_subject) &
      prior_subject != "Middle School All Core"
  ) %>%
  # many-to-many join: one row per current-year subject they teach
  left_join(
    select(current_year_subjects, -taught_same_subject),
    by = c("research_id", "fiscal_year"),
    relationship = "many-to-many"
  ) %>%
  mutate(
    taught_same_subject = (prior_subject == current_subject),
    taught_other_middle = (grepl("Middle School", current_subject) &
      prior_subject != current_subject),
    taught_elementary = (current_subject == "Elementary"),
    taught_secondary = grepl("Secondary", current_subject)
  ) %>%
  group_by(fiscal_year, research_id, prior_subject, lf_outcome) %>%
  summarize(
    taught_same_subject = any(taught_same_subject, na.rm = TRUE),
    taught_other_middle = any(taught_other_middle, na.rm = TRUE),
    taught_elementary = any(taught_elementary, na.rm = TRUE),
    taught_secondary = any(taught_secondary, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  mutate(
    ms_outcome = case_when(
      lf_outcome == "Exiter" ~ "Exiter",
      lf_outcome == "Switcher" ~ "Switcher",
      taught_same_subject ~ "Same MS subject",
      taught_other_middle ~ "Switched within middle school",
      taught_secondary ~ "Moved to secondary",
      taught_elementary ~ "Moved to elementary",
      TRUE ~ "Taught a non-core subject"
    )
  )

ms_outcome_levels <- c(
  "Same MS subject",
  "Switched within middle school",
  "Moved to secondary",
  "Moved to elementary",
  "Taught a non-core subject",
  "Switcher",
  "Exiter"
)

out <- middle_school_outcomes %>%
  mutate(ms_outcome = factor(ms_outcome, levels = ms_outcome_levels)) %>%
  count(fiscal_year, prior_subject, ms_outcome, .drop = FALSE, name = "n_teachers") %>%
  group_by(fiscal_year, prior_subject) %>%
  mutate(
    teachers_before = sum(n_teachers),
    rate_pct = round(n_teachers / teachers_before * 100, 1)
  ) %>%
  ungroup() %>%
  arrange(fiscal_year, prior_subject, ms_outcome)

write.csv(out, stdout(), row.names = FALSE)
