/**
 * Resilient Supabase update.
 *
 * Retries after removing columns/values the database rejects (unknown column,
 * bad uuid/enum syntax, broken foreign key) so a stray client field can't make
 * an update fail. Distinguishes "row doesn't exist" from real database errors.
 *
 * Returns { data, error, notFound }.
 */
async function updateRow(supabase, table, id, payload, { select = '*', idColumn = 'id', extraEq = null } = {}) {
  const sanitized = { ...payload };
  delete sanitized[idColumn];

  const run = () => {
    let q = supabase.from(table).update(sanitized).eq(idColumn, id);
    if (extraEq) for (const [k, v] of Object.entries(extraEq)) q = q.eq(k, v);
    return q.select(select).maybeSingle();
  };

  let { data, error } = await run();
  let retries = 15;

  while (error && retries-- > 0 && Object.keys(sanitized).length > 0) {
    const text = `${error.message || ''} ${error.details || ''}`;
    let dropped = null;

    if (error.code === 'PGRST204') {
      const m = /Could not find the '(.+?)' column/.exec(text);
      if (m && m[1] in sanitized) dropped = m[1];
    } else if (error.code === '22P02') {
      const m = /invalid input (?:syntax for type|value for enum) (?:.+?): "(.*?)"/.exec(text);
      if (m) dropped = Object.keys(sanitized).find((k) => String(sanitized[k]) === m[1]) || null;
    } else if (error.code === '23503') {
      const m = /Key \((.+?)\)=/.exec(text);
      if (m && m[1] in sanitized) dropped = m[1];
    }

    if (!dropped) break;
    console.warn(`[DB Update] ${table}: dropping field "${dropped}" (${error.code})`);
    delete sanitized[dropped];
    ({ data, error } = await run());
  }

  if (error) return { data: null, error, notFound: false };
  if (!data) return { data: null, error: null, notFound: true };
  return { data, error: null, notFound: false };
}

/** Send the right HTTP response for a failed updateRow result. */
function sendUpdateFailure(res, label, result) {
  if (result.notFound) {
    return res.status(404).json({ success: false, message: `${label} not found` });
  }
  console.error(`[DB Update Error] ${label}:`, result.error.code, result.error.message);
  return res.status(500).json({
    success: false,
    message: `Failed to update ${label.toLowerCase()}: ${result.error.message}`,
  });
}

/**
 * Resilient Supabase insert (single row or array). Drops columns the table
 * doesn't have and retries. Returns { data, error }.
 */
async function insertRows(supabase, table, rows, { select = '*' } = {}) {
  const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r }));
  const run = () => supabase.from(table).insert(list).select(select);
  let { data, error } = await run();
  let retries = 15;
  while (error && error.code === 'PGRST204' && retries-- > 0) {
    const m = /Could not find the '(.+?)' column/.exec(error.message || '');
    if (!m) break;
    console.warn(`[DB Insert] ${table}: dropping unknown column "${m[1]}"`);
    list.forEach((r) => delete r[m[1]]);
    ({ data, error } = await run());
  }
  return { data, error };
}

module.exports = { updateRow, insertRows, sendUpdateFailure };
