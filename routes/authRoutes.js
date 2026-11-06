const express = require('express');
const { signToken, checkAdminLogin, authenticate, revoked } = require('../middleware/auth');
const { asyncHandler, ok, HttpError } = require('../utils/helpers');
const r = express.Router();

const hits = new Map();  
r.post('/login', asyncHandler(async (req, res) => {
  const now = Date.now(), list = (hits.get(req.ip) || []).filter(t => now - t < 600000);
  if (list.length >= 10) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');
  const { username, password } = req.body || {};
  if (!username || !password) throw new HttpError(400, 'Username and password are required');
  if (!checkAdminLogin(username, password)) { list.push(now); hits.set(req.ip, list); throw new HttpError
    (401, 'Invalid username or password'); }
  ok(res, { token: signToken(), user: { name: 'Administrator', role: 'Admin' } });
}));
r.get('/me', authenticate, (req, res) => ok(res, { name: req.user.name, role: req.user.role }));
r.post('/logout', authenticate, (req, res) => { revoked.add(req.user.jti); ok(res, { message: 'Logged out' }); });
module.exports = r;
