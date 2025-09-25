Arewaflix Node Ramp - MySQL Setup

This project includes a MySQL database structure dump at `src/models/sql/db-structure.sql` and a small DB helper using `mysql2`.

Quick steps to set up MySQL locally and run the app

1. Install MySQL (Ubuntu example):

```bash
sudo apt update
sudo apt install mysql-server
sudo mysql_secure_installation
```

2. Create the database and import the provided SQL dump:

```bash
# open MySQL shell
sudo mysql -u root -p
CREATE DATABASE arewaflix DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
# from project root
mysql -u root -p arewaflix < src/models/sql/db-structure.sql
```

3. Copy `.env.example` to `.env` and set values:

```bash
cp .env.example .env
# Edit .env and set DB_PASSWORD (and other values if needed)
```

4. Install dependencies and run the server:

```bash
npm install
npm run dev   # uses nodemon
```

5. Test DB connection

- The project provides a `src/models/db.js` which uses `mysql2/promise` and exports a `query` helper.
- `src/users/users.service.js` demonstrates a simple `SELECT` against a `users` table with graceful fallback.

Notes

- If your MySQL server runs on a different host/port, update `.env` accordingly.
- For production, use a managed DB or secure the DB with a strong password and restricted network access.
# arewaflix-node-ramp
