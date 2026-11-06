const { asyncHandler, ok, toInt } = require('../utils/helpers');

function createCrudController(model) {
  return {
    list:   asyncHandler(async (req, res) => ok(res, await model.list(req.query))),
    get:    asyncHandler(async (req, res) => ok(res, await model.get(toInt(req.params.id, 'id')))),
    create: asyncHandler(async (req, res) => ok(res, await model.create(req.body || {}, req.user), 201)),
    update: asyncHandler(async (req, res) => ok(res, await model.update(toInt(req.params.id, 'id'), req.body || {}, req.user))),
    remove: asyncHandler(async (req, res) => ok(res, await model.remove(toInt(req.params.id, 'id'), req.user)))
  };
}
module.exports = createCrudController;
