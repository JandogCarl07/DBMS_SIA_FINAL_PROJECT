const express = require('express');
const createCrudRouter = require('./crudRoutes');
const model = require('../models/vehicleModel');
const { asyncHandler, ok, toInt } = require('../utils/helpers');
const { allow, ROLES } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/:id/amenities',
  allow(...ROLES.ALL),
  asyncHandler(async (req, res) => {
    return ok(
      res,
      await model.getAmenities(toInt(req.params.id, 'id'))
    );
  })
);

router.put(
  '/:id/amenities',
  allow(...ROLES.MGR),
  asyncHandler(async (req, res) => {
    return ok(
      res,
      await model.setAmenities(
        toInt(req.params.id, 'id'),
        (req.body || {}).amenity_ids
      )
    );
  })
);

router.use(
  createCrudRouter(
    require('../controllers/vehicleController'),
    require('../config/resources').vehicles
  )
);

module.exports = router;