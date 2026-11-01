const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { pool } = require("../config/db");
const { HttpError, buildData } = require("../utils/helpers");
const resources = require("../config/resources");
const reservationModel = require("./reservationModel");
const rentalModel = require("./rentalModel");
const publicModel = require("./publicModel");

const PROFILE_SQL = `SELECT c.customer_id, c.first_name, c.middle_name, c.last_name, c.birth_date, c.gender, c.email, c.phone, c.street, c.barangay,
  c.city, c.province, c.postal_code, c.license_number, c.license_expiry_date, c.emergency_contact_name, c.emergency_contact_phone, c.date_registered, c.status
  FROM customers c WHERE c.customer_id = ?`;
const EDITABLE = [
  "phone",
  "street",
  "barangay",
  "city",
  "province",
  "postal_code",
  "emergency_contact_name",
  "emergency_contact_phone",
  "license_expiry_date",
];
const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
const SUSPENDED = "This account is suspended. Please contact our branch.";

async function signup(b) {
  const cfg = resources.customers;
  const data = buildData(
    b,
    { ...cfg, fields: cfg.fields.filter((f) => f !== "status") },
    false,
  );
  await cfg.hooks.beforeSave(data); 
  if (typeof b.password !== "string" || b.password.length < 8)
    throw new HttpError(400, "Password must be at least 8 characters");
  const hash = await bcrypt.hash(b.password, 10);
  const [[existing]] = await pool.query(
    "SELECT customer_id, password_hash, license_number, birth_date, status FROM customers WHERE email = ?",
    [data.email],
  );
  if (existing) {
    if (
      !existing.password_hash &&
      existing.license_number === data.license_number &&
      existing.birth_date === data.birth_date
    ) {
      if (existing.status !== "Active") throw new HttpError(403, SUSPENDED);
      await pool.query(
        "UPDATE customers SET password_hash = ? WHERE customer_id = ?",
        [hash, existing.customer_id],
      );
      return me(existing.customer_id);
    }
    throw new HttpError(
      400,
      existing.password_hash
        ? "This email is already registered. Please log in instead."
        : "This email already belongs to a customer record. To activate online access, use the same license number and birth date.",
    );
  }
  try {
    const [ins] = await pool.query("INSERT INTO customers SET ?", [
      { ...data, password_hash: hash },
    ]);
    return me(ins.insertId);
  } catch (e) {
    if (e.errno === 1062)
      throw new HttpError(
        400,
        /email/.test(e.sqlMessage)
          ? "This email is already registered. Please log in instead."
          : "That driver's license number is already registered.",
      );
    throw e;
  }
}

async function login(email, password) {
  if (!email || !password)
    throw new HttpError(400, "Email and password are required");
  const [[row]] = await pool.query("SELECT * FROM customers WHERE email = ?", [
    email,
  ]);
  if (
    !row ||
    !row.password_hash ||
    !(await bcrypt.compare(String(password), row.password_hash))
  )
    throw new HttpError(401, "Incorrect email or password");
  if (row.status !== "Active") throw new HttpError(403, SUSPENDED);
  return row;
}

