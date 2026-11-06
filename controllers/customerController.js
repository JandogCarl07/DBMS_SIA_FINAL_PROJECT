const createCrudController = require('./crudController');
module.exports = createCrudController(require('../models/customerModel'));
