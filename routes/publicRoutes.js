const express = require('express');
const m = require('../models/publicModel');
const { asyncHandler, ok } = require('../utils/helpers');

const r = express.Router();

r.get('/vehicles', asyncHandler(async (req, res) => {
  return ok(res, await m.vehicles(req.query));
}));

r.get('/amenities', asyncHandler(async (req, res) => {
  return ok(res, await m.amenities());
}));

r.get('/vehicles/:id/reviews', asyncHandler(async (req, res) => {
  return ok(res, await m.reviews(Number(req.params.id)));
}));

r.get('/branches', asyncHandler(async (req, res) => {
  return ok(res, await m.branches());
}));

r.get('/categories', asyncHandler(async (req, res) => {
  return ok(res, await m.categories());
}));

r.get('/summary', asyncHandler(async (req, res) => {
  return ok(res, await m.summary());
}));

r.get('/quote', asyncHandler(async (req, res) => {
  return ok(res, await m.quote(req.query));
}));

r.get('/availability', asyncHandler(async (req, res) => {
  return ok(res, {
    bookable: await m.isBookable(
      Number(req.query.vehicle_id),
      req.query.start_date,
      req.query.end_date
    )
  });
}));

module.exports = r;