const API = "/api";
const $ = (id) => document.getElementById(id);
const ALL = ["Admin", "Manager", "Staff"],
  MGR = ["Admin", "Manager"],
  ADM = ["Admin"];
const state = {
  token: localStorage.getItem("vrent_token"),
  user: JSON.parse(localStorage.getItem("vrent_user") || "null"),
  branch: "",
  view: "dashboard",
};
const isMgr = () => MGR.includes(state.user?.role);

let pending = 0;
function showLoading() {
  pending++;
  $("spinner").hidden = false;
}
function hideLoading() {
  pending = Math.max(0, pending - 1);
  if (!pending) $("spinner").hidden = true;
}
function notify(message, type = "info", ms = 5000) {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  const t = document.createElement("span");
  t.textContent = message;
  const x = document.createElement("button");
  x.setAttribute("aria-label", "Dismiss");
  x.textContent = "\u00D7";
  x.onclick = () => el.remove();
  el.append(t, x);
  $("toasts").appendChild(el);
  if (ms) setTimeout(() => el.remove(), ms);
}
const notifySuccess = (m) => notify(m, "success");
const notifyError = (m) => notify(m, "error", 8000);

async function api(path, { method = "GET", body } = {}) {
  showLoading();
  try {
    const res = await fetch(API + path, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...(state.token ? { Authorization: "Bearer " + state.token } : {}),
      },
    });
    const json = await res.json().catch(() => ({
      success: false,
      error: `Unexpected response (${res.status})`,
    }));
    if (res.status === 401 && state.token) {
      clearSession();
      showLogin();
      throw new Error(json.error || "Session expired");
    }
    if (!res.ok || !json.success)
      throw new Error(json.error || `Request failed (${res.status})`);
    return json.data;
  } catch (err) {
    notifyError(err.message);
    throw err;
  } finally {
    hideLoading();
  }
}
const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => {
    if (v !== "" && v != null) p.append(k, v);
  });
  const s = p.toString();
  return s ? "?" + s : "";
};

function esc(v) {
  const d = document.createElement("div");
  d.textContent = v ?? "";
  return d.innerHTML;
}
const peso = (n) =>
  "\u20B1" +
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const dt = (s) => (s ? String(s).slice(0, 16).replace("T", " ") : "\u2014");
const badge = (s) =>
  `<span class="badge badge-${String(s).toLowerCase().replace(/\s+/g, "-")}">${esc(s)}</span>`;
const MONEY = new Set([
  "amount",
  "total_amount",
  "fee_amount",
  "repair_cost",
  "cost",
  "rate_per_day",
  "coverage_amount",
  "estimated_fee",
]);
const BADGE = new Set([
  "status",
  "rental_status",
  "late_fee_status",
  "severity",
  "policy_status",
]);
function cell(key, v) {
  if (v === null || v === undefined || v === "") return "\u2014";
  if (MONEY.has(key)) return peso(v);
  if (BADGE.has(key)) return badge(v);
  if (/(_date|_at|_time|computed_on|last_expiry)$/.test(key)) return esc(dt(v));
  return esc(v);
}
const pretty = (k) => k.replace(/_/g, " ");
const nowLocal = (addDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  d.setSeconds(0, 0);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
function fillTable(tbody, rows, cols, empty = "No records found.") {
  tbody.innerHTML = rows.length
    ? rows
        .map((r) => `<tr>${cols.map((c) => `<td>${c(r)}</td>`).join("")}</tr>`)
        .join("")
    : `<tr><td colspan="${cols.length}" class="empty">${empty}</td></tr>`;
}
function genericTable(thead, tbody, rows) {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  thead.innerHTML = keys.length
    ? `<tr>${keys.map((k) => `<th>${esc(pretty(k))}</th>`).join("")}</tr>`
    : "";
  fillTable(
    tbody,
    rows,
    keys.map((k) => (r) => cell(k, r[k])),
    "No rows returned by this report.",
  );
}
const btn = (act, id, label, cls = "btn-outline", extra = "") =>
  `<button class="btn ${cls} btn-sm" data-act="${act}" data-id="${id}" ${extra}>${label}</button>`;

function openModal(id) {
  const m = $(id);
  m.hidden = false;
  m.querySelector(
    "input:not([type=hidden]),select,textarea,button:not([data-close])",
  )?.focus();
}
function closeModal(id) {
  $(id).hidden = true;
}
document
  .querySelectorAll("[data-close]")
  .forEach((b) =>
    b.addEventListener(
      "click",
      () => (b.closest(".modal-backdrop").hidden = true),
    ),
  );
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape")
    document
      .querySelectorAll(".modal-backdrop")
      .forEach((m) => (m.hidden = true));
});

const REFS = {
  branch_id: { url: "/branches", v: "branch_id", l: (r) => r.branch_name },
  category_id: {
    url: "/categories",
    v: "category_id",
    l: (r) => r.category_name,
  },
  customer_id: {
    url: "/customers?status=Active",
    v: "customer_id",
    l: (r) => `${r.first_name} ${r.last_name}`,
  },
  vehicle_id: {
    url: "/vehicles",
    v: "vehicle_id",
    l: (r) => `${r.plate_number} - ${r.brand} ${r.model}`,
  },
  rental_id: {
    url: "/rentals",
    v: "rental_id",
    l: (r) => `#${r.rental_id} ${r.plate_number} - ${r.customer_name}`,
  },
};
let refCache = {};
const clearRefs = () => {
  refCache = {};
};
const getRef = (name) => (refCache[name] ||= api(REFS[name].url));

