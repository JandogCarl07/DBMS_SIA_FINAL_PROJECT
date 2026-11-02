# DBMS 1 & SIA Final Project
*Group 3*

**Section:** A

**Proposed System Title:** Vehicle Rental System  
**System Name:** V-RENT

---

## Project Description

V-RENT is a database-driven, web-based vehicle rental system developed as the final project for Database Management Systems 1 (DBMS 1) and System Integration and Architecture (SIA).

The system is designed to manage vehicle rental operations and related records. It provides a platform where customers can browse available vehicles, view vehicle information, and submit rental reservations. It also includes an administrative interface for managing vehicles, customers, branches, reservations, rentals, payments, and other related operations.

The system integrates a MySQL relational database with a Node.js and Express.js backend and a frontend developed using HTML, CSS, and JavaScript.

## Project Objectives

- Develop a functional web-based vehicle rental system.
- Provide customers with a convenient way to browse and reserve vehicles.
- Organize vehicle, customer, branch, reservation, and rental records.
- Integrate a MySQL database with a Node.js and Express.js backend.
- Implement database relationships using primary keys and foreign keys.
- Develop API endpoints for communication between the frontend and backend.
- Implement SQL JOIN queries to retrieve related information from multiple tables.
- Provide an administrative interface for managing vehicle rental operations.

---

## System Features

### Customer Features

- Customer registration and login
- Browse available vehicles
- Search and filter vehicles
- View vehicle details and amenities
- View vehicle categories and rental rates
- Submit vehicle reservations
- Manage customer account information
- View reservation and rental history
- View payment information
- Submit vehicle ratings and reviews
- Password reset functionality

### Admin Features

- Manage vehicles
- Manage vehicle categories
- Manage vehicle amenities
- Manage branch locations
- Manage rental rate plans
- Manage vehicle insurance records
- Manage customer records
- Manage reservations
- Manage rental transactions
- Manage payments
- Manage late fees
- Manage vehicle maintenance records
- Manage rental status history
- Manage vehicle damage reports
- View vehicle ratings and customer reviews

---

## Technologies Used

| Technology | Purpose |
|---|---|
| MySQL | Relational database management |
| Node.js | Backend runtime environment |
| Express.js | Backend framework and API routes |
| HTML | Website structure |
| CSS | Website design and layout |
| JavaScript | Frontend functionality and interaction |
| Git | Version control |
| GitHub | Source code hosting and collaboration |
| Visual Studio Code | Development environment |

---

## Database Structure

The V-RENT system uses a MySQL relational database named `vrent_final-database`.

It consists of 17 tables responsible for storing and organizing information about customers, vehicles, reservations, rentals, payments, and other vehicle rental operations.

### Database Tables

| No. | Table Name | Description |
|---|---|---|
| 1 | `vehicle_amenities` | Stores the available amenities that can be assigned to vehicles. |
| 2 | `branches` | Stores branch names, addresses, contact numbers, and opening hours. |
| 3 | `vehicle_categories` | Stores vehicle classifications, descriptions, and seating capacities. |
| 4 | `customers` | Stores customer personal information, contact details, driving license information, and account status. |
| 5 | `password_reset_tokens` | Stores customer password reset tokens, expiration dates, and usage information. |
| 6 | `vehicles` | Stores vehicle information, including category, branch, plate number, brand, model, year, and availability status. |
| 7 | `vehicle_amenity_assignments` | Connects vehicles with their assigned amenities. |
| 8 | `rate_plans` | Stores rental pricing plans based on vehicle categories, rental duration, and seasonal dates. |
| 9 | `insurance` | Stores vehicle insurance provider, policy number, coverage type, and expiration information. |
| 10 | `maintenance_records` | Stores vehicle maintenance schedules, service information, costs, and status. |
| 11 | `reservations` | Stores customer vehicle reservation details, rental dates, and reservation status. |
| 12 | `rentals` | Stores rental transactions, pickup and return branches, rental dates, mileage, total amount, and rental status. |
| 13 | `payments` | Stores rental payment amounts, payment methods, payment types, reference numbers, and payment status. |
| 14 | `late_fees` | Stores late rental information, number of days late, fee amounts, and payment status. |
| 15 | `rental_status_history` | Records changes in rental status, timestamps, and remarks. |
| 16 | `damage_reports` | Stores vehicle damage descriptions, severity, repair costs, and repair status. |
| 17 | `vehicle_ratings` | Stores customer ratings and reviews for vehicles. |

