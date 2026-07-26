require('dotenv').config();

const MIN_WEEKS_FOR_COMPLETION = parseInt(process.env.MIN_WEEKS_FOR_COMPLETION || '3', 10);
const BLOCK_TOTAL_WEEKS = parseInt(process.env.BLOCK_TOTAL_WEEKS || '4', 10);

// Statuses that NEVER count toward completion, per spec:
// "Maternity and Annual leave should not be counted as valid rotation."
const NON_COUNTING_STATUSES = ['maternity_leave', 'annual_leave', 'absent', 'pending'];
const COUNTING_STATUS = 'attended';

/**
 * Given an array of RotationWeek rows (status per week), determine whether
 * the rotation counts as COMPLETE: physician must have >= MIN_WEEKS_FOR_COMPLETION
 * (default 3) weeks with status 'attended' out of BLOCK_TOTAL_WEEKS (default 4).
 */
function isRotationComplete(weeks) {
  const attendedWeeks = weeks.filter((w) => w.status === COUNTING_STATUS).length;
  return attendedWeeks >= MIN_WEEKS_FOR_COMPLETION;
}

function countAttendedWeeks(weeks) {
  return weeks.filter((w) => w.status === COUNTING_STATUS).length;
}

function deriveAssignmentStatus(weeks) {
  const total = weeks.length;
  const attended = countAttendedWeeks(weeks);
  const pendingCount = weeks.filter((w) => w.status === 'pending').length;
  if (total === 0) return 'scheduled';
  // Nothing recorded yet -- the rotation is still just scheduled.
  if (pendingCount === total) return 'scheduled';
  // The final verdict (completed/incomplete) is only reached once EVERY
  // week's status has been recorded. While any week is still 'pending',
  // the rotation stays 'in_progress' -- even if it already has enough
  // attended weeks to qualify -- so the status never flips early and the
  // completed-lock on weekly editing can't engage before all weeks are in.
  if (pendingCount > 0) return 'in_progress';
  return attended >= MIN_WEEKS_FOR_COMPLETION ? 'completed' : 'incomplete';
}

module.exports = {
  MIN_WEEKS_FOR_COMPLETION,
  BLOCK_TOTAL_WEEKS,
  NON_COUNTING_STATUSES,
  COUNTING_STATUS,
  isRotationComplete,
  countAttendedWeeks,
  deriveAssignmentStatus,
};
