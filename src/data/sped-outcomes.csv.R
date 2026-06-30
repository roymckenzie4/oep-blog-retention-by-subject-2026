# sped-outcomes.csv.R
# Observable Framework data loader.
#
# Pre-COVID vs. post-COVID outcomes for special education teachers.
# Powers the "two-period outcomes for SPED teachers" chart.
#
# Output columns:
#   period             - "Pre-COVID (2017-2019)" or "Post-COVID (2024-2026)"
#   sped_outcome       - outcome category (mutually exclusive)
#   n_teachers         - count for this cell
#   teachers_before    - denominator: # SPED teachers in this period
#   rate_pct           - n_teachers / teachers_before, 0-100, 1dp

suppressPackageStartupMessages({
  library(dplyr)
  library(tidyr)
})

source("src/data/_load-and-prep.R")

# Build the teacher-level SPED outcomes table. Each row = one SPED teacher
# in one fiscal year, with their next-year outcome bucket.
sped_outcomes <- ar_teachers_w_sub %>%
  select(-subject) %>%
  distinct() %>%
  left_join(
    prior_year_subjects,
    by = c("research_id", "fiscal_year" = "next_year")
  ) %>%
  filter(prior_subject == "Special Education") %>%
  left_join(
    select(current_year_subjects, -taught_same_subject),
    by = c("research_id", "fiscal_year"),
    relationship = "many-to-many"
  ) %>%
  mutate(
    taught_same_subject = (current_subject == "Special Education"),
    taught_gen_elementary = (current_subject == "Elementary"),
    taught_gen_middle = grepl("Middle School", current_subject),
    taught_gen_secondary = grepl("Secondary", current_subject)
  ) %>%
  group_by(fiscal_year, research_id, prior_subject, lf_outcome) %>%
  summarize(
    taught_same_subject = any(taught_same_subject, na.rm = TRUE),
    taught_gen_elementary = any(taught_gen_elementary, na.rm = TRUE),
    taught_gen_middle = any(taught_gen_middle, na.rm = TRUE),
    taught_gen_secondary = any(taught_gen_secondary, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  mutate(
    sped_outcome = case_when(
      lf_outcome == "Exiter" ~ "Exiter",
      lf_outcome == "Switcher" ~ "Switcher",
      taught_same_subject ~ "Stayed in SPED",
      taught_gen_elementary | taught_gen_middle | taught_gen_secondary ~
        "Moved to core teaching",
      TRUE ~ "Taught a non-core subject"
    )
  )

sped_outcome_levels <- c(
  "Stayed in SPED",
  "Moved to core teaching",
  "Taught a non-core subject",
  "Switcher",
  "Exiter"
)

out <- sped_outcomes %>%
  filter(fiscal_year %in% as.character(c(2017:2019, 2024:2026))) %>%
  mutate(
    period = if_else(
      as.numeric(fiscal_year) <= 2019,
      "Pre-COVID (2017-2019)",
      "Post-COVID (2024-2026)"
    ),
    sped_outcome = factor(sped_outcome, levels = sped_outcome_levels)
  ) %>%
  count(period, sped_outcome, .drop = FALSE, name = "n_teachers") %>%
  group_by(period) %>%
  mutate(
    teachers_before = sum(n_teachers),
    rate_pct = round(n_teachers / teachers_before * 100, 1)
  ) %>%
  ungroup() %>%
  mutate(
    period = factor(
      period,
      levels = c("Pre-COVID (2017-2019)", "Post-COVID (2024-2026)")
    )
  ) %>%
  arrange(period, sped_outcome)

write.csv(out, stdout(), row.names = FALSE)
