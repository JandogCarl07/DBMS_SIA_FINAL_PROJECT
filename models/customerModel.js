
const createCrudModel = require('./crudModel');
const resources = require('../config/resources');
module.exports = createCrudModel(resources.customers);
