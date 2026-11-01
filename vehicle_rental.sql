CREATE DATABASE IF NOT EXISTS `vrent_final-database`;
USE `vrent_final-database`;

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
CONSTRAINT chk_customer_dates CHECK (license_expiry_date > DATE_ADD(birth_date, INTERVAL 18
YEAR)),
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
CONSTRAINT fk_veh_category FOREIGN KEY (category_id) REFERENCES
vehicle_categories(category_id)
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
INDEX idx_vaa_amenity (amenity_id)
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
CONSTRAINT chk_rate_days CHECK (min_days >= 1 AND (max_days IS NULL OR max_days >=
min_days)),
CONSTRAINT chk_rate_season CHECK (season_end IS NULL OR season_start IS NULL OR season_end
>= season_start),
CONSTRAINT fk_rate_category FOREIGN KEY (category_id) REFERENCES
vehicle_categories(category_id)
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
