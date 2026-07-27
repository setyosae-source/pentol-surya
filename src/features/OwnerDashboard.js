import { catalogRepository } from '../data/catalogRepository.js';
import { ownerRepository } from '../data/ownerRepository.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { formatCurrency, formatDateTime, formatNumber, todayRange, toNumber } from '../core/utils.js';
import { kpiCard, emptyState } from '../ui/components.js';

export function OwnerDashboard() {
  queueMicrotask(initOwnerDashboard);
  const dashboard = store.getState().ownerDashboard;

  if (!dashboard) {
    return `
      <section class="stack">
        <div class="skeleton block"></div>
        <div class="kpi-grid">
          <div class="skeleton card"></div>
          <div class="skeleton card"></div>
          <div class="skeleton card"></div>
          <div class="skeleton card"></div>
        </div>
      </section>
    `;
  }

  const { kpis, activeShifts, latestLocations, productPerformance, topOutlets, auditLogs } = dashboard;

  return `
    <section class="hero-panel">
      <small>Dashboard Owner</small>
      <h1>Kontrol semua outlet</h1>
      <p>Pantau penjualan, stok, cash flow, shift aktif, lokasi karyawan, laba, dan audit perubahan data.</p>
    </section>

    <section class="kpi-grid">
      ${kpiCard('Penjualan', kpis.sales)}
      ${kpiCard('Cash', kpis.cash)}
      ${kpiCard('QRIS', kpis.qris)}
      ${kpiCard('Transfer', kpis.transfer)}
      ${kpiCard('Piutang', kpis.piutang)}
      ${kpiCard('Pengeluaran Outlet', kpis.outlet_expenses)}
      ${kpiCard('Pengeluaran Umum', kpis.general_expenses)}
      ${kpiCard('Produk Terbuang', kpis.waste_hpp)}
      ${kpiCard('Estimasi Laba', kpis.estimated_profit)}
      ${kpiCard('Setoran', kpis.cash_deposits)}
      ${kpiCard('Gaji', kpis.payroll)}
      ${kpiCard('Cash Flow', kpis.cash_flow)}
    </section>

    <section class="grid two owner-grid">
      <article class="surface stack">
        <div class="section-title">
          <strong>Shift aktif</strong>
          <small>${activeShifts.length} shift berjalan</small>
        </div>
        ${activeShifts.length ? activeShifts.map((shift) => `
          <div class="list-item">
            <span>
              <strong>${shift.employees?.employee_code || 'Karyawan'}</strong>
              <small>${shift.outlets?.name || '-'} - ${formatDateTime(shift.checkin_at)}</small>
            </span>
            <span class="badge">${shift.status}</span>
          </div>
        `).join('') : emptyState('Tidak ada shift aktif', 'Outlet belum mulai operasional hari ini.')}
      </article>

      <article class="surface stack">
        <div class="section-title">
          <strong>Lokasi terakhir</strong>
          <small>Update monitoring 15 menit</small>
        </div>
        ${latestLocations.length ? latestLocations.map((ping) => `
          <div class="list-item">
            <span>
              <strong>${ping.employees?.employee_code || 'Karyawan'}</strong>
              <small>${ping.outlets?.name || '-'} - ${formatDateTime(ping.created_at)}</small>
            </span>
            <span class="badge ${ping.inside_radius ? 'success' : 'danger'}">
              ${ping.inside_radius ? 'Dalam radius' : 'Luar radius'}
            </span>
          </div>
        `).join('') : emptyState('Belum ada ping lokasi', 'Lokasi akan muncul saat karyawan mengirim data selama shift.')}
      </article>
    </section>

    <section class="grid two owner-grid">
      <article class="surface stack">
        <div class="section-title">
          <strong>Produk terlaris</strong>
          <small>Hari ini</small>
        </div>
        ${renderBars(productPerformance, 'qty')}
      </article>
      <article class="surface stack">
        <div class="section-title">
          <strong>Top outlet</strong>
          <small>Berdasarkan omzet</small>
        </div>
        ${renderBars(topOutlets, 'amount')}
      </article>
    </section>

    <section class="grid two owner-grid">
      <form class="surface stack" data-form="general-expense">
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
        <button class="primary" type="submit">Simpan</button>
      </form>

      <form class="surface stack" data-form="payroll-period">
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
    </section>

    <section class="grid two owner-grid">
      <form class="surface stack" data-form="outlet">
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

      <form class="surface stack" data-form="product">
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

      <form class="surface stack" data-form="outlet-price">
        <div class="section-title">
          <strong>Harga outlet</strong>
          <small>Terapkan ke semua outlet atau outlet tertentu</small>
        </div>
        <label class="field">
          <span>Produk</span>
          <select name="product_id" required>
            <option value="">Pilih produk</option>
            ${store.getState().products.map((product) => `<option value="${product.id}">${product.name}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Target outlet</span>
          <select name="outlet_id" required>
            <option value="all">Semua outlet</option>
            ${store.getState().outlets.map((outlet) => `<option value="${outlet.id}">${outlet.name}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Harga jual</span>
          <input name="sale_price" type="number" min="0" required />
        </label>
        <button class="primary" type="submit">Terapkan Harga</button>
      </form>
    </section>

    <section class="surface stack">
      <div class="section-title">
        <strong>Audit log</strong>
        <small>25 perubahan terbaru</small>
      </div>
      ${auditLogs.length ? auditLogs.map((log) => `
        <div class="list-item">
          <span>
            <strong>${log.table_name} - ${log.action}</strong>
            <small>${formatDateTime(log.created_at)} - ${log.actor?.full_name || 'System'}</small>
          </span>
          <span class="badge">${log.record_id ? log.record_id.slice(0, 8) : '-'}</span>
        </div>
      `).join('') : emptyState('Belum ada audit log', 'Perubahan data akan muncul otomatis di sini.')}
    </section>
  `;
}

async function initOwnerDashboard(force = false) {
  const state = store.getState();
  if (state.ownerDashboard && !force) {
    bindOwnerForms();
    return;
  }

  try {
    const range = todayRange();
    const [kpis, activeShifts, latestLocations, productPerformance, topOutlets, auditLogs] = await Promise.all([
      ownerRepository.getKpis(range),
      ownerRepository.getActiveShifts(),
      ownerRepository.getLatestLocations(),
      ownerRepository.getProductPerformance(range),
      ownerRepository.getTopOutlets(range),
      ownerRepository.getAuditLogs(),
      catalogRepository.loadOutlets(),
      catalogRepository.loadProducts(),
    ]);

    store.setState({
      ownerDashboard: {
        kpis,
        activeShifts,
        latestLocations,
        productPerformance,
        topOutlets,
        auditLogs,
      },
    });
    bindOwnerForms();
  } catch (error) {
    toast.error(error.message || 'Gagal memuat dashboard owner.');
  }
}

function renderBars(items, valueKey) {
  if (!items.length) return emptyState('Belum ada data', 'Data akan muncul setelah transaksi masuk.');
  const max = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1);
  return items.map((item) => `
    <div class="bar-row">
      <span>${item.name}</span>
      <div><i style="width:${Math.max(6, (Number(item[valueKey] || 0) / max) * 100)}%"></i></div>
      <strong>${valueKey === 'amount' ? formatCurrency(item.amount) : formatNumber(item.qty)}</strong>
    </div>
  `).join('');
}

function bindOwnerForms() {
  document.querySelector('[data-form="general-expense"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profile = store.getState().profile;
    await submit(event.currentTarget, () => ownerRepository.addGeneralExpense({
      tenant_id: profile.tenant_id,
      category: form.get('category'),
      amount: toNumber(form.get('amount')),
      note: form.get('note'),
    }), 'Pengeluaran umum tersimpan.');
  });

  document.querySelector('[data-form="payroll-period"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profile = store.getState().profile;
    await submit(event.currentTarget, () => ownerRepository.createPayrollPeriod({
      tenant_id: profile.tenant_id,
      name: form.get('name'),
      starts_on: form.get('starts_on'),
      ends_on: form.get('ends_on'),
      created_by: profile.id,
    }), 'Draft payroll dibuat.');
  });

  document.querySelector('[data-form="outlet"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profile = store.getState().profile;
    await submit(event.currentTarget, () => catalogRepository.saveOutlet({
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
  });

  document.querySelector('[data-form="product"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profile = store.getState().profile;
    await submit(event.currentTarget, () => catalogRepository.saveProduct({
      tenant_id: profile.tenant_id,
      name: form.get('name'),
      general_sale_price: toNumber(form.get('general_sale_price')),
      hpp: toNumber(form.get('hpp')),
      default_qty: toNumber(form.get('default_qty')),
    }), 'Produk tersimpan.');
  });

  document.querySelector('[data-form="outlet-price"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profile = store.getState().profile;
    await submit(event.currentTarget, () => catalogRepository.applyOutletPrice({
      tenant_id: profile.tenant_id,
      outlet_id: form.get('outlet_id'),
      product_id: form.get('product_id'),
      sale_price: toNumber(form.get('sale_price')),
    }), 'Harga outlet diterapkan.');
  });
}

async function submit(form, action, successMessage) {
  form.querySelectorAll('button, input, select, textarea').forEach((node) => {
    node.disabled = true;
  });
  try {
    await action();
    toast.success(successMessage);
    store.setState({ ownerDashboard: null });
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
