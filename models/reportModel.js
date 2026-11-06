const { pool } = require("../config/db");

async function activeRentals(q = {}) {
  const params = [];
  let where = q.scope === "all" ? "1=1" : "r.status IN ('Active','Overdue')";
  if (q.branch_id) {
    where += " AND r.pickup_branch_id = ?";
    params.push(q.branch_id);
  }
  const [rows] = await pool.query(
    `SELECT r.rental_id, CONCAT(c.first_name,' ',c.last_name) AS customer, c.phone AS customer_phone,
            v.plate_number, CONCAT(v.brand,' ',v.model) AS vehicle, vc.category_name AS category, b.branch_name AS pickup_branch,
            r.rental_date, r.due_date, r.total_amount, r.status
     FROM rentals r
     INNER JOIN customers c ON c.customer_id = r.customer_id
     INNER JOIN vehicles  v ON v.vehicle_id  = r.vehicle_id
     INNER JOIN branches  b ON b.branch_id   = r.pickup_branch_id
     INNER JOIN vehicle_categories vc ON vc.category_id = v.category_id
     WHERE ${where} ORDER BY r.due_date`,
    params,
  );
  return rows;
}

async function vehiclesWithoutInsurance(q = {}) {
  const params = [];
  let where = "valid.insurance_id IS NULL";
  if (q.branch_id) {
    where += " AND v.branch_id = ?";
    params.push(q.branch_id);
  }
  const [rows] = await pool.query(
    `SELECT v.vehicle_id, v.plate_number, CONCAT(v.brand,' ',v.model) AS vehicle, b.branch_name AS branch, v.status,
            last.last_expiry, IF(last.last_expiry IS NULL, 'No policy on file', 'Policy expired') AS issue
     FROM vehicles v
     JOIN branches b ON b.branch_id = v.branch_id
     LEFT JOIN insurance valid ON valid.vehicle_id = v.vehicle_id AND valid.expiry_date >= CURDATE()
     LEFT JOIN (SELECT vehicle_id, MAX(expiry_date) AS last_expiry FROM insurance GROUP BY vehicle_id) last ON last.vehicle_id = v.vehicle_id
     WHERE ${where} ORDER BY v.vehicle_id`,
    params,
  );
  return rows;
}

async function customersWithoutBookings() {
  const [rows] = await pool.query(
    `SELECT c.customer_id, CONCAT(c.first_name,' ',c.last_name) AS customer, c.email, c.phone, c.city, c.date_registered, c.status
     FROM customers c
     LEFT JOIN reservations rs ON rs.customer_id = c.customer_id
     LEFT JOIN rentals rt ON rt.customer_id = c.customer_id
     WHERE rs.reservation_id IS NULL AND rt.rental_id IS NULL ORDER BY c.customer_id`,
  );
  return rows;
}

async function vehiclesNeverRented(q = {}) {
  const params = [];
  let where = "r.rental_id IS NULL";
  if (q.branch_id) {
    where += " AND v.branch_id = ?";
    params.push(q.branch_id);
  }
  const [rows] = await pool.query(
    `SELECT v.vehicle_id, v.plate_number, CONCAT(v.brand,' ',v.model) AS vehicle, v.year, v.status, v.mileage
     FROM rentals r RIGHT JOIN vehicles v ON v.vehicle_id = r.vehicle_id
     WHERE ${where} ORDER BY v.vehicle_id`,
    params,
  );
  return rows;
}

async function customerVehicleActivity() {
  const [rows] = await pool.query(
    `SELECT t.*, CASE WHEN t.customer_id IS NULL THEN 'Vehicle never rented'
                      WHEN t.vehicle_id IS NULL THEN 'Customer with no rentals' ELSE 'Linked rental' END AS link_type
     FROM (
       SELECT c.customer_id, CONCAT(c.first_name,' ',c.last_name) AS customer, v.vehicle_id, v.plate_number, r.rental_id, r.status AS rental_status
       FROM customers c LEFT JOIN rentals r ON r.customer_id = c.customer_id LEFT JOIN vehicles v ON v.vehicle_id = r.vehicle_id
       UNION
       SELECT c.customer_id, CONCAT(c.first_name,' ',c.last_name), v.vehicle_id, v.plate_number, r.rental_id, r.status
       FROM customers c RIGHT JOIN rentals r ON r.customer_id = c.customer_id RIGHT JOIN vehicles v ON v.vehicle_id = r.vehicle_id
     ) t ORDER BY t.customer_id IS NULL, t.customer_id, t.vehicle_id`,
  );
  return rows;
}