async function sendResetEmail(to, link) {
  if (process.env.SMTP_HOST) {
    const nodemailer = require("nodemailer");
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await t.sendMail({
      from: process.env.MAIL_FROM || "V-RENT <no-reply@vrent.local>",
      to,
      subject: "Reset your V-RENT password",
      text: `Open this link to choose a new password (valid for 15 minutes):\n${link}\n\nIf you did not ask for this, ignore this email.`,
    });
  } else {
    console.log(
      `\n[password reset] No SMTP configured. Reset link for ${to}:\n${link}\n`,
    ); 
  }
}
async function forgotPassword(email) {
  if (!email) throw new HttpError(400, "Please enter your email");
  const [[c]] = await pool.query(
    "SELECT customer_id, email FROM customers WHERE email = ? AND status = 'Active'",
    [email],
  );
  if (c) {
    const token = crypto.randomBytes(32).toString("hex");
    await pool.query(
      "DELETE FROM password_reset_tokens WHERE customer_id = ?",
      [c.customer_id],
    ); 
    await pool.query(
      "INSERT INTO password_reset_tokens (customer_id, token_hash, expires_at) VALUES (?,?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))",
      [c.customer_id, sha256(token)],
    );
    const base =
      process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    sendResetEmail(c.email, `${base}/?reset=${token}`).catch((e) =>
      console.error("Could not send reset email:", e.message),
    );
  }
  return {
    message:
      "If that email is registered, a reset link has been sent. It is valid for 15 minutes.",
  };
}
async function resetPassword(token, password) {
  if (!token || typeof token !== "string")
    throw new HttpError(400, "Invalid reset link");
  if (typeof password !== "string" || password.length < 8)
    throw new HttpError(400, "Password must be at least 8 characters");
  const hash = await bcrypt.hash(password, 10);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[t]] = await conn.query(
      "SELECT reset_id, customer_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE",
      [sha256(token)],
    );
    if (!t)
      throw new HttpError(
        400,
        "This reset link is invalid or has expired. Please request a new one.",
      );
    await conn.query(
      "UPDATE customers SET password_hash = ? WHERE customer_id = ?",
      [hash, t.customer_id],
    );
    await conn.query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE reset_id = ?",
      [t.reset_id],
    );
    await conn.query(
      "DELETE FROM password_reset_tokens WHERE customer_id = ? AND reset_id <> ?",
      [t.customer_id, t.reset_id],
    );
    await conn.commit();
    return { message: "Your password was changed. You can log in now." };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function me(id) {
  const [[c]] = await pool.query(PROFILE_SQL, [id]);
  if (!c) throw new HttpError(401, "Account not found");
  return c;
}
async function updateMe(id, b) {
  const data = buildData(
    b,
    { fields: EDITABLE, required: [], dates: ["license_expiry_date"] },
    true,
  );
  if (
    data.license_expiry_date &&
    data.license_expiry_date < new Date().toISOString().slice(0, 10)
  )
    throw new HttpError(400, "Driver's license is already expired");
  if (!Object.keys(data).length) throw new HttpError(400, "Nothing to update");
  await pool.query("UPDATE customers SET ? WHERE customer_id = ?", [data, id]);
  return me(id);
}
async function changePassword(id, current, next) {
  if (typeof next !== "string" || next.length < 8)
    throw new HttpError(400, "New password must be at least 8 characters");
  const [[c]] = await pool.query(
    "SELECT password_hash FROM customers WHERE customer_id = ?",
    [id],
  );
  if (
    !c?.password_hash ||
    !(await bcrypt.compare(String(current || ""), c.password_hash))
  )
    throw new HttpError(400, "Your current password is incorrect");
  await pool.query(
    "UPDATE customers SET password_hash = ? WHERE customer_id = ?",
    [await bcrypt.hash(next, 10), id],
  );
  return { message: "Password changed" };
}

async function myReservations(id) {
  return reservationModel.list({ customer_id: id });
}
async function createReservation(customerId, b) {
  const vehicleId = Number(b.vehicle_id);
  if (!Number.isInteger(vehicleId) || vehicleId <= 0)
    throw new HttpError(400, "Please choose a vehicle");
  const c = await me(customerId);
  if (c.status !== "Active")
    throw new HttpError(403, "Your account cannot make reservations");
  if (c.license_expiry_date < b.end_date)
    throw new HttpError(
      400,
      "Your driver's license expires before the return date. Update it in My Account first.",
    );
  const [[cnt]] = await pool.query(
    "SELECT COUNT(*) n FROM reservations WHERE customer_id = ? AND status = 'Pending'",
    [customerId],
  );
  if (cnt.n >= 5)
    throw new HttpError(
      400,
      "You already have 5 pending reservations. Please wait for confirmation or cancel one.",
    );
  if (!(await publicModel.isBookable(vehicleId, b.start_date, b.end_date)))
    throw new HttpError(
      400,
      "Sorry, this car is not available for those dates. Please try other dates or another car.",
    );
  return reservationModel.create({
    customer_id: customerId,
    vehicle_id: vehicleId,
    start_date: b.start_date,
    end_date: b.end_date,
    status: "Pending",
  });
}
async function cancelReservation(customerId, id) {
  const r = await reservationModel.get(id);
  if (r.customer_id !== customerId)
    throw new HttpError(404, "Reservation not found");
  return reservationModel.setStatus(id, "Cancelled");
}

