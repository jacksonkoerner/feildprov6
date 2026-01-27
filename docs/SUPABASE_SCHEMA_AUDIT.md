# Supabase Schema vs Code Alignment Audit

**Date:** 2026-01-27
**Scope:** Converters in `supabase-utils.js` and direct queries across all JS files

---

## Database Schema Reference

| Table | Columns |
|-------|---------|
| `user_profiles` | id, auth_user_id, full_name, title, company, email, phone, created_at, updated_at |
| `projects` | id, user_id, project_name, noab_project_no, cno_solicitation_no, location, engineer, prime_contractor, notice_to_proceed, contract_duration, expected_completion, default_start_time, default_end_time, weather_days, logo, status, created_at, updated_at |
| `contractors` | id, project_id, name, company, abbreviation, type, trades, status, created_at, added_date, removed_date |
| `reports` | id, project_id, report_date, status (+ other columns TBD) |

---

## Part 1: Converter Alignment Table

### `fromSupabaseProject` / `toSupabaseProject`

| DB Column | Converter Reads | JS Property Output | Status |
|-----------|-----------------|-------------------|--------|
| id | row.id | id | ✅ OK |
| user_id | row.user_id | userId | ✅ OK |
| project_name | row.project_name | projectName | ✅ OK |
| noab_project_no | row.noab_project_no | noabProjectNo | ✅ OK |
| cno_solicitation_no | row.cno_solicitation_no | cnoSolicitationNo | ✅ OK |
| location | row.location | location | ✅ OK |
| engineer | row.engineer | engineer | ✅ OK |
| prime_contractor | row.prime_contractor | primeContractor | ✅ OK |
| notice_to_proceed | row.notice_to_proceed | noticeToProceed | ✅ OK |
| contract_duration | row.contract_duration | contractDuration | ✅ OK |
| expected_completion | row.expected_completion | expectedCompletion | ✅ OK |
| default_start_time | row.default_start_time | defaultStartTime | ✅ OK |
| default_end_time | row.default_end_time | defaultEndTime | ✅ OK |
| weather_days | row.weather_days | weatherDays | ✅ OK |
| logo | row.logo | logo | ✅ OK |
| status | row.status | status | ✅ OK |
| created_at | row.created_at | createdAt | ✅ OK |
| updated_at | row.updated_at | updatedAt | ✅ OK |

**Result:** ✅ FULLY ALIGNED

---

### `fromSupabaseContractor` / `toSupabaseContractor`

| DB Column | Converter Reads | JS Property Output | Status |
|-----------|-----------------|-------------------|--------|
| id | row.id | id | ✅ OK |
| project_id | row.project_id | projectId | ✅ OK |
| name | row.name | name | ✅ OK |
| company | row.company | company | ✅ OK |
| abbreviation | row.abbreviation | abbreviation | ✅ OK |
| type | row.type | type | ✅ OK |
| trades | row.trades | trades | ✅ OK |
| status | row.status | status | ✅ OK |
| created_at | row.created_at | (fallback for addedDate) | ✅ OK |
| added_date | row.added_date | addedDate | ✅ OK |
| removed_date | row.removed_date | removedDate | ✅ OK |

**Result:** ✅ FULLY ALIGNED

---

### `fromSupabaseReport` / `toSupabaseReport`

| DB Column | Converter Reads | JS Property Output | Status |
|-----------|-----------------|-------------------|--------|
| id | row.id | id | ✅ OK |
| project_id | row.project_id | projectId | ✅ OK |
| user_id | row.user_id | userId | ⚠️ VERIFY - column may not exist in reports table |
| device_id | row.device_id | deviceId | ⚠️ VERIFY - column may not exist in reports table |
| report_date | row.report_date | reportDate | ✅ OK |
| status | row.status | status | ✅ OK |
| capture_mode | row.capture_mode | captureMode | ⚠️ VERIFY - column may not exist in reports table |
| pdf_url | row.pdf_url | pdfUrl | ⚠️ VERIFY - column may not exist in reports table |
| created_at | row.created_at | createdAt | ⚠️ VERIFY - column may not exist in reports table |
| updated_at | row.updated_at | updatedAt | ⚠️ VERIFY - column may not exist in reports table |
| submitted_at | row.submitted_at | submittedAt | ⚠️ VERIFY - column may not exist in reports table |

