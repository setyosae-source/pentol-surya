import { catalogRepository } from '../data/catalogRepository.js';
import { employeeRepository } from '../data/employeeRepository.js';
import { shiftRepository } from '../data/shiftRepository.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { formatDateTime, formatNumber, toNumber } from '../core/utils.js';
import { productQtyFields } from '../ui/components.js';

export function EmployeeDashboard() {
  queueMicrotask(initEmployeeDashboard);
  const state = store.getState();
  const shift = state.activeShift;

  if (!state.employee) {
    return renderSkeleton();
  }

  if (!shift) {
    return renderCheckIn(state);
  }

  if (!shift.initial_report_submitted_at) {
    return renderInitialReport(state);
  }

  return renderActiveShift(state);
}

async function initEmployeeDashboard() {
  try {
    const context = await employeeRepository.loadContext();
    if (!context?.employee) return;
    const shift = await shiftRepository.loadActiveShift(context.employee.id);
    const outletId = shift?.outlet_id || context.employee.default_outlet_id;
    await catalogRepository.loadOutlets();
    await catalogRepository.loadProducts(outletId);

    bindEmployeeForms();
  } catch (error) {
    toast.error(error.message || 'Gagal memuat dashboard karyawan.');
  }
}

function renderSkeleton() {
  return `
    <section class="stack">
      <div class="skeleton block"></div>
      <div class="skeleton card"></div>
      <div class="skeleton card"></div>
    </section>
  `;
}

function renderCheckIn(state) {
  const employee = state.employee;
  const assigned = state.assignments || [];
  const outlets = assigned.length ? assigned.map((item) => item.outlets) : state.outlets;
  const locked = assigned.some((item) => item.locked_by_owner) || Boolean(employee.default_outlet_id);
  const selectedOutletId = employee.default_outlet_id || assigned[0]?.outlet_id || '';

  queueMicrotask(bindEmployeeForms);

  return `
    <section class="hero-panel">
      <small>Halo, ${state.profile.full_name}</small>
      <h1>Mulai shift hari ini</h1>
      <p>Absen masuk dilakukan di lokasi pengambilan barang. Jam kerja dan gaji mulai dihitung dari sini.</p>
    </section>

    <form class="surface stack" data-form="check-in">
      <label class="field">
        <span>Outlet</span>
        <select name="outlet_id" ${locked ? 'disabled' : ''} required>
          <option value="">Pilih outlet</option>
          ${outlets.map((outlet) => `
            <option value="${outlet.id}" ${outlet.id === selectedOutletId ? 'selected' : ''}>${outlet.name}</option>
          `).join('')}
        </select>
        ${locked ? `<input type="hidden" name="outlet_id" value="${selectedOutletId}" />` : ''}
      </label>
      <label class="field">
        <span>Foto absen masuk</span>
        <input name="photo" type="file" accept="image/*" capture="environment" required />
      </label>
      <button class="primary" type="submit">Absen Masuk</button>
    </form>
  `;
}

function renderInitialReport(state) {
  const shift = state.activeShift;
  queueMicrotask(async () => {
    try {
      const suggested = await shiftRepository.getSuggestedOpeningStock(shift.outlets, state.products);
      store.setState({ suggestedOpeningStock: suggested });
      bindEmployeeForms();
    } catch (error) {
      toast.error(error.message || 'Gagal menghitung stok awal.');
    }
  });

  const stock = state.suggestedOpeningStock || state.products.map((product) => ({
    product,
    qty: product.default_qty || 0,
    source: 'default_qty',
  }));

  return `
    <section class="hero-panel">
      <small>${shift.outlets?.name || 'Outlet'}</small>
      <h1>Laporan awal</h1>
      <p>Isi modal awal dan stok awal sebelum mulai jualan.</p>
    </section>

    <form class="surface stack" data-form="initial-report">
      <label class="field">
        <span>Modal awal cash</span>
        <input name="opening_cash" inputmode="numeric" type="number" min="0" placeholder="0" required />
      </label>
      <div class="section-title">
        <strong>Stok awal</strong>
        <small>Default mengikuti setting outlet</small>
      </div>
      <div class="product-grid">
        ${stock.map((item) => `
          <label class="field compact">
            <span>${item.product.name}</span>
            <small>${item.source === 'previous_remaining' ? 'Sisa shift sebelumnya' : 'Qty default'}</small>
            <input name="stock_${item.product.id}" type="number" min="0" step="0.01" value="${formatNumber(item.qty).replace(',', '.')}" />
            <input name="source_${item.product.id}" type="hidden" value="${item.source}" />
          </label>
        `).join('')}
      </div>
      <label class="field">
        <span>Catatan</span>
        <textarea name="note" rows="3"></textarea>
      </label>
      <button class="primary" type="submit">Simpan Laporan Awal</button>
    </form>
  `;
}