### Database Relationships

The database uses primary keys and foreign keys to maintain relationships between tables.

Some important relationships include:

- `customers` → `password_reset_tokens`: One customer can have multiple password reset tokens.
- `customers` → `reservations`: One customer can make multiple reservations.
- `vehicles` → `reservations`: One vehicle can appear in multiple reservation records.
- `vehicle_categories` → `vehicles`: One category can contain multiple vehicles.
- `branches` → `vehicles`: One branch can have multiple vehicles.
- `vehicle_amenities` ↔ `vehicles`: Vehicles and amenities have a many-to-many relationship through `vehicle_amenity_assignments`.
- `vehicle_categories` → `rate_plans`: One vehicle category can have multiple rate plans.
- `vehicles` → `insurance`: One vehicle can have multiple insurance records.
- `vehicles` → `maintenance_records`: One vehicle can have multiple maintenance records.
- `reservations` → `rentals`: A reservation can be linked to at most one rental.
- `customers` → `rentals`: One customer can have multiple rental transactions.
- `vehicles` → `rentals`: One vehicle can appear in multiple rental transactions.
- `branches` → `rentals`: Branches can be referenced as pickup and return locations.
- `rentals` → `payments`: One rental can have multiple payment records.
- `rentals` → `late_fees`: One rental can have multiple late fee records.
- `rentals` → `rental_status_history`: One rental can have multiple status history records.
- `rentals` → `damage_reports`: One rental can have multiple damage reports.
- `vehicles` → `damage_reports`: One vehicle can have multiple damage reports.
- `customers` → `vehicle_ratings`: One customer can submit ratings for multiple vehicles.
- `vehicles` → `vehicle_ratings`: One vehicle can receive ratings from multiple customers.

---

## Group Members and Database Responsibilities

| Member | GitHub Username | Assigned Tables |
|---|---|---|
| Kenneth Duran | `sleepy028` | `rate_plans`, `insurance`, `vehicle_amenity_assignments` |
| Ken Shinn B. Encarguez | `KenziiKen` | `customers`, `password_reset_tokens`, `vehicles` |
| Samantha Yatoc Garcia | `samantha5357` | `payments`, `late_fees` |
| Carlos Emmanuel V. Jandog | `JandogCarl07` | `rental_status_history`, `damage_reports`, `vehicle_ratings` |
| Shaira M. Jundarino | `sjndrno` | `vehicle_amenities`, `branches`, `vehicle_categories` |
| Chrisha Lorraine Oira | `chrishalorraine` | `reservations`, `rentals`, `maintenance_records` |

---

## Feature Assignments

The following responsibilities are based on the actual database tables and their relationships. The API endpoint names are suggested examples and should be updated to match the routes implemented in the project.

