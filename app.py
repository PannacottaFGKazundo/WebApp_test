import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from datetime import date
import database as db

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'refrigerator-app-secret-key-dev-only')


def init_db():
    db.init_db()


# ──────────────────────────────────────────────
# Dashboard
# ──────────────────────────────────────────────
@app.route('/')
def index():
    accounts = db.get_accounts()
    account_map = {a['account_type']: a for a in accounts}
    recent_txns = db.get_recent_transactions(5)
    low_stock = db.get_low_stock_items(1)
    return render_template(
        'index.html',
        account_map=account_map,
        recent_txns=recent_txns,
        low_stock=low_stock,
        today=date.today().isoformat()
    )


# ──────────────────────────────────────────────
# Finance
# ──────────────────────────────────────────────
@app.route('/finance')
def finance():
    accounts = db.get_accounts()
    account_map = {a['account_type']: a for a in accounts}
    transactions = db.get_recent_transactions(20)
    all_accounts = accounts
    return render_template(
        'finance.html',
        account_map=account_map,
        transactions=transactions,
        all_accounts=all_accounts,
        today=date.today().isoformat()
    )


@app.route('/finance/transaction', methods=['POST'])
def add_transaction():
    transaction_type = request.form.get('transaction_type')
    amount_str = request.form.get('amount', '0')
    description = request.form.get('description', '')
    txn_date = request.form.get('date', date.today().isoformat())
    other_account_id = request.form.get('other_account_id')
    other_direction = request.form.get('other_direction', 'expense')

    try:
        amount = float(amount_str)
        if amount <= 0:
            raise ValueError
    except ValueError:
        flash('金額を正しく入力してください。', 'danger')
        return redirect(url_for('finance'))

    conn = db.get_db()
    try:
        bank = conn.execute(
            "SELECT * FROM financial_accounts WHERE account_type='bank'"
        ).fetchone()
        cash = conn.execute(
            "SELECT * FROM financial_accounts WHERE account_type='cash'"
        ).fetchone()
        card = conn.execute(
            "SELECT * FROM financial_accounts WHERE account_type='card'"
        ).fetchone()

        if transaction_type == 'shopping_cash':
            # 買い出し(現金): deduct from 財布
            db.update_balance(cash['id'], -amount, conn)
            db.add_transaction(cash['id'], amount, 'expense', f'買い出し(現金): {description}', txn_date, conn)

        elif transaction_type == 'shopping_card':
            # 買い出し(カード): add to カード利用額
            db.update_balance(card['id'], amount, conn)
            db.add_transaction(card['id'], amount, 'expense', f'買い出し(カード): {description}', txn_date, conn)

        elif transaction_type == 'withdrawal':
            # 引き出し: deduct from 口座, add to 財布
            db.update_balance(bank['id'], -amount, conn)
            db.update_balance(cash['id'], amount, conn)
            db.add_transaction(bank['id'], amount, 'withdrawal', f'引き出し: {description}', txn_date, conn)

        elif transaction_type == 'deposit':
            # 預入: deduct from 財布, add to 口座
            db.update_balance(cash['id'], -amount, conn)
            db.update_balance(bank['id'], amount, conn)
            db.add_transaction(bank['id'], amount, 'deposit', f'預入: {description}', txn_date, conn)

        elif transaction_type == 'salary':
            # 給与振り込み: add to 口座
            db.update_balance(bank['id'], amount, conn)
            db.add_transaction(bank['id'], amount, 'salary', f'給与振り込み: {description}', txn_date, conn)

        elif transaction_type == 'other':
            # その他: user specifies account and direction
            if not other_account_id:
                flash('口座を選択してください。', 'danger')
                conn.close()
                return redirect(url_for('finance'))
            delta = amount if other_direction == 'income' else -amount
            db.update_balance(int(other_account_id), delta, conn)
            db.add_transaction(
                int(other_account_id), amount,
                'income' if other_direction == 'income' else 'expense',
                f'その他: {description}', txn_date, conn
            )

        conn.commit()
        flash('取引を記録しました。', 'success')
    except Exception as e:
        conn.rollback()
        flash(f'エラーが発生しました: {e}', 'danger')
    finally:
        conn.close()

    return redirect(url_for('finance'))


