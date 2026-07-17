# KPI Formula Reference — OBGYN Master Rotation Management System

All KPIs are computed server-side in `backend/services/kpiService.js` and exposed via
`GET /api/kpis/overview` (org/site/department level) and `GET /api/kpis/physician/:id`
(individual physician level). This document gives the exact formula and business
rationale for each metric, so scheduling and clinical leadership can trust the numbers.

## Core business rule (applies to every completion-based KPI)

A rotation counts as **COMPLETE** only if the physician has **at least 3 of the 4 weeks**
in the block marked `attended`. **Maternity leave and annual leave weeks never count**
toward completion, even though they consume a slot in the schedule. This is implemented
in `backend/utils/rotationRules.js` and is configurable via `MIN_WEEKS_FOR_COMPLETION`
and `BLOCK_TOTAL_WEEKS` in `.env`.

## Rotation Coverage & Distribution

1. **Rotation Coverage Rate** = (physicians with ≥1 assignment in the selected block) / (total physicians) × 100
2. **Department Allocation Balance** = max(0, 1 − coefficient of variation of assignment counts across departments) × 100. 100% = perfectly even distribution across all departments/teams; lower = some departments over- or under-staffed.
3. **Site Utilization** = count of rotation assignments per site (bar chart, one bar per site).

## Schedule Accuracy & Compliance

4. **Curriculum Compliance** = (completed block-assignments across all physicians) / (physicians × 13 curriculum blocks) × 100
5. **Rotation Block Completion** = (completed assignments in the block) / (total assignments in the block) × 100
6. **Conflict-Free Scheduling** = count of assignment pairs for the same physician whose date ranges overlap. Target = 0.

## Physician-Level KPIs

7. **Individual Rotation Completion** = (completed blocks for this physician) / 13 × 100
8. **Specialty Exposure** = (distinct departments the physician has rotated through) / (total departments offered) × 100
9. **Rotation Equity** = max(0, 1 − coefficient of variation of completed-rotation counts across all physicians) × 100. 100% = perfectly equal workload distribution.

## Department & Site KPIs

10. **Department Capacity Utilization** = (filled slots for a site+department in the block) / (capacity_per_block) × 100
11. **Site Rotation Compliance** = (department rotations at the site with ≥1 assignment) / (departments required at that site) × 100
12. **Critical Unit Coverage** = for each critical unit (NICU, ICU, Emergency Medicine, Gyne-Oncology Research), (blocks with ≥1 assignment) / (13 total blocks) × 100

## Operational KPIs

13. **Schedule Publication Timeliness** = average(block start date − schedule published date), in days. Higher = published further in advance.
14. **Change Request Rate** = (change requests logged against the block) / (total assignments in the block) × 100
15. **Approval Turnaround Time** = average(resolved_at − requested_at) across resolved change requests, in hours.
16. **Notification Success Rate** = (notifications with status `sent` or `mock_sent`) / (total notifications) × 100

## Note on the "22 departments" figure

The seed data models **23 department/team codes** (20 from the uploaded department
table plus NICU, ICU, and Research, added specifically so Critical Unit Coverage has
data to report on, as called out in the spec). `specialtyExposure` and department-count
denominators always read `Department.count()` live from the database, so this stays
correct even if departments are added or removed later.
