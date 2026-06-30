# subject-retention.csv.R
# Observable Framework data loader.
#
# Within-subject teacher retention rates by subject and year, with the
# stayers/movers/switchers/exiters counts that let the stacked-bar chart
# show what's driving the rate.
#
# Powers two charts:
#   - dumbbell: subject-level retention, pre-pandemic vs. recent
#   - stacked bar: outcome composition by subject
#
# Output columns:
#   fiscal_year                    - end-of-year fiscal year ("2026" = 2025-26)
#   prior_subject                  - subject taught the prior year
#   group                          - coarse grouping for color (Elementary,
#                                    Middle School, Secondary, Special
#                                    Education, Other)
#   teachers_before                - # teachers in `prior_subject` last year
#   stayers_movers_same_subject    - stayed teaching the same subject
#   stayers_movers_new_subject     - kept teaching but switched subject
#   switchers                      - moved to non-teaching public school role
#   exiters                        - left AR public schools entirely
#   retention_rate_pct             - same-subject retention rate (0-100, 1dp)

suppressPackageStartupMessages({
  library(dplyr)
  library(stringr)
})

source("src/data/_load-and-prep.R")

retention_rates <- ar_teachers_w_sub %>%
  # drop the per-subject expansion when building denominator (one row per
  # teacher-year), then re-join prior subject so each prior subject gets its
  # own denominator row.
  select(-subject) %>%
  distinct() %>%
  left_join(
    prior_year_subjects,
    by = c("research_id", "fiscal_year" = "next_year")
  ) %>%
  filter(!is.na(prior_subject)) %>%
  left_join(
    current_year_subjects,
    by = c("research_id", "fiscal_year", "prior_subject" = "current_subject")
  ) %>%
  mutate(taught_same_subject = replace_na(taught_same_subject, FALSE)) %>%
  group_by(fiscal_year, prior_subject) %>%
  summarize(
    teachers_before = n(),
    stayers_movers_same_subject = sum(
      (lf_outcome == "Stayer" | lf_outcome == "Mover") &
        taught_same_subject == TRUE
    ),
    stayers_movers_new_subject = sum(
      (lf_outcome == "Stayer" | lf_outcome == "Mover") &
        taught_same_subject == FALSE
    ),
    switchers = sum(lf_outcome == "Switcher", na.rm = TRUE),
    exiters = sum(lf_outcome == "Exiter", na.rm = TRUE),
    .groups = "drop"
  ) %>%
  mutate(
    retention_rate_pct = round(
      stayers_movers_same_subject / teachers_before * 100,
      1
    )
  )

# Coarse grouping for color scale; collapse "Other" subjects (Counselor,
# Library, etc.) — the chart only plots core subject lines.
out <- retention_rates %>%
  filter(prior_subject != "ESOL") %>%
  mutate(
    group = case_when(
      grepl("Middle", prior_subject) ~ "Middle",
      grepl("Secondary", prior_subject) ~ "High",
      prior_subject == "Elementary" ~ "Elementary",
      grepl("Special Education", prior_subject) ~ "Special Education",
      TRUE ~ "Non-core"
    )
  ) %>%
  filter(
    !(prior_subject %in% c("Other", "Counselor", "Library Media Specialist"))
  ) %>%
  mutate(
    prior_subject = str_replace_all(
      prior_subject,
      c(
        "English Language Arts" = "ELA",
        "Mathematics" = "Math",
        "and" = "&"
      )
    )
  ) %>%
  select(
    fiscal_year,
    prior_subject,
    group,
    teachers_before,
    stayers_movers_same_subject,
    stayers_movers_new_subject,
    switchers,
    exiters,
    retention_rate_pct
  ) %>%
  arrange(fiscal_year, prior_subject)

write.csv(out, stdout(), row.names = FALSE)