let formHandler = null;
async function fieldHtml(f, val) {
  const id = "f_" + f.name,
    req = f.required ? "required" : "",
    v = val ?? "";
  let input;
  if (f.type === "ref") {
    const list = await getRef(f.name),
      r = REFS[f.name];
    input = `<select id="${id}" ${req}><option value="">-- select --</option>${list.map((o) => `<option value="${esc(o[r.v])}" ${String(o[r.v]) === String(v) ? "selected" : ""}>${esc(r.l(o))}</option>`).join("")}</select>`;
  } else if (f.type === "amenities") {
    const list = await api("/amenities"),
      chosen = new Set((val || []).map(Number));
    return `<fieldset class="field"><legend><b>${esc(f.label)}</b></legend>${list.map((a) => `<label style="font-weight:400"><input type="checkbox" name="amenity" value="${a.amenity_id}" ${chosen.has(a.amenity_id) ? "checked" : ""}> ${esc(a.amenity_name)}</label>`).join("<br>")}</fieldset>`;
  } else if (f.type === "select") {
    input = `<select id="${id}" ${req}>${f.required ? "" : '<option value="">--</option>'}${f.options.map((o) => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  } else if (f.type === "textarea")
    input = `<textarea id="${id}" rows="3" ${req}>${esc(v)}</textarea>`;
  else if (f.type === "checkbox")
    return `<div class="field"><label><input type="checkbox" id="${id}"> ${esc(f.label)}</label></div>`;
  else
    input = `<input id="${id}" type="${f.type || "text"}" value="${esc(f.type === "datetime-local" ? String(v).replace(" ", "T").slice(0, 16) : v)}" ${req} ${f.type === "number" ? 'step="any"' : ""}>`;
  return `<div class="field"><label for="${id}">${esc(f.label)}${f.required ? " *" : ""}</label>${input}</div>`;
}
async function openForm({
  title,
  fields,
  values = {},
  submit = "Save",
  creating = true,
  onSubmit,
}) {
  const use = fields.filter((f) => (creating ? !f.editOnly : !f.createOnly));
  $("formTitle").textContent = title;
  $("formBody").innerHTML = (
    await Promise.all(use.map((f) => fieldHtml(f, values[f.name])))
  ).join("");
  $("formSubmit").textContent = submit;
  formHandler = async () => {
    const data = {};
    for (const f of use) {
      if (f.type === "amenities") {
        data.amenity_ids = [
          ...document.querySelectorAll("#formBody input[name=amenity]:checked"),
        ].map((i) => Number(i.value));
        continue;
      }
      const el = $("f_" + f.name);
      const v = f.type === "checkbox" ? el.checked : el.value.trim();
      if (
        v === "" &&
        (f.skipEmpty || (!creating && values[f.name] === undefined))
      )
        continue;
      data[f.name] = v;
    }
    await onSubmit(data);
    closeModal("formModal");
  };
  openModal("formModal");
}
$("genericForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await formHandler();
  } catch (_) {

  }
});

function clearSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("vrent_token");
  localStorage.removeItem("vrent_user");
  clearRefs();
}
function showLogin() {
  $("appRoot").hidden = true;
  $("loginScreen").hidden = false;
  $("loginUser").focus();
}
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const d = await api("/auth/login", {
      method: "POST",
      body: {
        username: $("loginUser").value.trim(),
        password: $("loginPass").value,
      },
    });
    state.token = d.token;
    state.user = d.user;
    localStorage.setItem("vrent_token", d.token);
    localStorage.setItem("vrent_user", JSON.stringify(d.user));
    $("loginPass").value = "";
    notifySuccess(`Welcome, ${d.user.name}`);
    startApp();
  } catch (_) {
    
  }
});
$("logoutBtn").addEventListener("click", async () => {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (_) {
    
  }
  clearSession();
  showLogin();
});

async function startApp() {
  $("loginScreen").hidden = true;
  $("appRoot").hidden = false;
  const u = state.user;
  $("userName").textContent = u.name;
  $("userRole").textContent = `${u.role}`;
  $("userAvatar").textContent = u.name[0];
  $("addVehicleBtn").hidden = !isMgr();
  const branches = await api("/branches");
  const opts = branches
    .map((b) => `<option value="${b.branch_id}">${esc(b.branch_name)}</option>`)
    .join("");
  $("branchSelect").innerHTML = '<option value="">All branches</option>' + opts;
  $("fBranch").innerHTML = '<option value="">All branches</option>' + opts;
  state.branch = "";
  buildRecordSelect();
  showView("dashboard");
}

const sidebar = $("sidebar"),
  toggle = $("menuToggle");
const LOADERS = {
  dashboard: loadDashboard,
  vehicles: loadVehicles,
  rentals: loadRentals,
  overdue: loadOverdue,
  reports: loadReport,
  records: loadRecords,
};
function showView(name) {
  state.view = name;
  document
    .querySelectorAll(".view")
    .forEach((v) => (v.hidden = v.id !== `view-${name}`));
  document
    .querySelectorAll(".nav button")
    .forEach((b) =>
      b.dataset.view === name
        ? b.setAttribute("aria-current", "page")
        : b.removeAttribute("aria-current"),
    );
  sidebar.classList.remove("open");
  toggle.setAttribute("aria-expanded", "false");
  LOADERS[name]().catch(() => {});
}
document
  .querySelectorAll(".nav button")
  .forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
toggle.addEventListener("click", () => {
  const o = sidebar.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(o));
});
$("branchSelect").addEventListener("change", (e) => {
  state.branch = e.target.value;
  showView(state.view);
});
const reloadAll = () => {
  clearRefs();
  LOADERS[state.view]().catch(() => {});
};

async function loadDashboard() {
  const s = await api("/reports/dashboard" + qs({ branch_id: state.branch }));
  $("statVehicles").textContent = s.total_vehicles;
  $("statActive").textContent = s.active_rentals;
  $("statOverdue").textContent = s.overdue_rentals;
  $("statRevenue").textContent = peso(s.total_revenue);
  $("statLateFees").textContent = peso(s.unpaid_late_fees);
}
$("quickSearchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("quickSearch").value.trim();
  if (!q) return;
  const [veh, ren] = await Promise.all([
    api("/vehicles" + qs({ q, branch_id: state.branch })),
    api("/rentals" + qs({ q, branch_id: state.branch })),
  ]);
  $("searchResults").innerHTML =
    `<h2>Vehicles (${veh.length})</h2><div class="table-wrap inline-table"><table><tbody>${
      veh
        .map(
          (v) =>
            `<tr><td>${esc(v.plate_number)}</td><td>${esc(v.brand + " " + v.model)}</td><td>${badge(v.is_overdue ? "Overdue" : v.status)}</td><td>${btn("vdetail", v.vehicle_id, "Details")}</td></tr>`,
        )
        .join("") || '<tr><td class="empty">No vehicles</td></tr>'
    }</tbody></table></div>
    <h2>Rentals (${ren.length})</h2><div class="table-wrap"><table><tbody>${
      ren
        .map(
          (r) =>
            `<tr><td>#${r.rental_id}</td><td>${esc(r.customer_name)}</td><td>${esc(r.plate_number)}</td><td>${badge(r.status)}</td><td>${btn("rdetail", r.rental_id, "Details")}</td></tr>`,
        )
        .join("") || '<tr><td class="empty">No rentals</td></tr>'
    }</tbody></table></div>`;
});

const VEHICLE_FIELDS = [
  { name: "category_id", label: "Category", type: "ref", required: true },
  { name: "branch_id", label: "Branch", type: "ref", required: true },
  { name: "plate_number", label: "Plate number", required: true },
  { name: "brand", label: "Brand", required: true },
  { name: "model", label: "Model", required: true },
  { name: "year", label: "Year", type: "number", required: true },
  { name: "color", label: "Color", required: true },
  {
    name: "transmission",
    label: "Transmission",
    type: "select",
    options: ["Automatic", "Manual"],
    required: true,
  },
  {
    name: "fuel_type",
    label: "Fuel type",
    type: "select",
    options: ["Gasoline", "Diesel", "Electric", "Hybrid"],
    required: true,
  },
  { name: "seats", label: "Seats", type: "number", required: true },
  { name: "mileage", label: "Mileage", type: "number" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: ["Available", "Reserved", "Rented", "Maintenance", "Unavailable"],
    editOnly: true,
    required: true,
  },
  { name: "amenity_ids", label: "Amenities included", type: "amenities" },
];
const ICON = {
  Sedan: "\u{1F697}",
  SUV: "\u{1F699}",
  Van: "\u{1F690}",
  Pickup: "\u{1F6FB}",
  Motorcycle: "\u{1F3CD}\uFE0F",
};
let vehicleRows = [];
async function loadVehicles() {
  vehicleRows = await api(
    "/vehicles" +
      qs({
        q: $("fQ").value.trim(),
        branch_id: $("fBranch").value || state.branch,
        category: $("fCategory").value,
        transmission: $("fTransmission").value,
        status: $("fStatus").value,
      }),
  );
  $("vehicleGrid").innerHTML = vehicleRows.length
    ? vehicleRows
        .map(
          (v) => `
    <article class="card vehicle-card">
      ${VehicleArt.picture(v)}
      <h3>${esc(v.brand)} ${esc(v.model)} (${v.year})</h3>
      <div class="meta">${esc(v.plate_number)} \u2022 ${esc(v.category_name)} \u2022 ${esc(v.transmission)} \u2022 ${esc(v.branch_name)}</div>
      <div>${badge(v.is_overdue ? "Overdue" : v.status)} ${v.insurance_status !== "Valid" ? badge(v.insurance_status === "None" ? "No insurance" : "Insurance expired") : ""}</div>
      <div class="rate">${peso(v.daily_rate)} / day</div>
      <div class="row-actions">${btn("vdetail", v.vehicle_id, "View Details")}${isMgr() ? btn("vedit", v.vehicle_id, "Edit Vehicle") : ""}${v.status === "Available" ? btn("vrent", v.vehicle_id, "Create Rental", "btn") : ""}</div>
    </article>`,
        )
        .join("")
    : '<p class="empty">No vehicles match these filters.</p>';
}
["fQ", "fBranch", "fCategory", "fTransmission", "fStatus"].forEach((id) =>
  $(id).addEventListener(id === "fQ" ? "input" : "change", () =>
    loadVehicles().catch(() => {}),
  ),
);
$("addVehicleBtn").addEventListener("click", () =>
  openForm({
    title: "Add Vehicle",
    fields: VEHICLE_FIELDS,
    creating: true,
    onSubmit: async (d) => {
      const { amenity_ids, ...rest } = d;
      const v = await api("/vehicles", { method: "POST", body: rest });
      if (amenity_ids?.length)
        await api(`/vehicles/${v.vehicle_id}/amenities`, {
          method: "PUT",
          body: { amenity_ids },
        });
      notifySuccess("Vehicle added");
      reloadAll();
    },
  }),
);

async function vehicleDetails(id) {
  const v = await api("/vehicles/" + id);
  $("infoTitle").textContent = `${v.brand} ${v.model} - ${v.plate_number}`;
  $("infoBody").innerHTML = `<div class="kv">
      <div><small>Category</small>${esc(v.category_name)}</div><div><small>Branch</small>${esc(v.branch_name)}</div><div><small>Status</small>${badge(v.is_overdue ? "Overdue" : v.status)}</div>
      <div><small>Daily rate</small>${peso(v.daily_rate)}</div><div><small>Mileage</small>${Number(v.mileage).toLocaleString()} km</div><div><small>Insurance</small>${esc(v.insurance_status)}</div></div>
    <h2>Amenities</h2><div class="kv" style="margin-bottom:1rem">${v.amenities.map((a) => `<div style="display:flex;gap:.5rem;align-items:center">${VehicleArt.amenityIcon(a.amenity_name, 36)}<span>${esc(a.amenity_name)}</span></div>`).join("") || "<div>None</div>"}</div>
    <h2>Insurance</h2><div class="table-wrap inline-table"><table><thead><tr><th>Provider</th><th>Policy</th><th>Coverage</th><th>Valid</th></tr></thead><tbody>${v.insurance.map((i) => `<tr><td>${esc(i.provider)}</td><td>${esc(i.policy_number)}</td><td>${esc(i.coverage_type)}</td><td>${esc(i.start_date)} \u2192 ${esc(i.expiry_date)}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">No policy on file</td></tr>'}</tbody></table></div>
    <h2>Maintenance</h2><div class="table-wrap inline-table"><table><thead><tr><th>Service</th><th>Date</th><th>Cost</th><th>Status</th></tr></thead><tbody>${v.maintenance.map((m) => `<tr><td>${esc(m.service_type)}</td><td>${esc(m.service_date)}</td><td>${peso(m.cost)}</td><td>${badge(m.status)}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">None</td></tr>'}</tbody></table></div>
    <h2>Recent rentals</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Customer</th><th>Pickup</th><th>Due</th><th>Status</th></tr></thead><tbody>${v.recent_rentals.map((r) => `<tr><td>#${r.rental_id}</td><td>${esc(r.customer_name)}</td><td>${dt(r.rental_date)}</td><td>${dt(r.due_date)}</td><td>${badge(r.status)}</td></tr>`).join("") || '<tr><td colspan="5" class="empty">Never rented</td></tr>'}</tbody></table></div>`;
  openModal("infoModal");
}

async function loadRentals() {
  const rows = await api(
    "/rentals" +
      qs({
        q: $("rQ").value.trim(),
        status: $("rStatusFilter").value,
        branch_id: state.branch,
      }),
  );
  fillTable(
    $("rentalBody"),
    rows,
    [
      (r) => "#" + r.rental_id,
      (r) => esc(r.customer_name),
      (r) =>
        `${esc(r.plate_number)}<br><small class="muted">${esc(r.vehicle_name)}</small>`,
      (r) => dt(r.rental_date),
      (r) => dt(r.due_date),
      (r) => badge(r.status),
      (r) => peso(r.total_amount),
      (r) =>
        `<div class="row-actions">${btn("rdetail", r.rental_id, "Details")}${["Active", "Overdue"].includes(r.status) ? btn("rreturn", r.rental_id, "Return", "btn") : ""}${r.status === "Active" ? btn("rcancel", r.rental_id, "Cancel") : ""}</div>`,
    ],
    "No rentals found.",
  );
}
$("rQ").addEventListener("input", () => loadRentals().catch(() => {}));
$("rStatusFilter").addEventListener("change", () =>
  loadRentals().catch(() => {}),
);

async function rentalDetails(id) {
  const r = await api("/rentals/" + id);
  $("infoTitle").textContent = `Rental #${r.rental_id}`;
  $("infoBody").innerHTML = `<div class="kv">
      <div><small>Customer</small>${esc(r.customer_name)}</div><div><small>Vehicle</small>${esc(r.plate_number)} ${esc(r.vehicle_name)}</div><div><small>Status</small>${badge(r.status)}</div>
      <div><small>Pickup</small>${dt(r.rental_date)} (${esc(r.pickup_branch)})</div><div><small>Due</small>${dt(r.due_date)}</div><div><small>Returned</small>${dt(r.return_date)}</div>
      <div><small>Mileage</small>${r.start_mileage} \u2192 ${r.end_mileage ?? "\u2014"}</div><div><small>Total</small>${peso(r.total_amount)}</div><div><small>Booked via</small>${r.reservation_id ? "Reservation #" + r.reservation_id : "Walk-in"}</div></div>
    <div class="toolbar">${btn("addpay", id, "+ Add Payment", "btn")}${btn("adddamage", id, "Report Damage")}</div>
    <h2>Payments</h2><div class="table-wrap inline-table"><table><thead><tr><th>Date</th><th>Type</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>${r.payments.map((p) => `<tr><td>${dt(p.payment_date)}</td><td>${esc(p.payment_type)}</td><td>${esc(p.payment_method)}</td><td>${peso(p.amount)}</td><td>${badge(p.status)}</td></tr>`).join("") || '<tr><td colspan="5" class="empty">No payments</td></tr>'}</tbody></table></div>
    <h2>Late fees</h2><div class="table-wrap inline-table"><table><thead><tr><th>Days late</th><th>Fee</th><th>Computed</th><th>Status</th></tr></thead><tbody>${r.late_fees.map((l) => `<tr><td>${l.days_late}</td><td>${peso(l.fee_amount)}</td><td>${dt(l.computed_on)}</td><td>${badge(l.status)}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">None</td></tr>'}</tbody></table></div>
    <h2>Status history</h2><div class="table-wrap"><table><thead><tr><th>When</th><th>Change</th><th>Remarks</th></tr></thead><tbody>${r.history.map((h) => `<tr><td>${dt(h.changed_at)}</td><td>${esc(h.old_status || "\u2014")} \u2192 ${esc(h.new_status)}</td><td>${esc(h.remarks)}</td></tr>`).join("")}</tbody></table></div>`;
  openModal("infoModal");
}

let step = 1;
function showStep(n) {
  step = n;
  document
    .querySelectorAll("#rentalForm [data-step]")
    .forEach((d) => (d.hidden = Number(d.dataset.step) !== n));
  document
    .querySelectorAll(".steps li")
    .forEach((li, i) => li.classList.toggle("active", i + 1 === n));
  $("stepBack").disabled = n === 1;
  $("stepNext").textContent = n === 3 ? "Create Rental" : "Next";
}
async function openRental(vehicleId) {
  const [cust, veh, branches] = await Promise.all([
    getRef("customer_id"),
    api("/vehicles?status=Available"),
    getRef("branch_id"),
  ]);
  $("rCustomer").innerHTML =
    '<option value="">-- select customer --</option>' +
    cust
      .map(
        (c) =>
          `<option value="${c.customer_id}">${esc(c.first_name + " " + c.last_name)} (${esc(c.license_number)})</option>`,
      )
      .join("");
  $("rVehicle").innerHTML =
    '<option value="">-- select vehicle --</option>' +
    veh
      .map(
        (v) =>
          `<option value="${v.vehicle_id}" data-branch="${v.branch_id}" data-ins="${v.insurance_status}">${esc(v.plate_number)} - ${esc(v.brand + " " + v.model)} (${peso(v.daily_rate)}/day)</option>`,
      )
      .join("");
  $("rPickup").innerHTML = branches
    .map((b) => `<option value="${b.branch_id}">${esc(b.branch_name)}</option>`)
    .join("");
  $("rStart").value = nowLocal();
  $("rDue").value = nowLocal(1);
  $("rWarn").textContent = "";
  if (vehicleId) {
    $("rVehicle").value = vehicleId;
    onVehiclePick();
  }
  showStep(1);
  openModal("rentalModal");
}
function onVehiclePick() {
  const o = $("rVehicle").selectedOptions[0];
  if (o?.dataset.branch) $("rPickup").value = o.dataset.branch;
  $("rWarn").textContent =
    o && o.dataset.ins && o.dataset.ins !== "Valid"
      ? `Warning: this vehicle's insurance is ${o.dataset.ins === "None" ? "missing" : "expired"}. The rental will be rejected until it is renewed.`
      : "";
}
$("rVehicle").addEventListener("change", onVehiclePick);
async function loadQuote() {
  const q = await api(
    "/rentals/quote" +
      qs({
        vehicle_id: $("rVehicle").value,
        rental_date: $("rStart").value,
        due_date: $("rDue").value,
        rate_plan_id: $("rPlan").value,
      }),
  );
  $("rPlan").innerHTML = q.plans
    .map(
      (p) =>
        `<option value="${p.rate_plan_id}" ${p.rate_plan_id === q.selected_plan.rate_plan_id ? "selected" : ""}>${esc(p.plan_name)} - ${peso(p.rate_per_day)}/day</option>`,
    )
    .join("");
  $("rTotal").textContent =
    `${q.days} day(s) \u00D7 ${peso(q.rate_per_day)} = ${peso(q.total_amount)}`;
}
$("rPlan").addEventListener("change", () => loadQuote().catch(() => {}));
$("stepBack").addEventListener("click", () => showStep(Math.max(1, step - 1)));
$("stepNext").addEventListener("click", async () => {
  try {
    if (step === 1) {
      if (!$("rCustomer").value || !$("rVehicle").value)
        return notifyError("Select a customer and a vehicle");
      showStep(2);
    } else if (step === 2) {
      if (!$("rStart").value || !$("rDue").value)
        return notifyError("Enter the pickup and due dates");
      if ($("rDue").value <= $("rStart").value)
        return notifyError("Due date must be after the pickup date");
      $("rPlan").innerHTML = "";
      await loadQuote();
      showStep(3);
    } else {
      await api("/rentals", {
        method: "POST",
        body: {
          customer_id: $("rCustomer").value,
          vehicle_id: $("rVehicle").value,
          pickup_branch_id: $("rPickup").value,
          rental_date: $("rStart").value,
          due_date: $("rDue").value,
          rate_plan_id: $("rPlan").value,
        },
      });
      closeModal("rentalModal");
      notifySuccess("Rental created");
      reloadAll();
    }
  } catch (_) {
    
  }
});
["newRentalBtn", "newRentalBtn2"].forEach((id) =>
  $(id).addEventListener("click", () => openRental().catch(() => {})),
);

let returnId = null;
async function openReturn(id, payNow = false) {
  returnId = id;
  const [r, branches] = await Promise.all([
    api("/rentals/" + id),
    getRef("branch_id"),
  ]);
  $("returnTitle").textContent =
    `Return Vehicle - ${r.plate_number} (rental #${id})`;
  $("retDate").value = nowLocal();
  $("retMileage").value = r.start_mileage;
  $("retMileage").min = r.start_mileage;
  $("retBranch").innerHTML = branches
    .map(
      (b) =>
        `<option value="${b.branch_id}" ${b.branch_id === r.pickup_branch_id ? "selected" : ""}>${esc(b.branch_name)}</option>`,
    )
    .join("");
  $("retPay").checked = payNow;
  $("retRef").value = "";
  await previewReturn();
  openModal("returnModal");
}
async function previewReturn() {
  try {
    const p = await api(
      `/rentals/${returnId}/return-preview` +
        qs({ return_date: $("retDate").value }),
    );
    $("retSummary").textContent =
      p.days_late > 0
        ? `Late: ${p.days_late} day(s) \u00D7 ${peso(p.daily_rate)} = late fee ${peso(p.fee_amount)}`
        : "Returned on time - no late fee";
  } catch (_) {
    $("retSummary").textContent = "Could not compute the late fee";
  }
}
$("retDate").addEventListener("change", previewReturn);
$("returnForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const d = await api(`/rentals/${returnId}/return`, {
      method: "POST",
      body: {
        return_date: $("retDate").value,
        end_mileage: $("retMileage").value,
        return_branch_id: $("retBranch").value,
        pay_late_fee: $("retPay").checked,
        payment_method: $("retMethod").value,
        reference_number: $("retRef").value,
      },
    });
    closeModal("returnModal");
    notifySuccess(
      d.late_summary.days_late
        ? `Returned ${d.late_summary.days_late} day(s) late. Late fee ${peso(d.late_summary.fee_amount)} (${d.late_summary.fee?.status || "Unpaid"})`
        : "Vehicle returned on time",
    );
    reloadAll();
  } catch (_) {
    
  }
});