**Result:** ⚠️ NEEDS VERIFICATION - Only `id, project_id, report_date, status` confirmed in schema. Other columns need verification.

---

### User Profile (No converter - direct access in settings.js)

| DB Column | Code Access | Status |
|-----------|-------------|--------|
| id | data.id | ✅ OK |
| auth_user_id | (not used) | ⚠️ Not mapped in code |
| full_name | data.full_name | ✅ OK |
| title | data.title | ✅ OK |
| company | data.company | ✅ OK |
| email | data.email | ✅ OK |
| phone | data.phone | ✅ OK |
| created_at | (not used) | ⚠️ Not mapped in code |
| updated_at | (set on save) | ✅ OK |

**Result:** ✅ ALIGNED (auth_user_id and created_at unused is acceptable)

---

## Part 2: Direct Query Alignment Table

### `settings.js`

| Operation | Table | Columns Used | Schema Match |
|-----------|-------|--------------|--------------|
| SELECT | user_profiles | `*` (all) | ✅ OK |
| SELECT | user_profiles | full_name, title, company | ✅ OK |
| INSERT | user_profiles | full_name, title, company, email, phone, updated_at | ✅ OK |
| UPDATE | user_profiles | full_name, title, company, email, phone, updated_at | ✅ OK |

**Result:** ✅ FULLY ALIGNED

---

### `project-config.js`

| Operation | Table | Columns Used | Schema Match |
|-----------|-------|--------------|--------------|
| SELECT | projects | `*` (all) | ✅ OK |
| UPSERT | projects | (via toSupabaseProject converter) | ✅ OK |
| DELETE | projects | id filter | ✅ OK |
| SELECT | contractors | `*` (all), id filter | ✅ OK |
| UPSERT | contractors | (via toSupabaseContractor converter) | ✅ OK |
| DELETE | contractors | id filter | ✅ OK |

**Result:** ✅ FULLY ALIGNED

---

### `index.js`

| Operation | Table | Columns Used | Schema Match |
|-----------|-------|--------------|--------------|
| SELECT | projects | `*` (all), order by project_name | ✅ OK |
| SELECT | projects | `*` single by id | ✅ OK |

**Result:** ✅ FULLY ALIGNED

---

### `archives.js`

| Operation | Table | Columns Used | Schema Match |
|-----------|-------|--------------|--------------|
| SELECT | projects | id, project_name, status | ✅ OK |
| SELECT | reports | id, project_id, report_date, inspector_name, status, created_at, submitted_at, updated_at | ⚠️ `inspector_name` not in provided schema |
| SELECT | report_photos | report_id | N/A (table not in provided schema) |
| DELETE | reports | id filter | ✅ OK |

**Result:** ⚠️ PARTIAL - `inspector_name` column not confirmed in reports table

---

### `drafts.js`

| Operation | Table | Columns Used | Schema Match |
|-----------|-------|--------------|--------------|
| SELECT | reports | id, status (filter by project_id, report_date) | ✅ OK |
| INSERT | reports | project_id, report_date, status, raw_capture | ⚠️ `raw_capture` not in provided schema |
| UPDATE | reports | status, ai_generated, updated_at | ⚠️ `ai_generated` not in provided schema |

**Result:** ⚠️ PARTIAL - `raw_capture`, `ai_generated` columns not confirmed

---

### `report.js`

