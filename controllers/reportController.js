const m = require('../models/reportModel');
const { asyncHandler, ok } = require('../utils/helpers');
const h = fn => asyncHandler(async (req, res) => ok(res, await fn(req.query)));
module.exports = {
  activeRentals: h(m.activeRentals), vehiclesWithoutInsurance: h(m.vehiclesWithoutInsurance), customersWithoutBookings: h(m.customersWithoutBookings),
  vehiclesNeverRented: h(m.vehiclesNeverRented), customerVehicleActivity: h(m.customerVehicleActivity), activityStream: h(m.activityStream), amenityUsage: h(m.amenityUsage), vehicleRatings: h(m.vehicleRatings), dashboard: h(m.dashboard)
};
