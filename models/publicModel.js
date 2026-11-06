const { pool } = require("../config/db");
const { HttpError, isValidDate, toInt } = require("../utils/helpers");
const rentals = require("./rentalModel");
const REQUIRE_INSURANCE =
  String(process.env.REQUIRE_INSURANCE || "false") === "true";

const RATE = (plan) =>
  `(SELECT rp.rate_per_day FROM rate_plans rp WHERE rp.category_id = v.category_id AND rp.plan_name = '${plan}' AND rp.season_start IS NULL LIMIT 1)`;

function checkRange(start, end) {
  if (!isValidDate(String(start)) || !isValidDate(String(end)))
    throw new HttpError(400, "Please choose valid pickup and return dates");
  if (end < start)
    throw new HttpError(400, "Return date cannot be before the pickup date");
}

function bookable(start, end) {
  if (!start)
    return {
      sql: `(v.status = 'Available'${REQUIRE_INSURANCE ? " AND EXISTS (SELECT 1 FROM insurance i WHERE i.vehicle_id = v.vehicle_id AND i.start_date <= CURDATE() AND i.expiry_date >= CURDATE())" : ""})`,
      params: [],
    };
  const s = `${start} 00:00:00`,
    e = `${end} 23:59:59`;
  return {
    sql: `(v.status NOT IN ('Maintenance','Unavailable')
      AND NOT EXISTS (SELECT 1 FROM rentals r WHERE r.vehicle_id = v.vehicle_id AND r.status IN ('Active','Overdue') AND r.return_date IS NULL AND (r.status = 'Overdue' OR (r.rental_date < ? AND r.due_date > ?)))
      AND NOT EXISTS (SELECT 1 FROM reservations rs WHERE rs.vehicle_id = v.vehicle_id AND rs.status IN ('Pending','Confirmed') AND rs.start_date <= ? AND rs.end_date >= ?)
      ${REQUIRE_INSURANCE ? "AND EXISTS (SELECT 1 FROM insurance i WHERE i.vehicle_id = v.vehicle_id AND i.start_date <= ? AND i.expiry_date >= ?)" : ""})`,
    params: REQUIRE_INSURANCE
      ? [e, s, end, start, start, end]
      : [e, s, end, start],
  };
}

async function vehicles(q = {}) {
  if (q.start_date || q.end_date) checkRange(q.start_date, q.end_date);
  const b = bookable(q.start_date, q.end_date);
  const where = ["v.status <> 'Unavailable'"],
    params = [...b.params];
  if (q.category) {
    where.push("c.category_name = ?");
    params.push(q.category);
  }
  if (q.branch_id) {
    where.push("v.branch_id = ?");
    params.push(q.branch_id);
  }
  if (q.transmission) {
    where.push("v.transmission = ?");
    params.push(q.transmission);
  }
  if (q.fuel_type) {
    where.push("v.fuel_type = ?");
    params.push(q.fuel_type);
  }
  if (q.seats) {
    where.push("v.seats >= ?");
    params.push(Number(q.seats) || 1);
  }
  if (q.q) {
    where.push("CONCAT(v.brand, ' ', v.model) LIKE ?");
    params.push(`%${q.q}%`);
  }
  for (const id of String(q.amenities || "")
    .split(",")
    .filter(Boolean)) {
    
    where.push(
      "EXISTS (SELECT 1 FROM vehicle_amenity_assignments x WHERE x.vehicle_id = v.vehicle_id AND x.amenity_id = ?)",
    );
    params.push(Number(id) || 0);
  }
  const [rows] = await pool.query(
    `SELECT v.vehicle_id, v.plate_number, v.brand, v.model, v.year, v.color, v.transmission, v.fuel_type, v.seats, v.branch_id,
            br.branch_name, br.city, c.category_name,
            ${RATE("Daily")} AS daily_rate, ${RATE("Weekly")} AS weekly_rate, ${RATE("Monthly")} AS monthly_rate,
            (SELECT ROUND(AVG(vr.rating), 1) FROM vehicle_ratings vr WHERE vr.vehicle_id = v.vehicle_id) AS avg_rating,
            (SELECT COUNT(*) FROM vehicle_ratings vr WHERE vr.vehicle_id = v.vehicle_id) AS rating_count,
            ${b.sql} AS bookable
     FROM vehicles v JOIN vehicle_categories c ON c.category_id = v.category_id JOIN branches br ON br.branch_id = v.branch_id
     WHERE ${where.join(" AND ")} ORDER BY bookable DESC, c.category_id, v.brand, v.model`,
    params,
  );
  const am = await amenityMap();
  return rows.map((r) => ({
    ...r,
    bookable: !!r.bookable,
    amenities: am[r.vehicle_id] || [],
  }));
}