async function loadOverdue() {
  const [over, fees] = await Promise.all([
    api("/rentals/overdue" + qs({ branch_id: state.branch })),
    api("/rentals/late-fees" + qs({ branch_id: state.branch })),
  ]);
  const b = $("overdueBanner");
  b.hidden = false;
  b.className = "banner " + (over.length ? "banner-overdue" : "banner-ok");
  b.textContent = over.length
    ? `${over.length} rental(s) are past their due date. Estimated unpaid late fees: ${peso(over.reduce((s, r) => s + r.estimated_fee, 0))}`
    : "No overdue rentals right now.";
  $("feeCards").innerHTML = over
    .map(
      (r) => `
    <article class="card">
      <h2>${esc(r.plate_number)} - ${esc(r.vehicle_name)}</h2>
      <p>${esc(r.customer_name)} \u2022 due ${dt(r.due_date)}</p>
      <p>${r.days_late_live} day(s) late \u00D7 ${peso(r.late_fee_per_day)} = <span class="fee-amount">${peso(r.estimated_fee)}</span></p>
      <p class="muted">Recorded fee: ${r.late_fee_id ? `${peso(r.fee_amount)} (${esc(r.late_fee_status)})` : "not recorded yet"}</p>
      <div class="fee-actions">
        ${btn("applyfee", r.rental_id, "Apply Late Fee", "btn-warn")}${btn("returnpay", r.rental_id, "Process Return & Payment", "btn")}
        ${r.late_fee_id && r.late_fee_status === "Unpaid" ? btn("feepaid", r.late_fee_id, "Mark Paid") + (isMgr() ? btn("feewaive", r.late_fee_id, "Waive") : "") : ""}
      </div></article>`,
    )
    .join("");
  fillTable(
    $("feeBody"),
    fees,
    [
      (r) => "#" + r.late_fee_id,
      (r) => "#" + r.rental_id,
      (r) => esc(r.customer_name),
      (r) => esc(r.plate_number),
      (r) => r.days_late,
      (r) => peso(r.fee_amount),
      (r) => dt(r.computed_on),
      (r) => badge(r.status),
    ],
    "No late fees recorded.",
  );
}
$("runCheckBtn").addEventListener("click", async () => {
  try {
    const r = await api("/rentals/check-overdue", { method: "POST" });
    notifySuccess(
      `Overdue check done: ${r.rentals_past_due} past due, ${r.newly_overdue} newly overdue, ${r.fees_created} fee(s) created, ${r.fees_updated} updated`,
    );
    reloadAll();
  } catch (_) {
    
  }
});