# ──────────────────────────────────────────────
# Inventory
# ──────────────────────────────────────────────
@app.route('/inventory')
def inventory():
    category_filter = request.args.get('category', '')
    items = db.get_inventory_items(category_filter if category_filter else None)
    categories = db.get_categories()
    return render_template(
        'inventory.html',
        items=items,
        categories=categories,
        selected_category=category_filter
    )


@app.route('/inventory/add', methods=['POST'])
def inventory_add():
    name = request.form.get('name', '').strip()
    quantity_str = request.form.get('quantity', '0')
    unit = request.form.get('unit', '個').strip()
    category = request.form.get('category', '').strip()

    if not name:
        flash('名前を入力してください。', 'danger')
        return redirect(url_for('inventory'))

    try:
        quantity = float(quantity_str)
    except ValueError:
        flash('数量を正しく入力してください。', 'danger')
        return redirect(url_for('inventory'))

    conn = db.get_db()
    try:
        conn.execute(
            """INSERT INTO inventory_items (name, quantity, unit, category, updated_at)
               VALUES (?, ?, ?, ?, datetime('now','localtime'))""",
            (name, quantity, unit, category or None)
        )
        conn.commit()
        flash(f'「{name}」を追加しました。', 'success')
    except Exception as e:
        conn.rollback()
        flash(f'エラー: {e}', 'danger')
    finally:
        conn.close()

    return redirect(url_for('inventory'))


@app.route('/inventory/update/<int:item_id>', methods=['POST'])
def inventory_update(item_id):
    delta_str = request.form.get('delta', '0')
    try:
        delta = float(delta_str)
    except ValueError:
        flash('数量を正しく入力してください。', 'danger')
        return redirect(url_for('inventory'))

    conn = db.get_db()
    try:
        item = conn.execute(
            "SELECT * FROM inventory_items WHERE id = ?", (item_id,)
        ).fetchone()
        if not item:
            flash('アイテムが見つかりません。', 'danger')
            conn.close()
            return redirect(url_for('inventory'))

        new_qty = item['quantity'] + delta
        conn.execute(
            """UPDATE inventory_items
               SET quantity = ?, updated_at = datetime('now','localtime')
               WHERE id = ?""",
            (new_qty, item_id)
        )
        reason = '追加' if delta > 0 else '使用'
        conn.execute(
            """INSERT INTO inventory_history (item_id, change_amount, reason, date)
               VALUES (?, ?, ?, date('now','localtime'))""",
            (item_id, delta, reason)
        )
        conn.commit()
        flash(f'「{item["name"]}」の数量を更新しました。', 'success')
    except Exception as e:
        conn.rollback()
        flash(f'エラー: {e}', 'danger')
    finally:
        conn.close()

    return redirect(url_for('inventory'))


@app.route('/inventory/delete/<int:item_id>', methods=['POST'])
def inventory_delete(item_id):
    conn = db.get_db()
    try:
        item = conn.execute(
            "SELECT * FROM inventory_items WHERE id = ?", (item_id,)
        ).fetchone()
        if item:
            conn.execute("DELETE FROM inventory_items WHERE id = ?", (item_id,))
            conn.commit()
            flash(f'「{item["name"]}」を削除しました。', 'success')
        else:
            flash('アイテムが見つかりません。', 'danger')
    except Exception as e:
        conn.rollback()
        flash(f'エラー: {e}', 'danger')
    finally:
        conn.close()

    return redirect(url_for('inventory'))


# ──────────────────────────────────────────────
# Menu
# ──────────────────────────────────────────────
@app.route('/menu')
def menu():
    menus = db.get_menus()
    return render_template('menu.html', menus=menus)


