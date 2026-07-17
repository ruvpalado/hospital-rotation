// Static reference data extracted from the OBGYN Master Rotation project spec:
// site list, department codes, and site->department mappings.

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

// code -> full name (deduplicated from the uploaded department/code table)
const DEPARTMENTS = [
  { code: 'GOBG, HRP & MFM', name: 'General Obstetrics & Gynecology / High Risk Pregnancy / Maternal Fetal Medicine' },
  { code: 'RE & MIS', name: 'Reproductive Endocrinology and Minimal Invasive Surgery' },
  { code: 'GOBG & HRP', name: 'General Obstetrics and Gynecology and High Risk Pregnancy' },
  { code: 'URGY', name: 'Urogynecology' },
  { code: 'RE & INF/GOBG', name: 'Reproductive Endocrinology & Infertility / General Obstetrics and Gynecology' },
  { code: 'MM & HRP', name: 'Maternal Medicine & High Risk Pregnancy (MFM)' },
  { code: 'END, INF & RM', name: 'Endoscopy, Infertility & Reproductive Medicine (REI/MIS)' },
  { code: 'GY-ONC', name: 'Gyne-Oncology' },
  { code: 'DM & HRP', name: 'Diabetic & High Risk Pregnancy' },
  { code: 'FM, HRP & US', name: 'Fetal Medicine, High Risk Pregnancy and Ultrasound (MFM)' },
  { code: 'FM & HRP', name: 'Fetal Medicine and High Risk Pregnancy' },
  { code: 'REI, INF & MIS', name: 'Reproductive Endocrinology, Infertility/IVF and Minimal Invasive Surgery' },
  { code: 'CLINIC', name: 'General OBGYNE Clinic' },
  { code: 'PNW', name: 'Postnatal Ward' },
  { code: 'ANW', name: 'Antenatal Ward' },
  { code: 'US', name: 'General Obstetric and Gynecology Ultrasound' },
  { code: 'DS', name: 'Delivery Suite' },
  { code: 'OT', name: 'Operating Theatre' },
  { code: 'EM', name: 'Emergency Medicine', critical: true },
  { code: 'BS', name: 'Birth Spacing' },
  // Added for Critical Unit Coverage KPI (NICU/ICU/Research called out explicitly in spec 11):
  { code: 'NICU', name: 'Neonatal Intensive Care Unit', critical: true },
  { code: 'ICU', name: 'Intensive Care Unit', critical: true },
  { code: 'RESEARCH', name: 'Gyne-Oncology Research', critical: true },
];

// site short_code -> array of department codes offered at that site
const SITE_DEPARTMENTS = {
  SQUH: ['GOBG, HRP & MFM', 'RE & MIS', 'GY-ONC', 'URGY', 'FM, HRP & US', 'NICU', 'ICU', 'DS', 'OT', 'ANW', 'PNW', 'CLINIC'],
  RH: ['GOBG, HRP & MFM', 'RE & MIS', 'GY-ONC', 'URGY', 'FM, HRP & US', 'NICU', 'ICU', 'DS', 'OT', 'EM'],
  KH: ['MM & HRP', 'ANW', 'PNW', 'DS', 'CLINIC', 'EM'],
  NH: ['FM & HRP', 'ANW', 'US', 'CLINIC'],
  SOHAR: ['REI, INF & MIS', 'END, INF & RM', 'CLINIC'],
  MCMSS: ['MM & HRP', 'CLINIC', 'BS'],
  LHC: ['MM & HRP', 'BS', 'CLINIC'],
  SQCCCRC: ['GY-ONC', 'RESEARCH'],
  NGC: ['RE & INF/GOBG', 'DM & HRP'],
};

module.exports = { SITES, DEPARTMENTS, SITE_DEPARTMENTS };