const REPORTS = {
  active: [
    [
      "Active rentals - INNER JOIN (rentals + customers + vehicles + categories + branches)",
      "/reports/active-rentals",
    ],
    ["All rentals - INNER JOIN", "/reports/active-rentals?scope=all"],
  ],
  unlinked: [
    [
      "Vehicles without valid insurance - LEFT JOIN",
      "/reports/vehicles-without-insurance",
    ],
    [
      "Customers with no reservation/rental - LEFT JOIN",
      "/reports/customers-without-bookings",
    ],
    ["Vehicles never rented - RIGHT JOIN", "/reports/vehicles-never-rented"],
    ["Vehicle ratings - LEFT JOIN + AVG", "/reports/vehicle-ratings"],
  ],
  activity: [
    ["Activity stream - UNION ALL", "/reports/activity-stream"],
    [
      "Customer & vehicle activity - FULL OUTER JOIN (LEFT JOIN UNION RIGHT JOIN)",
      "/reports/customer-vehicle-activity",
    ],
    ["Amenity usage - JOIN + GROUP BY", "/reports/amenity-usage"],
  ],
};
let reportTab = "active";
function fillReportSub() {
  $("reportSub").innerHTML = REPORTS[reportTab]
    .map((r, i) => `<option value="${i}">${esc(r[0])}</option>`)
    .join("");
}
async function loadReport() {
  if (!$("reportSub").options.length) fillReportSub();
  const [, url] = REPORTS[reportTab][$("reportSub").value || 0];
  const rows = await api(
    url +
      (url.includes("?") ? "&" : "?") +
      (state.branch ? "branch_id=" + state.branch : ""),
  );
  genericTable($("reportHead"), $("reportBody"), rows);
  $("reportCount").textContent = `${rows.length} row(s)`;
}
document.querySelectorAll("#reportTabs [role=tab]").forEach((t) =>
  t.addEventListener("click", () => {
    reportTab = t.dataset.report;
    document
      .querySelectorAll("#reportTabs [role=tab]")
      .forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    fillReportSub();
    loadReport().catch(() => {});
  }),
);
$("reportSub").addEventListener("change", () => loadReport().catch(() => {}));

