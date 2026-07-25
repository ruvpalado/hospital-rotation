const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { PhysicianRoster, AuditLog } = require('../models');

/**
 * The Physician List module: a lightweight name-only roster, distinct from
 * real User accounts (no login/email/password). Its single purpose is to
 * populate the Physician autocomplete in Add Schedule (AddScheduleModal.js).
 * Managed from the "Physician List" page: bulk upload via CSV or Excel,
 * manual single-name add, and per-name delete -- all developer-only except
 * the read, which every schedule-creating role needs.
 */

exports.listRoster = async (req, res) => {
  const entries = await PhysicianRoster.findAll({ order: [['full_name', 'ASC']] });
  res.json(entries.map((e) => ({ id: e.id, fullName: e.full_name })));
};

/**
 * Extracts an array of name strings from an uploaded CSV or Excel file.
 * CSV: expects a header row with a `name` (or `full_name`/`fullName` or
 * `physician`) column; if the file has no recognizable header, every
 * first-column value is treated as a name.
 * Excel (.xlsx/.xls): same logic against the first worksheet.
 */
function extractNames(file) {
  const isExcel = /\.(xlsx|xls)$/i.test(file.originalname)
    || file.mimetype.includes('spreadsheetml')
    || file.mimetype.includes('ms-excel');

  let records; // array of objects (header mode) or array of arrays
  if (isExcel) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    records = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }); // array of arrays
  } else {
    records = parse(file.buffer.toString('utf8'), { skip_empty_lines: true, trim: true }); // array of arrays
  }

  if (records.length === 0) return [];

  // If the first row looks like a header (name/full_name/fullName/physician,
  // case-insensitive), use that column; otherwise treat every row's first
  // cell as a name (headerless single-column file).
  const headerAliases = ['name', 'full_name', 'fullname', 'physician', 'physician_name', 'doctor'];
  const firstRow = records[0].map((c) => String(c ?? '').trim().toLowerCase());
  const headerIndex = firstRow.findIndex((c) => headerAliases.includes(c));

  const dataRows = headerIndex >= 0 ? records.slice(1) : records;
  const columnIndex = headerIndex >= 0 ? headerIndex : 0;

  return dataRows.map((row) => String(row[columnIndex] ?? '').trim());
}

/** Developer-only: bulk-add names from a CSV or Excel upload. Row-tolerant. */
exports.uploadRoster = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Send a CSV or Excel file as multipart/form-data with field name "file".' });
    }

    let names;
    try {
      names = extractNames(req.file);
    } catch (parseErr) {
      return res.status(400).json({ error: 'Could not parse the uploaded file. Make sure it is a valid CSV or Excel file.', details: parseErr.message });
    }

    const existingEntries = await PhysicianRoster.findAll({ attributes: ['full_name'] });
    const existingNamesLower = new Set(existingEntries.map((e) => e.full_name.toLowerCase()));

    const created = [];
    const skipped = [];

    for (let index = 0; index < names.length; index++) {
      const name = names[index];
      const rowNumber = index + 1;

      if (!name) {
        skipped.push({ row: rowNumber, name: null, reason: 'Blank name' });
        continue;
      }
      if (existingNamesLower.has(name.toLowerCase())) {
        skipped.push({ row: rowNumber, name, reason: 'Already in the list' });
        continue;
      }

      const entry = await PhysicianRoster.create({ full_name: name });
      existingNamesLower.add(name.toLowerCase()); // also guards against duplicates within the same file
      created.push({ row: rowNumber, id: entry.id, name });
    }

    await AuditLog.create({
      user_id: req.user.id,
      action: 'create',
      entity_type: 'physician_list_upload',
      details: { fileName: req.file.originalname, createdCount: created.length, skippedCount: skipped.length },
    });

    res.json({
      message: `${created.length} name(s) added to the physician list, ${skipped.length} skipped.`,
      created,
      skipped,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process the uploaded file', details: err.message });
  }
};

/** Developer-only: manually add a single name. */
exports.addName = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    const existing = await PhysicianRoster.findAll({ attributes: ['full_name'] });
    if (existing.some((e) => e.full_name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: `"${name}" is already in the physician list.` });
    }

    const entry = await PhysicianRoster.create({ full_name: name });

    await AuditLog.create({
      user_id: req.user.id,
      action: 'create',
      entity_type: 'physician_list_entry',
      entity_id: entry.id,
      details: { name },
    });

    res.status(201).json({ id: entry.id, fullName: entry.full_name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add name', details: err.message });
  }
};

/**
 * Developer-only: remove a name from the list. Existing rotation schedules
 * that used this name are untouched -- they store the name as free text on
 * the assignment (physician_name), not a reference to this table.
 */
exports.deleteName = async (req, res) => {
  try {
    const entry = await PhysicianRoster.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });

    const name = entry.full_name;
    await entry.destroy();

    await AuditLog.create({
      user_id: req.user.id,
      action: 'delete',
      entity_type: 'physician_list_entry',
      entity_id: Number(req.params.id),
      details: { name },
    });

    res.json({ message: `"${name}" removed from the physician list.`, id: Number(req.params.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete name', details: err.message });
  }
};
