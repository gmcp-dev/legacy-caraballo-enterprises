const Database = require('better-sqlite3');
const path = require('path');

const dbDir = process.env.DB_DIR || __dirname;
const dbPath = path.join(dbDir, 'legacy.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('investment', 'earning', 'expense')),
    amount REAL NOT NULL,
    description TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS farms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    logo TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS farm_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL,
    product TEXT NOT NULL CHECK(product IN ('milk', 'beef', 'pork', 'chicken')),
    quantity REAL DEFAULT 0,
    price REAL DEFAULT 0,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS farm_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('entrada', 'salida')),
    product TEXT,
    quantity REAL,
    amount REAL NOT NULL,
    description TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    photo TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS member_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('socio', 'inversionista', 'propietario')),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS member_projects (
    member_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    PRIMARY KEY (member_id, project_id),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS member_farms (
    member_id INTEGER NOT NULL,
    farm_id INTEGER NOT NULL,
    PRIMARY KEY (member_id, farm_id),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS investments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    project_id INTEGER,
    amount REAL NOT NULL,
    description TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS role_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#c9a84c',
    is_special INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS treasury_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    amount REAL NOT NULL,
    description TEXT,
    source TEXT NOT NULL,
    source_id INTEGER,
    source_name TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO role_definitions (name, slug, color, is_special) VALUES
    ('Socio', 'socio', '#60a5fa', 1),
    ('Inversionista', 'inversionista', '#22c55e', 1),
    ('Propietario', 'propietario', '#a78bfa', 1);
`);

const memberRolesInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='member_roles'").get();
if (memberRolesInfo && memberRolesInfo.sql.includes("CHECK")) {
  db.exec(`
    CREATE TABLE member_roles_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );
    INSERT INTO member_roles_new (id, member_id, role) SELECT id, member_id, role FROM member_roles;
    DROP TABLE member_roles;
    ALTER TABLE member_roles_new RENAME TO member_roles;
  `);
}

const inventoryInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='farm_inventory'").get();
if (inventoryInfo && !inventoryInfo.sql.includes('price')) {
  db.exec(`ALTER TABLE farm_inventory ADD COLUMN price REAL DEFAULT 0`);
}

const farmTxInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='farm_transactions'").get();
if (farmTxInfo && farmTxInfo.sql.includes("'sale'")) {
  db.exec(`
    CREATE TABLE farm_transactions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farm_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('entrada', 'salida')),
      product TEXT,
      quantity REAL,
      amount REAL NOT NULL,
      description TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );
    INSERT INTO farm_transactions_new (id, farm_id, type, product, quantity, amount, description, date)
      SELECT id, farm_id,
        CASE type WHEN 'sale' THEN 'salida' WHEN 'purchase' THEN 'entrada' WHEN 'expense' THEN 'entrada' ELSE type END,
        product, quantity, amount, description, date
      FROM farm_transactions;
    DROP TABLE farm_transactions;
    ALTER TABLE farm_transactions_new RENAME TO farm_transactions;
  `);
}

const farmsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='farms'").get();
if (farmsInfo && !farmsInfo.sql.includes('owner')) {
  db.exec(`ALTER TABLE farms ADD COLUMN owner TEXT DEFAULT ''`);
}

const farmTxPriceInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='farm_transactions'").get();
if (farmTxPriceInfo && !farmTxPriceInfo.sql.includes('price')) {
  db.exec(`ALTER TABLE farm_transactions ADD COLUMN price REAL DEFAULT 0`);
}

const txMemberInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'").get();
if (txMemberInfo && !txMemberInfo.sql.includes('member_id')) {
  db.exec(`ALTER TABLE transactions ADD COLUMN member_id INTEGER REFERENCES members(id) ON DELETE SET NULL`);
}

const farmProductsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='farm_products'").get();
if (!farmProductsInfo) {
  db.exec(`
    CREATE TABLE farm_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farm_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '',
      price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );
  `);

  const invSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='farm_inventory'").get();
  if (invSchema && invSchema.sql.includes("CHECK(product IN")) {
    db.exec(`
      CREATE TABLE farm_inventory_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        farm_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity REAL DEFAULT 0,
        FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES farm_products(id) ON DELETE CASCADE
      );
      INSERT INTO farm_inventory_new (id, farm_id, product_id, quantity)
        SELECT fi.id, fi.farm_id, fp.id, fi.quantity
        FROM farm_inventory fi
        JOIN farm_products fp ON fp.farm_id = fi.farm_id AND fp.name = fi.product;
      DROP TABLE farm_inventory;
      ALTER TABLE farm_inventory_new RENAME TO farm_inventory;
    `);
  } else if (invSchema && invSchema.sql.includes('product TEXT')) {
    db.exec(`
      CREATE TABLE farm_inventory_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        farm_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity REAL DEFAULT 0,
        FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES farm_products(id) ON DELETE CASCADE
      );
      DROP TABLE farm_inventory;
      ALTER TABLE farm_inventory_new RENAME TO farm_inventory;
    `);
  }

  const txSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='farm_transactions'").get();
  if (txSchema && txSchema.sql.includes('product TEXT')) {
    db.exec(`
      CREATE TABLE farm_transactions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        farm_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('entrada', 'salida')),
        product_id INTEGER,
        quantity REAL,
        price REAL DEFAULT 0,
        amount REAL NOT NULL,
        description TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
      );
      DROP TABLE farm_transactions;
      ALTER TABLE farm_transactions_new RENAME TO farm_transactions;
    `);
  }

  const farms = db.prepare('SELECT id FROM farms').all();
  for (const farm of farms) {
    const existing = db.prepare('SELECT COUNT(*) as c FROM farm_products WHERE farm_id = ?').get(farm.id);
    if (existing.c === 0) {
      db.prepare('INSERT INTO farm_products (farm_id, name, icon, price) VALUES (?, ?, ?, ?)').run(farm.id, 'Producto', '', 0);
    }
  }
}

module.exports = db;