| Member | Endpoints / Screens | JOIN Reports and Types | Feature Role |
|---|---|---|---|
| **Kenneth Duran** | Rate plan management, insurance management, and vehicle amenity assignment screens. Suggested endpoints: `/api/rate-plans`, `/api/insurance`, `/api/vehicle-amenity-assignments`. | `rate_plans` with `vehicle_categories` (`INNER JOIN`); `vehicles` with `insurance` (`LEFT JOIN`); `vehicles` with `vehicle_amenity_assignments` and `vehicle_amenities` (`LEFT JOIN`). | **Rate Plan, Insurance, and Vehicle Amenity Assignment Developer** – Manages rental pricing plans, vehicle insurance information, and the assignment of amenities to vehicles. |
| **Ken Shinn B. Encarguez** | Customer registration, customer profiles, password reset, and vehicle management screens. Suggested endpoints: `/api/customers`, `/api/password-reset`, `/api/vehicles`. | `customers` with `password_reset_tokens` (`LEFT JOIN`); `customers` with `reservations` and `vehicles` (`INNER JOIN`); `vehicles` with `vehicle_categories` and `branches` (`INNER JOIN`). | **Customer and Vehicle Management Developer** – Manages customer accounts, password reset records, and vehicle information. |
| **Samantha Yatoc Garcia** | Payment management, payment records, and late fee management screens. Suggested endpoints: `/api/payments`, `/api/late-fees`. | `rentals` with `payments` and `late_fees` (`LEFT JOIN`); `payments` with `rentals` (`INNER JOIN`); `late_fees` with `rentals` (`INNER JOIN`). | **Payment and Billing Developer** – Handles rental payments, payment methods, payment statuses, and late fee records. |
| **Carlos Emmanuel V. Jandog** | Rental status history, damage reports, and vehicle ratings screens. Suggested endpoints: `/api/rental-status-history`, `/api/damage-reports`, `/api/vehicle-ratings`. | `rental_status_history` with `rentals` (`INNER JOIN`); `damage_reports` with `rentals` and `vehicles` (`INNER JOIN`); `vehicle_ratings` with `customers` and `vehicles` (`INNER JOIN`). | **Rental Monitoring, Damage Report, and Vehicle Rating Developer** – Manages rental status changes, vehicle damage documentation, and customer reviews and ratings. |
| **Shaira M. Jundarino** | Vehicle amenity management, branch management, and vehicle category management screens. Suggested endpoints: `/api/vehicle-amenities`, `/api/branches`, `/api/vehicle-categories`. | `vehicles` with `branches` and `vehicle_categories` (`INNER JOIN`); `vehicles` with `vehicle_amenity_assignments` and `vehicle_amenities` (`LEFT JOIN`). | **Branch, Category, and Vehicle Amenity Management Developer** – Manages branch information, vehicle classifications, and the available amenities that can be assigned to vehicles. |
| **Chrisha Lorraine Oira** | Reservation management, rental management, and vehicle maintenance screens. Suggested endpoints: `/api/reservations`, `/api/rentals`, `/api/maintenance-records`. | `reservations` with `customers` and `vehicles` (`INNER JOIN`); `rentals` with `reservations`, `customers`, `vehicles`, and `branches` (`INNER JOIN`); `maintenance_records` with `vehicles` (`INNER JOIN`). | **Reservation, Rental, and Maintenance Developer** – Manages customer reservations, rental transactions, vehicle pickup and return information, and maintenance records. |

**Note:** These are proposed responsibilities based on the database schema. Actual implementation should follow the existing project routes, database columns, and foreign key relationships.

---

## Existing SQL JOIN Reports

The following SQL JOIN reports are already included in the database script.

| No. | SQL Report | Description | Suggested Responsible Member |
|---|---|---|---|
| 1 | Vehicle Details with Category, Branch, and Amenities | Displays vehicle information, category, branch, and assigned amenities. | Shaira Jundarino and Kenneth Duran |
| 2 | Customer Reservation History | Displays customers, their reservations, vehicle details, rental dates, and reservation status. | Ken Shinn B. Encarguez and Chrisha Lorraine Oira |
| 3 | Vehicle Insurance Information | Displays vehicle details together with insurance provider, policy number, and expiry date. | Kenneth Duran |
| 4 | Rental Details with Payments and Late Fees | Displays rental information, customer details, vehicle details, payment amounts, and late fee amounts. | Samantha Yatoc Garcia |
| 5 | Vehicle Category and Rate Plans | Displays vehicle categories, plan names, daily rates, and rental duration limits. | Kenneth Duran and Shaira Jundarino |

### JOIN Types Used

| JOIN Type | Purpose |
|---|---|
| `INNER JOIN` | Retrieves records that have matching values in the related tables. |
| `LEFT JOIN` | Retrieves all records from the left table, including those without matching records in the right table. |

