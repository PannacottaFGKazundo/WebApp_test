import sqlite3
import os
from datetime import date

DATABASE = os.path.join(os.path.dirname(__file__), 'webapp.db')


def _dict_factory(cursor, row):
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = _dict_factory
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript('''
        CREATE TABLE IF NOT EXISTS financial_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            balance REAL NOT NULL DEFAULT 0,
            account_type TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER,
            amount REAL NOT NULL,
            transaction_type TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (account_id) REFERENCES financial_accounts(id)
        );

        CREATE TABLE IF NOT EXISTS inventory_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            quantity REAL NOT NULL DEFAULT 0,
            unit TEXT NOT NULL DEFAULT '個',
            category TEXT,
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS dinner_menus (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            instructions TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS menu_ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            menu_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            quantity REAL NOT NULL DEFAULT 0,
            unit TEXT,
            FOREIGN KEY (menu_id) REFERENCES dinner_menus(id)
        );

        CREATE TABLE IF NOT EXISTS inventory_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER,
            change_amount REAL NOT NULL,
            reason TEXT,
            date TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (item_id) REFERENCES inventory_items(id)
        );
    ''')

    # Insert default accounts only if they don't exist
    c.execute("SELECT COUNT(*) as cnt FROM financial_accounts")
    if c.fetchone()['cnt'] == 0:
        c.executemany(
            "INSERT INTO financial_accounts (name, balance, account_type) VALUES (?, ?, ?)",
            [
                ('口座', 0, 'bank'),
                ('財布', 0, 'cash'),
                ('カード', 0, 'card'),
            ]
        )

    conn.commit()
    conn.close()


def get_accounts():
    conn = get_db()
    accounts = conn.execute(
        "SELECT * FROM financial_accounts ORDER BY id"
    ).fetchall()
    conn.close()
    return accounts


def get_account_by_type(account_type):
    conn = get_db()
    account = conn.execute(
        "SELECT * FROM financial_accounts WHERE account_type = ?",
        (account_type,)
    ).fetchone()
    conn.close()
    return account


def update_balance(account_id, delta, conn=None):
    close_after = False
    if conn is None:
        conn = get_db()
        close_after = True
    conn.execute(
        "UPDATE financial_accounts SET balance = balance + ? WHERE id = ?",
        (delta, account_id)
    )
    if close_after:
        conn.commit()
        conn.close()


def add_transaction(account_id, amount, transaction_type, description, txn_date, conn=None):
    close_after = False
    if conn is None:
        conn = get_db()
        close_after = True
    conn.execute(
        """INSERT INTO transactions
           (account_id, amount, transaction_type, description, date)
           VALUES (?, ?, ?, ?, ?)""",
        (account_id, amount, transaction_type, description, txn_date)
    )
    if close_after:
        conn.commit()
        conn.close()


def get_recent_transactions(limit=20):
    conn = get_db()
    rows = conn.execute(
        """SELECT t.*, a.name as account_name
           FROM transactions t
           LEFT JOIN financial_accounts a ON t.account_id = a.id
           ORDER BY t.date DESC, t.created_at DESC
           LIMIT ?""",
        (limit,)
    ).fetchall()
    conn.close()
    return rows


def get_inventory_items(category=None):
    conn = get_db()
    if category:
        rows = conn.execute(
            "SELECT * FROM inventory_items WHERE category = ? ORDER BY category, name",
            (category,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM inventory_items ORDER BY category, name"
        ).fetchall()
    conn.close()
    return rows


def get_low_stock_items(threshold=1):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM inventory_items WHERE quantity <= ? ORDER BY quantity ASC",
        (threshold,)
    ).fetchall()
    conn.close()
    return rows


def get_menus():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM dinner_menus ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return rows


def get_menu_with_ingredients(menu_id):
    conn = get_db()
    menu = conn.execute(
        "SELECT * FROM dinner_menus WHERE id = ?", (menu_id,)
    ).fetchone()
    ingredients = conn.execute(
        "SELECT * FROM menu_ingredients WHERE menu_id = ?", (menu_id,)
    ).fetchall()
    conn.close()
    return menu, ingredients


def get_categories():
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT category FROM inventory_items WHERE category IS NOT NULL ORDER BY category"
    ).fetchall()
    conn.close()
    return [r['category'] for r in rows if r['category']]
