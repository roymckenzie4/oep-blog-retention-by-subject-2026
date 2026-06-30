# sped-destinations.csv.R
# Observable Framework data loader.
#
# Where SPED switchers actually went — categorized by their non-teaching
# job codes — split pre-COVID vs. post-COVID. Powers the "detailed outcomes
# for SPED teachers" chart.
#
# Pipeline:
#   1. Build the teacher-level SPED outcomes table (shares logic with
#      sped-outcomes.csv.R — kept inline rather than helper'd to keep each
#      loader self-documenting).
#   2. Find switchers' non-teaching job codes.
#   3. Categorize each job code into a granular bucket via a large case_when.
#   4. Collapse multiple job codes per teacher-year via a priority order.
#   5. Roll up to 7 final destination categories.
#   6. Compute rates against the period-wide SPED teacher denominator.
#
# Output columns:
#   period             - "Pre-COVID (2017-2019)" or "Post-COVID (2024-2026)"
#   final_category     - one of 7 destination buckets
#   n_teachers         - count for this cell
#   teachers_before    - denominator: total SPED teacher-years in period
#   rate_pct           - n_teachers / teachers_before, 0-100, 2dp
#                        (2dp because category rates can be <1%)

suppressPackageStartupMessages({
  library(dplyr)
  library(tidyr)
})

source("src/data/_load-and-prep.R")

# --- Step 1: teacher-level SPED outcomes (duplicates sped-outcomes.csv.R prep) ---

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

# --- Step 2: switchers' non-teaching job codes ---

sped_switchers <- sped_outcomes %>%
  filter(sped_outcome == "Switcher") %>%
  select(research_id, fiscal_year) %>%
  mutate(fiscalyear = as.character(as.numeric(fiscal_year) - 1990)) %>%
  left_join(all_job_codes, by = c("research_id", "fiscalyear")) %>%
  select(-fiscalyear) %>%
  # exclude inclusion-SpEd teaching codes (these aren't a "destination" switch)
  filter(!(jobcode %in% c(7145, 7150))) %>%
  distinct()

# --- Step 3: categorize each job code ---

sped_switchers_coded <- sped_switchers %>%
  filter(teacher_jobcode_flag == FALSE) %>%
  mutate(
    job_category = case_when(
      # District admin
      jobcode %in% c(1000, 1015, 1030) ~ "District admin",
      # Building admin (principals & APs)
      jobcode %in% c(2010, 2020, 2030, 2040, 2050, 2060) ~ "Building admin",
      # Curriculum / program supervisors (incl. SpEd supervisor)
      jobcode %in% 3010:3030 ~ "Curriculum supervisor",
      jobcode == 3040 ~ "Curriculum supervisor",
      jobcode %in% 3325:3399 ~ "Curriculum supervisor",
      jobcode %in% 4336:4368 ~ "Curriculum supervisor",
      # Specialized teaching (SpEd-adjacent / specialized populations)
      jobcode %in% c(7170, 7190, 7530, 7540) ~ "Specialized teaching",
      # Instructional coaches
      jobcode %in% c(7100, 7110, 7120, 7130, 7135, 7315) ~ "Instructional coach",
      # Interventionists & subject specialists
      jobcode %in% c(6040, 6041, 6042) ~ "Interventionist/specialist",
      jobcode %in% c(7180, 7200, 7210, 7220, 7230, 7235) ~ "Interventionist/specialist",
      jobcode %in% c(3050, 3055, 3060) ~ "Interventionist/specialist",
      jobcode %in% c(7142, 7144, 7146) ~ "Interventionist/specialist",
      # Counselors
      jobcode %in% c(6015, 6020, 6030) ~ "Counselor",
      # Library/media
      jobcode %in% c(5010, 5020, 5030) ~ "Library/media",
      # Other student support (psych, SLP, mental health, dean, parent liaison)
      jobcode %in% c(9010, 9020, 9030, 9035) ~ "Student support",
      jobcode %in% c(7060, 7070, 7080) ~ "Student support",
      # Other certified job codes
      jobcode %in% c(7160) ~ "Specialized teaching",
      jobcode == 7090 ~ "Instructional coach",
      jobcode %in% c(7005, 7010, 7020, 7030, 7035, 7040, 7050, 7051, 7052, 7095, 7400, 7410) ~ "Other admin/support",
      jobcode %in% c(9040, 9041, 9042) ~ "Adult education",
      jobcode %in% c(7006, 7140) ~ "Other teaching",
      # 6-digit codes: older course codes (data quality) vs. 99 series (non-academic)
      jobcode >= 100000 & jobcode <= 699999 ~ "Course code (older - data quality)",
      jobcode >= 990000 ~ "Non-academic (99 series)",
      # Classified District admin
      jobcode %in% c(604, 606, 612, 614) ~ "District admin",
      # Classified other admin/support
      jobcode %in% c(605, 607, 640, 745, 747, 750, 888, 890) ~ "Other admin/support",
      # Classified student support (nurses, therapists, social workers, etc.)
      jobcode %in% c(452, 454, 455, 456, 457, 458, 459, 460, 461, 462, 463, 464, 465, 466, 472, 474, 475, 476) ~ "Student support",
      # Interventionist/specialist (dyslexia roles)
      jobcode %in% c(480, 481) ~ "Interventionist/specialist",
      # Other teaching (paras, subs, tutors, unlicensed, apprentices, ESOL paras)
      jobcode %in% c(758, 759, 760, 761, 762, 763, 764, 765, 766, 778, 779, 780, 781, 782, 785) ~ "Other teaching",
      # Operations / clerical / facilities — rare for SpEd switchers, single bucket
      jobcode %in% c(
        453, 473, 500, 502, 600, 602, 603, 608, 609, 610, 611, 613, 616, 617,
        619, 620, 621, 623, 624, 625, 626, 628, 630, 631, 632, 633, 636, 643,
        644, 645, 648, 650, 651, 652, 654, 656, 660, 661, 670, 671, 672, 673,
        680, 681, 682, 690, 691, 692, 740, 742, 743, 744, 746, 748, 756, 757,
        768, 770, 776, 777, 880, 882, 884, 886
      ) ~ "Operations/support staff",
      TRUE ~ "Other/Unknown"
    )
  )