| Operation | Table | Columns Used | Schema Match |
|-----------|-------|--------------|--------------|
| SELECT | projects | `*` single by id | ✅ OK |
| SELECT | contractors | `*` by project_id | ✅ OK |
| SELECT | equipment | `*` by project_id | N/A (table not in provided schema) |
| SELECT | user_profiles | `*` single | ✅ OK |
| SELECT | reports | `*` by id or project_id+report_date | ⚠️ Full schema unknown |
| SELECT | report_raw_capture | `*` by report_id | N/A (table not in provided schema) |
| SELECT | report_contractor_work | `*` by report_id | N/A (table not in provided schema) |
| SELECT | report_personnel | `*` by report_id | N/A (table not in provided schema) |
| SELECT | report_equipment_usage | `*` by report_id | N/A (table not in provided schema) |
| SELECT | report_photos | `*` by report_id | N/A (table not in provided schema) |
| SELECT | report_ai_response | `*` by report_id | N/A (table not in provided schema) |
| SELECT | report_user_edits | `*` by report_id | N/A (table not in provided schema) |
| UPSERT | reports | various fields | ⚠️ Full schema unknown |
| DELETE/INSERT | report_raw_capture | report_id, etc. | N/A |
| DELETE/INSERT | report_contractor_work | report_id, etc. | N/A |
| DELETE/INSERT | report_personnel | report_id, etc. | N/A |
| DELETE/INSERT | report_equipment_usage | report_id, etc. | N/A |
| DELETE/INSERT | report_user_edits | report_id, etc. | N/A |

**Result:** ⚠️ INCOMPLETE SCHEMA - Many report-related tables not in provided schema

---

## Part 3: All Mismatches Summary

### CRITICAL MISMATCHES (Schema vs Code)

| Issue | Location | Details | Action Required |
|-------|----------|---------|-----------------|
| **None for core tables** | - | user_profiles, projects, contractors converters are fully aligned | ✅ No action |

### UNVERIFIED COLUMNS (Reports Table)

The `reports` table schema was provided as: `id, project_id, report_date, status (+ other columns)`

The code expects these additional columns:
| Column | Used In | Verify Exists |
|--------|---------|---------------|
| user_id | report.js, supabase-utils.js | ⚠️ VERIFY |
| device_id | report.js, supabase-utils.js | ⚠️ VERIFY |
| capture_mode | report.js, supabase-utils.js | ⚠️ VERIFY |
| pdf_url | report.js, supabase-utils.js | ⚠️ VERIFY |
| created_at | report.js, archives.js | ⚠️ VERIFY |
| updated_at | report.js, archives.js, drafts.js | ⚠️ VERIFY |
| submitted_at | report.js, archives.js | ⚠️ VERIFY |
| inspector_name | archives.js | ⚠️ VERIFY |
| raw_capture | drafts.js | ⚠️ VERIFY |
| ai_generated | drafts.js | ⚠️ VERIFY |

### TABLES NOT IN PROVIDED SCHEMA

These tables are referenced in code but not listed in the provided schema:

| Table | Used In | Purpose |
|-------|---------|---------|
| equipment | report.js | Equipment list per project |
| report_raw_capture | report.js | Raw interview capture data |
| report_contractor_work | report.js | Contractor work entries |
| report_personnel | report.js | Personnel counts |
| report_equipment_usage | report.js | Equipment usage tracking |
| report_photos | report.js, archives.js | Photo attachments |
| report_ai_response | report.js | AI processing responses |
| report_user_edits | report.js | User edit tracking |
| report_final | supabase-utils.js | Final report data |
| report_entries | sync-manager.js | Report entries |
| report_ai_request | quick-interview.js | AI request logs |

### UNUSED SCHEMA COLUMNS

| Table | Column | Status |
|-------|--------|--------|
| user_profiles | auth_user_id | Not read/written by any code |

---

## Recommendations

1. **Get full reports table schema** - The reports table has "(+ other columns)" which need to be verified against code expectations

2. **Document all tables** - Add schema documentation for all report-related tables (report_raw_capture, report_contractor_work, etc.)

3. **Consider auth_user_id usage** - The user_profiles.auth_user_id column is never used; determine if it should be linked to auth or removed

4. **Core tables are aligned** - user_profiles, projects, contractors converters match their schemas exactly

---

## Quick Reference: Converter File Locations

- All converters: `js/supabase-utils.js`
- Project queries: `js/project-config.js`, `js/index.js`
- User profile queries: `js/settings.js`
- Report queries: `js/report.js`, `js/archives.js`, `js/drafts.js`
