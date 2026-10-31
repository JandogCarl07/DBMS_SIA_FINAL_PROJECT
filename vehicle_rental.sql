show databases;
CREATE database VRENT_DATABASE_FINAL;
USE VRENT_DATABASE_FINAL;

-- ---------------------------------------------------------------------
-- 1. vehicle_amenities
-- ---------------------------------------------------------------------
CREATE TABLE vehicle_amenities (
 amenity_id INT AUTO_INCREMENT PRIMARY KEY,
 amenity_name VARCHAR(100) NOT NULL UNIQUE,
 description VARCHAR(255)
) ENGINE=InnoDB;
-- ---------------------------------------------------------------------
-- 2. branches
-- ---------------------------------------------------------------------
CREATE TABLE branches (
 branch_id INT AUTO_INCREMENT PRIMARY KEY,
 branch_name VARCHAR(100) NOT NULL UNIQUE,
 address VARCHAR(255) NOT NULL,
 city VARCHAR(100) NOT NULL,
 phone VARCHAR(20) NOT NULL,
 opening_hours VARCHAR(100)
) ENGINE=InnoDB;
-- ---------------------------------------------------------------------
-- 3. vehicle_categories
-- ---------------------------------------------------------------------
CREATE TABLE vehicle_categories (
 category_id INT AUTO_INCREMENT PRIMARY KEY,
 category_name VARCHAR(50) NOT NULL UNIQUE,
 description VARCHAR(255),
 seating_capacity TINYINT UNSIGNED NOT NULL,
 CONSTRAINT chk_category_seats CHECK (seating_capacity BETWEEN 1 AND 60)
) ENGINE=InnoDB;
-- ---------------------------------------------------------------------
-- 4. customers
-- ---------------------------------------------------------------------
CREATE TABLE customers (
 customer_id INT AUTO_INCREMENT PRIMARY KEY,
 first_name VARCHAR(50) NOT NULL,
 middle_name VARCHAR(50),
 last_name VARCHAR(50) NOT NULL,
 birth_date DATE NOT NULL,
 gender ENUM('Male','Female','Other') NOT NULL,
 email VARCHAR(100) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NULL,
 phone VARCHAR(20) NOT NULL,
 street VARCHAR(150) NOT NULL,
 barangay VARCHAR(100) NOT NULL,
 city VARCHAR(100) NOT NULL,
 province VARCHAR(100) NOT NULL,
 postal_code VARCHAR(10) NOT NULL,
 license_number VARCHAR(30) NOT NULL UNIQUE,
 license_expiry_date DATE NOT NULL,
 emergency_contact_name VARCHAR(100) NOT NULL,
 emergency_contact_phone VARCHAR(20) NOT NULL,
 date_registered DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 status ENUM('Active','Blacklisted') NOT NULL DEFAULT 'Active',
 CONSTRAINT chk_customer_dates CHECK (license_expiry_date > DATE_ADD(birth_date, INTERVAL 18 YEAR)),
 INDEX idx_cust_name (last_name, first_name)
) ENGINE=InnoDB;
-- ---------------------------------------------------------------------
-- 5. password_reset_tokens
-- ---------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
 reset_id INT AUTO_INCREMENT PRIMARY KEY,
 customer_id INT NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE,
 expires_at DATETIME NOT NULL,
 used_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_reset_customer FOREIGN KEY (customer_id)
 REFERENCES customers(customer_id)
 ON DELETE CASCADE ON UPDATE CASCADE,
 INDEX idx_reset_customer_expiry (customer_id, expires_at),
 INDEX idx_reset_expiry (expires_at)
) ENGINE=InnoDB;
-- ---------------------------------------------------------------------
-- 6. vehicles
-- ---------------------------------------------------------------------
CREATE TABLE vehicles (
 vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
 category_id INT NOT NULL,
 branch_id INT NOT NULL,
 plate_number VARCHAR(15) NOT NULL UNIQUE,
 brand VARCHAR(50) NOT NULL,
 model VARCHAR(50) NOT NULL,
 year SMALLINT NOT NULL,
 color VARCHAR(30) NOT NULL,
 transmission ENUM('Manual','Automatic') NOT NULL,
 fuel_type ENUM('Gasoline','Diesel','Electric','Hybrid') NOT NULL,
 seats TINYINT UNSIGNED NOT NULL,
 mileage INT UNSIGNED NOT NULL DEFAULT 0,
 status ENUM('Available','Reserved','Rented','Maintenance','Unavailable')
 NOT NULL DEFAULT 'Available',
 CONSTRAINT chk_vehicle_year CHECK (year BETWEEN 1990 AND 2100),
 CONSTRAINT chk_vehicle_seats CHECK (seats > 0),
 CONSTRAINT fk_veh_category FOREIGN KEY (category_id) REFERENCES vehicle_categories(category_id)
 ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fk_veh_branch FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
 ON DELETE RESTRICT ON UPDATE CASCADE,
 INDEX idx_veh_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. vehicle_amenity_assignments
-- ---------------------------------------------------------------------
CREATE TABLE vehicle_amenity_assignments (
 vehicle_id INT NOT NULL,
 amenity_id INT NOT NULL,

 PRIMARY KEY (vehicle_id, amenity_id),

 CONSTRAINT fk_vaa_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
 ON DELETE CASCADE ON UPDATE CASCADE,

 CONSTRAINT fk_vaa_amenity FOREIGN KEY (amenity_id) REFERENCES vehicle_amenities(amenity_id)
 ON DELETE CASCADE ON UPDATE CASCADE,
 
 INDEX idx_vaa_ame
 ) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. rate_plans (Daily 1-6 days, Weekly 7-29, Monthly 30+, seasonal)
-- ---------------------------------------------------------------------
CREATE TABLE rate_plans (
 rate_plan_id INT AUTO_INCREMENT PRIMARY KEY,
 category_id INT NOT NULL,
 plan_name VARCHAR(50) NOT NULL,
 rate_per_day DECIMAL(10,2) NOT NULL,
 min_days INT NOT NULL DEFAULT 1,
 max_days INT NULL,
 season_start DATE NULL,
 season_end DATE NULL,
 CONSTRAINT chk_rate_amount CHECK (rate_per_day > 0),
 CONSTRAINT chk_rate_days CHECK (min_days >= 1 AND (max_days IS NULL OR max_days >= min_days)),
 CONSTRAINT chk_rate_season CHECK (season_end IS NULL OR season_start IS NULL OR season_end >= season_start),
 CONSTRAINT fk_rate_category FOREIGN KEY (category_id) REFERENCES vehicle_categories(category_id),
 ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. insurance
-- ---------------------------------------------------------------------
CREATE TABLE insurance (
 insurance_id INT AUTO_INCREMENT PRIMARY KEY,
 vehicle_id INT NOT NULL,
 provider VARCHAR(100) NOT NULL,
 policy_number VARCHAR(50) NOT NULL UNIQUE,
 coverage_type ENUM('Comprehensive','Third-Party','Collision') NOT NULL,
 coverage_amount DECIMAL(12,2) NOT NULL,
 start_date DATE NOT NULL,
 expiry_date DATE NOT NULL,
 CONSTRAINT chk_ins_amount CHECK (coverage_amount > 0),
 CONSTRAINT chk_ins_dates CHECK (expiry_date > start_date),
 CONSTRAINT fk_ins_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
 ON DELETE RESTRICT ON UPDATE CASCADE,
 INDEX idx_ins_vehicle_expiry (vehicle_id, expiry_date)
) ENGINE=InnoDB;

--------------------------------------------------------------------
--  10. reservations -- 
--------------------------------------------------------------------
CREATE TABLE reservations ( 
  reservation_id INT AUTO_INCREMENT PRIMARY KEY, 
  customer_id    INT      NOT NULL, 
  vehicle_id     INT      NOT NULL, 
  employee_id    INT      NOT NULL,   
  start_date     DATE     NOT NULL, 
  end_date       DATE     NOT NULL, 
  status         ENUM('Pending','Confirmed','Cancelled','Completed','No-Show') 
                 NOT NULL DEFAULT 'Pending', 
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  CONSTRAINT chk_resv_dates CHECK (end_date >= start_date), 
  CONSTRAINT fk_resv_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE, 
  CONSTRAINT fk_resv_vehicle  FOREIGN KEY (vehicle_id)  REFERENCES vehicles(vehicle_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE, 
  CONSTRAINT fk_resv_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE, 
  -- speeds up the "is this vehicle free for these dates?" check 
  INDEX idx_resv_vehicle_dates (vehicle_id, start_date, end_date) 
) ENGINE=InnoDB; 

--------------------------------------------------------------------- 
-- 11. reservations -- 
--------------------------------------------------------------------- 
CREATE TABLE reservations ( 
  reservation_id INT AUTO_INCREMENT PRIMARY KEY, 
  customer_id    INT      NOT NULL, 
  vehicle_id     INT      NOT NULL, 
  start_date     DATE     NOT NULL, 
  end_date       DATE     NOT NULL, 
  status         ENUM('Pending','Confirmed','Cancelled','Completed','No-Show') 
                 NOT NULL DEFAULT 'Pending', 
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  CONSTRAINT chk_resv_dates CHECK (end_date >= start_date), 
  CONSTRAINT fk_resv_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE, 
  CONSTRAINT fk_resv_vehicle  FOREIGN KEY (vehicle_id)  REFERENCES vehicles(vehicle_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE, 
  -- speeds up the "is this vehicle free for these dates?" check 
  INDEX idx_resv_vehicle_dates (vehicle_id, start_date, end_date) 
) ENGINE=InnoDB;

--------------------------------------------------------------------- 
-- 12. rentals   (reservation_id NULL = walk-in) --
--------------------------------------------------------------------- 
CREATE TABLE rentals ( 
  rental_id        INT AUTO_INCREMENT PRIMARY KEY, 
  reservation_id   INT          NULL UNIQUE, 
  customer_id      INT          NOT NULL, 
  vehicle_id       INT          NOT NULL, 
  pickup_branch_id INT          NOT NULL, 
  return_branch_id INT          NULL, 
  rental_date      DATETIME     NOT NULL, 
  due_date         DATETIME     NOT NULL, 
  return_date      DATETIME     NULL,          
  start_mileage    INT UNSIGNED NOT NULL, 
  end_mileage      INT UNSIGNED NULL, 
  total_amount     DECIMAL(12,2) NOT NULL DEFAULT 0, 
  status           ENUM('Active','Returned','Overdue','Cancelled') NOT NULL DEFAULT 'Active', 
  CONSTRAINT chk_rental_due     CHECK (due_date > rental_date), 
  CONSTRAINT chk_rental_return  CHECK (return_date IS NULL OR return_date >= rental_date), 
  CONSTRAINT chk_rental_mileage CHECK (end_mileage IS NULL OR end_mileage >= start_mileage), 
  CONSTRAINT chk_rental_total   CHECK (total_amount >= 0), 
  CONSTRAINT fk_rent_reservation FOREIGN KEY (reservation_id)   REFERENCES 
reservations(reservation_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE, 
  CONSTRAINT fk_rent_customer    FOREIGN KEY (customer_id)      REFERENCES customers(customer_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE, 
  CONSTRAINT fk_rent_vehicle     FOREIGN KEY (vehicle_id)       REFERENCES vehicles(vehicle_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE, 
  CONSTRAINT fk_rent_pickup      FOREIGN KEY (pickup_branch_id) REFERENCES branches(branch_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE, 
  CONSTRAINT fk_rent_return      FOREIGN KEY (return_branch_id) REFERENCES branches(branch_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE, 
  INDEX idx_rent_vehicle_status (vehicle_id, status, rental_date, due_date), 
  INDEX idx_rent_status (status) 
) ENGINE=InnoDB; 

-- ---------------------------------------------------------------------
-- 15. rental_status_history
-- ---------------------------------------------------------------------
CREATE TABLE rental_status_history (
  history_id INT AUTO_INCREMENT PRIMARY KEY,
  rental_id  INT          NOT NULL,
  old_status VARCHAR(30)  NULL,       
  new_status VARCHAR(30)  NOT NULL,
  changed_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  remarks    VARCHAR(255),
  CONSTRAINT fk_hist_rental   FOREIGN KEY (rental_id)  REFERENCES rentals(rental_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 16. damage_reports
-- ---------------------------------------------------------------------
CREATE TABLE damage_reports (
  damage_id     INT AUTO_INCREMENT PRIMARY KEY,
  rental_id     INT           NOT NULL,
  vehicle_id    INT           NOT NULL,
  description   TEXT          NOT NULL,
  severity      ENUM('Minor','Moderate','Major') NOT NULL,
  repair_cost   DECIMAL(10,2) NOT NULL DEFAULT 0,
  reported_date DATE          NOT NULL,
  status        ENUM('Reported','Under Repair','Resolved') NOT NULL DEFAULT 'Reported',
  CONSTRAINT chk_damage_cost CHECK (repair_cost >= 0),
  CONSTRAINT fk_dmg_rental   FOREIGN KEY (rental_id)   REFERENCES rentals(rental_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_dmg_vehicle  FOREIGN KEY (vehicle_id)  REFERENCES vehicles(vehicle_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ---------------------------------------------------------------------
-- 17. vehicle_ratings
-- ---------------------------------------------------------------------
CREATE TABLE vehicle_ratings (
  rating_id   INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT          NOT NULL,
  vehicle_id  INT          NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL,
  review      TEXT         NULL,
  rated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_vehicle_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_rating_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rating_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_customer_vehicle_rating UNIQUE (customer_id, vehicle_id),
  INDEX idx_vehicle_rating (vehicle_id, rating)
) ENGINE=InnoDB;


INSERT INTO vehicle_amenities (amenity_name, description) VALUES
('Dash cam', 'In-vehicle camera for recording the road ahead'),
('Roof rack / luggage carrier', 'Additional exterior luggage storage'),
('GPS navigator device', 'Dedicated navigation device for route guidance'),
('Rear Parking Sensors', 'Sensors that help detect obstacles behind the vehicle'),
('Wireless phone charger', 'Built-in or mounted wireless phone charging');

INSERT INTO branches (branch_name, address, city, phone, opening_hours) VALUES
('Dumaguete Branch', 'Barangay, Camanjac', 'Dumaguete City', '0935-252-4173', '8:00 AM - 6:00 PM');

INSERT INTO vehicle_categories (category_name, description, seating_capacity) VALUES
('Sedan',      'Compact and mid-size cars for city driving', 5),
('SUV',        'Sport utility vehicles for families and trips', 7),
('Van',        'Large vans for groups and cargo',              12),
('Pickup',     'Pickup trucks for rough roads and hauling',     5),
('Motorcycle', 'Scooters and motorcycles',                      2);

INSERT INTO customers
(first_name, middle_name, last_name, birth_date, gender, email, phone, street, barangay, city, province, postal_code,
 license_number, license_expiry_date, emergency_contact_name, emergency_contact_phone, status, password_hash) VALUES
('Alex', NULL, 'Reyes', '1995-04-12', 'Male', 'demo.customer@vehiclerental.test', '09000000001',
 'Poblacion Street', 'Barangay Poblacion 1', 'Dumaguete City', 'Negros Oriental', '6200',
 'DGT-95-000001', '2030-04-12', 'Jamie Reyes', '09000000002', 'Active', NULL);

INSERT INTO vehicles (category_id, branch_id, plate_number, brand, model, year, color, transmission, fuel_type, seats, mileage, status) VALUES
-- 5 SUVs
(2, 1, 'DGT-SUV01', 'Toyota', 'Fortuner', 2024, 'White', 'Automatic', 'Diesel', 7, 12000, 'Available'),
(2, 1, 'DGT-SUV02', 'Mitsubishi', 'Montero Sport', 2023, 'Black', 'Automatic', 'Diesel', 7, 18500, 'Available'),
(2, 1, 'DGT-SUV03', 'Ford', 'Everest', 2024, 'Gray', 'Automatic', 'Diesel', 7, 9800, 'Available'),
(2, 1, 'DGT-SUV04', 'Honda', 'CR-V', 2023, 'Silver', 'Automatic', 'Gasoline', 5, 15000, 'Available'),
(2, 1, 'DGT-SUV05', 'Nissan', 'Terra', 2022, 'White', 'Automatic', 'Diesel', 7, 24000, 'Available'),
-- 5 vans
(3, 1, 'DGT-VAN01', 'Toyota', 'Hiace', 2023, 'White', 'Manual', 'Diesel', 12, 21000, 'Available'),
(3, 1, 'DGT-VAN02', 'Nissan', 'Urvan', 2022, 'Silver', 'Manual', 'Diesel', 12, 27500, 'Available'),
(3, 1, 'DGT-VAN03', 'Hyundai', 'Staria', 2024, 'Black', 'Automatic', 'Diesel', 9, 8500, 'Available'),
(3, 1, 'DGT-VAN04', 'Kia', 'Carnival', 2023, 'Gray', 'Automatic', 'Diesel', 8, 13200, 'Available'),
(3, 1, 'DGT-VAN05', 'Mitsubishi', 'L300', 2022, 'White', 'Manual', 'Diesel', 12, 32000, 'Available'),
-- 5 motorcycles
(5, 1, 'DGT-MOT01', 'Honda', 'Click 160', 2024, 'Blue', 'Automatic', 'Gasoline', 2, 4200, 'Available'),
(5, 1, 'DGT-MOT02', 'Yamaha', 'NMAX', 2024, 'Black', 'Automatic', 'Gasoline', 2, 5100, 'Available'),
(5, 1, 'DGT-MOT03', 'Honda', 'PCX 160', 2023, 'White', 'Automatic', 'Gasoline', 2, 7800, 'Available'),
(5, 1, 'DGT-MOT04', 'Suzuki', 'Burgman Street', 2023, 'Gray', 'Automatic', 'Gasoline', 2, 6900, 'Available'),
(5, 1, 'DGT-MOT05', 'Yamaha', 'Mio Gear', 2022, 'Red', 'Automatic', 'Gasoline', 2, 10500, 'Available'),
-- 5 cars
(1, 1, 'DGT-CAR01', 'Toyota', 'Vios', 2024, 'White', 'Automatic', 'Gasoline', 5, 9900, 'Available'),
(1, 1, 'DGT-CAR02', 'Honda', 'City', 2023, 'Silver', 'Automatic', 'Gasoline', 5, 14500, 'Available'),
(1, 1, 'DGT-CAR03', 'Mitsubishi', 'Mirage G4', 2024, 'Red', 'Automatic', 'Gasoline', 5, 6000, 'Available'),
(1, 1, 'DGT-CAR04', 'Nissan', 'Almera', 2023, 'Gray', 'Automatic', 'Gasoline', 5, 12500, 'Available'),
(1, 1, 'DGT-CAR05', 'Hyundai', 'Accent', 2022, 'Blue', 'Manual', 'Diesel', 5, 26000, 'Available'),
-- 5 pickup trucks
(4, 1, 'DGT-PUP01', 'Ford', 'Ranger', 2024, 'Orange', 'Automatic', 'Diesel', 5, 11000, 'Available'),
(4, 1, 'DGT-PUP02', 'Toyota', 'Hilux', 2023, 'White', 'Manual', 'Diesel', 5, 17000, 'Available'),
(4, 1, 'DGT-PUP03', 'Isuzu', 'D-Max', 2023, 'Silver', 'Manual', 'Diesel', 5, 19500, 'Available'),
(4, 1, 'DGT-PUP04', 'Mitsubishi', 'Triton', 2024, 'Black', 'Automatic', 'Diesel', 5, 9000, 'Available'),
(4, 1, 'DGT-PUP05', 'Nissan', 'Navara', 2022, 'Gray', 'Automatic', 'Diesel', 5, 28500, 'Available');

INSERT INTO vehicle_amenity_assignments (vehicle_id, amenity_id) VALUES
-- SUVs
(1,1),(1,3),(1,4),(1,5),
(2,1),(2,2),(2,3),(2,4),
(3,1),(3,2),(3,3),(3,4),(3,5),
(4,1),(4,3),(4,4),(4,5),
(5,1),(5,2),(5,3),(5,4),
-- Vans
(6,1),(6,2),(6,3),(6,5),
(7,1),(7,2),(7,3),(7,4),
(8,1),(8,3),(8,4),(8,5),
(9,1),(9,2),(9,3),(9,4),(9,5),
(10,1),(10,2),(10,3),
-- Motorcycles
(11,1),(11,3),(11,5),
(12,1),(12,3),(12,4),
(13,1),(13,3),(13,5),
(14,1),(14,3),(14,4),
(15,1),(15,3),(15,5),
-- Cars
(16,1),(16,3),(16,4),(16,5),
(17,1),(17,3),(17,4),
(18,1),(18,3),(18,5),
(19,1),(19,3),(19,4),(19,5),
(20,1),(20,3),(20,4),
-- Pickup trucks
(21,1),(21,2),(21,3),(21,4),(21,5),
(22,1),(22,2),(22,3),(22,4),
(23,1),(23,2),(23,3),(23,5),
(24,1),(24,2),(24,3),(24,4),(24,5),
(25,1),(25,2),(25,3),(25,4);

INSERT INTO rate_plans (category_id, plan_name, rate_per_day, min_days, max_days, season_start, season_end) VALUES
(1, 'Daily',        1500.00, 1,  6,    NULL,         NULL),
(1, 'Weekly',       1300.00, 7,  29,   NULL,         NULL),
(2, 'Daily',        3000.00, 1,  6,    NULL,         NULL),
(2, 'Weekly',       2700.00, 7,  29,   NULL,         NULL),
(3, 'Daily',        3500.00, 1,  6,    NULL,         NULL),
(3, 'Weekly',       3200.00, 7,  29,   NULL,         NULL),
(4, 'Daily',        3200.00, 1,  6,    NULL,         NULL),
(5, 'Daily',         600.00, 1,  6,    NULL,         NULL),
(4, 'Weekly',       2900.00, 7,  29,   NULL,         NULL),
(5, 'Weekly',        550.00, 7,  29,   NULL,         NULL),
(1, 'Monthly',      1200.00, 30, NULL, NULL,         NULL),
(2, 'Monthly',      2400.00, 30, NULL, NULL,         NULL),
(3, 'Monthly',      2800.00, 30, NULL, NULL,         NULL),
(4, 'Monthly',      2600.00, 30, NULL, NULL,         NULL),
(5, 'Monthly',       450.00, 30, NULL, NULL,         NULL),
(1, 'Holiday Peak', 2000.00, 1,  NULL, '2026-12-15', '2027-01-05');

INSERT INTO insurance (vehicle_id, provider, policy_number, coverage_type, coverage_amount, start_date, expiry_date) VALUES
(16, 'Malayan Insurance', 'POL-DEMO-0016', 'Comprehensive', 1800000.00, '2026-10-01', '2027-09-30');

INSERT INTO maintenance_records (vehicle_id, service_type, description, service_date, next_service_date, next_service_mileage, cost, status) VALUES
(16, 'Preventive Maintenance', 'Oil change and general inspection', '2026-08-01', '2027-02-01', 20000, 4500.00, 'Completed');

INSERT INTO reservations (customer_id, vehicle_id, start_date, end_date, status, created_at) VALUES
(1, 16, '2026-09-01', '2026-09-05', 'Completed', '2026-08-25 10:00:00');

INSERT INTO rentals (reservation_id, customer_id, vehicle_id, pickup_branch_id, return_branch_id,
                     rental_date, due_date, return_date, start_mileage, end_mileage, total_amount, status) VALUES
(1, 1, 16, 1, 1, '2026-09-01 09:00:00', '2026-09-05 09:00:00', '2026-09-06 08:30:00', 9500, 9900, 6000.00, 'Returned');

INSERT INTO payments (rental_id, amount, payment_date, payment_method, payment_type, reference_number, status) VALUES
(1, 6000.00, '2026-09-01 09:05:00', 'Cash', 'Rental Fee', NULL, 'Paid');



INSERT INTO late_fees (rental_id, days_late, fee_amount, computed_on, status) VALUES
(1, 1, 500.00, '2026-09-06 08:35:00', 'Waived');

INSERT INTO rental_status_history (rental_id, old_status, new_status, changed_at, remarks) VALUES
(1, 'Active', 'Returned', '2026-09-06 08:30:00', 'Alex returned the Toyota Vios; the rental is closed.');

INSERT INTO damage_reports (rental_id, vehicle_id, description, severity, repair_cost, reported_date, status) VALUES
(1, 16, 'Minor scratch noted during vehicle return inspection; repair completed.', 'Minor', 800.00, '2026-09-06', 'Resolved');

INSERT INTO vehicle_ratings (customer_id, vehicle_id, rating, review, rated_at) VALUES
(1, 16, 5, 'Clean car and smooth driving experience.', '2026-09-05 09:00:00');