async function myRentals(id) {
  const rows = await rentalModel.list({ customer_id: id });
  if (!rows.length) return [];
  const [pay] = await pool.query(
    "SELECT rental_id, payment_type, amount, status, payment_date FROM payments WHERE rental_id IN (?) ORDER BY payment_date",
    [rows.map((r) => r.rental_id)],
  );
  return rows.map((r) => ({
    rental_id: r.rental_id,
    vehicle_id: r.vehicle_id,
    vehicle_name: r.vehicle_name,
    plate_number: r.plate_number,
    pickup_branch: r.pickup_branch,
    return_branch: r.return_branch,
    rental_date: r.rental_date,
    due_date: r.due_date,
    return_date: r.return_date,
    status: r.status,
    total_amount: r.total_amount,
    days_late: r.status === "Overdue" ? r.days_late_live : r.days_late,
    late_fee_per_day: r.late_fee_per_day,
    fee_amount: r.fee_amount,
    late_fee_status: r.late_fee_status,
    payments: pay.filter((p) => p.rental_id === r.rental_id),
  }));
}

async function myRatings(customerId) {
  const [rows] = await pool.query(
    `SELECT v.vehicle_id, v.brand, v.model, v.plate_number, v.color, vc.category_name, MAX(r.return_date) AS last_returned,
      vr.rating, vr.review, vr.rated_at
    FROM rentals r JOIN vehicles v ON v.vehicle_id = r.vehicle_id JOIN vehicle_categories vc ON vc.category_id = v.category_id
    LEFT JOIN vehicle_ratings vr ON vr.vehicle_id = v.vehicle_id AND vr.customer_id = r.customer_id
    WHERE r.customer_id = ? AND r.status = 'Returned'
    GROUP BY v.vehicle_id, v.brand, v.model, v.plate_number, v.color, vc.category_name, vr.rating, vr.review, vr.rated_at ORDER BY last_returned DESC`,
    [customerId],
  );
  return rows;
}
async function rateVehicle(customerId, vehicleId, b) {
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    throw new HttpError(400, "Please choose 1 to 5 stars");
  const [[done]] = await pool.query(
    "SELECT COUNT(*) n FROM rentals WHERE customer_id = ? AND vehicle_id = ? AND status = 'Returned'",
    [customerId, vehicleId],
  );
  if (!done.n)
    throw new HttpError(
      400,
      "You can rate a vehicle after you have rented and returned it.",
    );
  const review = b.review ? String(b.review).trim().slice(0, 1000) : null;
  await pool.query(
    `INSERT INTO vehicle_ratings (customer_id, vehicle_id, rating, review) VALUES (?,?,?,?)
    ON DUPLICATE KEY UPDATE rating = VALUES(rating), review = VALUES(review), rated_at = NOW()`,
    [customerId, vehicleId, rating, review],
  );
  return { vehicle_id: vehicleId, rating, review };
}
async function deleteRating(customerId, vehicleId) {
  const [r] = await pool.query(
    "DELETE FROM vehicle_ratings WHERE customer_id = ? AND vehicle_id = ?",
    [customerId, vehicleId],
  );
  if (!r.affectedRows) throw new HttpError(404, "Rating not found");
  return { vehicle_id: vehicleId, deleted: true };
}
module.exports = {
  signup,
  login,
  forgotPassword,
  resetPassword,
  me,
  updateMe,
  changePassword,
  myReservations,
  createReservation,
  cancelReservation,
  myRentals,
  myRatings,
  rateVehicle,
  deleteRating,
};
