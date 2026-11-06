const { HttpError, todayStr } = require("../utils/helpers");
const { ROLES } = require("../middleware/auth");

const R_ALL_W_MGR = { read: ROLES.ALL, write: ROLES.MGR, delete: ROLES.MGR };
const R_ALL = { read: ROLES.ALL, write: ROLES.ALL, delete: ROLES.ALL };
const R_ADMIN = { read: ROLES.ADMIN, write: ROLES.ADMIN, delete: ROLES.ADMIN };

const DAILY_RATE_SQL = `(SELECT rp.rate_per_day FROM rate_plans rp 
WHERE rp.category_id = t.category_id AND rp.plan_name = 'Daily' AND rp.season_start IS NULL LIMIT 1)`;

const resources = {

  customers: {
    table: "customers",
    pk: "customer_id",
    label: "Customer",
    order: "t.last_name, t.first_name",
   
    select: `SELECT t.customer_id, t.first_name, t.middle_name, t.last_name, t.birth_date, t.gender, t.email, 
    (t.password_hash IS NOT NULL) AS has_online_account,
      t.phone, t.street, t.barangay, t.city, t.province, t.postal_code, t.license_number, t.license_expiry_date,
      t.emergency_contact_name, t.emergency_contact_phone, t.date_registered, t.status FROM customers t`,
    fields: [
      "first_name",
      "middle_name",
      "last_name",
      "birth_date",
      "gender",
      "email",
      "phone",
      "street",
      "barangay",
      "city",
      "province",
      "postal_code",
      "license_number",
      "license_expiry_date",
      "emergency_contact_name",
      "emergency_contact_phone",
      "status",
    ],
    required: [
      "first_name",
      "last_name",
      "birth_date",
      "gender",
      "email",
      "phone",
      "street",
      "barangay",
      "city",
      "province",
      "postal_code",
      "license_number",
      "license_expiry_date",
      "emergency_contact_name",
      "emergency_contact_phone",
    ],
    enums: {
      gender: ["Male", "Female", "Other"],
      status: ["Active", "Blacklisted"],
    },
    dates: ["birth_date", "license_expiry_date"],
    filters: ["status", "city"],
    search: ["first_name", "last_name", "email", "license_number", "phone"],
    softDelete: { col: "status", value: "Blacklisted" },
    roles: R_ALL,
    hooks: {
      beforeSave: async (d) => {
        if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
          throw new HttpError(400, "Invalid email address");
        if (d.birth_date) {
          const b = new Date(d.birth_date + "T00:00:00"),
            t = new Date();
          let age = t.getFullYear() - b.getFullYear();
          if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) age--;
          if (age < 18)
            throw new HttpError(400, "Customer must be at least 18 years old");
        }
        if (d.license_expiry_date && d.license_expiry_date < todayStr())
          throw new HttpError(400, "Driver's license is already expired");
      },
    },
  },

  vehicles: {
    table: "vehicles",
    pk: "vehicle_id",
    label: "Vehicle",
    order: "t.vehicle_id",
    select: `SELECT t.*, c.category_name, b.branch_name, ${DAILY_RATE_SQL} AS daily_rate,
      (SELECT CASE WHEN MAX(i.expiry_date) IS NULL THEN 'None' WHEN MAX(i.expiry_date) < CURDATE() THEN 'Expired' ELSE 'Valid' END
         FROM insurance i WHERE i.vehicle_id = t.vehicle_id) AS insurance_status,
      EXISTS(SELECT 1 FROM rentals r WHERE r.vehicle_id = t.vehicle_id AND r.status = 'Overdue') AS is_overdue
      FROM vehicles t JOIN vehicle_categories c ON c.category_id = t.category_id JOIN branches b ON b.branch_id = t.branch_id`,
    fields: [
      "category_id",
      "branch_id",
      "plate_number",
      "brand",
      "model",
      "year",
      "color",
      "transmission",
      "fuel_type",
      "seats",
      "mileage",
      "status",
    ],
    required: [
      "category_id",
      "branch_id",
      "plate_number",
      "brand",
      "model",
      "year",
      "color",
      "transmission",
      "fuel_type",
      "seats",
    ],
    enums: {
      transmission: ["Manual", "Automatic"],
      fuel_type: ["Gasoline", "Diesel", "Electric", "Hybrid"],
      status: ["Available", "Reserved", "Rented", "Maintenance", "Unavailable"],
    },
    positive: ["seats"],
    nonNegative: ["mileage"],
    filters: ["branch_id", "category_id", "transmission", "fuel_type"],
    search: ["plate_number", "brand", "model"],
    customFilters: (q, where, params) => {
      if (q.category) {
        where.push("c.category_name = ?");
        params.push(q.category);
      }
      if (q.status === "Overdue")
        where.push(
          `EXISTS(SELECT 1 FROM rentals r WHERE r.vehicle_id = t.vehicle_id AND r.status = 'Overdue')`,
        );
      else if (q.status) {
        where.push("t.status = ?");
        params.push(q.status);
      }
    },
    softDelete: { col: "status", value: "Unavailable" },
    roles: R_ALL_W_MGR,
    hooks: {
      beforeDelete: async (v) => {
        if (["Rented", "Reserved"].includes(v.status))
          throw new HttpError(
            400,
            `Vehicle is ${v.status} and cannot be removed`,
          );
      },
    },
  },

  // ---------------- payments ----------------
  payments: {
    table: "payments",
    pk: "payment_id",
    label: "Payment",
    order: "t.payment_date DESC",
    select: `SELECT t.*, r.vehicle_id, r.customer_id FROM payments t JOIN rentals r ON r.rental_id = t.rental_id`,
    fields: [
      "rental_id",
      "amount",
      "payment_date",
      "payment_method",
      "payment_type",
      "reference_number",
      "status",
    ],
    required: ["rental_id", "amount", "payment_method", "payment_type"],
    enums: {
      payment_method: [
        "Cash",
        "GCash",
        "Credit Card",
        "Debit Card",
        "Bank Transfer",
      ],
      payment_type: [
        "Deposit",
        "Rental Fee",
        "Late Fee",
        "Damage Fee",
        "Refund",
      ],
      status: ["Paid", "Pending", "Refunded", "Failed"],
    },
    positive: ["amount"],
    filters: ["rental_id", "status", "payment_type"],
    parent: { path: "/rental/:parentId", col: "rental_id" },
    roles: { read: ROLES.ALL, write: ROLES.ALL, delete: ROLES.MGR },
    hooks: {
      beforeSave: async (d) => {
        if (d.payment_method === "Cash") d.reference_number = null;
      },
    },
  },

  branches: {
    table: "branches",
    pk: "branch_id",
    label: "Branch",
    order: "t.branch_id",
    fields: ["branch_name", "address", "city", "phone", "opening_hours"],
    required: ["branch_name", "address", "city", "phone"],
    filters: ["city"],
    search: ["branch_name", "city"],
    roles: R_ALL_W_MGR,
  },

  vehicle_categories: {
    table: "vehicle_categories",
    pk: "category_id",
    label: "Category",
    order: "t.category_id",
    fields: ["category_name", "description", "seating_capacity"],
    required: ["category_name", "seating_capacity"],
    positive: ["seating_capacity"],
    search: ["category_name"],
    roles: R_ALL_W_MGR,
  },

  rate_plans: {
    table: "rate_plans",
    pk: "rate_plan_id",
    label: "Rate plan",
    order: "t.category_id, t.min_days",
    select: `SELECT t.*, c.category_name FROM rate_plans t JOIN vehicle_categories c ON c.category_id = t.category_id`,
    fields: [
      "category_id",
      "plan_name",
      "rate_per_day",
      "min_days",
      "max_days",
      "season_start",
      "season_end",
    ],
    required: ["category_id", "plan_name", "rate_per_day"],
    positive: ["rate_per_day"],
    dates: ["season_start", "season_end"],
    filters: ["category_id", "plan_name"],
    roles: R_ALL_W_MGR,
  },

  insurance: {
    table: "insurance",
    pk: "insurance_id",
    label: "Insurance policy",
    order: "t.vehicle_id, t.expiry_date DESC",
    select: `SELECT t.*, v.plate_number, CONCAT(v.brand, ' ', v.model) AS vehicle_name,
      CASE WHEN t.expiry_date < CURDATE() THEN 'Expired' ELSE 'Valid' END AS policy_status
      FROM insurance t JOIN vehicles v ON v.vehicle_id = t.vehicle_id`,
    fields: [
      "vehicle_id",
      "provider",
      "policy_number",
      "coverage_type",
      "coverage_amount",
      "start_date",
      "expiry_date",
    ],
    required: [
      "vehicle_id",
      "provider",
      "policy_number",
      "coverage_type",
      "coverage_amount",
      "start_date",
      "expiry_date",
    ],
    enums: { coverage_type: ["Comprehensive", "Third-Party", "Collision"] },
    dates: ["start_date", "expiry_date"],
    positive: ["coverage_amount"],
    filters: ["vehicle_id", "coverage_type"],
    roles: R_ALL_W_MGR,
    hooks: {
      beforeSave: async (d, { existing }) => {
        const s = d.start_date ?? existing?.start_date,
          e = d.expiry_date ?? existing?.expiry_date;
        if (s && e && e <= s)
          throw new HttpError(400, "expiry_date must be after start_date");
      },
    },
  },

  maintenance_records: {
    table: "maintenance_records",
    pk: "maintenance_id",
    label: "Maintenance record",
    order: "t.service_date DESC",
    select: `SELECT t.*, v.plate_number, CONCAT(v.brand, ' ', v.model) AS vehicle_name FROM maintenance_records t JOIN vehicles v ON v.vehicle_id = t.vehicle_id`,
    fields: [
      "vehicle_id",
      "service_type",
      "description",
      "service_date",
      "next_service_date",
      "next_service_mileage",
      "cost",
      "status",
    ],
    required: ["vehicle_id", "service_type", "service_date"],
    enums: { status: ["Scheduled", "In Progress", "Completed"] },
    dates: ["service_date", "next_service_date"],
    nonNegative: ["cost"],
    filters: ["vehicle_id", "status"],
    roles: R_ALL_W_MGR,
    hooks: {
    
      afterSave: async (conn, row, { user }) => {
        const [[v]] = await conn.query(
          "SELECT vehicle_id, status FROM vehicles WHERE vehicle_id = ? FOR UPDATE",
          [row.vehicle_id],
        );
        if (row.status === "In Progress") {
          if (["Rented", "Reserved"].includes(v.status))
            throw new HttpError(
              400,
              `Vehicle is currently ${v.status}. Return it before starting maintenance.`,
            );
          await conn.query(
            "UPDATE vehicles SET status = 'Maintenance' WHERE vehicle_id = ?",
            [v.vehicle_id],
          );
        } else if (row.status === "Completed" && v.status === "Maintenance") {
          const [[other]] = await conn.query(
            "SELECT COUNT(*) n FROM maintenance_records WHERE vehicle_id = ? AND status = 'In Progress' AND maintenance_id <> ?",
            [v.vehicle_id, row.maintenance_id],
          );
          if (!other.n)
            await conn.query(
              "UPDATE vehicles SET status = 'Available' WHERE vehicle_id = ?",
              [v.vehicle_id],
            );
        }
      },
    },
  },

  damage_reports: {
    table: "damage_reports",
    pk: "damage_id",
    label: "Damage report",
    order: "t.reported_date DESC",
    select: `SELECT t.*, v.plate_number FROM damage_reports t JOIN vehicles v ON v.vehicle_id = t.vehicle_id`,
    fields: [
      "rental_id",
      "description",
      "severity",
      "repair_cost",
      "reported_date",
      "status",
    ],
    required: ["rental_id", "description", "severity"],
    enums: {
      severity: ["Minor", "Moderate", "Major"],
      status: ["Reported", "Under Repair", "Resolved"],
    },
    dates: ["reported_date"],
    nonNegative: ["repair_cost"],
    filters: ["rental_id", "vehicle_id", "status", "severity"],
    roles: { read: ROLES.ALL, write: ROLES.ALL, delete: ROLES.MGR },
    hooks: {
      beforeSave: async (d, { conn, user, isCreate }) => {
        if (!isCreate) return;
        const [[r]] = await conn.query(
          "SELECT vehicle_id FROM rentals WHERE rental_id = ?",
          [d.rental_id],
        );
        if (!r) throw new HttpError(400, "Rental does not exist");
        d.vehicle_id = r.vehicle_id;
        d.reported_date = d.reported_date || todayStr();
      },

      afterSave: async (conn, row, { body, isCreate }) => {
        if (isCreate && body.charge_customer && row.repair_cost > 0)
          await conn.query(
            "INSERT INTO payments (rental_id, amount, payment_method, payment_type, status) VALUES (?,?,?,'Damage Fee','Pending')",
            [row.rental_id, row.repair_cost, body.payment_method || "Cash"],
          );
      },
    },
  },

  vehicle_amenities: {
    table: "vehicle_amenities",
    pk: "amenity_id",
    label: "Amenity",
    order: "t.amenity_id",
    select: `SELECT t.*, (SELECT COUNT(*) FROM vehicle_amenity_assignments a WHERE a.amenity_id = t.amenity_id) AS vehicle_count FROM vehicle_amenities t`,
    fields: ["amenity_name", "description"],
    required: ["amenity_name"],
    search: ["amenity_name"],
    roles: R_ALL_W_MGR,
  },

  vehicle_ratings: {
    table: "vehicle_ratings",
    pk: "rating_id",
    label: "Rating",
    order: "t.rated_at DESC",
    select: `SELECT t.*, CONCAT(c.first_name, ' ', c.last_name) AS customer_name, v.plate_number, CONCAT(v.brand, ' ', v.model) AS vehicle_name
      FROM vehicle_ratings t JOIN customers c ON c.customer_id = t.customer_id JOIN vehicles v ON v.vehicle_id = t.vehicle_id`,
    fields: ["rating", "review"],
    filters: ["vehicle_id", "customer_id", "rating"],
    roles: R_ALL_W_MGR,
  },

  rental_status_history: {
    table: "rental_status_history",
    pk: "history_id",
    label: "History entry",
    order: "t.changed_at DESC, t.history_id DESC",
    readOnly: true,
    filters: ["rental_id", "new_status"],
    roles: { read: ROLES.MGR },
  },
};
module.exports = resources;
