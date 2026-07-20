// Static reference data extracted from the OBGYN Master Rotation project spec.
//
// Site list and site->department mapping were rebuilt from the authoritative
// "Site and Department" guideline document (uploaded 2026-07-20), which
// supersedes the earlier hand-assembled mapping. Department codes/names below
// are deduplicated across all 9 sites as listed in that document.

const SITES = [
  { name: 'Sultan Qaboos University Hospital', short_code: 'SQUH' },
  { name: 'Royal Hospital', short_code: 'RH' },
  { name: 'Khoula Hospital', short_code: 'KH' },
  { name: 'Nizwa Hospital', short_code: 'NH' },
  { name: 'Sohar Hospital', short_code: 'SOHAR' },
  { name: 'Medical City Military & Security Services - Muscat', short_code: 'MCMSS' },
  { name: 'Local Health Centers', short_code: 'LHC' },
  { name: 'Sultan Qaboos Comprehensive Cancer Care & Research Centre', short_code: 'SQCCCRC' },
  { name: 'National Genetics Center', short_code: 'NGC' },
];

// code -> full name, deduplicated from the authoritative Site-Department guideline doc.
// critical: true marks a unit tracked by the Critical Unit Coverage KPI.
const DEPARTMENTS = [
  { code: 'GOBG & HRP', name: 'General OBGYN & High Risk Pregnancy' },
  { code: 'MFM & HRP', name: 'Maternal Fetal Medicine & High Risk Pregnancy' },
  { code: 'RE & INF', name: 'Reproductive Endocrinology & Infertility' },
  { code: 'RE & MIS', name: 'Reproductive Endocrinology & Minimal Invasive Surgery' },
  { code: 'URGY', name: 'Urogynecology' },
  { code: 'CLINIC', name: 'GYNE Clinic' },
  { code: 'GENETICS', name: 'Genetics' },
  { code: 'RESEARCH', name: 'Research Block', critical: true },
  { code: 'ICU', name: 'Intensive Care Unit', critical: true },
  { code: 'NICU', name: 'Neonatal Intensive Care Unit', critical: true },
  { code: 'MM & HRP', name: 'Maternal Medicine & High Risk Pregnancy' },
  { code: 'GY-ONC', name: 'Gyne-Oncology' },
  { code: 'DM & HRP', name: 'Diabetes Mellitus & High Risk Pregnancy' },
  { code: 'FM & HRP', name: 'Fetal Medicine & High Risk Pregnancy' },
  { code: 'PNW', name: 'Postnatal Ward' },
  { code: 'ANW', name: 'Antenatal Ward' },
  { code: 'US', name: 'Ultrasound' },
  { code: 'DS', name: 'Delivery Suite' },
  { code: 'OT', name: 'Operating Theatre' },
  { code: 'EM', name: 'Emergency Medicine', critical: true },
  { code: 'BS', name: 'Birth Spacing' },
  { code: 'ASSESSMENT', name: 'Assessment' },
  { code: 'GYN WARD', name: 'Gyn Ward' },
  { code: 'GYNE', name: 'Gyne' },
  { code: 'ADMISSION', name: 'Admission' },
  { code: 'REI, INF & MIS', name: 'Reproductive Infertility and Minimally Invasive Surgery' },
  { code: 'ANC', name: 'Antenatal Clinic' },
];

// site short_code -> array of department codes offered at that site
// (per the authoritative Site-Department guideline document).
const SITE_DEPARTMENTS = {
  SQUH: ['PNW', 'ANW', 'US', 'DS', 'OT', 'EM', 'GOBG & HRP', 'MFM & HRP', 'RE & INF', 'RE & MIS', 'URGY', 'CLINIC', 'GENETICS', 'RESEARCH', 'ICU', 'NICU'],
  RH: ['CLINIC', 'MM & HRP', 'GY-ONC', 'DM & HRP', 'FM & HRP', 'PNW', 'ANW', 'DS', 'US', 'ASSESSMENT', 'GYN WARD', 'OT', 'RESEARCH', 'EM', 'ICU', 'NICU', 'GYNE'],
  KH: ['ADMISSION', 'ANW', 'PNW', 'GYN WARD', 'MM & HRP', 'REI, INF & MIS', 'FM & HRP', 'RESEARCH', 'EM', 'US', 'ICU'],
  NH: ['DS'],
  SOHAR: ['GYNE'],
  MCMSS: ['GYNE', 'DS', 'ANC', 'RESEARCH'],
  LHC: ['BS'],
  SQCCCRC: ['GY-ONC'],
  NGC: ['GENETICS'],
};

module.exports = { SITES, DEPARTMENTS, SITE_DEPARTMENTS };
