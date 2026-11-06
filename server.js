require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const { testConnection } = require('./config/db');
const { authenticate } = require('./middleware/auth');
const rentalModel = require('./models/rentalModel');
const resourceRoutes = require('./routes/resourceRoutes');

const app = express();

const PORT = process.env.PORT || 3000;
const DEMO_MODE = process.env.DEMO_MODE === 'true';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'ok' }
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/portal', require('./routes/portalRoutes'));

app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

app.use('/api', (req, res, next) => {
  if (DEMO_MODE) {
    req.user = {
      kind: 'admin',
      name: 'Demo Administrator',
      role: 'Admin'
    };

    return next();
  }

  authenticate(req, res, next);
});

app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/reservations', require('./routes/reservationRoutes'));
app.use('/api/rentals', require('./routes/rentalRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/branches', resourceRoutes.branches);
app.use('/api/categories', resourceRoutes.vehicle_categories);
app.use('/api/rate-plans', resourceRoutes.rate_plans);
app.use('/api/insurance', resourceRoutes.insurance);
app.use('/api/maintenance', resourceRoutes.maintenance_records);
app.use('/api/damage-reports', resourceRoutes.damage_reports);
app.use('/api/amenities', resourceRoutes.vehicle_amenities);
app.use('/api/ratings', resourceRoutes.vehicle_ratings);
app.use('/api/rental-history', resourceRoutes.rental_status_history);

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON body'
    });
  }

  let status = err.status || 500;
  let msg = err.message || 'Internal server error';

  switch (err.errno) {
    case 1062:
      status = 400;
      msg = `Duplicate value: ${err.sqlMessage}`;
      break;

    case 1452:
      status = 400;
      msg = 'Referenced record does not exist (check the id you sent)';
      break;

    case 1451:
      status = 400;
      msg = 'Cannot delete: this record is used by other records. Deactivate it instead.';
      break;

    case 3819:
    case 4025:
      status = 400;
      msg = `Value rejected by a database CHECK constraint: ${err.sqlMessage}`;
      break;

    case 1048:
    case 1265:
    case 1366:
    case 1406:
    case 1292:
      status = 400;
      msg = `Invalid value: ${err.sqlMessage}`;
      break;
  }

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    success: false,
    error: msg
  });
});

testConnection()
  .then(() => {
    const startServer = () => {
      console.log(`V-RENT running at http://localhost:${PORT}`);

      if (DEMO_MODE) {
        console.log('DEMO MODE: Global JWT authentication bypassed');
        console.log('Server restricted to this computer (127.0.0.1)');
      }

      const schedule = process.env.OVERDUE_CRON || '*/15 * * * *';

      const run = () => {
        rentalModel.runOverdueCheck()
          .then(r => {
            console.log(
              `[auto overdue check] past due: ${r.rentals_past_due}, 
               new overdue: ${r.newly_overdue}, fees created: ${r.fees_created}, updated: ${r.fees_updated}`
            );
          })
          .catch(e => {
            console.error('[auto overdue check] failed:', e.message);
          });
      };

      cron.schedule(schedule, run);
      run();
    };

    if (DEMO_MODE) {
      app.listen(PORT, '127.0.0.1', startServer);
    } else {
      app.listen(PORT, startServer);
    }
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
