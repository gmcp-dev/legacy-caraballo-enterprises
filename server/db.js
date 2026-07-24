const Database = require('better-sqlite3');
const path = require('path');

const dbDir = process.env.DB_DIR || __dirname;
const dbPath = path.join(dbDir, 'legacy.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('investment', 'earning', 'expense')),
    amount REAL NOT NULL,
    description TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS farms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    logo TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    PRIMARY KEY (member_id, project_id)
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
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
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

  CREATE TABLE IF NOT EXISTS farm_debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL,
    proveedor_name TEXT NOT NULL,
    total_amount REAL NOT NULL,
    remaining REAL NOT NULL,
    source_tx_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bank_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    profile_link TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bank_loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    interest_pct REAL NOT NULL,
    total_to_pay REAL NOT NULL,
    deadline TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES bank_clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bank_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES bank_loans(id) ON DELETE CASCADE
  );

  INSERT OR IGNORE INTO role_definitions (name, slug, color, is_special) VALUES
    ('Socio', 'socio', '#60a5fa', 1),
    ('Inversionista', 'inversionista', '#22c55e', 1),
    ('Proveedor', 'proveedor', '#a78bfa', 1),
    ('Empleado', 'empleado', '#f59e0b', 1);
`);

const ownerSlugMigration = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='role_definitions'").get();
if (ownerSlugMigration) {
  db.prepare("UPDATE member_roles SET role = 'proveedor' WHERE role = 'propietario'").run();
  db.prepare("DELETE FROM role_definitions WHERE slug = 'propietario'").run();
}

const projectsTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'").get();
if (projectsTableInfo) {
  db.exec(`DROP TABLE IF EXISTS projects`);
}

const txInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'").get();
if (txInfo && txInfo.sql.includes('REFERENCES projects')) {
  db.exec(`
    CREATE TABLE transactions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('investment', 'earning', 'expense')),
      amount REAL NOT NULL,
      description TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO transactions_new (id, project_id, type, amount, description, date)
      SELECT id, project_id, type, amount, description, date FROM transactions;
    DROP TABLE transactions;
    ALTER TABLE transactions_new RENAME TO transactions;
  `);
}

const farmsInfo2 = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='farms'").get();
if (farmsInfo2 && farmsInfo2.sql.includes('REFERENCES projects')) {
  db.exec(`
    CREATE TABLE farms_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      logo TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO farms_new (id, project_id, name, logo, status, created_at)
      SELECT id, project_id, name, logo, status, created_at FROM farms;
    DROP TABLE farms;
    ALTER TABLE farms_new RENAME TO farms;
  `);
}

const memberProjectsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='member_projects'").get();
if (memberProjectsInfo && memberProjectsInfo.sql.includes('REFERENCES projects')) {
  db.exec(`
    CREATE TABLE member_projects_new (
      member_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      PRIMARY KEY (member_id, project_id)
    );
    INSERT INTO member_projects_new (member_id, project_id)
      SELECT member_id, project_id FROM member_projects;
    DROP TABLE member_projects;
    ALTER TABLE member_projects_new RENAME TO member_projects;
  `);
}

const investmentsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='investments'").get();
if (investmentsInfo && investmentsInfo.sql.includes('REFERENCES projects')) {
  db.exec(`
    CREATE TABLE investments_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      project_id INTEGER,
      amount REAL NOT NULL,
      description TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );
    INSERT INTO investments_new (id, member_id, project_id, amount, description, date)
      SELECT id, member_id, project_id, amount, description, date FROM investments;
    DROP TABLE investments;
    ALTER TABLE investments_new RENAME TO investments;
  `);
}

const memberRolesInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='member_roles'").get();
if (memberRolesInfo && !memberRolesInfo.sql.includes("UNIQUE(member_id, role)")) {
  db.exec(`DELETE FROM member_roles WHERE id NOT IN (SELECT MIN(id) FROM member_roles GROUP BY member_id, role)`);
  db.exec(`
    CREATE TABLE member_roles_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      UNIQUE(member_id, role)
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

