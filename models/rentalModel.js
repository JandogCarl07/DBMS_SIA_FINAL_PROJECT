const { pool } = require("../config/db");
const {
  HttpError,
  logHistory,
  normDateTime,
  toInt,
} = require("../utils/helpers");

const LATE_FEE = Number(process.env.LATE_FEE_PER_DAY || 500);
const REQUIRE_INSURANCE =
  String(process.env.REQUIRE_INSURANCE || "false") === "true";
const GRACE = Number(process.env.LATE_GRACE_MINUTES || 0);

const DAILY_RATE_SQL = `(SELECT rp.rate_per_day FROM rate_plans rp WHERE rp.category_id = v.category_id AND rp.plan_name = 'Daily' AND rp.season_start IS NULL LIMIT 1)`;
const BASE_SELECT = `
  SELECT r.rental_id, r.reservation_id, r.customer_id, CONCAT(c.first_name,' ',c.last_name) AS customer_name,
    r.vehicle_id, v.plate_number, CONCAT(v.brand,' ',v.model) AS vehicle_name, v.mileage AS vehicle_mileage,
    r.pickup_branch_id, pb.branch_name AS pickup_branch, r.return_branch_id, rb.branch_name AS return_branch,
    r.rental_date, r.due_date, r.return_date, r.start_mileage, r.end_mileage, r.total_amount, r.status,
    ${DAILY_RATE_SQL} AS daily_rate, ${LATE_FEE} AS late_fee_per_day,
    IF(r.return_date IS NULL AND r.due_date < NOW(), GREATEST(0, CEIL((TIMESTAMPDIFF(MINUTE, r.due_date, NOW()) - ${GRACE}) / 1440)), 0) AS days_late_live,
    lf.late_fee_id, lf.days_late, lf.fee_amount, lf.status AS late_fee_status
  FROM rentals r
  JOIN customers c ON c.customer_id = r.customer_id
  JOIN vehicles v ON v.vehicle_id = r.vehicle_id
  JOIN branches pb ON pb.branch_id = r.pickup_branch_id
  LEFT JOIN branches rb ON rb.branch_id = r.return_branch_id
  LEFT JOIN late_fees lf ON lf.late_fee_id = (SELECT MAX(l2.late_fee_id) FROM late_fees l2 WHERE l2.rental_id = r.rental_id)`;

async function list(q = {}) {
  const where = [],
    params = [];
  if (q.status) {
    where.push("r.status = ?");
    params.push(q.status);
  }
  if (q.branch_id) {
    where.push("r.pickup_branch_id = ?");
    params.push(q.branch_id);
  }
  if (q.customer_id) {
    where.push("r.customer_id = ?");
    params.push(q.customer_id);
  }
  if (q.vehicle_id) {
    where.push("r.vehicle_id = ?");
    params.push(q.vehicle_id);
  }
  if (q.q) {
    where.push(
      `(v.plate_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR CONCAT(c.first_name,' ',c.last_name) LIKE ?)`,
    );
    params.push(...Array(4).fill(`%${q.q}%`));
  }
  const [rows] = await pool.query(
    `${BASE_SELECT}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY r.rental_date DESC, r.rental_id DESC`,
    params,
  );
  return rows;
}
async function get(id, db = pool) {
  const [[rental]] = await db.query(`${BASE_SELECT} WHERE r.rental_id = ?`, [
    id,
  ]);
  if (!rental) throw new HttpError(404, `Rental #${id} not found`);
  const [payments] = await db.query(
    "SELECT * FROM payments WHERE rental_id = ? ORDER BY payment_date",
    [id],
  );
  const [late_fees] = await db.query(
    "SELECT * FROM late_fees WHERE rental_id = ? ORDER BY late_fee_id",
    [id],
  );
  const [history] = await db.query(
    "SELECT * FROM rental_status_history WHERE rental_id = ? ORDER BY changed_at, history_id",
    [id],
  );
  const [damage_reports] = await db.query(
    "SELECT * FROM damage_reports WHERE rental_id = ?",
    [id],
  );
  return { ...rental, payments, late_fees, history, damage_reports };
}