async function activityStream() {
  const [rows] = await pool.query(
    `SELECT * FROM (
       SELECT h.changed_at AS event_time, 'Rental status' AS source, CONCAT(COALESCE(h.old_status, 'new'), ' -> ', h.new_status) AS event, CONCAT('Rental #', h.rental_id, ' - ', COALESCE(h.remarks, '')) AS details FROM rental_status_history h
       UNION ALL
       SELECT p.payment_date, 'Payment', CONCAT(p.payment_type, ' (', p.payment_method, ')'), CONCAT('Rental #', p.rental_id, ' - ', p.amount, ' - ', p.status) FROM payments p
       UNION ALL
       SELECT l.computed_on, 'Late Fee', CONCAT('Late fee ', l.status), CONCAT('Rental #', l.rental_id, ' - ', l.days_late, ' day(s) - ', l.fee_amount) FROM late_fees l
       UNION ALL
       SELECT d.reported_date, 'Damage', CONCAT(d.severity, ' damage'), CONCAT('Rental #', d.rental_id, ' - ', d.description) FROM damage_reports d
       UNION ALL
       SELECT vr.rated_at, 'Rating', CONCAT(vr.rating, ' star(s)'), CONCAT(c.first_name, ' rated ', v.brand, ' ', v.model) FROM vehicle_ratings vr JOIN customers c ON c.customer_id = vr.customer_id JOIN vehicles v ON v.vehicle_id = vr.vehicle_id
       UNION ALL
       SELECT r.created_at, 'Reservation', CONCAT('Reservation ', r.status), CONCAT('#', r.reservation_id, ' - ', v.brand, ' ', v.model, ' ', r.start_date, ' to ', r.end_date) FROM reservations r JOIN vehicles v ON v.vehicle_id = r.vehicle_id
     ) s ORDER BY event_time DESC LIMIT 100`,
  );
  return rows;
}

async function amenityUsage() {
  const [rows] = await pool.query(
    `SELECT a.amenity_id, a.amenity_name, COUNT(va.vehicle_id) AS vehicles_with_amenity,
            GROUP_CONCAT(DISTINCT c.category_name ORDER BY c.category_name SEPARATOR ', ') AS categories
     FROM vehicle_amenities a
     LEFT JOIN vehicle_amenity_assignments va ON va.amenity_id = a.amenity_id
     LEFT JOIN vehicles v ON v.vehicle_id = va.vehicle_id
     LEFT JOIN vehicle_categories c ON c.category_id = v.category_id
     GROUP BY a.amenity_id, a.amenity_name ORDER BY vehicles_with_amenity DESC`,
  );
  return rows;
}

async function vehicleRatings() {
  const [rows] = await pool.query(
    `SELECT v.vehicle_id, v.plate_number, CONCAT(v.brand, ' ', v.model) AS vehicle, COUNT(r.rating_id) AS ratings, ROUND(AVG(r.rating), 2) AS average_rating
     FROM vehicles v LEFT JOIN vehicle_ratings r ON r.vehicle_id = v.vehicle_id GROUP BY v.vehicle_id, v.plate_number, v.brand, v.model
     ORDER BY AVG(r.rating) IS NULL, AVG(r.rating) DESC, v.vehicle_id`,
  );
  return rows;
}

async function dashboard(q = {}) {
  const b = q.branch_id ? Number(q.branch_id) : null;
  const vw = b ? "WHERE branch_id = ?" : "",
    rw = b ? "AND pickup_branch_id = ?" : "",
    p = b ? [b] : [];
  const [[v]] = await pool.query(
    `SELECT COUNT(*) total_vehicles, SUM(status='Available') available, SUM(status='Maintenance') in_maintenance FROM vehicles ${vw}`,
    p,
  );
  const [[r]] = await pool.query(
    `SELECT SUM(status='Active') active_rentals, SUM(status='Overdue') overdue_rentals FROM rentals WHERE 1=1 ${rw}`,
    p,
  );
  const [[rev]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN p.payment_type = 'Refund' THEN -p.amount ELSE p.amount END), 0) AS total_revenue
     FROM payments p JOIN rentals r ON r.rental_id = p.rental_id WHERE p.status = 'Paid' ${rw}`,
    p,
  );
  const [[lf]] = await pool.query(
    `SELECT COALESCE(SUM(l.fee_amount), 0) AS unpaid_late_fees FROM late_fees l JOIN rentals r ON r.rental_id = l.rental_id WHERE l.status = 'Unpaid' ${rw}`,
    p,
  );
  const [[cu]] = await pool.query(
    "SELECT COUNT(*) AS customers FROM customers",
  );
  const [[rt]] = await pool.query(
    "SELECT ROUND(AVG(rating), 2) AS avg_rating, COUNT(*) AS ratings FROM vehicle_ratings",
  );
  return {
    customers: cu.customers,
    avg_rating: rt.avg_rating,
    ratings: rt.ratings,
    total_vehicles: v.total_vehicles,
    available_vehicles: Number(v.available || 0),
    vehicles_in_maintenance: Number(v.in_maintenance || 0),
    active_rentals: Number(r.active_rentals || 0),
    overdue_rentals: Number(r.overdue_rentals || 0),
    total_revenue: rev.total_revenue,
    unpaid_late_fees: lf.unpaid_late_fees,
  };
}
module.exports = {
  activeRentals,
  vehiclesWithoutInsurance,
  customersWithoutBookings,
  vehiclesNeverRented,
  customerVehicleActivity,
  activityStream,
  amenityUsage,
  vehicleRatings,
  dashboard,
};
