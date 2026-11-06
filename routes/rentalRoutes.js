const express = require('express');
const c = require('../controllers/rentalController');
const { allow, ROLES } = require('../middleware/auth');

const r = express.Router();

const all = allow(...ROLES.ALL);
const mgr = allow(...ROLES.MGR);

r.get('/quote', all, c.quote);

r.get('/overdue', all, c.listOverdue);

r.get('/late-fees', all, c.listLateFees);

r.patch(
  '/late-fees/:id',
  (req, res, next) =>
    req.body?.status === 'Waived'
      ? mgr(req, res, next)
      : all(req, res, next),
  c.setLateFeeStatus
);

r.post('/check-overdue', all, c.checkOverdue);

r.get('/', all, c.list);

r.post('/', all, c.create);

r.get('/:id', all, c.get);

r.put('/:id', all, c.update);
r.patch('/:id', all, c.update);

r.delete('/:id', all, c.cancel);

r.get('/:id/return-preview', all, c.returnPreview);

r.post('/:id/return', all, c.processReturn);

r.post('/:id/apply-late-fee', all, c.applyLateFee);

module.exports = r;