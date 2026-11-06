const { pool } = require("../config/db");
const { HttpError, isValidDate, toInt, todayStr } = require("../utils/helpers");
const rentals = require("./rentalModel");

const BASE = `SELECT r.*, CONCAT(c.first_name,' ',c.last_name) AS customer_name, v.plate_number, CONCAT(v.brand,' ',v.model) AS vehicle_name,
    v.branch_id, rt.rental_id AS rental_id
  FROM reservations r JOIN customers c ON c.customer_id = r.customer_id JOIN vehicles v ON v.vehicle_id = r.vehicle_id
  LEFT JOIN rentals rt ON rt.reservation_id = r.reservation_id`;

const FLOW = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Cancelled", "No-Show"],
  Cancelled: [],
  Completed: [],
  "No-Show": [],
};

async function list(q = {}) {
  const where = [],
    params = [];
  if (q.status) {
    where.push("r.status = ?");
    params.push(q.status);
  }
  if (q.customer_id) {
    where.push("r.customer_id = ?");
    params.push(q.customer_id);
  }
  if (q.vehicle_id) {
    where.push("r.vehicle_id = ?");
    params.push(q.vehicle_id);
  }
  if (q.branch_id) {
    where.push("v.branch_id = ?");
    params.push(q.branch_id);
  }
  const [rows] = await pool.query(
    `${BASE}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY r.start_date DESC, r.reservation_id DESC`,
    params,
  );
  return rows;
}
async function get(id, db = pool) {
  const [[row]] = await db.query(`${BASE} WHERE r.reservation_id = ?`, [id]);
  if (!row) throw new HttpError(404, `Reservation #${id} not found`);
  return row;
}

function checkDates(s, e) {
  if (!isValidDate(String(s)) || !isValidDate(String(e)))
    throw new HttpError(
      400,
      "start_date and end_date must be valid dates (YYYY-MM-DD)",
    );
  if (e < s) throw new HttpError(400, "end_date cannot be before start_date");
}

async function create(b, user) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const customerId = toInt(b.customer_id, "customer_id"),
      vehicleId = toInt(b.vehicle_id, "vehicle_id");
    checkDates(b.start_date, b.end_date);
    if (b.start_date < todayStr())
      throw new HttpError(400, "Start date cannot be in the past");
    const status = b.status || "Pending";
    if (!["Pending", "Confirmed"].includes(status))
      throw new HttpError(
        400,
        "A new reservation must be Pending or Confirmed",
      );
    const [[cust]] = await conn.query(
      "SELECT status FROM customers WHERE customer_id = ?",
      [customerId],
    );
    if (!cust) throw new HttpError(404, "Customer not found");
    if (cust.status !== "Active")
      throw new HttpError(400, `Customer is ${cust.status}`);
    const [[veh]] = await conn.query(
      "SELECT status FROM vehicles WHERE vehicle_id = ? FOR UPDATE",
      [vehicleId],
    );
    if (!veh) throw new HttpError(404, "Vehicle not found");
    if (veh.status === "Unavailable")
      throw new HttpError(400, "Vehicle is Unavailable");
    await rentals.assertNoOverlap(
      conn,
      vehicleId,
      `${b.start_date} 00:00:00`,
      `${b.end_date} 23:59:59`,
    );
    const [ins] = await conn.query(
      "INSERT INTO reservations (customer_id, vehicle_id, start_date, end_date, status) VALUES (?,?,?,?,?)",
      [customerId, vehicleId, b.start_date, b.end_date, status],
    );
    await conn.commit();
    return await get(ins.insertId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function update(id, b, user) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[r]] = await conn.query(
      "SELECT * FROM reservations WHERE reservation_id = ? FOR UPDATE",
      [id],
    );
    if (!r) throw new HttpError(404, `Reservation #${id} not found`);
    if (!["Pending", "Confirmed"].includes(r.status))
      throw new HttpError(400, `A ${r.status} reservation cannot be edited`);
    const next = {
      start_date: b.start_date ?? r.start_date,
      end_date: b.end_date ?? r.end_date,
      vehicle_id: b.vehicle_id
        ? toInt(b.vehicle_id, "vehicle_id")
        : r.vehicle_id,
    };
    checkDates(next.start_date, next.end_date);
    await rentals.assertNoOverlap(
      conn,
      next.vehicle_id,
      `${next.start_date} 00:00:00`,
      `${next.end_date} 23:59:59`,
      { excludeReservation: id },
    );
    await conn.query(
      "UPDATE reservations SET start_date = ?, end_date = ?, vehicle_id = ? WHERE reservation_id = ?",
      [next.start_date, next.end_date, next.vehicle_id, id],
    );
    if (b.status && b.status !== r.status)
      await moveStatus(conn, r, b.status, user);
    await conn.commit();
    return await get(id);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function moveStatus(conn, r, status, user) {
  if (!FLOW[r.status]?.includes(status))
    throw new HttpError(
      400,
      `Cannot change a ${r.status} reservation to ${status}`,
    );
  await conn.query(
    "UPDATE reservations SET status = ? WHERE reservation_id = ?",
    [status, r.reservation_id],
  );
}

async function setStatus(id, status, user) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[r]] = await conn.query(
      "SELECT * FROM reservations WHERE reservation_id = ? FOR UPDATE",
      [id],
    );
    if (!r) throw new HttpError(404, `Reservation #${id} not found`);
    await moveStatus(conn, r, status, user);
    await conn.commit();
    return await get(id);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function remove(id, user) {
  await setStatus(id, "Cancelled", user);
  return { id, deleted: false, message: `Reservation #${id} cancelled` };
}

async function convert(id, b, user) {
  const r = await get(id);
  if (r.status !== "Confirmed")
    throw new HttpError(
      400,
      `Only Confirmed reservations can be converted (this one is ${r.status})`,
    );
  const rental_date = b.rental_date || `${r.start_date} 09:00:00`;
  let due_date = b.due_date || `${r.end_date} 09:00:00`;
  if (!b.due_date && due_date <= rental_date) {
    const d = new Date(`${r.start_date}T09:00:00`);
    d.setDate(d.getDate() + 1);
    due_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 09:00:00`;
  }
  return rentals.create(
    {
      reservation_id: id,
      customer_id: r.customer_id,
      vehicle_id: r.vehicle_id,
      rental_date,
      due_date,
      pickup_branch_id: b.pickup_branch_id,
      rate_plan_id: b.rate_plan_id,
    },
    user,
  );
}
module.exports = { list, get, create, update, setStatus, remove, convert };
