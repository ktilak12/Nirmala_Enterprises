-- ============================================================================
-- Migration: 0001_initial_schema.sql
-- Description: Initial D1 schema for Nirmala Enterprises Agro Management System
-- Database: Cloudflare D1 (SQLite)
-- ============================================================================

-- 1. Users Table (System Administrators & Staff)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER',
    password_hash TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. User Data (Generic key-value / document store for user preferences and custom state)
CREATE TABLE IF NOT EXISTS user_data (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_user_data_user_key ON user_data(user_id, key);

-- 3. Products (Catalog & Inventory)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_code TEXT,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT,
    brand TEXT,
    purchase_price REAL DEFAULT 0,
    selling_price REAL DEFAULT 0,
    current_stock REAL DEFAULT 0,
    min_stock_alert REAL DEFAULT 10,
    description TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(user_id, product_code);

-- 4. Farmers (Farmer Registry)
CREATE TABLE IF NOT EXISTS farmers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    farmer_code TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    village TEXT,
    land_acres REAL DEFAULT 0,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_farmers_user ON farmers(user_id);
CREATE INDEX IF NOT EXISTS idx_farmers_phone ON farmers(user_id, phone);

-- 5. Parties (Suppliers, Mandi Buyers, Millers)
CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    phone TEXT,
    gstin TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_parties_user ON parties(user_id);

-- 6. Sales (POS Invoices & Customer Orders)
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    invoice_no TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    grand_total REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    balance_due REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'PAID',
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(user_id, invoice_no);

-- 7. Purchases (Mandi Crop Procurement)
CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    receipt_number TEXT NOT NULL,
    farmer_id TEXT,
    farmer_name TEXT,
    commodity TEXT,
    payable_weight_kg REAL DEFAULT 0,
    rate_per_quintal REAL DEFAULT 0,
    net_payable REAL DEFAULT 0,
    status TEXT DEFAULT 'COMPLETED',
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);

-- 8. Loans (Farmer Advances & Micro-lending)
CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    loan_number TEXT NOT NULL,
    farmer_id TEXT,
    borrower_name TEXT,
    principal_amount REAL DEFAULT 0,
    interest_rate REAL DEFAULT 12,
    status TEXT DEFAULT 'ACTIVE',
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);

-- 9. Expenses (Operating Expenses)
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    amount REAL DEFAULT 0,
    category TEXT,
    date TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);

-- 10. Settings (Business Profile & Defaults)
CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY,
    company_name TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
