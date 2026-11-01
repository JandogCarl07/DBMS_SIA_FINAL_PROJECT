const express = require('express');
const { allow, ROLES } = require('../middleware/auth');

function createCrudRouter(ctrl, cfg) {
  const r = express.Router();
  const roles = cfg.roles || { read: ROLES.ALL, write: ROLES.MGR, delete: ROLES.MGR };
  if (cfg.parent) r.get(cfg.parent.path, allow(...roles.read), (req, res, next) => 
    { req.query[cfg.parent.col] = req.params.parentId; ctrl.list(req, res, next); });
  r.get('/', allow(...roles.read), ctrl.list);
  r.get('/:id', allow(...roles.read), ctrl.get);
  if (!cfg.readOnly) {
    r.post('/', allow(...roles.write), ctrl.create);
    r.put('/:id', allow(...roles.write), ctrl.update);
    r.patch('/:id', allow(...roles.write), ctrl.update);
    r.delete('/:id', allow(...roles.delete), ctrl.remove);
  }
  return r;
}
module.exports = createCrudRouter;
