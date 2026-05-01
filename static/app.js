'use strict';

// =============================================================================
// State management (localStorage)
// =============================================================================
var APP_KEY = 'webapp_v1';

var DEFAULT_STATE = {
    accounts: [
        { id: 1, account_type: 'bank',  name: '銀行口座',         balance: 250000 },
        { id: 2, account_type: 'cash',  name: '財布',             balance: 15000  },
        { id: 3, account_type: 'card',  name: 'クレジットカード', balance: 8500   }
    ],
    transactions: [
        { id: 1, account_id: 1, amount: 200000, transaction_type: 'salary',
          description: '給与振り込み: 4月分',             date: '2026-05-01', account_name: '銀行口座'         },
        { id: 2, account_id: 2, amount:   3200, transaction_type: 'expense',
          description: '買い出し(現金): スーパー',         date: '2026-05-01', account_name: '財布'             },
        { id: 3, account_id: 3, amount:   5300, transaction_type: 'expense',
          description: '買い出し(カード): ドラッグストア', date: '2026-05-01', account_name: 'クレジットカード' }
    ],
    inventory: [
        { id: 1, name: '米',         quantity: 5, unit: 'kg', category: '主食',       updated_at: '2026-05-01' },
        { id: 2, name: '卵',         quantity: 8, unit: '個', category: '卵・乳製品', updated_at: '2026-05-01' },
        { id: 3, name: '牛乳',       quantity: 1, unit: 'L',  category: '卵・乳製品', updated_at: '2026-05-01' },
        { id: 4, name: '玉ねぎ',     quantity: 3, unit: '個', category: '野菜',       updated_at: '2026-05-01' },
        { id: 5, name: 'にんじん',   quantity: 2, unit: '本', category: '野菜',       updated_at: '2026-05-01' },
        { id: 6, name: 'じゃがいも', quantity: 0, unit: '個', category: '野菜',       updated_at: '2026-05-01' }
    ],
    menus: [
        {
            id: 1,
            name: 'カレーライス',
            description: '家庭の定番カレー',
            instructions: '1. 野菜を切る\n2. 肉を炒める\n3. カレールーを加えて煮込む',
            ingredients: [
                { item_name: '玉ねぎ',     quantity: 1,   unit: '個' },
                { item_name: 'にんじん',   quantity: 1,   unit: '本' },
                { item_name: 'じゃがいも', quantity: 2,   unit: '個' },
                { item_name: '米',         quantity: 0.5, unit: 'kg' }
            ]
        }
    ],
    next_ids: { transaction: 4, inventory: 7, menu: 2 }
};

function getState() {
    try {
        var raw = localStorage.getItem(APP_KEY);
        return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_STATE));
    } catch (e) {
        return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
}

function saveState(state) {
    localStorage.setItem(APP_KEY, JSON.stringify(state));
}

function todayISO() {
    return new Date().toISOString().split('T')[0];
}

function accountMap(accounts) {
    var m = {};
    accounts.forEach(function (a) { m[a.account_type] = a; });
    return m;
}

// =============================================================================
// UI utilities
// =============================================================================
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmt(n) {
    return Number(n).toLocaleString('ja-JP', { maximumFractionDigits: 0 });
}

function fmtQty(q) {
    return String(Number(q));
}

function showAlert(msg, type) {
    var container = document.getElementById('alert-container');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'alert alert-' + type + ' alert-dismissible fade show';
    div.setAttribute('role', 'alert');
    div.innerHTML = escHtml(msg) +
        '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="閉じる"></button>';
    container.appendChild(div);
    setTimeout(function () {
        try {
            bootstrap.Alert.getOrCreateInstance(div).close();
        } catch (e) {
            if (div.parentNode) div.parentNode.removeChild(div);
        }
    }, 4000);
}