async function quote(db, vehicleId, start, due, planId) {
  const [[veh]] = await db.query(
    "SELECT vehicle_id, category_id FROM vehicles WHERE vehicle_id = ?",
    [vehicleId],
  );
  if (!veh) throw new HttpError(404, "Vehicle not found");
  const [[d]] = await db.query(
    "SELECT CEIL(TIMESTAMPDIFF(MINUTE, ?, ?) / 1440) AS days",
    [start, due],
  );
  const days = Number(d.days);
  if (!(days >= 1))
    throw new HttpError(400, "Due date must be after the pickup date");
  const [plans] = await db.query(
    `SELECT * FROM rate_plans WHERE category_id = ? AND min_days <= ? AND (max_days IS NULL OR max_days >= ?)
       AND (season_start IS NULL OR season_end IS NULL OR DATE(?) BETWEEN season_start AND season_end)
     ORDER BY (season_start IS NOT NULL) DESC, rate_per_day ASC`,
    [veh.category_id, days, days, start],
  );
  if (!plans.length)
    throw new HttpError(
      400,
      `No rate plan covers ${days} day(s) for this vehicle category`,
    );
  let selected = plans[0];
  if (planId) {
    selected = plans.find((p) => p.rate_plan_id === Number(planId));
    if (!selected)
      throw new HttpError(
        400,
        "Selected rate plan does not apply to this rental period",
      );
  }
  return {
    days,
    plans,
    selected_plan: selected,
    rate_per_day: selected.rate_per_day,
    total_amount: Math.round(selected.rate_per_day * days * 100) / 100,
  };
}
const quoteHttp = async (q) => {
  const start = normDateTime(q.rental_date, "rental_date"),
    due = normDateTime(q.due_date, "due_date");
  return quote(
    pool,
    toInt(q.vehicle_id, "vehicle_id"),
    start,
    due,
    q.rate_plan_id,
  );
};

async function assertNoOverlap(
  conn,
  vehicleId,
  start,
  due,
  { excludeReservation = 0, excludeRental = 0 } = {},
) {
  const [r] = await conn.query(
    `SELECT rental_id FROM rentals WHERE vehicle_id = ? AND status IN ('Active','Overdue') AND return_date IS NULL AND rental_id <> ?
       AND (status = 'Overdue' OR (rental_date < ? AND due_date > ?)) LIMIT 1`,
    [vehicleId, excludeRental, due, start],
  );
  if (r.length)
    throw new HttpError(
      400,
      `Vehicle is already in rental #${r[0].rental_id} for these dates`,
    );
  const [rs] = await conn.query(
    `SELECT reservation_id FROM reservations WHERE vehicle_id = ? AND status IN ('Pending','Confirmed') AND reservation_id <> ?
       AND start_date <= DATE(?) AND end_date >= DATE(?) LIMIT 1`,
    [vehicleId, excludeReservation, due, start],
  );
  if (rs.length)
    throw new HttpError(
      400,
      `Vehicle is already booked by reservation #${rs[0].reservation_id} for these dates`,
    );
}
async function assertInsured(conn, vehicleId, start, due) {
  if (!REQUIRE_INSURANCE) return; 
  const [i] = await conn.query(
    "SELECT insurance_id FROM insurance WHERE vehicle_id = ? AND start_date <= DATE(?) AND expiry_date >= DATE(?) LIMIT 1",
    [vehicleId, start, due],
  );
  if (!i.length)
    throw new HttpError(
      400,
      "Vehicle has no valid insurance policy covering the rental period (missing or expired). Renew the insurance first.",
    );
}

