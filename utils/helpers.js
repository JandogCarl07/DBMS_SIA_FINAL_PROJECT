class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

async function logHistory(db, rentalId, oldStatus, newStatus, remarks) {
  await db.query('INSERT INTO rental_status_history (rental_id, old_status, new_status, remarks) VALUES (?,?,?,?)',
    [rentalId, oldStatus, newStatus, String(remarks || '').slice(0, 255)]);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
function normDateTime(v, label = 'date') {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(v || ''));
  if (!m || !isValidDate(m[1])) throw new HttpError(400, `Invalid ${label}. Use YYYY-MM-DD HH:MM`);
  return `${m[1]} ${m[2]}:${m[3]}:${m[4] || '00'}`;
}
function toInt(v, label) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${label} must be a valid id`);
  return n;
}
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function buildData(body, cfg, partial) {
  const data = {};
  for (const f of cfg.fields) {
    if (body[f] === undefined) continue;
    data[f] = body[f] === '' ? null : body[f];
  }
  if (!partial) {
    const missing = (cfg.required || []).filter(f => data[f] === undefined || data[f] === null);
    if (missing.length) throw new HttpError(400, `Missing required field(s): ${missing.join(', ')}`);
  } else {
    for (const f of cfg.required || []) if (f in data && data[f] === null) throw new HttpError(400, `${f} cannot be empty`);
  }
  for (const [f, allowed] of Object.entries(cfg.enums || {}))
    if (data[f] != null && !allowed.includes(data[f])) throw new HttpError(400, `${f} must be one of: ${allowed.join(', ')}`);
  for (const f of cfg.dates || [])
    if (data[f] != null && !isValidDate(String(data[f]))) throw new HttpError(400, `${f} must be a valid date (YYYY-MM-DD)`);
  for (const f of cfg.positive || [])
    if (data[f] != null && !(Number(data[f]) > 0)) throw new HttpError(400, `${f} must be greater than 0`);
  for (const f of cfg.nonNegative || [])
    if (data[f] != null && !(Number(data[f]) >= 0)) throw new HttpError(400, `${f} cannot be negative`);
  return data;
}

module.exports = { HttpError, asyncHandler, ok, logHistory, isValidDate, normDateTime, toInt, todayStr, buildData };
