"""
freeze.py – Frozen-Flask を使って Flask アプリを静的サイトとして書き出すスクリプト。
GitHub Actions から呼び出され、生成物を build/ ディレクトリに出力する。
"""
import os
import shutil

# ── サンプルデータ用の一時 DB パスに差し替え ──────────────────────────────
import database as db

db.DATABASE = os.path.join('/tmp', 'freeze_webapp.db')

# ── サンプルデータ初期化 ───────────────────────────────────────────────────
db.init_db()
conn = db.get_db()
today = '2026-05-01'

conn.execute("UPDATE financial_accounts SET balance = 250000 WHERE account_type = 'bank'")
conn.execute("UPDATE financial_accounts SET balance = 15000  WHERE account_type = 'cash'")
conn.execute("UPDATE financial_accounts SET balance = 8500   WHERE account_type = 'card'")

conn.executemany(
    "INSERT INTO transactions (account_id, amount, transaction_type, description, date)"
    " VALUES (?, ?, ?, ?, ?)",
    [
        (1, 200000, 'salary',  '給与振り込み: 4月分',         today),
        (2,   3200, 'expense', '買い出し(現金): スーパー',     today),
        (3,   5300, 'expense', '買い出し(カード): ドラッグストア', today),
    ]
)

conn.executemany(
    "INSERT INTO inventory_items (name, quantity, unit, category) VALUES (?, ?, ?, ?)",
    [
        ('米',       5, 'kg', '主食'),
        ('卵',       8, '個', '卵・乳製品'),
        ('牛乳',     1, 'L',  '卵・乳製品'),
        ('玉ねぎ',   3, '個', '野菜'),
        ('にんじん', 2, '本', '野菜'),
        ('じゃがいも', 0, '個', '野菜'),
    ]
)

conn.execute(
    "INSERT INTO dinner_menus (name, description, instructions) VALUES (?, ?, ?)",
    ('カレーライス', '家庭の定番カレー',
     '1. 野菜を切る\n2. 肉を炒める\n3. カレールーを加えて煮込む')
)
menu_id = conn.execute("SELECT last_insert_rowid() AS id").fetchone()['id']
conn.executemany(
    "INSERT INTO menu_ingredients (menu_id, item_name, quantity, unit) VALUES (?, ?, ?, ?)",
    [
        (menu_id, '玉ねぎ',     1, '個'),
        (menu_id, 'にんじん',   1, '本'),
        (menu_id, 'じゃがいも', 2, '個'),
        (menu_id, '米',         0.5, 'kg'),
    ]
)
conn.commit()
conn.close()

# ── Frozen-Flask 設定 ─────────────────────────────────────────────────────
from app import app  # noqa: E402 (db.DATABASE must be patched first)
from flask_frozen import Freezer  # noqa: E402

app.config['FREEZER_DESTINATION'] = 'build'
app.config['FREEZER_RELATIVE_URLS'] = True
app.config['FREEZER_IGNORE_MIMETYPE_WARNINGS'] = True

# with_no_argument_rules=False: デフォルトの URL 自動探索を無効化し、
#   手動で trailing-slash 付き URL を登録する。
# log_url_for=False: テンプレート内の url_for() 呼び出し（POST フォームの
#   action 等）が追加 URL として登録されるのを防ぐ。
freezer = Freezer(app, with_no_argument_rules=False, log_url_for=False)


@freezer.register_generator
def all_pages():
    """凍結対象の全ページを trailing-slash 付きで列挙する。"""
    yield '/'
    yield '/finance/'
    yield '/inventory/'
    yield '/menu/'


if __name__ == '__main__':
    import warnings
    from flask_frozen import MissingURLGeneratorWarning
    warnings.filterwarnings('ignore', category=MissingURLGeneratorWarning)

    if os.path.exists('build'):
        shutil.rmtree('build')
    freezer.freeze()

    # Jekyll 処理を無効化して GitHub Pages が静的ファイルをそのまま配信する
    with open(os.path.join('build', '.nojekyll'), 'w'):
        pass

    print("静的サイトを build/ ディレクトリに生成しました。")
