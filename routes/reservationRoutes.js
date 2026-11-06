const express = require('express');
const c = require('../controllers/reservationController');
const { allow, ROLES } = require('../middleware/auth');

const r = express.Router();
const all = allow(...ROLES.ALL);

r.get('/', all, c.list);

r.post('/', all, c.create);

r.get('/:id', all, c.get);

r.put('/:id', all, c.update);
r.patch('/:id', all, c.update);

r.patch('/:id/status', all, c.setStatus);

r.post('/:id/convert', all, c.convert);

r.delete('/:id', all, c.remove);

module.exports = r;