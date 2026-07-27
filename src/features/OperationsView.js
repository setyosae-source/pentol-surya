import { catalogRepository } from '../data/catalogRepository.js';
import { employeeRepository } from '../data/employeeRepository.js';
import { shiftRepository } from '../data/shiftRepository.js';
import { operationsRepository } from '../data/operationsRepository.js';
import { stockRepository } from '../data/stockRepository.js';
import { ownerRepository } from '../data/ownerRepository.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { formatCurrency, toNumber } from '../core/utils.js';
import { productQtyFields } from '../ui/components.js';

export function OperationsView() {
  queueMicrotask(initOperations);
  const state = store.getState();

  if (isOwnerRole(state.profile)) {
    return renderOwnerInput(state);
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
      await initOwnerInput();
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

function isOwnerRole(profile) {
  return ['owner', 'manager'].includes(profile?.role);
}

function renderOwnerInput(state) {
  const products = state.products || [];
  const outlets = state.outlets || [];

  return `
    <section class="hero-panel">
      <small>Input Owner</small>
      <h1>Kelola data operasional</h1>
      <p>Input master outlet, produk, harga khusus, pengeluaran umum, dan periode gaji tanpa memenuhi dashboard pantauan.</p>
    </section>

    ${state.ownerInputError ? `
      <div class="empty-state">
        <strong>Input belum bisa dimuat</strong>
        <p>${state.ownerInputError}</p>
      </div>
    ` : ''}

    ${state.ownerInputLoading && !state.ownerInputLoaded ? '<div class="skeleton block"></div>' : ''}

    <div class="segmented sticky" role="tablist">
      <button class="active" data-owner-tab="expense">Biaya</button>
      <button data-owner-tab="payroll">Payroll</button>
      <button data-owner-tab="outlet">Outlet</button>
      <button data-owner-tab="product">Produk</button>
      <button data-owner-tab="price">Harga</button>
    </div>

    ${renderOwnerExpenseForm()}
    ${renderOwnerPayrollForm()}
    ${renderOwnerOutletForm()}
    ${renderOwnerProductForm()}
    ${renderOwnerPriceForm(products, outlets)}
  `;
}

async function initOwnerInput() {
  const state = store.getState();
  if (state.ownerInputLoaded) {
    bindOwnerInputs();
    return;
  }
  if (state.ownerInputLoading) return;

  try {
    store.setState({ ownerInputLoading: true, ownerInputError: null });
    await Promise.all([
      catalogRepository.loadOutlets(),
      catalogRepository.loadProducts(),
    ]);
    store.setState({ ownerInputLoaded: true, ownerInputLoading: false });
    bindOwnerInputs();
  } catch (error) {
    store.setState({
      ownerInputLoading: false,
      ownerInputError: error.message || 'Gagal memuat data input owner.',
    });
    toast.error(error.message || 'Gagal memuat data input owner.');
  }
}

function renderOwnerExpenseForm() {
  return `
    <form class="surface stack op-panel" data-owner-panel="expense" data-owner-form="general-expense">
      <div class="section-title">
        <strong>Pengeluaran umum</strong>
        <small>Tidak terkait outlet tertentu</small>
      </div>
      <label class="field">
        <span>Kategori</span>
        <input name="category" placeholder="Bahan baku, sewa, gas, perbaikan" required />
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

function renderOwnerPayrollForm() {
  return `
    <form class="surface stack op-panel hidden" data-owner-panel="payroll" data-owner-form="payroll-period">
      <div class="section-title">
        <strong>Periode gaji</strong>
        <small>Draft, final, sudah dibayar</small>
      </div>
      <label class="field">
        <span>Nama periode</span>
        <input name="name" placeholder="Gaji Minggu 4 Juli" required />
      </label>
      <div class="grid two">
        <label class="field">
          <span>Mulai</span>
          <input name="starts_on" type="date" required />
        </label>
        <label class="field">
          <span>Sampai</span>
          <input name="ends_on" type="date" required />
        </label>
      </div>
      <button class="primary" type="submit">Buat Draft Payroll</button>
    </form>
  `;
}

function renderOwnerOutletForm() {
  return `
    <form class="surface stack op-panel hidden" data-owner-panel="outlet" data-owner-form="outlet">
      <div class="section-title">
        <strong>Tambah outlet</strong>
        <small>Lokasi dapat diubah sewaktu-waktu</small>
      </div>
      <label class="field">
        <span>Nama outlet</span>
        <input name="name" required />
      </label>
      <label class="field">
        <span>Alamat</span>
        <textarea name="address" rows="2"></textarea>
      </label>
      <div class="grid two">
        <label class="field"><span>Lat jualan</span><input name="sale_lat" type="number" step="0.0000001" /></label>
        <label class="field"><span>Lng jualan</span><input name="sale_lng" type="number" step="0.0000001" /></label>
        <label class="field"><span>Lat ambil barang</span><input name="pickup_lat" type="number" step="0.0000001" /></label>
        <label class="field"><span>Lng ambil barang</span><input name="pickup_lng" type="number" step="0.0000001" /></label>
        <label class="field"><span>Lat absen pulang</span><input name="checkout_lat" type="number" step="0.0000001" /></label>
        <label class="field"><span>Lng absen pulang</span><input name="checkout_lng" type="number" step="0.0000001" /></label>
      </div>
      <label class="field"><span>Radius geofence meter</span><input name="geofence_radius_m" type="number" value="120" /></label>
      <div class="grid two">
        <label class="field">
          <span>Metode stok awal</span>
          <select name="stock_default_method">
            <option value="default_qty">Qty default</option>
            <option value="previous_remaining">Sisa shift sebelumnya</option>
          </select>
        </label>
        <label class="field">
          <span>Mode laporan berkala</span>
          <select name="report_schedule_mode">
            <option value="free">Bebas</option>
            <option value="scheduled">Jam tertentu</option>
          </select>
        </label>
      </div>
      <label class="field">
        <span>Jam laporan, pisahkan koma</span>
        <input name="report_times" placeholder="10:00, 13:00, 16:00" />
      </label>
      <button class="primary" type="submit">Simpan Outlet</button>
    </form>
  `;
}

function renderOwnerProductForm() {
  return `
    <form class="surface stack op-panel hidden" data-owner-panel="product" data-owner-form="product">
      <div class="section-title">
        <strong>Tambah produk</strong>
        <small>Harga transaksi lama tetap memakai snapshot</small>
      </div>
      <label class="field"><span>Nama produk</span><input name="name" required /></label>
      <div class="grid two">
        <label class="field"><span>Harga jual umum</span><input name="general_sale_price" type="number" min="0" required /></label>
        <label class="field"><span>HPP</span><input name="hpp" type="number" min="0" required /></label>
      </div>
      <label class="field"><span>Qty default</span><input name="default_qty" type="number" min="0" step="0.01" value="0" /></label>
      <button class="primary" type="submit">Simpan Produk</button>
    </form>
  `;
}

function renderOwnerPriceForm(products, outlets) {
  return `
    <form class="surface stack op-panel hidden" data-owner-panel="price" data-owner-form="outlet-price">
      <div class="section-title">
        <strong>Harga outlet</strong>
        <small>Terapkan ke semua outlet atau outlet tertentu</small>
      </div>
      <label class="field">
        <span>Produk</span>
        <select name="product_id" required>
          <option value="">Pilih produk</option>
          ${products.map((product) => `<option value="${product.id}">${product.name}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>Target outlet</span>
        <select name="outlet_id" required>
          <option value="all">Semua outlet</option>
          ${outlets.map((outlet) => `<option value="${outlet.id}">${outlet.name}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>Harga jual</span>
        <input name="sale_price" type="number" min="0" required />
      </label>
      <button class="primary" type="submit">Terapkan Harga</button>
    </form>
  `;
}

function bindOwnerInputs() {
  document.querySelectorAll('[data-owner-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-owner-tab]').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('[data-owner-panel]').forEach((panel) => panel.classList.add('hidden'));
      button.classList.add('active');
      document.querySelector(`[data-owner-panel="${button.dataset.ownerTab}"]`)?.classList.remove('hidden');
    });
  });

  document.querySelector('[data-owner-form="general-expense"]')?.addEventListener('submit', handleOwnerExpenseSubmit);
  document.querySelector('[data-owner-form="payroll-period"]')?.addEventListener('submit', handleOwnerPayrollSubmit);
  document.querySelector('[data-owner-form="outlet"]')?.addEventListener('submit', handleOwnerOutletSubmit);
  document.querySelector('[data-owner-form="product"]')?.addEventListener('submit', handleOwnerProductSubmit);
  document.querySelector('[data-owner-form="outlet-price"]')?.addEventListener('submit', handleOwnerPriceSubmit);
}

async function handleOwnerExpenseSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const profile = store.getState().profile;
  await submitOwnerForm(event.currentTarget, () => ownerRepository.addGeneralExpense({
    tenant_id: profile.tenant_id,
    category: form.get('category'),
    amount: toNumber(form.get('amount')),
    note: form.get('note'),
  }), 'Pengeluaran umum tersimpan.');
}

async function handleOwnerPayrollSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const profile = store.getState().profile;
  await submitOwnerForm(event.currentTarget, () => ownerRepository.createPayrollPeriod({
    tenant_id: profile.tenant_id,
    name: form.get('name'),
    starts_on: form.get('starts_on'),
    ends_on: form.get('ends_on'),
    created_by: profile.id,
  }), 'Draft payroll dibuat.');
}

async function handleOwnerOutletSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const profile = store.getState().profile;
  await submitOwnerForm(event.currentTarget, () => catalogRepository.saveOutlet({
    tenant_id: profile.tenant_id,
    name: form.get('name'),
    address: form.get('address'),
    sale_lat: nullableNumber(form.get('sale_lat')),
    sale_lng: nullableNumber(form.get('sale_lng')),
    pickup_lat: nullableNumber(form.get('pickup_lat')),
    pickup_lng: nullableNumber(form.get('pickup_lng')),
    checkout_lat: nullableNumber(form.get('checkout_lat')),
    checkout_lng: nullableNumber(form.get('checkout_lng')),
    geofence_radius_m: toNumber(form.get('geofence_radius_m'), 120),
    stock_default_method: form.get('stock_default_method'),
    report_schedule_mode: form.get('report_schedule_mode'),
    report_times: parseReportTimes(form.get('report_times')),
  }), 'Outlet tersimpan.');
}

async function handleOwnerProductSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const profile = store.getState().profile;
  await submitOwnerForm(event.currentTarget, () => catalogRepository.saveProduct({
    tenant_id: profile.tenant_id,
    name: form.get('name'),
    general_sale_price: toNumber(form.get('general_sale_price')),
    hpp: toNumber(form.get('hpp')),
    default_qty: toNumber(form.get('default_qty')),
  }), 'Produk tersimpan.');
}

async function handleOwnerPriceSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const profile = store.getState().profile;
  await submitOwnerForm(event.currentTarget, () => catalogRepository.applyOutletPrice({
    tenant_id: profile.tenant_id,
    outlet_id: form.get('outlet_id'),
    product_id: form.get('product_id'),
    sale_price: toNumber(form.get('sale_price')),
  }), 'Harga outlet diterapkan.');
}

async function submitOwnerForm(form, action, successMessage) {
  form.querySelectorAll('button, input, select, textarea').forEach((node) => {
    node.disabled = true;
  });
  try {
    await action();
    toast.success(successMessage);
    store.setState({
      ownerDashboard: null,
      ownerDashboardError: null,
      ownerInputLoaded: false,
      ownerInputLoading: false,
    });
    form.reset();
  } catch (error) {
    toast.error(error.message || 'Gagal menyimpan data.');
  } finally {
    form.querySelectorAll('button, input, select, textarea').forEach((node) => {
      node.disabled = false;
    });
  }
}

function nullableNumber(value) {
  return value === '' || value === null ? null : Number(value);
}

function parseReportTimes(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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
