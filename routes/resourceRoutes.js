const resources = require('../config/resources');
const createCrudModel = require('../models/crudModel');
const createCrudController = require('../controllers/crudController');
const createCrudRouter = require('./crudRoutes');

const names = ['payments', 'branches', 'vehicle_categories', 'rate_plans', 'insurance', 'maintenance_records',
  'damage_reports', 'vehicle_amenities', 'vehicle_ratings', 'rental_status_history'];
const routers = {};
for (const n of names) routers[n] = createCrudRouter(createCrudController(createCrudModel(resources[n])), resources[n]);
module.exports = routers;