// =============================================================================
// Shared: balance cards
// =============================================================================
function renderBalanceCards(state) {
    var am = accountMap(state.accounts);
    function setEl(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = '¥' + fmt(val);
    }
    setEl('balance-bank', (am['bank'] || { balance: 0 }).balance);
    setEl('balance-cash', (am['cash'] || { balance: 0 }).balance);
    setEl('balance-card', (am['card'] || { balance: 0 }).balance);
}

// =============================================================================
// Dashboard page
// =============================================================================
function renderDashboard() {
    var state = getState();
    renderBalanceCards(state);

    // Recent transactions (last 5, newest first)
    var recent = state.transactions.slice().reverse().slice(0, 5);
    var txnEl = document.getElementById('recent-txns');
    if (txnEl) {
        if (recent.length === 0) {
            txnEl.innerHTML = '<p class="text-muted text-center py-3 mb-0">取引がありません</p>';
        } else {
            txnEl.innerHTML = '<ul class="list-group list-group-flush">' +
                recent.map(function (t) {
                    var isIncome = ['income', 'salary', 'deposit'].indexOf(t.transaction_type) >= 0;
                    return '<li class="list-group-item py-2 px-3">' +
                        '<div class="d-flex justify-content-between align-items-center">' +
                            '<div>' +
                                '<div class="small fw-bold">' + escHtml(t.description || t.transaction_type) + '</div>' +
                                '<div class="text-muted" style="font-size:0.75rem">' +
                                    escHtml(t.date) + ' ・ ' + escHtml(t.account_name || '不明') +
                                '</div>' +
                            '</div>' +
                            '<div class="fw-bold ' + (isIncome ? 'text-success' : 'text-danger') + '">' +
                                '¥' + fmt(t.amount) +
                            '</div>' +
                        '</div>' +
                    '</li>';
                }).join('') + '</ul>';
        }
    }

    // Low stock (quantity <= 1)
    var lowStock = state.inventory.filter(function (i) { return i.quantity <= 1; });
    var lowEl = document.getElementById('low-stock');
    if (lowEl) {
        if (lowStock.length === 0) {
            lowEl.innerHTML = '<p class="text-success text-center py-3 mb-0">' +
                '<i class="bi bi-check-circle"></i> 在庫は十分です</p>';
        } else {
            lowEl.innerHTML = '<ul class="list-group list-group-flush">' +
                lowStock.map(function (item) {
                    var badge = item.quantity <= 0 ? 'bg-danger' : 'bg-warning text-dark';
                    return '<li class="list-group-item py-2 px-3">' +
                        '<div class="d-flex justify-content-between align-items-center">' +
                            '<span>' + escHtml(item.name) +
                                (item.category
                                    ? '<span class="badge bg-secondary ms-1">' + escHtml(item.category) + '</span>'
                                    : '') +
                            '</span>' +
                            '<span class="badge ' + badge + '">' +
                                fmtQty(item.quantity) + ' ' + escHtml(item.unit) +
                            '</span>' +
                        '</div>' +
                    '</li>';
                }).join('') + '</ul>';
        }
    }
}

