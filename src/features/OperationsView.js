import { catalogRepository } from '../data/catalogRepository.js';
import { employeeRepository } from '../data/employeeRepository.js';
import { shiftRepository } from '../data/shiftRepository.js';
import { operationsRepository } from '../data/operationsRepository.js';
import { stockRepository } from '../data/stockRepository.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { formatCurrency, toNumber } from '../core/utils.js';
import { productQtyFields } from '../ui/components.js';

export function OperationsView() {
  queueMicrotask(initOperations);
  const state = store.getState();

  if (isOwnerRole(state.profile)) {
    return renderOwnerDataShortcut();
  }

  const shift = state.activeShift;

  if (!shift) {
    return `
      <section class="hero-panel">
        <h1>Operasional</h1>
        <p>Belum ada shift aktif. Karyawan harus absen masuk dan mengisi laporan awal terlebih dahulu.</p>
      </section>
    `;
  }

  return `
    <section class="hero-panel">
      <small>${shift.outlets?.name || 'Outlet'}</small>
      <h1>Operasional Shift</h1>
      <p>Catat penjualan, pengeluaran, supply, produk terbuang, dan laporan berkala.</p>
    </section>

    <div class="segmented sticky" role="tablist">
      <button class="active" data-op-tab="sale">Penjualan</button>
      <button data-op-tab="expense">Pengeluaran</button>
      <button data-op-tab="supply">Supply</button>
      <button data-op-tab="waste">Terbuang</button>
      <button data-op-tab="periodic">Berkala</button>
    </div>

    ${renderSaleForm(state)}
    ${renderExpenseForm()}
    ${renderSupplyForm(state)}
    ${renderWasteForm(state)}
    ${renderPeriodicForm(state)}
  `;
}

async function initOperations() {
  try {
    const state = store.getState();
    if (isOwnerRole(state.profile)) {
      return;
    }

    if (!state.employee && state.profile?.role === 'employee') {
      await employeeRepository.loadContext();
    }
    const employeeId = store.getState().employee?.id;
    if (!store.getState().activeShift) await shiftRepository.loadActiveShift(employeeId);
    const shift = store.getState().activeShift;
    if (shift) await catalogRepository.loadProducts(shift.outlet_id);
    bindOperations();
  } catch (error) {
    toast.error(error.message || 'Gagal memuat operasional.');
  }
}

function renderOwnerDataShortcut() {
  return `
    <section class="hero-panel">
      <small>Data Bisnis</small>
      <h1>Input owner dipindahkan</h1>
      <p>Gunakan sidebar untuk membuka tabel karyawan, outlet, produk, harga, biaya umum, dan payroll.</p>
    </section>
    <section class="action-grid">
      <a class="action-card" href="#/owner/employees"><strong>Karyawan</strong><span>Tambah, edit, nonaktifkan, dan reset PIN.</span></a>
      <a class="action-card" href="#/owner/outlets"><strong>Outlet</strong><span>Kelola lokasi, geofence, dan jadwal laporan.</span></a>
      <a class="action-card" href="#/owner/products"><strong>Produk</strong><span>Kelola produk, harga umum, stok default, dan HPP.</span></a>
      <a class="action-card" href="#/owner/expenses"><strong>Biaya umum</strong><span>Catat dan koreksi pengeluaran umum owner.</span></a>
    </section>
  `;
}

function isOwnerRole(profile) {
  return ['owner', 'manager'].includes(profile?.role);
}

function renderSaleForm(state) {
  return `
    <form class="surface stack op-panel" data-op-panel="sale" data-form="sale">
      <label class="field">
        <span>Metode pembayaran</span>
        <select name="payment_method" required>
          <option value="cash">Cash</option>
          <option value="qris">QRIS</option>
          <option value="transfer">Transfer</option>
          <option value="piutang">Piutang</option>
        </select>
      </label>
      ${productQtyFields(state.products, 'sale')}
      <div class="grid two">
        <label class="field">
          <span>Nama pelanggan</span>
          <input name="customer_name" />
        </label>
        <label class="field">
          <span>HP pelanggan</span>
          <input name="customer_phone" inputmode="tel" />
        </label>
      </div>
      <label class="field">
        <span>Catatan</span>
        <textarea name="note" rows="2"></textarea>
      </label>
      <button class="primary" type="submit">Simpan Penjualan</button>
    </form>
  `;
}

