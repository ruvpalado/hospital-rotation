/**
 * The 13 OBGYN curriculum blocks for the Sept 2026 - Aug 2027 cycle.
 * Block 1 starts September 1, 2026; Block 2 starts September 27, 2026 (per
 * the approved schedule). Every block is a 4-week cycle except Block 13,
 * the 5-week exception. Shared by seed.js (fresh setup) and
 * scripts/update-block-dates.js (updating an already-seeded database).
 */
const BLOCK_DEFS = [
  { n: 1, start: '2026-09-01', end: '2026-09-26', weeks: 4 },
  { n: 2, start: '2026-09-27', end: '2026-10-24', weeks: 4 },
  { n: 3, start: '2026-10-25', end: '2026-11-21', weeks: 4 },
  { n: 4, start: '2026-11-22', end: '2026-12-19', weeks: 4 },
  { n: 5, start: '2026-12-20', end: '2027-01-16', weeks: 4 },
  { n: 6, start: '2027-01-17', end: '2027-02-13', weeks: 4 },
  { n: 7, start: '2027-02-14', end: '2027-03-13', weeks: 4 },
  { n: 8, start: '2027-03-14', end: '2027-04-10', weeks: 4 },
  { n: 9, start: '2027-04-11', end: '2027-05-08', weeks: 4 },
  { n: 10, start: '2027-05-09', end: '2027-06-05', weeks: 4 },
  { n: 11, start: '2027-06-06', end: '2027-07-03', weeks: 4 },
  { n: 12, start: '2027-07-04', end: '2027-07-31', weeks: 4 },
  { n: 13, start: '2027-08-01', end: '2027-08-31', weeks: 5 },
];

module.exports = { BLOCK_DEFS };