function renderActiveShift(state) {
  const shift = state.activeShift;
  queueMicrotask(bindEmployeeForms);

  return `
    <section class="hero-panel">
      <small>${shift.outlets?.name || 'Outlet'}</small>
      <h1>Shift aktif</h1>
      <p>Mulai ${formatDateTime(shift.checkin_at)}. Lokasi akan dikirim setiap 15 menit selama shift berjalan.</p>
    </section>

    <section class="grid two">
      <article class="surface metric">
        <small>Status</small>
        <strong>${shift.status}</strong>
      </article>
      <article class="surface metric">
        <small>Jarak absen masuk</small>
        <strong>${shift.checkin_distance_m ? `${Math.round(shift.checkin_distance_m)} m` : '-'}</strong>
      </article>
    </section>

    <section class="action-grid">
      <a class="action-card" href="#/operations" data-op="sale">
        <strong>Tambah Penjualan</strong>
        <span>Cash, QRIS, transfer, piutang</span>
      </a>
      <a class="action-card" href="#/operations" data-op="expense">
        <strong>Pengeluaran</strong>
        <span>Parkir, es batu, gas, transport</span>
      </a>
      <a class="action-card" href="#/operations" data-op="supply">
        <strong>Supply</strong>
        <span>Tambahan produk dan sumber</span>
      </a>
      <a class="action-card" href="#/operations" data-op="periodic">
        <strong>Laporan Berkala</strong>
        <span>Stok fisik dan uang terkini</span>
      </a>
    </section>

    <button class="secondary full" data-action="send-location">Kirim Lokasi Sekarang</button>
  `;
}

function bindEmployeeForms() {
  document.querySelector('[data-form="check-in"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const state = store.getState();
    const outlet = state.outlets.find((item) => item.id === form.get('outlet_id'));
    if (!outlet) {
      toast.error('Outlet belum dipilih.');
      return;
    }

    setBusy(event.currentTarget, true);
    try {
      await shiftRepository.checkIn({
        outlet,
        employee: state.employee,
        photoFile: form.get('photo'),
      });
      toast.success('Absen masuk tersimpan.');
    } catch (error) {
      toast.error(error.message || 'Gagal absen masuk.');
    } finally {
      setBusy(event.currentTarget, false);
    }
  });

  document.querySelector('[data-form="initial-report"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const state = store.getState();
    const stockItems = state.products.map((product) => ({
      product_id: product.id,
      qty: toNumber(form.get(`stock_${product.id}`)),
      source: form.get(`source_${product.id}`) || 'default_qty',
    }));

    setBusy(event.currentTarget, true);
    try {
      await shiftRepository.submitInitialReport({
        shift: state.activeShift,
        openingCash: toNumber(form.get('opening_cash')),
        note: form.get('note'),
        stockItems,
      });
      toast.success('Laporan awal tersimpan.');
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan laporan awal.');
    } finally {
      setBusy(event.currentTarget, false);
    }
  });

  document.querySelector('[data-action="send-location"]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      await shiftRepository.sendLocationPing(store.getState().activeShift);
      toast.success('Lokasi terkirim.');
    } catch (error) {
      toast.error(error.message || 'Gagal mengirim lokasi.');
    } finally {
      event.currentTarget.disabled = false;
    }
  });
}

function setBusy(form, busy) {
  form.querySelectorAll('button, input, select, textarea').forEach((node) => {
    node.disabled = busy;
  });
}