@app.route('/menu/add', methods=['POST'])
def menu_add():
    name = request.form.get('name', '').strip()
    description = request.form.get('description', '').strip()
    instructions = request.form.get('instructions', '').strip()

    if not name:
        flash('メニュー名を入力してください。', 'danger')
        return redirect(url_for('menu'))

    ingredient_names = request.form.getlist('ingredient_name[]')
    ingredient_quantities = request.form.getlist('ingredient_quantity[]')
    ingredient_units = request.form.getlist('ingredient_unit[]')

    conn = db.get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO dinner_menus (name, description, instructions) VALUES (?, ?, ?)",
            (name, description, instructions)
        )
        menu_id = cursor.lastrowid

        for i, iname in enumerate(ingredient_names):
            iname = iname.strip()
            if not iname:
                continue
            try:
                iqty = float(ingredient_quantities[i]) if i < len(ingredient_quantities) else 0
            except (ValueError, IndexError):
                iqty = 0
            iunit = ingredient_units[i].strip() if i < len(ingredient_units) else ''
            conn.execute(
                "INSERT INTO menu_ingredients (menu_id, item_name, quantity, unit) VALUES (?, ?, ?, ?)",
                (menu_id, iname, iqty, iunit)
            )

        conn.commit()
        flash(f'「{name}」を登録しました。', 'success')
    except Exception as e:
        conn.rollback()
        flash(f'エラー: {e}', 'danger')
    finally:
        conn.close()

    return redirect(url_for('menu'))


@app.route('/menu/<int:menu_id>')
def menu_detail(menu_id):
    menu_item, ingredients = db.get_menu_with_ingredients(menu_id)
    if not menu_item:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({
        'id': menu_item['id'],
        'name': menu_item['name'],
        'description': menu_item['description'] or '',
        'instructions': menu_item['instructions'] or '',
        'ingredients': [
            {
                'item_name': ing['item_name'],
                'quantity': ing['quantity'],
                'unit': ing['unit'] or ''
            }
            for ing in ingredients
        ]
    })


@app.route('/menu/<int:menu_id>/cook', methods=['POST'])
def menu_cook(menu_id):
    menu_item, ingredients = db.get_menu_with_ingredients(menu_id)
    if not menu_item:
        flash('メニューが見つかりません。', 'danger')
        return redirect(url_for('menu'))

    conn = db.get_db()
    try:
        today = date.today().isoformat()
        for ing in ingredients:
            item = conn.execute(
                "SELECT * FROM inventory_items WHERE name = ?", (ing['item_name'],)
            ).fetchone()
            if item:
                new_qty = item['quantity'] - ing['quantity']
                conn.execute(
                    """UPDATE inventory_items
                       SET quantity = ?, updated_at = datetime('now','localtime')
                       WHERE id = ?""",
                    (new_qty, item['id'])
                )
                conn.execute(
                    """INSERT INTO inventory_history (item_id, change_amount, reason, date)
                       VALUES (?, ?, ?, ?)""",
                    (item['id'], -ing['quantity'], f'調理: {menu_item["name"]}', today)
                )
            else:
                flash(f'材料「{ing["item_name"]}」が在庫に見つかりません（スキップしました）。', 'warning')
        conn.commit()
        flash(f'「{menu_item["name"]}」を作りました！在庫を更新しました。', 'success')
    except Exception as e:
        conn.rollback()
        flash(f'エラー: {e}', 'danger')
    finally:
        conn.close()

    return redirect(url_for('menu'))


@app.route('/menu/delete/<int:menu_id>', methods=['POST'])
def menu_delete(menu_id):
    conn = db.get_db()
    try:
        menu_item = conn.execute(
            "SELECT * FROM dinner_menus WHERE id = ?", (menu_id,)
        ).fetchone()
        if menu_item:
            conn.execute("DELETE FROM menu_ingredients WHERE menu_id = ?", (menu_id,))
            conn.execute("DELETE FROM dinner_menus WHERE id = ?", (menu_id,))
            conn.commit()
            flash(f'「{menu_item["name"]}」を削除しました。', 'success')
        else:
            flash('メニューが見つかりません。', 'danger')
    except Exception as e:
        conn.rollback()
        flash(f'エラー: {e}', 'danger')
    finally:
        conn.close()

    return redirect(url_for('menu'))


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
