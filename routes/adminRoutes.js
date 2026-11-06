const express = require('express');
const router = express.Router();

router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Admin authentication required.'
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      name: req.user.name,
      role: req.user.role,
      kind: req.user.kind
    }
  });
});

router.get('/status', (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      status: 'Admin API is working'
    }
  });
});

module.exports = router;