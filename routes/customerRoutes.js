const createCrudRouter = require('./crudRoutes');

module.exports = createCrudRouter(
  require('../controllers/customerController'),
  require('../config/resources').customers
);