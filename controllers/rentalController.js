const model = require('../models/rentalModel');
const { asyncHandler, ok, toInt } = require('../utils/helpers');
const id = req => toInt(req.params.id, 'id');

module.exports = {
  list: asyncHandler(async (req, res) => ok(res, await model.list(req.query))),
  get: asyncHandler(async (req, res) => ok(res, await model.get(id(req)))),
  create: asyncHandler(async (req, res) => ok(res, await model.create(req.body || {}, req.user), 201)),
  update: asyncHandler(async (req, res) => ok(res, await model.update(id(req), req.body || {}, req.user))),
  cancel: asyncHandler(async (req, res) => ok(res, await model.cancel(id(req), req.user))),
  quote: asyncHandler(async (req, res) => ok(res, await model.quote(req.query))),
  returnPreview: asyncHandler(async (req, res) => ok(res, await model.returnPreview(id(req), req.query))),
  processReturn: asyncHandler(async (req, res) => ok(res, await model.processReturn(id(req), req.body || {}, req.user))),
  checkOverdue: asyncHandler(async (req, res) => ok(res, await model.runOverdueCheck(req.user.id))),
  applyLateFee: asyncHandler(async (req, res) => ok(res, await model.applyLateFee(id(req), req.user))),
  listOverdue: asyncHandler(async (req, res) => ok(res, await model.listOverdue(req.query))),
  listLateFees: asyncHandler(async (req, res) => ok(res, await model.listLateFees(req.query))),
  setLateFeeStatus: asyncHandler(async (req, res) => ok(res, await model.setLateFeeStatus(id(req), req.body || {}, req.user)))
};