const PAY_METHODS = [
  "Cash",
  "GCash",
  "Credit Card",
  "Debit Card",
  "Bank Transfer",
];
const T = (name, label, extra = {}) => ({ name, label, ...extra });
const RECORDS = {
  customers: {
    label: "Customers",
    url: "/customers",
    pk: "customer_id",
    write: ALL,
    del: ALL,
    soft: "Blacklist",
    cols: [
      ["customer_id", "ID"],
      ["first_name", "First"],
      ["last_name", "Last"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["license_number", "License"],
      ["license_expiry_date", "License expiry"],
      ["status", "Status"],
    ],
    fields: [
      T("first_name", "First name", { required: true }),
      T("middle_name", "Middle name"),
      T("last_name", "Last name", { required: true }),
      T("birth_date", "Birth date", { type: "date", required: true }),
      T("gender", "Gender", {
        type: "select",
        options: ["Male", "Female", "Other"],
        required: true,
      }),
      T("email", "Email", { type: "email", required: true }),
      T("phone", "Phone", { required: true }),
      T("street", "Street", { required: true }),
      T("barangay", "Barangay", { required: true }),
      T("city", "City", { required: true }),
      T("province", "Province", { required: true }),
      T("postal_code", "Postal code", { required: true }),
      T("license_number", "License number", { required: true }),
      T("license_expiry_date", "License expiry", {
        type: "date",
        required: true,
      }),
      T("emergency_contact_name", "Emergency contact", { required: true }),
      T("emergency_contact_phone", "Emergency phone", { required: true }),
      T("status", "Status", {
        type: "select",
        options: ["Active", "Blacklisted"],
        editOnly: true,
        required: true,
      }),
    ],
  },
  reservations: {
    label: "Reservations",
    url: "/reservations",
    pk: "reservation_id",
    write: ALL,
    del: ALL,
    soft: "Cancel",
    special: true,
    cols: [
      ["reservation_id", "ID"],
      ["customer_name", "Customer"],
      ["plate_number", "Vehicle"],
      ["start_date", "Start"],
      ["end_date", "End"],
      ["status", "Status"],
      ["rental_id", "Rental"],
    ],
    fields: [
      T("customer_id", "Customer", { type: "ref", required: true }),
      T("vehicle_id", "Vehicle", { type: "ref", required: true }),
      T("start_date", "Start date", { type: "date", required: true }),
      T("end_date", "End date", { type: "date", required: true }),
    ],
  },
  payments: {
    label: "Payments",
    url: "/payments",
    pk: "payment_id",
    write: ALL,
    del: MGR,
    cols: [
      ["payment_id", "ID"],
      ["rental_id", "Rental"],
      ["payment_date", "Date"],
      ["payment_type", "Type"],
      ["payment_method", "Method"],
      ["amount", "Amount"],
      ["reference_number", "Reference"],
      ["status", "Status"],
    ],
    fields: [
      T("rental_id", "Rental", { type: "ref", required: true }),
      T("amount", "Amount", { type: "number", required: true }),
      T("payment_method", "Method", {
        type: "select",
        options: PAY_METHODS,
        required: true,
      }),
      T("payment_type", "Type", {
        type: "select",
        options: ["Deposit", "Rental Fee", "Late Fee", "Damage Fee", "Refund"],
        required: true,
      }),
      T("reference_number", "Reference number (non-cash)"),
      T("status", "Status", {
        type: "select",
        options: ["Paid", "Pending", "Refunded", "Failed"],
        editOnly: true,
        required: true,
      }),
    ],
  },
  damage_reports: {
    label: "Damage reports",
    url: "/damage-reports",
    pk: "damage_id",
    write: ALL,
    del: MGR,
    cols: [
      ["damage_id", "ID"],
      ["rental_id", "Rental"],
      ["plate_number", "Vehicle"],
      ["description", "Description"],
      ["severity", "Severity"],
      ["repair_cost", "Repair cost"],
      ["reported_date", "Reported"],
      ["status", "Status"],
    ],
    fields: [
      T("rental_id", "Rental", {
        type: "ref",
        required: true,
        createOnly: true,
      }),
      T("description", "Description", { type: "textarea", required: true }),
      T("severity", "Severity", {
        type: "select",
        options: ["Minor", "Moderate", "Major"],
        required: true,
      }),
      T("repair_cost", "Repair cost", { type: "number" }),
      T("status", "Status", {
        type: "select",
        options: ["Reported", "Under Repair", "Resolved"],
        required: true,
        editOnly: true,
      }),
      T(
        "charge_customer",
        "Charge repair cost to the customer (Damage Fee payment)",
        { type: "checkbox", createOnly: true },
      ),
    ],
  },
  branches: {
    label: "Branches",
    url: "/branches",
    pk: "branch_id",
    write: MGR,
    del: MGR,
    cols: [
      ["branch_id", "ID"],
      ["branch_name", "Name"],
      ["address", "Address"],
      ["city", "City"],
      ["phone", "Phone"],
      ["opening_hours", "Hours"],
    ],
    fields: [
      T("branch_name", "Branch name", { required: true }),
      T("address", "Address", { required: true }),
      T("city", "City", { required: true }),
      T("phone", "Phone", { required: true }),
      T("opening_hours", "Opening hours"),
    ],
  },
  categories: {
    label: "Vehicle categories",
    url: "/categories",
    pk: "category_id",
    write: MGR,
    del: MGR,
    cols: [
      ["category_id", "ID"],
      ["category_name", "Name"],
      ["description", "Description"],
      ["seating_capacity", "Seats"],
    ],
    fields: [
      T("category_name", "Name", { required: true }),
      T("description", "Description"),
      T("seating_capacity", "Seating capacity", {
        type: "number",
        required: true,
      }),
    ],
  },
  rate_plans: {
    label: "Rate plans",
    url: "/rate-plans",
    pk: "rate_plan_id",
    write: MGR,
    del: MGR,
    cols: [
      ["rate_plan_id", "ID"],
      ["category_name", "Category"],
      ["plan_name", "Plan"],
      ["rate_per_day", "Rate / day"],
      ["min_days", "Min days"],
      ["max_days", "Max days"],
      ["season_start", "Season start"],
      ["season_end", "Season end"],
    ],
    fields: [
      T("category_id", "Category", { type: "ref", required: true }),
      T("plan_name", "Plan name", { required: true }),
      T("rate_per_day", "Rate per day", { type: "number", required: true }),
      T("min_days", "Min days", { type: "number" }),
      T("max_days", "Max days", { type: "number" }),
      T("season_start", "Season start", { type: "date" }),
      T("season_end", "Season end", { type: "date" }),
    ],
  },
  insurance: {
    label: "Insurance",
    url: "/insurance",
    pk: "insurance_id",
    write: MGR,
    del: MGR,
    cols: [
      ["insurance_id", "ID"],
      ["plate_number", "Vehicle"],
      ["provider", "Provider"],
      ["policy_number", "Policy"],
      ["coverage_type", "Coverage"],
      ["coverage_amount", "Amount"],
      ["expiry_date", "Expiry"],
      ["policy_status", "Status"],
    ],
    fields: [
      T("vehicle_id", "Vehicle", { type: "ref", required: true }),
      T("provider", "Provider", { required: true }),
      T("policy_number", "Policy number", { required: true }),
      T("coverage_type", "Coverage type", {
        type: "select",
        options: ["Comprehensive", "Third-Party", "Collision"],
        required: true,
      }),
      T("coverage_amount", "Coverage amount", {
        type: "number",
        required: true,
      }),
      T("start_date", "Start date", { type: "date", required: true }),
      T("expiry_date", "Expiry date", { type: "date", required: true }),
    ],
  },
  maintenance: {
    label: "Maintenance",
    url: "/maintenance",
    pk: "maintenance_id",
    write: MGR,
    del: MGR,
    cols: [
      ["maintenance_id", "ID"],
      ["plate_number", "Vehicle"],
      ["service_type", "Service"],
      ["service_date", "Date"],
      ["next_service_date", "Next"],
      ["cost", "Cost"],
      ["status", "Status"],
    ],
    fields: [
      T("vehicle_id", "Vehicle", { type: "ref", required: true }),
      T("service_type", "Service type", { required: true }),
      T("description", "Description", { type: "textarea" }),
      T("service_date", "Service date", { type: "date", required: true }),
      T("next_service_date", "Next service date", { type: "date" }),
      T("next_service_mileage", "Next service mileage", { type: "number" }),
      T("cost", "Cost", { type: "number" }),
      T("status", "Status", {
        type: "select",
        options: ["Scheduled", "In Progress", "Completed"],
        required: true,
      }),
    ],
  },
  amenities: {
    label: "Vehicle amenities",
    url: "/amenities",
    pk: "amenity_id",
    write: MGR,
    del: MGR,
    cols: [
      ["amenity_id", "ID"],
      ["amenity_name", "Amenity"],
      ["description", "Description"],
      ["vehicle_count", "Vehicles"],
    ],
    fields: [
      T("amenity_name", "Amenity name", { required: true }),
      T("description", "Description"),
    ],
  },
  ratings: {
    label: "Vehicle ratings",
    url: "/ratings",
    pk: "rating_id",
    write: MGR,
    del: MGR,
    noAdd: true,
    editFields: ["rating", "review"],
    cols: [
      ["rating_id", "ID"],
      ["vehicle_name", "Vehicle"],
      ["customer_name", "Customer"],
      ["rating", "Stars"],
      ["review", "Review"],
      ["rated_at", "Rated"],
    ],
    fields: [
      T("rating", "Stars (1-5)", { type: "number", required: true }),
      T("review", "Review", { type: "textarea" }),
    ],
  },
  history: {
    label: "Rental status history (read-only)",
    url: "/rental-history",
    pk: "history_id",
    ro: true,
    read: MGR,
    cols: [
      ["history_id", "ID"],
      ["rental_id", "Rental"],
      ["old_status", "From"],
      ["new_status", "To"],
      ["changed_at", "When"],
      ["remarks", "Remarks"],
    ],
  },
};
function buildRecordSelect() {
  $("recSelect").innerHTML = Object.keys(RECORDS)
    .map((k) => `<option value="${k}">${esc(RECORDS[k].label)}</option>`)
    .join("");
}
let recRows = [];
async function loadRecords() {
  const r = RECORDS[$("recSelect").value];
  if (!r) return;
  recRows = await api(r.url);
  const canWrite = !r.ro && r.write.includes(state.user.role),
    canDel = !r.ro && r.del.includes(state.user.role);
  $("recAddBtn").hidden = !canWrite || !!r.noAdd;
  $("recHead").innerHTML =
    `<tr>${r.cols.map((c) => `<th>${esc(c[1])}</th>`).join("")}${r.ro ? "" : "<th>Actions</th>"}</tr>`;
  const cols = r.cols.map((c) => (row) => cell(c[0], row[c[0]]));
  if (!r.ro)
    cols.push((row) => {
      const id = row[r.pk];
      let a = "";
      if (r.special) {
        if (row.status === "Pending")
          a += btn("resv", id, "Confirm", "btn", 'data-status="Confirmed"');
        if (row.status === "Confirmed")
          a +=
            btn("resconvert", id, "Convert to Rental", "btn") +
            btn("resv", id, "No-Show", "btn-outline", 'data-status="No-Show"');
        if (["Pending", "Confirmed"].includes(row.status))
          a += btn(
            "resv",
            id,
            "Cancel",
            "btn-outline",
            'data-status="Cancelled"',
          );
      } else {
        if (canWrite) a += btn("recedit", id, "Edit");
        if (canDel) a += btn("recdel", id, r.soft || "Delete");
      }
      return `<div class="row-actions">${a}</div>`;
    });
  fillTable($("recBody"), recRows, cols, "No records.");
}
$("recSelect").addEventListener("change", () => loadRecords().catch(() => {}));
$("recAddBtn").addEventListener("click", () => {
  const r = RECORDS[$("recSelect").value];
  openForm({
    title: `Add - ${r.label}`,
    fields: r.fields,
    creating: true,
    onSubmit: async (d) => {
      await api(r.url, { method: "POST", body: d });
      notifySuccess("Saved");
      reloadAll();
    },
  }).catch(() => {});
});

const actions = {
  vdetail: (id) => vehicleDetails(id),
  rdetail: (id) => rentalDetails(id),
  vedit: async (id) => {
    const v = vehicleRows.find((x) => x.vehicle_id == id),
      am = await api(`/vehicles/${id}/amenities`);
    openForm({
      title: `Edit ${v.plate_number}`,
      fields: VEHICLE_FIELDS,
      values: { ...v, amenity_ids: am.map((a) => a.amenity_id) },
      creating: false,
      onSubmit: async (d) => {
        const { amenity_ids, ...rest } = d;
        await api("/vehicles/" + id, { method: "PUT", body: rest });
        if (amenity_ids)
          await api(`/vehicles/${id}/amenities`, {
            method: "PUT",
            body: { amenity_ids },
          });
        notifySuccess("Vehicle updated");
        reloadAll();
      },
    });
  },
  vrent: (id) => openRental(id),
  rreturn: (id) => openReturn(id),
  returnpay: (id) => openReturn(id, true),
  rcancel: async (id) => {
    if (confirm(`Cancel rental #${id}?`)) {
      await api("/rentals/" + id, { method: "DELETE" });
      notifySuccess("Rental cancelled");
      reloadAll();
    }
  },
  applyfee: async (id) => {
    const r = await api(`/rentals/${id}/apply-late-fee`, { method: "POST" });
    notifySuccess(
      `Late fee ${r.fee_action}: ${peso(r.fee_amount)} for ${r.days_late} day(s)`,
    );
    reloadAll();
  },
  feepaid: async (id) => {
    await api("/rentals/late-fees/" + id, {
      method: "PATCH",
      body: { status: "Paid", payment_method: "Cash" },
    });
    notifySuccess("Late fee marked Paid (payment recorded)");
    reloadAll();
  },
  feewaive: async (id) => {
    if (confirm("Waive this late fee?")) {
      await api("/rentals/late-fees/" + id, {
        method: "PATCH",
        body: { status: "Waived" },
      });
      notifySuccess("Late fee waived");
      reloadAll();
    }
  },
  addpay: (id) =>
    openForm({
      title: `Add payment - rental #${id}`,
      fields: RECORDS.payments.fields.filter((f) => f.name !== "rental_id"),
      creating: true,
      onSubmit: async (d) => {
        await api("/payments", {
          method: "POST",
          body: { ...d, rental_id: id },
        });
        notifySuccess("Payment recorded");
        rentalDetails(id);
      },
    }),
  adddamage: (id) =>
    openForm({
      title: `Report damage - rental #${id}`,
      fields: RECORDS.damage_reports.fields.filter(
        (f) => f.name !== "rental_id",
      ),
      creating: true,
      onSubmit: async (d) => {
        await api("/damage-reports", {
          method: "POST",
          body: { ...d, rental_id: id },
        });
        notifySuccess("Damage report saved");
        rentalDetails(id);
      },
    }),
  recedit: (id) => {
    const r = RECORDS[$("recSelect").value],
      row = recRows.find((x) => x[r.pk] == id);
    openForm({
      title: `Edit - ${r.label} #${id}`,
      fields: r.fields,
      values: row,
      creating: false,
      onSubmit: async (d) => {
        await api(`${r.url}/${id}`, { method: "PUT", body: d });
        notifySuccess("Updated");
        reloadAll();
      },
    });
  },
  recdel: async (id) => {
    const r = RECORDS[$("recSelect").value];
    if (confirm(`${r.soft || "Delete"} record #${id}?`)) {
      const d = await api(`${r.url}/${id}`, { method: "DELETE" });
      notifySuccess(d.message);
      reloadAll();
    }
  },
  resv: async (id, el) => {
    await api(`/reservations/${id}/status`, {
      method: "PATCH",
      body: { status: el.dataset.status },
    });
    notifySuccess("Reservation updated");
    reloadAll();
  },
  resconvert: async (id) => {
    const r = recRows.find((x) => x.reservation_id == id);
    openForm({
      title: `Convert reservation #${id} to a rental`,
      creating: true,
      values: {
        rental_date: `${r.start_date}T09:00`,
        due_date: `${r.end_date}T09:00`,
      },
      fields: [
        T("rental_date", "Pickup date & time", {
          type: "datetime-local",
          required: true,
        }),
        T("due_date", "Due date & time", {
          type: "datetime-local",
          required: true,
        }),
      ],
      onSubmit: async (d) => {
        const x = await api(`/reservations/${id}/convert`, {
          method: "POST",
          body: d,
        });
        notifySuccess(
          `Rental #${x.rental_id} created, total ${peso(x.total_amount)}`,
        );
        reloadAll();
      },
    });
  },
};
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || !actions[el.dataset.act]) return;
  Promise.resolve(actions[el.dataset.act](el.dataset.id, el)).catch(() => {});
});
$("newReservationBtn").addEventListener("click", () =>
  openForm({
    title: "Add - Reservations",
    fields: RECORDS.reservations.fields,
    creating: true,
    onSubmit: async (d) => {
      await api("/reservations", { method: "POST", body: d });
      notifySuccess("Reservation created");
      reloadAll();
    },
  }).catch(() => {}),
);

if (state.token && state.user)
  startApp().catch(() => {
    clearSession();
    showLogin();
  });
else showLogin();
