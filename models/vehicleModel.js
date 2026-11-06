const createCrudModel = require("./crudModel");
const resources = require("../config/resources");
module.exports = createCrudModel(resources.vehicles);

const { pool } = require("../config/db");
const baseGet = module.exports.get;
module.exports.get = async (id) => {
  const vehicle = await baseGet(id);
  const [insurance] = await pool.query(
    "SELECT * FROM insurance WHERE vehicle_id = ? ORDER BY expiry_date DESC",
    [id],
  );
  const [maintenance] = await pool.query(
    "SELECT * FROM maintenance_records WHERE vehicle_id = ? ORDER BY service_date DESC LIMIT 5",
    [id],
  );
  const [rentals] = await pool.query(
    `SELECT r.rental_id, CONCAT(c.first_name,' ',c.last_name) AS customer_name, r.rental_date, r.due_date, r.return_date, r.status, r.total_amount
     FROM rentals r JOIN customers c ON c.customer_id = r.customer_id WHERE r.vehicle_id = ? ORDER BY r.rental_date DESC LIMIT 5`,
    [id],
  );
  const amenities = await getAmenities(id);
  return {
    ...vehicle,
    insurance,
    maintenance,
    recent_rentals: rentals,
    amenities,
  };
};

async function getAmenities(id) {
  const [rows] = await pool.query(
    `SELECT m.amenity_id, m.amenity_name, m.description FROM vehicle_amenity_assignments a
    JOIN vehicle_amenities m ON m.amenity_id = a.amenity_id WHERE a.vehicle_id = ? ORDER BY m.amenity_id`,
    [id],
  );
  return rows;
}

module.exports.getAmenities = getAmenities;
module.exports.setAmenities = async (id, ids) => {
  const { HttpError } = require("../utils/helpers");
  if (!Array.isArray(ids))
    throw new HttpError(400, "amenity_ids must be a list of amenity ids");
  const clean = [...new Set(ids.map(Number))].filter(
    (n) => Number.isInteger(n) && n > 0,
  );
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[v]] = await conn.query(
      "SELECT vehicle_id FROM vehicles WHERE vehicle_id = ? FOR UPDATE",
      [id],
    );
    if (!v) throw new HttpError(404, `Vehicle #${id} not found`);
    await conn.query(
      "DELETE FROM vehicle_amenity_assignments WHERE vehicle_id = ?",
      [id],
    );
    if (clean.length)
      await conn.query(
        "INSERT INTO vehicle_amenity_assignments (vehicle_id, amenity_id) VALUES ?",
        [clean.map((a) => [id, a])],
      );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return getAmenities(id);
};
