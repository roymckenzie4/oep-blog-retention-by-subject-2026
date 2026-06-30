# _load-and-prep.R
#
# Shared upstream prep sourced by every data loader in this directory.
# Observable Framework ignores files with a leading underscore for routing,
# so this is not itself a loader — `source()` it from a `*.csv.R` loader.
#
# Exposes (after sourcing):
#   ar_teachers_w_sub      - per-teacher-year-subject base table
#   prior_year_subjects    - lookup: subject(s) a teacher taught last year
#   current_year_subjects  - lookup: subject(s) a teacher teaches this year
#   all_job_codes          - per-teacher-year job code rows with teacher flag
#   teacher_job_codes      - all_job_codes filtered to teaching codes only
#   subject_xwalk          - job code → subject crosswalk
#
# Data paths come from env vars with local-dev fallbacks. In CI, the build
# uses the force-committed `src/.observablehq/cache/` and never executes this.

suppressPackageStartupMessages({
  library(data.table)
  library(dplyr)
  library(tidyr)
  library(stringr)
  library(purrr)
})

# --- Configuration ---

# Main teacher workforce transitions file (matches Post 1's env var name).
data_path <- Sys.getenv(
  "TEACHER_LM_DATA",
  unset = "~/Library/CloudStorage/Box-Box/0 - Arkansas Projects/Projects/Teacher Pipeline/Teacher Retention/0_data/Classroom and Inclusion SPED Teachers/teacher_workforce_transitions_Classroom and Inclusion SPED Teachers_04-20-26.csv"
)

# Course/job code → subject crosswalk.
subject_xwalk_path <- Sys.getenv(
  "TEACHER_SUBJECT_XWALK",
  unset = "~/Library/CloudStorage/OneDrive-UniversityofArkansas/Josh Mcgee's files - Teacher Pipeline Project/0_data/Course Code-License-Subject Crosswalks/0_crosswalks/2025-26 Course_Job-Subject_Crosswalk_1-25-2026.csv"
)

# Directory containing the per-year "Employee YYYY-YYYY deidentified.csv" files.
# The 2025-26 file is special-cased (Cycle 2 path) to match the draft R script.
employee_dir <- Sys.getenv(
  "TEACHER_EMPLOYEE_DIR",
  unset = "~/Library/CloudStorage/OneDrive-UniversityofArkansas/Josh Mcgee's files - Teacher Pipeline Project/0_data/Longitudinal Teacher Workforce Data/Deidentified Longitudinal Data with Research ID/Employee"
)

start_year <- 2014
end_year <- 2026

# --- Load: teacher workforce transitions ---

ar_teachers <- fread(
  data_path,
  colClasses = "character",
  na.strings = c("", "NA")
) %>%
  # restrict to teachers we observed in the prior year OR new entrants
  filter(lag_teacher == "TRUE" | lf_outcome == "New")

# --- Load: subject crosswalk ---

subject_xwalk <- fread(
  subject_xwalk_path,
  colClasses = "character",
  na.strings = c("", "NA")
) %>%
  select(courseidjobcode, coursenamejobtitle, subject) %>%
  group_by(courseidjobcode, subject) %>%
  summarize(coursenamejobtitle = first(coursenamejobtitle), .groups = "drop") %>%
  distinct() %>%
  mutate(courseidjobcode_num = as.numeric(courseidjobcode))

# --- Load: per-year Employee files (job code source) ---

employee_tables <- list()
for (year in start_year:end_year) {
  file_path <- if (year == 2026) {
    file.path(employee_dir, "Employee 2025-2026 Cycle 2 deidentified.csv")
  } else {
    file.path(
      employee_dir,
      paste0("Employee ", year - 1, "-", year, " deidentified.csv")
    )
  }
  employee_tables[[paste0("employeeTable_", year)]] <- fread(
    file_path,
    colClasses = "character",
    na.strings = c("", "NA")
  )
}

all_job_codes <- employee_tables %>%
  map(\(df) dplyr::rename_with(df, ~ tolower(gsub(" |_|", "", .x)))) %>%
  bind_rows() %>%
  filter(outofdistrictlea == "N") %>%
  select(research_id = researchid, fiscalyear, jobcode) %>%
  mutate(
    jobcode = gsub('xml:space=\\"preserve\\">', "", jobcode),
    jobcode = gsub('xml:space=""preserve"">', "", jobcode),
    jobcode = as.numeric(jobcode)
  ) %>%
  mutate(
    teacher_jobcode_flag = case_when(
      # exclude classified (1xxxxx) and 99xxxx course codes from teaching set
      nchar(jobcode) == 6 &
        (grepl("^1", jobcode) | grepl("^99", jobcode)) ~ FALSE,
      # 6-char teacher codes + inclusion SpEd codes count as teaching
      nchar(jobcode) == 6 | jobcode %in% c(7145, 7150) ~ TRUE,
      TRUE ~ FALSE
    )
  )

teacher_job_codes <- all_job_codes %>%
  filter(teacher_jobcode_flag == TRUE) %>%
  distinct() %>%
  select(-teacher_jobcode_flag)

# --- Map teachers → subjects ---

job_codes_w_sub <- teacher_job_codes %>%
  left_join(subject_xwalk, by = c("jobcode" = "courseidjobcode_num"))

teacher_to_subject <- job_codes_w_sub %>%
  filter(!is.na(subject)) %>%
  mutate(fiscal_year = as.character(as.numeric(fiscalyear) + 1990)) %>%
  select(research_id, fiscal_year, subject) %>%
  unique()

ar_teachers_w_sub <- ar_teachers %>%
  left_join(teacher_to_subject, by = c("research_id", "fiscal_year"))

# Create combined "All Core" buckets for middle and secondary so they show up
# as standalone categories in addition to the per-subject rows.
ar_teachers_sub_by_gl <- ar_teachers_w_sub %>%
  filter(grepl("Secondary|Middle", subject)) %>%
  mutate(
    subject = case_when(
      grepl("Secondary", subject) ~ "Secondary All Core",
      grepl("Middle", subject) ~ "Middle School All Core",
      TRUE ~ NA_character_
    )
  ) %>%
  unique()

ar_teachers_w_sub <- bind_rows(ar_teachers_w_sub, ar_teachers_sub_by_gl)

# --- Prior/current year subject lookups ---

prior_year_subjects <- ar_teachers_w_sub %>%
  filter(teacher == "TRUE") %>%
  mutate(next_year = as.character(as.numeric(fiscal_year) + 1)) %>%
  select(research_id, next_year, prior_subject = subject)

current_year_subjects <- ar_teachers_w_sub %>%
  filter(teacher == "TRUE") %>%
  select(research_id, fiscal_year, current_subject = subject) %>%
  distinct() %>%
  mutate(taught_same_subject = TRUE)