const DEFAULT_PRODUCTS = [
  { name: 'Leche', icon: '', price: 0 },
  { name: 'Carne de vaca', icon: '', price: 0 },
  { name: 'Carne de cerdo', icon: '', price: 0 },
  { name: 'Muslos de pollo', icon: '', price: 0 },
  { name: 'Huevos', icon: '', price: 0 },
];

const farmsWithoutProducts = db.prepare(`
  SELECT f.id FROM farms f
  WHERE NOT EXISTS (SELECT 1 FROM farm_products WHERE farm_id = f.id)
`).all();

for (const farm of farmsWithoutProducts) {
  const insertProduct = db.prepare('INSERT INTO farm_products (farm_id, name, icon, price) VALUES (?, ?, ?, ?)');
  const insertInventory = db.prepare('INSERT INTO farm_inventory (farm_id, product_id, quantity) VALUES (?, ?, 0)');
  for (const p of DEFAULT_PRODUCTS) {
    const result = insertProduct.run(farm.id, p.name, p.icon, p.price);
    insertInventory.run(farm.id, result.lastInsertRowid);
  }
}

// ==================== BIG BISTEC TABLES ====================

const bistecProductsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bistec_products'").get();
if (!bistecProductsInfo) {
  db.exec(`
    CREATE TABLE bistec_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cost_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE bistec_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL UNIQUE,
      quantity REAL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES bistec_products(id) ON DELETE CASCADE
    );

    CREATE TABLE bistec_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('entrada')),
      quantity REAL,
      price REAL DEFAULT 0,
      amount REAL NOT NULL,
      description TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES bistec_products(id) ON DELETE CASCADE
    );

    CREATE TABLE bistec_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      cost_price REAL NOT NULL,
      assigned_price REAL NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'settled')),
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES bistec_products(id) ON DELETE CASCADE
    );

    CREATE TABLE bistec_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      quantity_sold REAL NOT NULL,
      revenue REAL NOT NULL,
      description TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (delivery_id) REFERENCES bistec_deliveries(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES bistec_products(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE TABLE bistec_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL UNIQUE,
      product_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      quantity_returned REAL DEFAULT 0,
      description TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (delivery_id) REFERENCES bistec_deliveries(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES bistec_products(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );
  `);
} else {
  const salesInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bistec_sales'").get();
  if (!salesInfo) {
    db.exec(`
      CREATE TABLE bistec_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        delivery_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        quantity_sold REAL NOT NULL,
        revenue REAL NOT NULL,
        description TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (delivery_id) REFERENCES bistec_deliveries(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES bistec_products(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );
    `);
  }

  const settlementDeliveryUnique = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bistec_settlements'").get();
  if (settlementDeliveryUnique && !settlementDeliveryUnique.sql.includes('UNIQUE')) {
    db.exec(`
      CREATE TABLE bistec_settlements_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        delivery_id INTEGER NOT NULL UNIQUE,
        product_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        quantity_returned REAL DEFAULT 0,
        description TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (delivery_id) REFERENCES bistec_deliveries(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES bistec_products(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );
      INSERT INTO bistec_settlements_new (id, delivery_id, product_id, member_id, quantity_returned, description, date)
        SELECT id, delivery_id, product_id, member_id, quantity_returned, description, date FROM bistec_settlements;
      DROP TABLE bistec_settlements;
      ALTER TABLE bistec_settlements_new RENAME TO bistec_settlements;
    `);
  }
}

const bigBistecProjectId = 2;
const staleBigBistecMembers = db.prepare(`
  SELECT mp.member_id FROM member_projects mp
  WHERE mp.project_id = 3
  AND EXISTS (SELECT 1 FROM member_roles mr WHERE mr.member_id = mp.member_id AND mr.role = 'empleado')
  AND NOT EXISTS (SELECT 1 FROM member_projects mp2 WHERE mp2.member_id = mp.member_id AND mp2.project_id = ?)
`).all(bigBistecProjectId);
for (const row of staleBigBistecMembers) {
  db.prepare('DELETE FROM member_projects WHERE member_id = ? AND project_id = 3').run(row.member_id);
  db.prepare('INSERT OR IGNORE INTO member_projects (member_id, project_id) VALUES (?, ?)').run(row.member_id, bigBistecProjectId);
}

module.exports = db;