function renderExpenseForm() {
  return `
    <form class="surface stack op-panel hidden" data-op-panel="expense" data-form="expense">
      <label class="field">
        <span>Kategori</span>
        <input name="category" placeholder="Parkir, es batu, gas, transport" required />
      </label>
      <label class="field">
        <span>Jumlah</span>
        <input name="amount" type="number" inputmode="numeric" min="0" required />
      </label>
      <label class="field">
        <span>Catatan</span>
        <textarea name="note" rows="2"></textarea>
      </label>
      <button class="primary" type="submit">Simpan Pengeluaran</button>
    </form>
  `;
}

function renderSupplyForm(state) {
  return `
    <form class="surface stack op-panel hidden" data-op-panel="supply" data-form="supply">
      <div class="grid two">
        <label class="field">
          <span>Sumber supply</span>
          <input name="source_name" placeholder="Owner, manager, belanja tambahan" required />
        </label>
        <label class="field">
          <span>Role sumber</span>
          <select name="source_role">
            <option value="employee">Karyawan</option>
            <option value="manager">Manager</option>
            <option value="owner">Owner</option>
          </select>
        </label>
      </div>
      ${productQtyFields(state.products, 'supply')}
      <label class="field">
        <span>Catatan</span>
        <textarea name="note" rows="2"></textarea>
      </label>
      <button class="primary" type="submit">Simpan Supply</button>
    </form>
  `;
}

