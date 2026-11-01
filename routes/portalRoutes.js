const express = require("express");
const m = require("../models/portalModel");
const {
  signCustomerToken,
  authenticateCustomer,
  revoked,
} = require("../middleware/auth");
const { asyncHandler, ok } = require("../utils/helpers");
const r = express.Router();

const hits = new Map();
function limiter(req, res, next) {
  const k = req.ip,
    now = Date.now(),
    list = (hits.get(k) || []).filter((t) => now - t < 600000);
  if (list.length >= 15)
    return res
      .status(429)
      .json({
        success: false,
        error: "Too many attempts. Please wait a few minutes and try again.",
      });
  list.push(now);
  hits.set(k, list);
  next();
}
const session = (c) => ({
  token: signCustomerToken(c),
  customer: {
    customer_id: c.customer_id,
    name: `${c.first_name} ${c.last_name}`,
    email: c.email,
  },
});

r.post(
  "/signup",
  limiter,
  asyncHandler(async (req, res) => {
    const c = await m.signup(req.body || {});
    ok(res, session(c), 201);
  }),
);
r.post(
  "/login",
  limiter,
  asyncHandler(async (req, res) => {
    const c = await m.login((req.body || {}).email, (req.body || {}).password);
    ok(res, session(c));
  }),
);

r.post(
  "/forgot-password",
  limiter,
  asyncHandler(async (req, res) =>
    ok(res, await m.forgotPassword((req.body || {}).email)),
  ),
);
r.post(
  "/reset-password",
  limiter,
  asyncHandler(async (req, res) =>
    ok(
      res,
      await m.resetPassword((req.body || {}).token, (req.body || {}).password),
    ),
  ),
);

r.use(authenticateCustomer);
r.post("/logout", (req, res) => {
  revoked.add(req.customer.jti);
  ok(res, { message: "Logged out" });
});
r.get(
  "/me",
  asyncHandler(async (req, res) => ok(res, await m.me(req.customer.cid))),
);
r.put(
  "/me",
  asyncHandler(async (req, res) =>
    ok(res, await m.updateMe(req.customer.cid, req.body || {})),
  ),
);
r.get(
  "/reservations",
  asyncHandler(async (req, res) =>
    ok(res, await m.myReservations(req.customer.cid)),
  ),
);
r.post(
  "/reservations",
  asyncHandler(async (req, res) =>
    ok(res, await m.createReservation(req.customer.cid, req.body || {}), 201),
  ),
);
r.delete(
  "/reservations/:id",
  asyncHandler(async (req, res) =>
    ok(res, await m.cancelReservation(req.customer.cid, Number(req.params.id))),
  ),
);
r.get(
  "/rentals",
  asyncHandler(async (req, res) =>
    ok(res, await m.myRentals(req.customer.cid)),
  ),
);
r.put(
  "/password",
  asyncHandler(async (req, res) =>
    ok(
      res,
      await m.changePassword(
        req.customer.cid,
        (req.body || {}).current_password,
        (req.body || {}).new_password,
      ),
    ),
  ),
);
r.get(
  "/ratings",
  asyncHandler(async (req, res) =>
    ok(res, await m.myRatings(req.customer.cid)),
  ),
);
r.put(
  "/ratings/:vehicleId",
  asyncHandler(async (req, res) =>
    ok(
      res,
      await m.rateVehicle(
        req.customer.cid,
        Number(req.params.vehicleId),
        req.body || {},
      ),
    ),
  ),
);
r.delete(
  "/ratings/:vehicleId",
  asyncHandler(async (req, res) =>
    ok(
      res,
      await m.deleteRating(req.customer.cid, Number(req.params.vehicleId)),
    ),
  ),
);
module.exports = r;
