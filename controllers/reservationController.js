const model = require('../models/reservationModel');
const { asyncHandler, ok, toInt } = require('../utils/helpers');
const id = req => toInt(req.params.id, 'id');
module.exports = {
  list: asyncHandler(async (req, res) => ok(res, await model.list(req.query))),
  get: asyncHandler(async (req, res) => ok(res, await model.get(id(req)))),
  create: asyncHandler(async (req, res) => ok(res, await model.create(req.body || {}, req.user), 201)),
  update: asyncHandler(async (req, res) => ok(res, await model.update(id(req), req.body || {}, req.user))),
  setStatus: asyncHandler(async (req, res) => ok(res, await model.setStatus(id(req), (req.body || {}).status, req.user))),
  remove: asyncHandler(async (req, res) => ok(res, await model.remove(id(req), req.user))),
  convert: asyncHandler(async (req, res) => ok(res, await model.convert(id(req), req.body || {}, req.user), 201))
};