function renderWasteForm(state) {
  return `
    <form class="surface stack op-panel hidden" data-op-panel="waste" data-form="waste">
      <label class="field">
        <span>Produk</span>
        <select name="product_id" required>
          ${state.products.map((product) => `<option value="${product.id}">${product.name}${product.can_view_cost ? ` - HPP ${formatCurrency(product.hpp)}` : ''}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>Qty terbuang</span>
        <input name="qty" type="number" min="0.01" step="0.01" required />
      </label>
      <label class="field">
        <span>Alasan</span>
        <textarea name="reason" rows="3" required></textarea>
      </label>
      <label class="field">
        <span>Foto opsional</span>
        <input name="photo" type="file" accept="image/*" capture="environment" />
      </label>
      <button class="primary" type="submit">Simpan Produk Terbuang</button>
    </form>
  `;
}

function renderPeriodicForm(state) {
  return `
    <form class="surface stack op-panel hidden" data-op-panel="periodic" data-form="periodic">
      <div class="grid three">
        <label class="field">
          <span>Cash fisik</span>
          <input name="cash_amount" type="number" min="0" value="0" />
        </label>
        <label class="field">
          <span>QRIS</span>
          <input name="qris_amount" type="number" min="0" value="0" />
        </label>
        <label class="field">
          <span>Transfer</span>
          <input name="transfer_amount" type="number" min="0" value="0" />
        </label>
      </div>
      <div class="section-title">
        <strong>Stok fisik</strong>
        <small>Sistem akan menghitung selisih stok.</small>
      </div>
      ${productQtyFields(state.products, 'physical')}
      <label class="field">
        <span>Catatan</span>
        <textarea name="note" rows="2"></textarea>
      </label>
      <button class="primary" type="submit">Simpan Laporan Berkala</button>
    </form>
  `;
}

function bindOperations() {
  document.querySelectorAll('[data-op-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-op-tab]').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('[data-op-panel]').forEach((panel) => panel.classList.add('hidden'));
      button.classList.add('active');
      document.querySelector(`[data-op-panel="${button.dataset.opTab}"]`)?.classList.remove('hidden');
    });
  });

  document.querySelector('[data-form="sale"]')?.addEventListener('submit', handleSaleSubmit);
  document.querySelector('[data-form="expense"]')?.addEventListener('submit', handleExpenseSubmit);
  document.querySelector('[data-form="supply"]')?.addEventListener('submit', handleSupplySubmit);
  document.querySelector('[data-form="waste"]')?.addEventListener('submit', handleWasteSubmit);
  document.querySelector('[data-form="periodic"]')?.addEventListener('submit', handlePeriodicSubmit);
}

async function handleSaleSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const { activeShift, products } = store.getState();
  const items = collectProductQty(products, form, 'sale').map(({ product, qty }) => ({
    product_id: product.id,
    qty,
    unit_price_snapshot: product.resolved_price ?? product.general_sale_price,
    hpp_snapshot: 0,
  }));

  if (!items.length) {
    toast.error('Isi minimal satu produk terjual.');
    return;
  }

  await submit(event.currentTarget, () => operationsRepository.addSale({
    shift: activeShift,
    paymentMethod: form.get('payment_method'),
    customerName: form.get('customer_name'),
    customerPhone: form.get('customer_phone'),
    note: form.get('note'),
    items,
  }), 'Penjualan tersimpan.');
}

async function handleExpenseSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await submit(event.currentTarget, () => operationsRepository.addOutletExpense({
    shift: store.getState().activeShift,
    category: form.get('category'),
    amount: toNumber(form.get('amount')),
    note: form.get('note'),
  }), 'Pengeluaran tersimpan.');
}

async function handleSupplySubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const { activeShift, products } = store.getState();
  const items = collectProductQty(products, form, 'supply').map(({ product, qty }) => ({
    product_id: product.id,
    qty,
    unit_hpp_snapshot: 0,
  }));
  if (!items.length) {
    toast.error('Isi minimal satu produk supply.');
    return;
  }

  await submit(event.currentTarget, () => operationsRepository.addSupply({
    shift: activeShift,
    sourceName: form.get('source_name'),
    sourceRole: form.get('source_role'),
    note: form.get('note'),
    items,
  }), 'Supply tersimpan.');
}

async function handleWasteSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const state = store.getState();
  const product = state.products.find((item) => item.id === form.get('product_id'));
  const photo = form.get('photo');
  await submit(event.currentTarget, async () => {
    const photoPath = photo?.size
      ? await shiftRepository.uploadPhoto({
          tenantId: state.activeShift.tenant_id,
          shiftId: state.activeShift.id,
          file: photo,
          folder: 'waste',
        })
      : null;

    return operationsRepository.addWaste({
      shift: state.activeShift,
      productId: product.id,
      qty: toNumber(form.get('qty')),
      reason: form.get('reason'),
      unitHppSnapshot: 0,
      photoPath,
    });
  }, 'Produk terbuang tersimpan.');
}

async function handlePeriodicSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const { activeShift, products } = store.getState();
  const expectedMap = await stockRepository.expectedStockMap(activeShift.id);
  const items = collectProductQty(products, form, 'physical').map(({ product, qty }) => ({
    product_id: product.id,
    physical_qty: qty,
    expected_qty: expectedMap.get(product.id) ?? qty,
  }));
  await submit(event.currentTarget, () => operationsRepository.addPeriodicReport({
    shift: activeShift,
    values: {
      cash_amount: toNumber(form.get('cash_amount')),
      qris_amount: toNumber(form.get('qris_amount')),
      transfer_amount: toNumber(form.get('transfer_amount')),
      note: form.get('note'),
    },
    items,
  }), 'Laporan berkala tersimpan.');
}

function collectProductQty(products, form, prefix) {
  return products
    .map((product) => ({ product, qty: toNumber(form.get(`${prefix}_${product.id}`)) }))
    .filter((item) => item.qty > 0);
}

async function submit(form, action, successMessage) {
  form.querySelectorAll('button, input, select, textarea').forEach((node) => {
    node.disabled = true;
  });
  try {
    const result = await action();
    toast.success(result?.queued ? 'Offline: data masuk antrean.' : successMessage);
    form.reset();
  } catch (error) {
    toast.error(error.message || 'Gagal menyimpan data.');
  } finally {
    form.querySelectorAll('button, input, select, textarea').forEach((node) => {
      node.disabled = false;
    });
  }
}