// =============================================================================
// Finance page
// =============================================================================
function renderTransactionHistory(state) {
    var container = document.getElementById('transaction-history');
    if (!container) return;
    var recent = state.transactions.slice().reverse().slice(0, 20);
    if (recent.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-3 mb-0">取引がありません</p>';
        return;
    }
    container.innerHTML =
        '<div class="table-responsive">' +
        '<table class="table table-sm table-hover mb-0">' +
        '<thead class="table-light"><tr>' +
            '<th>日付</th><th>内容</th><th>口座</th><th class="text-end">金額</th>' +
        '</tr></thead><tbody>' +
        recent.map(function (t) {
            var isIncome = ['income', 'salary', 'deposit'].indexOf(t.transaction_type) >= 0;
            return '<tr>' +
                '<td class="text-nowrap small">' + escHtml(t.date) + '</td>' +
                '<td class="small">' + escHtml(t.description || t.transaction_type) + '</td>' +
                '<td class="small text-muted">' + escHtml(t.account_name || '不明') + '</td>' +
                '<td class="text-end fw-bold small ' + (isIncome ? 'text-success' : 'text-danger') + '">' +
                    '¥' + fmt(t.amount) +
                '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';
}

function handleAddTransaction(e) {
    e.preventDefault();
    var form = e.target;
    var state = getState();

    var txnType    = form.querySelector('[name="transaction_type"]').value;
    var amountStr  = form.querySelector('[name="amount"]').value;
    var description = form.querySelector('[name="description"]').value;
    var txnDate    = form.querySelector('[name="date"]').value || todayISO();

    var amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        showAlert('金額を正しく入力してください。', 'danger');
        return;
    }

    var bankAcct = state.accounts.filter(function (a) { return a.account_type === 'bank'; })[0];
    var cashAcct = state.accounts.filter(function (a) { return a.account_type === 'cash'; })[0];
    var cardAcct = state.accounts.filter(function (a) { return a.account_type === 'card'; })[0];

    var newTxn = null;
    if (txnType === 'shopping_cash') {
        cashAcct.balance -= amount;
        newTxn = { account_id: cashAcct.id, amount: amount, transaction_type: 'expense',
            description: '買い出し(現金): ' + description, date: txnDate, account_name: cashAcct.name };
    } else if (txnType === 'shopping_card') {
        cardAcct.balance += amount;
        newTxn = { account_id: cardAcct.id, amount: amount, transaction_type: 'expense',
            description: '買い出し(カード): ' + description, date: txnDate, account_name: cardAcct.name };
    } else if (txnType === 'withdrawal') {
        bankAcct.balance -= amount;
        cashAcct.balance += amount;
        newTxn = { account_id: bankAcct.id, amount: amount, transaction_type: 'withdrawal',
            description: '引き出し: ' + description, date: txnDate, account_name: bankAcct.name };
    } else if (txnType === 'deposit') {
        cashAcct.balance -= amount;
        bankAcct.balance += amount;
        newTxn = { account_id: bankAcct.id, amount: amount, transaction_type: 'deposit',
            description: '預入: ' + description, date: txnDate, account_name: bankAcct.name };
    } else if (txnType === 'salary') {
        bankAcct.balance += amount;
        newTxn = { account_id: bankAcct.id, amount: amount, transaction_type: 'salary',
            description: '給与振り込み: ' + description, date: txnDate, account_name: bankAcct.name };
    } else if (txnType === 'other') {
        var sel = form.querySelector('[name="other_account_id"]');
        var dir = form.querySelector('[name="other_direction"]').value;
        if (!sel || !sel.value) { showAlert('口座を選択してください。', 'danger'); return; }
        var otherAcctId = parseInt(sel.value, 10);
        var otherAcct = null;
        for (var i = 0; i < state.accounts.length; i++) {
            if (state.accounts[i].id === otherAcctId) { otherAcct = state.accounts[i]; break; }
        }
        if (!otherAcct) { showAlert('口座を選択してください。', 'danger'); return; }
        otherAcct.balance += (dir === 'income' ? amount : -amount);
        newTxn = { account_id: otherAcct.id, amount: amount,
            transaction_type: dir === 'income' ? 'income' : 'expense',
            description: 'その他: ' + description, date: txnDate, account_name: otherAcct.name };
    }

    if (newTxn) {
        newTxn.id = state.next_ids.transaction++;
        state.transactions.push(newTxn);
        saveState(state);
        renderBalanceCards(state);
        renderTransactionHistory(state);
        form.reset();
        var dateInput = form.querySelector('[name="date"]');
        if (dateInput) dateInput.value = todayISO();
        showAlert('取引を記録しました。', 'success');
    }
}

function initFinance() {
    var state = getState();
    renderBalanceCards(state);
    renderTransactionHistory(state);

    // Populate "その他" account select from localStorage
    var otherSel = document.getElementById('other-account-select');
    if (otherSel) {
        otherSel.innerHTML = state.accounts.map(function (a) {
            return '<option value="' + a.id + '">' + escHtml(a.name) + '</option>';
        }).join('');
    }

    // Set today's date on the date input
    var dateInput = document.querySelector('#transaction-form [name="date"]');
    if (dateInput) dateInput.value = todayISO();

    var form = document.getElementById('transaction-form');
    if (form) form.addEventListener('submit', handleAddTransaction);

    var txnType = document.getElementById('txnType');
    if (txnType) {
        txnType.addEventListener('change', function () {
            var otherFields = document.getElementById('otherFields');
            if (otherFields) otherFields.classList.toggle('d-none', this.value !== 'other');
        });
    }
}

// =============================================================================
// Inventory page
// =============================================================================
var _invFilter = '';

function renderInventory(filterCat) {
    if (filterCat === undefined) filterCat = _invFilter;
    _invFilter = filterCat;

    var state = getState();

    // Collect unique categories
    var categories = [];
    state.inventory.forEach(function (i) {
        if (i.category && categories.indexOf(i.category) < 0) categories.push(i.category);
    });
    categories.sort();

    // Category filter buttons
    var catEl = document.getElementById('category-filter');
    if (catEl) {
        catEl.innerHTML =
            '<a href="#" class="btn btn-sm ' + (!filterCat ? 'btn-primary' : 'btn-outline-primary') +
            '" onclick="return setInvFilter(\'\')">すべて</a>' +
            categories.map(function (cat) {
                return '<a href="#" class="btn btn-sm ' +
                    (filterCat === cat ? 'btn-primary' : 'btn-outline-secondary') +
                    '" onclick="return setInvFilter(\'' + escHtml(cat) + '\')">' +
                    escHtml(cat) + '</a>';
            }).join('');
    }

    // Category datalist
    var dl = document.getElementById('categoryList');
    if (dl) {
        dl.innerHTML = categories.map(function (c) {
            return '<option value="' + escHtml(c) + '">';
        }).join('') +
        '<option value="野菜"><option value="肉・魚"><option value="乳製品">' +
        '<option value="調味料"><option value="飲み物"><option value="その他">';
    }

    // Filter and render items
    var filtered = filterCat
        ? state.inventory.filter(function (i) { return i.category === filterCat; })
        : state.inventory;

    var listEl = document.getElementById('inventory-list');
    if (!listEl) return;

    if (filtered.length === 0) {
        listEl.innerHTML =
            '<div class="text-center text-muted py-5">' +
            '<i class="bi bi-box fs-1"></i>' +
            '<p class="mt-2">在庫アイテムがありません<br>上のフォームから追加してください</p>' +
            '</div>';
        return;
    }

    listEl.innerHTML = '<div class="row g-2">' +
        filtered.map(function (item) {
            var cardCls = item.quantity <= 0 ? ' border-danger' : (item.quantity <= 1 ? ' border-warning' : '');
            var badgeCls = item.quantity <= 0 ? 'bg-danger' : (item.quantity <= 1 ? 'bg-warning text-dark' : 'bg-success');
            var updAt = item.updated_at ? String(item.updated_at).slice(0, 10) : '不明';
            var safeName = escHtml(item.name);
            return '<div class="col-12">' +
                '<div class="card shadow-sm inventory-item' + cardCls + '">' +
                '<div class="card-body py-2 px-3">' +
                '<div class="d-flex justify-content-between align-items-start">' +
                    '<div>' +
                        '<span class="fw-bold">' + safeName + '</span>' +
                        (item.category ? '<span class="badge bg-secondary ms-1 small">' + escHtml(item.category) + '</span>' : '') +
                        '<div class="text-muted small">更新: ' + escHtml(updAt) + '</div>' +
                    '</div>' +
                    '<div class="text-end">' +
                        '<span class="badge fs-6 ' + badgeCls + '">' +
                            fmtQty(item.quantity) + ' ' + escHtml(item.unit) +
                        '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="d-flex gap-2 mt-2 align-items-center">' +
                    '<div class="d-flex gap-1 flex-grow-1">' +
                        '<button type="button" class="btn btn-sm btn-outline-danger px-2"' +
                            ' onclick="invAdjust(' + item.id + ',-1)">' +
                            '<i class="bi bi-dash"></i></button>' +
                        '<input type="number" id="invd-' + item.id + '"' +
                            ' class="form-control form-control-sm text-center"' +
                            ' step="0.1" aria-label="数量調整（プラスで追加、マイナスで減算）" placeholder="±数量" style="min-width:70px">' +
                        '<button type="button" class="btn btn-sm btn-outline-success px-2"' +
                            ' onclick="invAdjust(' + item.id + ',1)">' +
                            '<i class="bi bi-plus"></i></button>' +
                    '</div>' +
                    '<button type="button" class="btn btn-sm btn-outline-danger"' +
                        ' onclick="invDelete(' + item.id + ',\'' + safeName + '\')">' +
                        '<i class="bi bi-trash"></i></button>' +
                '</div>' +
                '</div></div></div>';
        }).join('') + '</div>';
}

// Exposed globally for onclick handlers
function setInvFilter(cat) {
    _invFilter = cat;
    renderInventory(cat);
    return false;
}

function invAdjust(id, sign) {
    var input = document.getElementById('invd-' + id);
    var delta;
    if (input && input.value.trim() !== '') {
        delta = Math.abs(parseFloat(input.value)) * sign;
    } else {
        delta = sign;
    }
    if (isNaN(delta)) { showAlert('数量を正しく入力してください。', 'danger'); return; }

    var state = getState();
    var item = null;
    for (var i = 0; i < state.inventory.length; i++) {
        if (state.inventory[i].id === id) { item = state.inventory[i]; break; }
    }
    if (!item) return;
    item.quantity = parseFloat((item.quantity + delta).toFixed(4));
    item.updated_at = todayISO();
    saveState(state);
    renderInventory();
    showAlert('「' + item.name + '」の数量を更新しました。', 'success');
}

function invDelete(id, name) {
    if (!confirm('「' + name + '」を削除しますか？')) return;
    var state = getState();
    state.inventory = state.inventory.filter(function (i) { return i.id !== id; });
    saveState(state);
    renderInventory();
    showAlert('「' + name + '」を削除しました。', 'success');
}

function handleAddInventoryItem(e) {
    e.preventDefault();
    var form = e.target;
    var name      = form.querySelector('[name="name"]').value.trim();
    var qtyStr    = form.querySelector('[name="quantity"]').value;
    var unit      = (form.querySelector('[name="unit"]').value || '').trim() || '個';
    var category  = (form.querySelector('[name="category"]').value || '').trim();

    if (!name) { showAlert('名前を入力してください。', 'danger'); return; }
    var quantity = parseFloat(qtyStr);
    if (isNaN(quantity)) { showAlert('数量を正しく入力してください。', 'danger'); return; }

    var state = getState();
    state.inventory.push({
        id: state.next_ids.inventory++,
        name: name, quantity: quantity, unit: unit,
        category: category || null,
        updated_at: todayISO()
    });
    saveState(state);
    form.reset();
    var unitField = form.querySelector('[name="unit"]');
    if (unitField) unitField.value = '個';
    renderInventory();
    showAlert('「' + name + '」を追加しました。', 'success');
    var collapse = document.getElementById('addItemForm');
    if (collapse) {
        try { bootstrap.Collapse.getOrCreateInstance(collapse).hide(); } catch (ex) {}
    }
}

function initInventory() {
    renderInventory('');
    var form = document.getElementById('add-inventory-form');
    if (form) form.addEventListener('submit', handleAddInventoryItem);
}

// =============================================================================
// Menu page
// =============================================================================
var _ingredientRowHTML =
    '<div class="ingredient-row row g-1 mb-1">' +
        '<div class="col-5"><input type="text" name="ingredient_name[]"' +
            ' class="form-control form-control-sm" placeholder="食材名"></div>' +
        '<div class="col-3"><input type="number" name="ingredient_quantity[]"' +
            ' class="form-control form-control-sm" placeholder="量" min="0" step="0.1"></div>' +
        '<div class="col-3"><input type="text" name="ingredient_unit[]"' +
            ' class="form-control form-control-sm" placeholder="単位"></div>' +
        '<div class="col-1 d-flex align-items-center">' +
            '<button type="button" class="btn btn-sm btn-outline-danger remove-ingredient px-1">' +
            '<i class="bi bi-x"></i></button></div>' +
    '</div>';

function renderMenu() {
    var state = getState();
    var listEl = document.getElementById('menu-list');
    if (!listEl) return;

    if (state.menus.length === 0) {
        listEl.innerHTML =
            '<div class="text-center text-muted py-5">' +
            '<i class="bi bi-journal-x fs-1"></i>' +
            '<p class="mt-2">登録されたメニューがありません<br>上のフォームから追加してください</p>' +
            '</div>';
        return;
    }

    listEl.innerHTML = '<div class="row g-2">' +
        state.menus.map(function (m) {
            var safeName = escHtml(m.name);
            return '<div class="col-12">' +
                '<div class="card shadow-sm">' +
                '<div class="card-body py-2 px-3">' +
                '<div class="d-flex justify-content-between align-items-start">' +
                    '<div>' +
                        '<div class="fw-bold">' + safeName + '</div>' +
                        (m.description ? '<div class="text-muted small">' + escHtml(m.description) + '</div>' : '') +
                    '</div>' +
                    '<div class="d-flex gap-1">' +
                        '<button class="btn btn-sm btn-outline-info"' +
                            ' onclick="showRecipeModal(' + m.id + ')"' +
                            ' data-bs-toggle="modal" data-bs-target="#recipeModal">' +
                            '<i class="bi bi-eye"></i></button>' +
                        '<button type="button" class="btn btn-sm btn-outline-danger"' +
                            ' onclick="menuDelete(' + m.id + ',\'' + safeName + '\')">' +
                            '<i class="bi bi-trash"></i></button>' +
                    '</div>' +
                '</div>' +
                '<button type="button" class="btn btn-sm btn-warning w-100 mt-2"' +
                    ' onclick="menuCook(' + m.id + ',\'' + safeName + '\')">' +
                    '<i class="bi bi-fire"></i> このメニューを今日作る</button>' +
                '</div></div></div>';
        }).join('') + '</div>';
}

function menuDelete(id, name) {
    if (!confirm('「' + name + '」を削除しますか？')) return;
    var state = getState();
    state.menus = state.menus.filter(function (m) { return m.id !== id; });
    saveState(state);
    renderMenu();
    showAlert('「' + name + '」を削除しました。', 'success');
}

function menuCook(id, name) {
    if (!confirm('「' + name + '」を今日作りますか？在庫から材料が差し引かれます。')) return;
    var state = getState();
    var menu = null;
    for (var i = 0; i < state.menus.length; i++) {
        if (state.menus[i].id === id) { menu = state.menus[i]; break; }
    }
    if (!menu) return;

    var warnings = [];
    menu.ingredients.forEach(function (ing) {
        var item = null;
        for (var j = 0; j < state.inventory.length; j++) {
            if (state.inventory[j].name === ing.item_name) { item = state.inventory[j]; break; }
        }
        if (item) {
            item.quantity = parseFloat((item.quantity - ing.quantity).toFixed(4));
            item.updated_at = todayISO();
        } else {
            warnings.push('材料「' + ing.item_name + '」が在庫に見つかりません（スキップしました）。');
        }
    });

    saveState(state);
    renderMenu();
    showAlert('「' + name + '」を作りました！在庫を更新しました。', 'success');
    warnings.forEach(function (w) { showAlert(w, 'warning'); });
}

function showRecipeModal(id) {
    var state = getState();
    var menu = null;
    for (var i = 0; i < state.menus.length; i++) {
        if (state.menus[i].id === id) { menu = state.menus[i]; break; }
    }
    var titleEl = document.getElementById('recipeModalTitle');
    var bodyEl  = document.getElementById('recipeModalBody');
    if (!menu) {
        if (bodyEl) bodyEl.innerHTML = '<p class="text-danger">レシピが見つかりません</p>';
        return;
    }
    if (titleEl) titleEl.textContent = menu.name;
    var html = '';
    if (menu.description) html += '<p class="text-muted">' + escHtml(menu.description) + '</p>';
    if (menu.ingredients && menu.ingredients.length > 0) {
        html += '<h6 class="fw-bold">材料</h6><ul class="list-group list-group-flush mb-3">';
        menu.ingredients.forEach(function (ing) {
            html += '<li class="list-group-item py-1 px-2">' +
                escHtml(ing.item_name) + ' ― ' + ing.quantity + ' ' + escHtml(ing.unit) +
                '</li>';
        });
        html += '</ul>';
    }
    if (menu.instructions) {
        html += '<h6 class="fw-bold">調理手順</h6>' +
            '<p style="white-space:pre-wrap">' + escHtml(menu.instructions) + '</p>';
    }
    if (!html) html = '<p class="text-muted">詳細情報がありません</p>';
    if (bodyEl) bodyEl.innerHTML = html;
}

function handleAddMenu(e) {
    e.preventDefault();
    var form = e.target;
    var name        = form.querySelector('[name="name"]').value.trim();
    var description = (form.querySelector('[name="description"]').value || '').trim();
    var instructions = (form.querySelector('[name="instructions"]').value || '').trim();

    if (!name) { showAlert('メニュー名を入力してください。', 'danger'); return; }

    var nameInputs = form.querySelectorAll('[name="ingredient_name[]"]');
    var qtyInputs  = form.querySelectorAll('[name="ingredient_quantity[]"]');
    var unitInputs = form.querySelectorAll('[name="ingredient_unit[]"]');
    var ingredients = [];
    nameInputs.forEach(function (ni, idx) {
        var iname = ni.value.trim();
        if (!iname) return;
        var qty  = parseFloat(qtyInputs[idx] ? qtyInputs[idx].value : '') || 0;
        var unit = (unitInputs[idx] ? unitInputs[idx].value.trim() : '') || '';
        ingredients.push({ item_name: iname, quantity: qty, unit: unit });
    });

    var state = getState();
    state.menus.push({
        id: state.next_ids.menu++,
        name: name, description: description,
        instructions: instructions, ingredients: ingredients
    });
    saveState(state);
    form.reset();
    // Reset ingredient list to one empty row
    var ingList = document.getElementById('ingredientList');
    if (ingList) ingList.innerHTML = _ingredientRowHTML;
    renderMenu();
    showAlert('「' + name + '」を登録しました。', 'success');
    var collapse = document.getElementById('addMenuForm');
    if (collapse) {
        try { bootstrap.Collapse.getOrCreateInstance(collapse).hide(); } catch (ex) {}
    }
}

function initMenu() {
    renderMenu();

    var form = document.getElementById('add-menu-form');
    if (form) form.addEventListener('submit', handleAddMenu);

    var addIngBtn = document.getElementById('addIngredient');
    if (addIngBtn) {
        addIngBtn.addEventListener('click', function () {
            var row = document.createElement('div');
            row.innerHTML = _ingredientRowHTML;
            var ingList = document.getElementById('ingredientList');
            if (ingList) ingList.appendChild(row.firstChild);
        });
    }

    var ingList = document.getElementById('ingredientList');
    if (ingList) {
        ingList.addEventListener('click', function (e) {
            if (e.target.closest('.remove-ingredient')) {
                var rows = ingList.querySelectorAll('.ingredient-row');
                if (rows.length > 1) {
                    e.target.closest('.ingredient-row').remove();
                }
            }
        });
    }
}

// =============================================================================
// Page dispatch
// =============================================================================
document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page');
    if      (page === 'index')     renderDashboard();
    else if (page === 'finance')   initFinance();
    else if (page === 'inventory') initInventory();
    else if (page === 'menu')      initMenu();
});