# --- Step 4: one job category per teacher-year, via fixed priority ---

job_priority <- c(
  "District admin" = 1,
  "Building admin" = 2,
  "Curriculum supervisor" = 3,
  "Instructional coach" = 4,
  "Interventionist/specialist" = 5,
  "Counselor" = 6,
  "Library/media" = 7,
  "Student support" = 8,
  "Specialized teaching" = 9,
  "Other admin/support" = 10,
  "Adult education" = 11,
  "Other teaching" = 12,
  "Operations/support staff" = 13,
  "Course code (older - data quality)" = 14,
  "Non-academic (99 series)" = 15,
  "Other/Unknown" = 16
)

sped_switchers_collapsed <- sped_switchers_coded %>%
  mutate(priority = job_priority[job_category]) %>%
  group_by(research_id, fiscal_year) %>%
  slice_min(priority, n = 1, with_ties = FALSE) %>%
  ungroup() %>%
  select(-priority)

# --- Step 5: compute denominators per period, then collapse to final buckets ---

sped_destination_rates <- sped_outcomes %>%
  filter(fiscal_year %in% as.character(c(2017:2019, 2024:2026))) %>%
  mutate(
    period = if_else(
      as.numeric(fiscal_year) <= 2019,
      "Pre-COVID (2017-2019)",
      "Post-COVID (2024-2026)"
    )
  ) %>%
  left_join(
    sped_switchers_collapsed %>% select(research_id, fiscal_year, job_category),
    by = c("research_id", "fiscal_year")
  ) %>%
  group_by(period) %>%
  mutate(teachers_before = n()) %>%  # all SPED teacher-years in this period
  ungroup() %>%
  filter(!is.na(job_category)) %>%   # only switchers populate the numerator
  count(period, job_category, teachers_before, name = "n_teachers") %>%
  mutate(
    final_category = case_when(
      job_category %in% c("Instructional coach", "Curriculum supervisor") ~
        "Coaching & curriculum leadership",
      job_category == "Interventionist/specialist" ~ "Interventionist / specialist",
      job_category %in% c("Building admin", "District admin", "Other admin/support") ~
        "Administration",
      job_category %in% c("Counselor", "Student support", "Library/media") ~
        "Counseling & student support",
      job_category %in% c("Specialized teaching", "Other teaching", "Adult education") ~
        "Other teaching roles",
      job_category == "Non-academic (99 series)" ~ "Non-academic role (99 series)",
      TRUE ~ "Other / unclear"
    )
  ) %>%
  group_by(period, teachers_before, final_category) %>%
  summarize(n_teachers = sum(n_teachers), .groups = "drop") %>%
  mutate(rate_pct = round(n_teachers / teachers_before * 100, 2))

out <- sped_destination_rates %>%
  mutate(
    period = factor(
      period,
      levels = c("Pre-COVID (2017-2019)", "Post-COVID (2024-2026)")
    )
  ) %>%
  arrange(period, desc(rate_pct)) %>%
  select(period, final_category, n_teachers, teachers_before, rate_pct)

write.csv(out, stdout(), row.names = FALSE)
