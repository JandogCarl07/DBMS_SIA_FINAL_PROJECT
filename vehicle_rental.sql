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