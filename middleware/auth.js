const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DEMO_MODE = process.env.DEMO_MODE === 'true';

const revoked = new Set();

const ROLES = {
  ALL: ['Admin'],
  MGR: ['Admin'],
  ADMIN: ['Admin']
};

const sha = v =>
  crypto.createHash('sha256').update(String(v)).digest();

function isLocalRequest(req) {
  const ip = req.ip || req.socket.remoteAddress || '';

  return [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1'
  ].includes(ip);
}

function checkAdminLogin(username, password) {
  const u = process.env.ADMIN_USERNAME || 'admin';
  const p = process.env.ADMIN_PASSWORD || 'admin123';

  return (
    crypto.timingSafeEqual(sha(username), sha(u)) &
    crypto.timingSafeEqual(sha(password), sha(p))
  );
}

const signToken = () =>
  jwt.sign(
    {
      kind: 'admin',
      name: 'Administrator',
      role: 'Admin'
    },
    SECRET,
    {
      expiresIn: '8h',
      jwtid: crypto.randomUUID()
    }
  );

function verify(req, res, kind, messages) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (!token) {
    res.status(401).json({
      success: false,
      error: messages[0]
    });
    return null;
  }

  try {
    const payload = jwt.verify(token, SECRET);

    if (revoked.has(payload.jti) || payload.kind !== kind) {
      throw new Error('Invalid token');
    }

    return payload;
  } catch (e) {
    res.status(401).json({
      success: false,
      error: messages[1]
    });
    return null;
  }
}

// Administrator authentication
function authenticate(req, res, next) {
  if (DEMO_MODE && isLocalRequest(req)) {
    req.user = {
      kind: 'admin',
      name: 'Demo Administrator',
      role: 'Admin'
    };

    return next();
  }

  const p = verify(req, res, 'admin', [
    'Admin login required.',
    'Session expired or invalid. Please log in again.'
  ]);

  if (p) {
    req.user = p;
    next();
  }
}

// Role authorization
const allow = (...roles) => (req, res, next) => {
  if (DEMO_MODE && isLocalRequest(req)) {
    return next();
  }

  if (req.user && roles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Not allowed.'
  });
};

// Customer authentication
const signCustomerToken = c =>
  jwt.sign(
    {
      kind: 'customer',
      cid: c.customer_id,
      name: `${c.first_name} ${c.last_name}`
    },
    SECRET,
    {
      expiresIn: '7d',
      jwtid: crypto.randomUUID()
    }
  );

function authenticateCustomer(req, res, next) {
  const p = verify(req, res, 'customer', [
    'Please log in to continue.',
    'Your session expired. Please log in again.'
  ]);

  if (p) {
    req.customer = p;
    next();
  }
}

module.exports = {
  signToken,
  checkAdminLogin,
  authenticate,
  allow,
  revoked,
  ROLES,
  signCustomerToken,
  authenticateCustomer
};