async function amenityMap() {
  const [rows] =
    await pool.query(`SELECT a.vehicle_id, m.amenity_id, m.amenity_name, m.description FROM vehicle_amenity_assignments a
    JOIN vehicle_amenities m ON m.amenity_id = a.amenity_id ORDER BY m.amenity_id`);
  const map = {};
  for (const r of rows)
    (map[r.vehicle_id] ||= []).push({
      amenity_id: r.amenity_id,
      amenity_name: r.amenity_name,
      description: r.description,
    });
  return map;
}
async function amenities() {
  const [rows] =
    await pool.query(`SELECT m.amenity_id, m.amenity_name, m.description, COUNT(a.vehicle_id) AS vehicle_count
    FROM vehicle_amenities m LEFT JOIN vehicle_amenity_assignments a ON a.amenity_id = m.amenity_id GROUP BY m.amenity_id, m.amenity_name, m.description ORDER BY m.amenity_id`);
  return rows;
}

async function reviews(vehicleId) {
  const [rows] = await pool.query(
    `SELECT r.rating, r.review, r.rated_at, CONCAT(c.first_name, ' ', LEFT(c.last_name, 1), '.') AS customer
    FROM vehicle_ratings r JOIN customers c ON c.customer_id = r.customer_id WHERE r.vehicle_id = ? ORDER BY r.rated_at DESC LIMIT 20`,
    [vehicleId],
  );
  return rows;
}
async function isBookable(vehicleId, start, end) {
  checkRange(start, end);
  const b = bookable(start, end);
  const [[row]] = await pool.query(
    `SELECT ${b.sql} AS ok FROM vehicles v WHERE v.vehicle_id = ?`,
    [...b.params, vehicleId],
  );
  if (!row) throw new HttpError(404, "Vehicle not found");
  return !!row.ok;
}
async function branches() {
  const [rows] =
    await pool.query(`SELECT b.branch_id, b.branch_name, b.address, b.city, b.phone, b.opening_hours,
    (SELECT COUNT(*) FROM vehicles v WHERE v.branch_id = b.branch_id AND v.status <> 'Unavailable') AS vehicle_count FROM branches b ORDER BY b.branch_id`);
  return rows;
}
async function categories() {
  const [rows] =
    await pool.query(`SELECT c.category_id, c.category_name, c.description, c.seating_capacity,
    (SELECT MIN(rp.rate_per_day) FROM rate_plans rp WHERE rp.category_id = c.category_id AND rp.plan_name = 'Daily') AS from_rate,
    (SELECT COUNT(*) FROM vehicles v WHERE v.category_id = c.category_id AND v.status <> 'Unavailable') AS vehicle_count
    FROM vehicle_categories c ORDER BY c.category_id`);
  return rows;
}
async function summary() {
  const [[v]] = await pool.query(
    "SELECT COUNT(*) AS vehicles FROM vehicles WHERE status <> 'Unavailable'",
  );
  const [[b]] = await pool.query("SELECT COUNT(*) AS branches FROM branches");
  const [[c]] = await pool.query(
    "SELECT COUNT(*) AS categories FROM vehicle_categories",
  );
  const [[a]] = await pool.query(
    "SELECT COUNT(*) AS amenities FROM vehicle_amenities",
  );
  const [[r]] = await pool.query(
    "SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS ratings FROM vehicle_ratings",
  );
  return {
    vehicles: v.vehicles,
    branches: b.branches,
    categories: c.categories,
    amenities: a.amenities,
    avg_rating: r.avg_rating,
    ratings: r.ratings,
  };
}

async function quote(q) {
  checkRange(q.start_date, q.end_date);
  const d = new Date(`${q.end_date}T09:00:00`);
  if (q.end_date === q.start_date) d.setDate(d.getDate() + 1);
  const p = (n) => String(n).padStart(2, "0");
  const due = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 09:00:00`;
  const r = await rentals.quoteInternal(
    pool,
    toInt(q.vehicle_id, "vehicle_id"),
    `${q.start_date} 09:00:00`,
    due,
  );
  return {
    days: r.days,
    rate_per_day: r.rate_per_day,
    plan_name: r.selected_plan.plan_name,
    total_amount: r.total_amount,
  };
}
module.exports = {
  vehicles,
  amenities,
  reviews,
  branches,
  categories,
  summary,
  quote,
  isBookable,
};