---

## Project Structure

The following is the reference folder structure of the V-RENT project. Actual filenames should match the files in the repository.

```text
DBMS - SIA - SYSTEM/
├── config/
├── controllers/
├── database/
│   └── vrent_final-database.sql
├── middleware/
├── models/
├── routes/
├── utils/
├── public/
│   ├── images/
│   │   └── vehicles/
│   ├── index.html
│   ├── admin.html
│   ├── app.js
│   ├── site.js
│   ├── site.css
│   ├── styles.css
│   ├── theme.js
│   └── vehicle-art.js
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── server.js
```

### Important Files and Folders

| File / Folder | Purpose |
|---|---|
| `config/` | Contains application and database configuration. |
| `controllers/` | Handles application requests and processes responses. |
| `database/` | Contains the SQL database script. |
| `middleware/` | Contains middleware for authentication and request processing. |
| `models/` | Handles database queries and data operations. |
| `routes/` | Defines backend API endpoints. |
| `utils/` | Contains reusable helper functions. |
| `public/` | Contains frontend files and website assets. |
| `package.json` | Contains project information and dependencies. |
| `.env.example` | Provides an example of the required environment variables. |
| `.gitignore` | Specifies files and folders that should not be uploaded to GitHub. |
| `server.js` | Main backend server file. |
| `README.md` | Contains project documentation and setup instructions. |

---

## Installation and Setup

### 1. Clone the Repository

Replace the placeholder with your actual GitHub repository URL.

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Open the Project Folder

```bash
cd "DBMS - SIA - SYSTEM"
```

### 3. Install Dependencies

Install the required Node.js packages.

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root project folder.

Use the variable names provided in `.env.example` and configure your local database credentials.

**Important:** Do not upload your actual `.env` file to GitHub because it may contain private credentials and passwords.

### 5. Set Up the MySQL Database

1. Open MySQL Workbench.
2. Connect to your local MySQL server.
3. Open the SQL script located in the `database/` folder.
4. Execute the SQL script.
5. Verify that the `vrent_final-database` database has been created.
6. Execute `SHOW TABLES;` to verify that the required tables exist.

Database name:

```sql
vrent_final-database
```

### 6. Verify the Database Connection

Make sure that the database connection settings in your `.env` file match your local MySQL configuration.

The backend should be able to connect to the `vrent_final-database` database before the application is used.

---

## Running the Application

Start the backend using the command configured in `package.json`.

For example, if your project contains a `start` script:

```bash
npm start
```

If the project does not have a `start` script, use the actual command configured in `package.json`.

Open the application using the local address configured by the server.

Example:

```text
http://localhost:3000
```

The port may differ depending on the project's configuration.

---

## GitHub Collaboration Commands

The following commands can be used when updating the project.

### 1. Check the Current Branch

```bash
git branch
```

### 2. Check Project Changes

```bash
git status
```

### 3. Add Project Files

```bash
git add .
```

### 4. Commit Changes

```bash
git commit -m "feat: update V-RENT system"
```

### 5. Push Changes to GitHub

```bash
git push origin YOUR_BRANCH_NAME
```

Replace `YOUR_BRANCH_NAME` with the actual branch you are working on.

### Important GitHub Upload Reminders

Do not upload the following:

- `node_modules/`
- `.env`
- Temporary files
- Log files
- Private credentials or passwords

Recommended `.gitignore`:

```gitignore
node_modules/
.env
*.log
.DS_Store
```

---

## Project Status

**Currently under development.**

Database implementation, API endpoints, frontend screens, SQL JOIN reports, and system features will be documented and updated as the project progresses.

---

## Project Purpose

The purpose of V-RENT is to provide an organized and convenient vehicle rental platform by integrating frontend development, backend processing, and database management.

It demonstrates the practical application of database management and system integration concepts through the development of a functional web-based vehicle rental system.

---

**Academic Project:** DBMS 1 & SIA Final Project  
**Group:** 3  
**System Name:** V-RENT – Vehicle Rental System