async function create(b, user) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const customerId = toInt(b.customer_id, "customer_id"),
      vehicleId = toInt(b.vehicle_id, "vehicle_id");
    const start = normDateTime(b.rental_date, "rental_date"),
      due = normDateTime(b.due_date, "due_date");
    if (due <= start)
      throw new HttpError(400, "Due date must be after the pickup date");

    const [[veh]] = await conn.query(
      "SELECT * FROM vehicles WHERE vehicle_id = ? FOR UPDATE",
      [vehicleId],
    );
    if (!veh) throw new HttpError(404, "Vehicle not found");
    const [[cust]] = await conn.query(
      "SELECT * FROM customers WHERE customer_id = ?",
      [customerId],
    );
    if (!cust) throw new HttpError(404, "Customer not found");

    let reservationId = null;
    if (b.reservation_id) {
      reservationId = toInt(b.reservation_id, "reservation_id");
      const [[res]] = await conn.query(
        "SELECT * FROM reservations WHERE reservation_id = ? FOR UPDATE",
        [reservationId],
      );
      if (!res) throw new HttpError(404, "Reservation not found");
      if (res.status !== "Confirmed")
        throw new HttpError(
          400,
          `Only Confirmed reservations can become rentals (this one is ${res.status})`,
        );
      if (res.customer_id !== customerId || res.vehicle_id !== vehicleId)
        throw new HttpError(
          400,
          "Customer/vehicle do not match the reservation",
        );
      const [[used]] = await conn.query(
        "SELECT rental_id FROM rentals WHERE reservation_id = ?",
        [reservationId],
      );
      if (used)
        throw new HttpError(
          400,
          `Reservation already converted to rental #${used.rental_id}`,
        );
    }

    if (
      !(
        veh.status === "Available" ||
        (veh.status === "Reserved" && reservationId)
      )
    )
      throw new HttpError(400, `Vehicle is ${veh.status}, not Available`);
    if (cust.status !== "Active")
      throw new HttpError(400, `Customer is ${cust.status} and cannot rent`);
    if (cust.license_expiry_date < due.slice(0, 10))
      throw new HttpError(
        400,
        "Customer's driver's license expires before the due date",
      );
    await assertInsured(conn, vehicleId, start, due);
    await assertNoOverlap(conn, vehicleId, start, due, {
      excludeReservation: reservationId || 0,
    });

    const q = await quote(conn, vehicleId, start, due, b.rate_plan_id);
    const pickupBranch = b.pickup_branch_id
      ? toInt(b.pickup_branch_id, "pickup_branch_id")
      : veh.branch_id;

    const [ins] = await conn.query(
      `INSERT INTO rentals (reservation_id, customer_id, vehicle_id, pickup_branch_id, rental_date, due_date, start_mileage, total_amount, status)
       VALUES (?,?,?,?,?,?,?,?, 'Active')`,
      [
        reservationId,
        customerId,
        vehicleId,
        pickupBranch,
        start,
        due,
        veh.mileage,
        q.total_amount,
      ],
    );
    const id = ins.insertId;
    await conn.query(
      "UPDATE vehicles SET status = 'Rented' WHERE vehicle_id = ?",
      [vehicleId],
    );
    await logHistory(
      conn,
      id,
      null,
      "Active",
      reservationId ? "Rental created from reservation" : "Walk-in rental",
    );
    await conn.commit();
    return await get(id);
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
      "SELECT * FROM rentals WHERE rental_id = ? FOR UPDATE",
      [id],
    );
    if (!r) throw new HttpError(404, `Rental #${id} not found`);
    if (r.status !== "Active")
      throw new HttpError(
        400,
        `Only Active rentals can be edited (this one is ${r.status})`,
      );
    const patch = {};
    if (b.due_date !== undefined) {
      const due = normDateTime(b.due_date, "due_date");
      if (due <= r.rental_date)
        throw new HttpError(400, "Due date must be after the pickup date");
      await assertInsured(conn, r.vehicle_id, r.rental_date, due);
      await assertNoOverlap(conn, r.vehicle_id, r.rental_date, due, {
        excludeRental: id,
        excludeReservation: r.reservation_id || 0,
      });
      const q = await quote(
        conn,
        r.vehicle_id,
        r.rental_date,
        due,
        b.rate_plan_id,
      );
      patch.due_date = due;
      patch.total_amount = q.total_amount;
    }
    if (b.return_branch_id !== undefined)
      patch.return_branch_id = toInt(b.return_branch_id, "return_branch_id");
    if (!Object.keys(patch).length)
      throw new HttpError(
        400,
        "Nothing to update (allowed: due_date, return_branch_id)",
      );
    await conn.query("UPDATE rentals SET ? WHERE rental_id = ?", [patch, id]);
    if (patch.due_date)
      await logHistory(
        conn,
        id,
        "Active",
        "Active",
        `Due date changed to ${patch.due_date}, total ${patch.total_amount}`,
      );
    await conn.commit();
    return await get(id);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function cancel(id, user) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[r]] = await conn.query(
      "SELECT * FROM rentals WHERE rental_id = ? FOR UPDATE",
      [id],
    );
    if (!r) throw new HttpError(404, `Rental #${id} not found`);
    if (r.status !== "Active")
      throw new HttpError(
        400,
        `Only Active rentals can be cancelled (this one is ${r.status})`,
      );
    await conn.query(
      "UPDATE rentals SET status = 'Cancelled' WHERE rental_id = ?",
      [id],
    );
    await conn.query(
      "UPDATE vehicles SET status = 'Available' WHERE vehicle_id = ? AND status = 'Rented'",
      [r.vehicle_id],
    );
    if (r.reservation_id)
      await conn.query(
        "UPDATE reservations SET status = 'Cancelled' WHERE reservation_id = ? AND status = 'Confirmed'",
        [r.reservation_id],
      );
    await logHistory(conn, id, "Active", "Cancelled", "Rental cancelled");
    await conn.commit();
    return {
      id,
      deleted: false,
      message: `Rental #${id} cancelled and vehicle released`,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function lateInfo(db, rental, returnDateOrNull) {
  
  const [[m]] = returnDateOrNull
    ? await db.query("SELECT TIMESTAMPDIFF(MINUTE, ?, ?) AS mins", [
        rental.due_date,
        returnDateOrNull,
      ])
    : await db.query("SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) AS mins", [
        rental.due_date,
      ]);
  const days = Math.max(0, Math.ceil((Number(m.mins) - GRACE) / 1440));
  return {
    days_late: days,
    daily_rate: LATE_FEE,
    fee_amount: Math.round(days * LATE_FEE * 100) / 100,
  };
}

async function upsertLateFee(conn, rentalId, days, fee) {
  const [[ex]] = await conn.query(
    "SELECT * FROM late_fees WHERE rental_id = ? ORDER BY late_fee_id DESC LIMIT 1 FOR UPDATE",
    [rentalId],
  );
  if (!ex) {
    const [r] = await conn.query(
      "INSERT INTO late_fees (rental_id, days_late, fee_amount) VALUES (?,?,?)",
      [rentalId, days, fee],
    );
    return {
      id: r.insertId,
      action: "created",
      fee_amount: fee,
      status: "Unpaid",
    };
  }
  if (
    ex.status === "Unpaid" &&
    (ex.days_late !== days || Number(ex.fee_amount) !== fee)
  ) {
    await conn.query(
      "UPDATE late_fees SET days_late = ?, fee_amount = ?, computed_on = NOW() WHERE late_fee_id = ?",
      [days, fee, ex.late_fee_id],
    );
    return {
      id: ex.late_fee_id,
      action: "updated",
      fee_amount: fee,
      status: "Unpaid",
    };
  }
  return {
    id: ex.late_fee_id,
    action: "unchanged",
    fee_amount: Number(ex.fee_amount),
    status: ex.status,
  };
}

async function returnPreview(id, q) {
  const [[r]] = await pool.query("SELECT * FROM rentals WHERE rental_id = ?", [
    id,
  ]);
  if (!r) throw new HttpError(404, `Rental #${id} not found`);
  const ret = q.return_date ? normDateTime(q.return_date, "return_date") : null;
  const info = await lateInfo(pool, r, ret);
  return { rental_id: id, status: r.status, due_date: r.due_date, ...info };
}

async function processReturn(id, b, user) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[r]] = await conn.query(
      "SELECT * FROM rentals WHERE rental_id = ? FOR UPDATE",
      [id],
    );
    if (!r) throw new HttpError(404, `Rental #${id} not found`);
    if (!["Active", "Overdue"].includes(r.status))
      throw new HttpError(400, `Rental is already ${r.status}`);
    const retDate = b.return_date
      ? normDateTime(b.return_date, "return_date")
      : (
          await conn.query(
            "SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS n",
          )
        )[0][0].n;
    if (retDate < r.rental_date)
      throw new HttpError(400, "Return date cannot be before the pickup date");
    const endMileage = Number(b.end_mileage);
    if (!Number.isInteger(endMileage) || endMileage < r.start_mileage)
      throw new HttpError(
        400,
        `end_mileage is required and must be at least ${r.start_mileage}`,
      );
    const retBranch = b.return_branch_id
      ? toInt(b.return_branch_id, "return_branch_id")
      : r.pickup_branch_id;

    const late = await lateInfo(conn, r, retDate);
    await conn.query(
      "UPDATE rentals SET return_date = ?, end_mileage = ?, return_branch_id = ?, status = 'Returned' WHERE rental_id = ?",
      [retDate, endMileage, retBranch, id],
    );
    await conn.query(
      "UPDATE vehicles SET mileage = GREATEST(mileage, ?), status = 'Available', branch_id = ? WHERE vehicle_id = ?",
      [endMileage, retBranch, r.vehicle_id],
    );

    let fee = null;
    if (late.days_late > 0) {
      fee = await upsertLateFee(conn, id, late.days_late, late.fee_amount);
      if (b.pay_late_fee && fee.status === "Unpaid") {
        const method = b.payment_method || "Cash";
        await conn.query(
          "INSERT INTO payments (rental_id, amount, payment_method, payment_type, reference_number, status) VALUES (?,?,?,'Late Fee',?, 'Paid')",
          [
            id,
            fee.fee_amount,
            method,
            method === "Cash" ? null : b.reference_number || null,
          ],
        );
        await conn.query(
          "UPDATE late_fees SET status = 'Paid' WHERE late_fee_id = ?",
          [fee.id],
        );
        fee.status = "Paid";
      }
    }
    if (r.reservation_id)
      await conn.query(
        "UPDATE reservations SET status = 'Completed' WHERE reservation_id = ?",
        [r.reservation_id],
      );
    await logHistory(
      conn,
      id,
      r.status,
      "Returned",
      late.days_late
        ? `Returned ${late.days_late} day(s) late, late fee ${late.fee_amount}`
        : "Returned on time",
    );
    await conn.commit();
    return { ...(await get(id)), late_summary: { ...late, fee } };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function processOverdueRental(rentalId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[r]] = await conn.query(
      "SELECT * FROM rentals WHERE rental_id = ? FOR UPDATE",
      [rentalId],
    );
    if (!r || !["Active", "Overdue"].includes(r.status) || r.return_date) {
      await conn.rollback();
      return null;
    }
    const late = await lateInfo(conn, r, null);
    if (late.days_late < 1) {
      await conn.rollback();
      return null;
    }

    let becameOverdue = false;
    if (r.status === "Active") {
      await conn.query(
        "UPDATE rentals SET status = 'Overdue' WHERE rental_id = ?",
        [rentalId],
      );
      await conn.query(
        "UPDATE vehicles SET status = 'Rented' WHERE vehicle_id = ?",
        [r.vehicle_id],
      );
      await logHistory(
        conn,
        rentalId,
        "Active",
        "Overdue",
        "Not returned by due date (automatic check)",
      );
      becameOverdue = true;
    }
    const fee = await upsertLateFee(
      conn,
      rentalId,
      late.days_late,
      late.fee_amount,
    );
    await conn.commit();
    return {
      rental_id: rentalId,
      became_overdue: becameOverdue,
      days_late: late.days_late,
      daily_rate: late.daily_rate,
      fee_amount: fee.fee_amount,
      fee_action: fee.action,
      fee_status: fee.status,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function runOverdueCheck() {
  const [rows] = await pool.query(
    "SELECT rental_id FROM rentals WHERE status IN ('Active','Overdue') AND return_date IS NULL AND due_date < NOW()",
  );
  const items = [];
  for (const { rental_id } of rows) {
    const res = await processOverdueRental(rental_id);
    if (res) items.push(res);
  }
  return {
    checked_at: new Date().toISOString(),
    rentals_past_due: items.length,
    newly_overdue: items.filter((i) => i.became_overdue).length,
    fees_created: items.filter((i) => i.fee_action === "created").length,
    fees_updated: items.filter((i) => i.fee_action === "updated").length,
    items,
  };
}

async function applyLateFee(id, user) {
  const res = await processOverdueRental(id);
  if (!res)
    throw new HttpError(
      400,
      "Rental is not past its due date (or is already returned)",
    );
  return res;
}

async function listOverdue(q = {}) {
  const params = [];
  let where = "r.status = 'Overdue'";
  if (q.branch_id) {
    where += " AND r.pickup_branch_id = ?";
    params.push(q.branch_id);
  }
  const [rows] = await pool.query(
    `${BASE_SELECT} WHERE ${where} ORDER BY r.due_date`,
    params,
  );
  return rows.map((r) => ({
    ...r,
    estimated_fee: Math.round(r.days_late_live * LATE_FEE * 100) / 100,
  }));
}
async function listLateFees(q = {}) {
  const where = [],
    params = [];
  if (q.status) {
    where.push("lf.status = ?");
    params.push(q.status);
  }
  if (q.branch_id) {
    where.push("r.pickup_branch_id = ?");
    params.push(q.branch_id);
  }
  const [rows] = await pool.query(
    `SELECT lf.*, r.vehicle_id, v.plate_number, CONCAT(c.first_name,' ',c.last_name) AS customer_name, r.due_date, r.status AS rental_status
     FROM late_fees lf JOIN rentals r ON r.rental_id = lf.rental_id JOIN vehicles v ON v.vehicle_id = r.vehicle_id JOIN customers c ON c.customer_id = r.customer_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY lf.late_fee_id DESC`,
    params,
  );
  return rows;
}

async function setLateFeeStatus(id, b, user) {
  if (!["Paid", "Waived"].includes(b.status))
    throw new HttpError(400, "status must be 'Paid' or 'Waived'");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[lf]] = await conn.query(
      "SELECT * FROM late_fees WHERE late_fee_id = ? FOR UPDATE",
      [id],
    );
    if (!lf) throw new HttpError(404, `Late fee #${id} not found`);
    if (lf.status !== "Unpaid")
      throw new HttpError(400, `Late fee is already ${lf.status}`);
    if (b.status === "Paid" && lf.fee_amount > 0) {
      const method = b.payment_method || "Cash";
      await conn.query(
        "INSERT INTO payments (rental_id, amount, payment_method, payment_type, reference_number, status) VALUES (?,?,?,'Late Fee',?, 'Paid')",
        [
          lf.rental_id,
          lf.fee_amount,
          method,
          method === "Cash" ? null : b.reference_number || null,
        ],
      );
    }
    await conn.query("UPDATE late_fees SET status = ? WHERE late_fee_id = ?", [
      b.status,
      id,
    ]);
    await conn.commit();
    const [[row]] = await pool.query(
      "SELECT * FROM late_fees WHERE late_fee_id = ?",
      [id],
    );
    return row;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  cancel,
  quote: quoteHttp,
  quoteInternal: quote,
  returnPreview,
  processReturn,
  runOverdueCheck,
  applyLateFee,
  listOverdue,
  listLateFees,
  setLateFeeStatus,
  assertNoOverlap,
};
