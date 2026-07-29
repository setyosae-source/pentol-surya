import { authRepository } from '../data/authRepository.js';
import { catalogRepository } from '../data/catalogRepository.js';
import { employeeRepository } from '../data/employeeRepository.js';
import { ownerRepository } from '../data/ownerRepository.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { escapeHtml, formatCurrency, formatDateTime, formatNumber, toNumber } from '../core/utils.js';
import { emptyState } from '../ui/components.js';

const SECTIONS = {
  employees: {
    title: 'Karyawan',
    eyebrow: 'Tim outlet',
    description: 'Kelola data karyawan, outlet default, komponen gaji, dan reset PIN.',
    addLabel: 'Tambah karyawan',
  },
  outlets: {
    title: 'Outlet',
    eyebrow: 'Multi outlet',
    description: 'Kelola lokasi outlet, titik absen, geofence, dan jadwal laporan.',
    addLabel: 'Tambah outlet',
  },
  products: {
    title: 'Produk',
    eyebrow: 'Master produk',
    description: 'Kelola produk aktif, harga jual umum, stok default, dan HPP.',
    addLabel: 'Tambah produk',
  },
  prices: {
    title: 'Harga outlet',
    eyebrow: 'Harga khusus',
    description: 'Kelola harga khusus per outlet tanpa mengubah snapshot transaksi lama.',
    addLabel: 'Tambah harga',
  },
  expenses: {
    title: 'Biaya umum',
    eyebrow: 'Keuangan owner',
    description: 'Kelola pengeluaran umum yang tidak terkait outlet tertentu.',
    addLabel: 'Tambah biaya',
  },
  payroll: {
    title: 'Periode gaji',
    eyebrow: 'Payroll',
    description: 'Kelola periode gaji manual dengan status draft, final, atau sudah dibayar.',
    addLabel: 'Tambah periode',
  },
  audit: {
    title: 'Audit log',
    eyebrow: 'Keamanan',
    description: 'Pantau perubahan data terbaru yang tercatat otomatis oleh database.',
    addLabel: '',
    readonly: true,
  },
};

export function OwnerDataView({ section = 'employees' } = {}) {
  const activeSection = SECTIONS[section] ? section : 'employees';
  const meta = SECTIONS[activeSection];
  const state = store.getState();
  const sectionState = state.ownerData?.[activeSection] || {};
  const rows = sectionState.rows || [];

  queueMicrotask(() => initOwnerData(activeSection));

  return `
    <section class="data-page">
      <div class="data-heading">
        <span>
          <small>${escapeHtml(meta.eyebrow)}</small>
          <h1>${escapeHtml(meta.title)}</h1>
          <p>${escapeHtml(meta.description)}</p>
        </span>
        <a class="secondary" href="#/owner">Dashboard</a>
      </div>

      ${sectionState.error ? `
        <div class="empty-state">
          <strong>Data belum bisa dimuat</strong>
          <p>${escapeHtml(sectionState.error)}</p>
        </div>
      ` : ''}

      <article class="surface data-surface">
        <div class="section-title">
          <strong>${escapeHtml(meta.title)}</strong>
          <small>${sectionState.loading ? 'Memuat data...' : `${rows.length} data tersimpan`}</small>
        </div>
        ${sectionState.loading && !sectionState.loaded ? '<div class="skeleton block"></div>' : renderTable(activeSection, rows)}
      </article>

      ${meta.readonly ? '' : `<button class="fab owner-fab" type="button" data-owner-add="${activeSection}" aria-label="${escapeHtml(meta.addLabel)}">+</button>`}
    </section>
  `;
}

async function initOwnerData(section) {
  const current = store.getState().ownerData?.[section];
  if (current?.loaded) {
    bindOwnerData(section);
    return;
  }
  if (current?.loading) return;
  await refreshOwnerData(section);
}

async function refreshOwnerData(section) {
  setSectionState(section, { loading: true, error: null });
  try {
    const rows = await loadRows(section);
    setSectionState(section, {
      rows,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch (error) {
    setSectionState(section, {
      rows: [],
      loaded: false,
      loading: false,
      error: error.message || 'Gagal memuat data.',
    });
    toast.error(error.message || 'Gagal memuat data.');
  }
}

function setSectionState(section, patch) {
  const state = store.getState();
  const ownerData = state.ownerData || {};
  store.setState({
    ownerData: {
      ...ownerData,
      [section]: {
        ...(ownerData[section] || {}),
        ...patch,
      },
    },
  });
}

async function loadRows(section) {
  if (section === 'employees') {
    await catalogRepository.loadOutlets({ force: true });
    return employeeRepository.listEmployees();
  }
  if (section === 'outlets') return catalogRepository.loadOutlets({ force: true });
  if (section === 'products') return catalogRepository.loadProducts(null, { force: true });
  if (section === 'prices') {
    await Promise.all([
      catalogRepository.loadOutlets({ force: true }),
      catalogRepository.loadProducts(null, { force: true }),
    ]);
    return catalogRepository.loadOutletPrices({ force: true });
  }
  if (section === 'expenses') return ownerRepository.listGeneralExpenses();
  if (section === 'payroll') return ownerRepository.listPayrollPeriods();
  if (section === 'audit') return ownerRepository.getAuditLogs();
  return [];
}

function bindOwnerData(section) {
  document.querySelector(`[data-owner-add="${section}"]`)?.addEventListener('click', () => {
    openEditor(section);
  });

  document.querySelectorAll(`[data-owner-edit="${section}"]`).forEach((button) => {
    button.addEventListener('click', () => {
      const row = findRow(section, button.dataset.rowId);
      if (row) openEditor(section, row);
    });
  });

  document.querySelectorAll(`[data-owner-delete="${section}"]`).forEach((button) => {
    button.addEventListener('click', async () => {
      const row = findRow(section, button.dataset.rowId);
      if (!row) return;
      await deleteRow(section, row);
    });
  });
}

function findRow(section, id) {
  return (store.getState().ownerData?.[section]?.rows || []).find((row) => row.id === id);
}

function renderTable(section, rows) {
  if (!rows.length) return emptyState('Belum ada data', 'Tekan tombol tambah untuk membuat data baru.');
  const renderers = {
    employees: renderEmployeeRows,
    outlets: renderOutletRows,
    products: renderProductRows,
    prices: renderPriceRows,
    expenses: renderExpenseRows,
    payroll: renderPayrollRows,
    audit: renderAuditRows,
  };
  const headers = {
    employees: ['Kode', 'Nama', 'HP', 'Outlet', 'Gaji', 'Aksi'],
    outlets: ['Outlet', 'Lokasi', 'Geofence', 'Stok awal', 'Aksi'],
    products: ['Produk', 'Kategori', 'Harga umum', 'HPP', 'Aksi'],
    prices: ['Outlet', 'Produk', 'Harga', 'Berlaku', 'Aksi'],
    expenses: ['Tanggal', 'Kategori', 'Jumlah', 'Catatan', 'Aksi'],
    payroll: ['Periode', 'Tanggal', 'Status', 'Dibuat', 'Aksi'],
    audit: ['Waktu', 'Tabel', 'Aksi', 'Record', 'Alasan'],
  };

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>${headers[section].map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>${renderers[section](rows)}</tbody>
      </table>
    </div>
  `;
}

function renderEmployeeRows(rows) {
  return rows.map((employee) => `
    <tr>
      <td><strong>${escapeHtml(employee.employee_code)}</strong></td>
      <td>${escapeHtml(employee.user_profiles?.full_name || '-')}</td>
      <td>${escapeHtml(employee.phone || '-')}</td>
      <td>${escapeHtml(employee.default_outlet?.name || 'Bebas')}</td>
      <td>
        <strong>${formatCurrency(employee.hourly_rate)}/jam</strong>
        <small>Makan ${formatCurrency(employee.meal_allowance)} - Transport ${formatCurrency(employee.transport_allowance)}</small>
      </td>
      <td>${rowActions('employees', employee.id, 'Nonaktifkan')}</td>
    </tr>
  `).join('');
}

function renderOutletRows(rows) {
  return rows.map((outlet) => `
    <tr>
      <td><strong>${escapeHtml(outlet.name)}</strong><small>${escapeHtml(outlet.address || '-')}</small></td>
      <td>
        <small>Jual ${formatCoordinate(outlet.sale_lat, outlet.sale_lng)}</small>
        <small>Ambil ${formatCoordinate(outlet.pickup_lat, outlet.pickup_lng)}</small>
      </td>
      <td>${formatNumber(outlet.geofence_radius_m)} m</td>
      <td>${stockMethodLabel(outlet.stock_default_method)}</td>
      <td>${rowActions('outlets', outlet.id, 'Nonaktifkan')}</td>
    </tr>
  `).join('');
}

function renderProductRows(rows) {
  return rows.map((product) => `
    <tr>
      <td><strong>${escapeHtml(product.name)}</strong><small>Default ${formatNumber(product.default_qty)}</small></td>
      <td>${escapeHtml(product.product_categories?.name || '-')}</td>
      <td>${formatCurrency(product.general_sale_price)}</td>
      <td>${product.can_view_cost ? formatCurrency(product.hpp) : '-'}</td>
      <td>${rowActions('products', product.id, 'Nonaktifkan')}</td>
    </tr>
  `).join('');
}

function renderPriceRows(rows) {
  return rows.map((price) => `
    <tr>
      <td>${escapeHtml(price.outlets?.name || '-')}</td>
      <td>${escapeHtml(price.products?.name || '-')}</td>
      <td><strong>${formatCurrency(price.sale_price)}</strong></td>
      <td>${formatDateTime(price.valid_from)}</td>
      <td>${rowActions('prices', price.id, 'Hapus')}</td>
    </tr>
  `).join('');
}

function renderExpenseRows(rows) {
  return rows.map((expense) => `
    <tr>
      <td>${escapeHtml(expense.occurred_at || '-')}</td>
      <td><strong>${escapeHtml(expense.category)}</strong></td>
      <td>${formatCurrency(expense.amount)}</td>
      <td>${escapeHtml(expense.note || '-')}</td>
      <td>${rowActions('expenses', expense.id, 'Hapus')}</td>
    </tr>
  `).join('');
}

function renderPayrollRows(rows) {
  return rows.map((period) => `
    <tr>
      <td><strong>${escapeHtml(period.name)}</strong></td>
      <td>${escapeHtml(period.starts_on)} s/d ${escapeHtml(period.ends_on)}</td>
      <td><span class="badge">${payrollStatusLabel(period.status)}</span></td>
      <td>${formatDateTime(period.created_at)}</td>
      <td>${rowActions('payroll', period.id, 'Hapus')}</td>
    </tr>
  `).join('');
}

function renderAuditRows(rows) {
  return rows.map((log) => `
    <tr>
      <td>${formatDateTime(log.created_at)}</td>
      <td><strong>${escapeHtml(log.table_name)}</strong></td>
      <td>${escapeHtml(log.action)}</td>
      <td>${escapeHtml(log.record_id ? log.record_id.slice(0, 8) : '-')}</td>
      <td>${escapeHtml(log.reason || '-')}</td>
    </tr>
  `).join('');
}

function rowActions(section, rowId, deleteLabel) {
  return `
    <div class="table-actions">
      <button class="secondary compact-button" type="button" data-owner-edit="${section}" data-row-id="${rowId}">Edit</button>
      <button class="danger compact-button" type="button" data-owner-delete="${section}" data-row-id="${rowId}">${deleteLabel}</button>
    </div>
  `;
}

function openEditor(section, row = null) {
  const meta = SECTIONS[section];
  document.querySelector('[data-owner-modal]')?.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop" data-owner-modal>
      <section class="modal-card" role="dialog" aria-modal="true">
        <div class="section-title">
          <span>
            <strong>${row ? `Edit ${escapeHtml(meta.title)}` : escapeHtml(meta.addLabel)}</strong>
            <small>${escapeHtml(meta.description)}</small>
          </span>
          <button class="icon-button" type="button" data-modal-close aria-label="Tutup">X</button>
        </div>
        <form class="stack" data-owner-editor="${section}">
          ${renderEditorFields(section, row)}
          <div class="form-actions">
            <button class="secondary" type="button" data-modal-close>Batal</button>
            <button class="primary" type="submit">Simpan</button>
          </div>
        </form>
      </section>
    </div>
  `);

  document.querySelectorAll('[data-modal-close]').forEach((button) => {
    button.addEventListener('click', closeEditor);
  });
  document.querySelector('[data-owner-modal]')?.addEventListener('click', (event) => {
    if (event.target.matches('[data-owner-modal]')) closeEditor();
  });
  document.querySelector(`[data-owner-editor="${section}"]`)?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveRow(section, event.currentTarget, row);
  });
}

function closeEditor() {
  document.querySelector('[data-owner-modal]')?.remove();
}

function renderEditorFields(section, row) {
  const state = store.getState();
  const profile = state.profile;
  const outlets = state.outlets || [];
  const products = state.products || [];

  if (section === 'employees') {
    return `
      <div class="grid two">
        ${hiddenTenant(profile)}
        <label class="field"><span>Nama lengkap</span><input name="full_name" value="${fieldValue(row?.user_profiles?.full_name)}" required /></label>
        <label class="field"><span>Kode karyawan</span><input name="employee_code" value="${fieldValue(row?.employee_code)}" placeholder="PS001" required /></label>
        <label class="field"><span>Nomor HP</span><input name="phone" inputmode="tel" value="${fieldValue(row?.phone)}" placeholder="+62812..." required /></label>
        <label class="field"><span>${row ? 'PIN baru opsional' : 'PIN awal'}</span><input name="pin" type="password" inputmode="numeric" maxlength="6" ${row ? '' : 'required'} /></label>
        <label class="field">
          <span>Outlet default</span>
          <select name="default_outlet_id">
            <option value="">Bebas dipilih karyawan</option>
            ${outletOptions(outlets, row?.default_outlet_id)}
          </select>
        </label>
        <label class="field"><span>Upah per jam</span><input name="hourly_rate" type="number" min="0" value="${numberValue(row?.hourly_rate, 5000)}" /></label>
        <label class="field"><span>Uang makan</span><input name="meal_allowance" type="number" min="0" value="${numberValue(row?.meal_allowance, 10000)}" /></label>
        <label class="field"><span>Transport</span><input name="transport_allowance" type="number" min="0" value="${numberValue(row?.transport_allowance, 0)}" /></label>
      </div>
    `;
  }

  if (section === 'outlets') {
    return `
      ${hiddenTenant(profile)}
      <label class="field"><span>Nama outlet</span><input name="name" value="${fieldValue(row?.name)}" required /></label>
      <label class="field"><span>Alamat</span><textarea name="address" rows="2">${fieldValue(row?.address)}</textarea></label>
      <div class="grid two">
        <label class="field"><span>Lat jualan</span><input name="sale_lat" type="number" step="0.0000001" value="${numberValue(row?.sale_lat, '')}" /></label>
        <label class="field"><span>Lng jualan</span><input name="sale_lng" type="number" step="0.0000001" value="${numberValue(row?.sale_lng, '')}" /></label>
        <label class="field"><span>Lat ambil barang</span><input name="pickup_lat" type="number" step="0.0000001" value="${numberValue(row?.pickup_lat, '')}" /></label>
        <label class="field"><span>Lng ambil barang</span><input name="pickup_lng" type="number" step="0.0000001" value="${numberValue(row?.pickup_lng, '')}" /></label>
        <label class="field"><span>Lat absen pulang</span><input name="checkout_lat" type="number" step="0.0000001" value="${numberValue(row?.checkout_lat, '')}" /></label>
        <label class="field"><span>Lng absen pulang</span><input name="checkout_lng" type="number" step="0.0000001" value="${numberValue(row?.checkout_lng, '')}" /></label>
        <label class="field"><span>Radius geofence meter</span><input name="geofence_radius_m" type="number" min="1" value="${numberValue(row?.geofence_radius_m, 120)}" /></label>
        <label class="field">
          <span>Metode stok awal</span>
          <select name="stock_default_method">
            ${option('default_qty', 'Qty default', row?.stock_default_method)}
            ${option('previous_remaining', 'Sisa shift sebelumnya', row?.stock_default_method)}
          </select>
        </label>
        <label class="field">
          <span>Mode laporan berkala</span>
          <select name="report_schedule_mode">
            ${option('free', 'Bebas', row?.report_schedule_mode)}
            ${option('scheduled', 'Jam tertentu', row?.report_schedule_mode)}
          </select>
        </label>
        <label class="field"><span>Jam laporan</span><input name="report_times" value="${fieldValue(timeList(row?.report_times))}" placeholder="10:00, 13:00, 16:00" /></label>
      </div>
    `;
  }

  if (section === 'products') {
    return `
      ${hiddenTenant(profile)}
      <label class="field"><span>Nama produk</span><input name="name" value="${fieldValue(row?.name)}" required /></label>
      <div class="grid two">
        <label class="field"><span>Harga jual umum</span><input name="general_sale_price" type="number" min="0" value="${numberValue(row?.general_sale_price, 0)}" required /></label>
        <label class="field"><span>HPP</span><input name="hpp" type="number" min="0" value="${numberValue(row?.hpp, 0)}" required /></label>
        <label class="field"><span>Qty default</span><input name="default_qty" type="number" min="0" step="0.01" value="${numberValue(row?.default_qty, 0)}" /></label>
      </div>
    `;
  }

  if (section === 'prices') {
    return `
      ${hiddenTenant(profile)}
      <div class="grid two">
        <label class="field">
          <span>Produk</span>
          <select name="product_id" ${row ? 'disabled' : 'required'}>
            <option value="">Pilih produk</option>
            ${productOptions(products, row?.product_id)}
          </select>
        </label>
        <label class="field">
          <span>Outlet</span>
          <select name="outlet_id" ${row ? 'disabled' : 'required'}>
            ${row ? '' : '<option value="all">Semua outlet</option>'}
            ${outletOptions(outlets, row?.outlet_id)}
          </select>
        </label>
        <label class="field"><span>Harga jual</span><input name="sale_price" type="number" min="0" value="${numberValue(row?.sale_price, 0)}" required /></label>
      </div>
    `;
  }

  if (section === 'expenses') {
    return `
      ${hiddenTenant(profile)}
      <div class="grid two">
        <label class="field"><span>Tanggal</span><input name="occurred_at" type="date" value="${fieldValue(row?.occurred_at || todayDate())}" required /></label>
        <label class="field"><span>Kategori</span><input name="category" value="${fieldValue(row?.category)}" required /></label>
        <label class="field"><span>Jumlah</span><input name="amount" type="number" min="0" value="${numberValue(row?.amount, 0)}" required /></label>
      </div>
      <label class="field"><span>Catatan</span><textarea name="note" rows="3">${fieldValue(row?.note)}</textarea></label>
    `;
  }

  if (section === 'payroll') {
    return `
      ${hiddenTenant(profile)}
      <label class="field"><span>Nama periode</span><input name="name" value="${fieldValue(row?.name)}" required /></label>
      <div class="grid two">
        <label class="field"><span>Mulai</span><input name="starts_on" type="date" value="${fieldValue(row?.starts_on)}" required /></label>
        <label class="field"><span>Sampai</span><input name="ends_on" type="date" value="${fieldValue(row?.ends_on)}" required /></label>
        <label class="field">
          <span>Status</span>
          <select name="status">
            ${option('draft', 'Draft', row?.status)}
            ${option('final', 'Final', row?.status)}
            ${option('paid', 'Sudah dibayar', row?.status)}
          </select>
        </label>
      </div>
    `;
  }

  return '';
}

async function saveRow(section, form, row) {
  const values = new FormData(form);
  disableForm(form, true);
  try {
    const profile = store.getState().profile;

    if (section === 'employees') {
      if (row) {
        await employeeRepository.updateEmployee(row.id, {
          user_id: row.user_id,
          full_name: values.get('full_name'),
          employee_code: values.get('employee_code'),
          phone: values.get('phone'),
          default_outlet_id: values.get('default_outlet_id') || null,
          hourly_rate: toNumber(values.get('hourly_rate')),
          meal_allowance: toNumber(values.get('meal_allowance')),
          transport_allowance: toNumber(values.get('transport_allowance')),
          active: true,
        });
        const newPin = String(values.get('pin') || '').trim();
        if (newPin) {
          await authRepository.resetEmployeePin({ userId: row.user_id, newPin });
        }
      } else {
        await authRepository.createEmployee({
          full_name: values.get('full_name'),
          employee_code: values.get('employee_code'),
          phone: values.get('phone'),
          pin: values.get('pin'),
          default_outlet_id: values.get('default_outlet_id') || null,
          hourly_rate: values.get('hourly_rate'),
          meal_allowance: values.get('meal_allowance'),
          transport_allowance: values.get('transport_allowance'),
        });
      }
    }

    if (section === 'outlets') {
      await catalogRepository.saveOutlet({
        id: row?.id,
        tenant_id: profile.tenant_id,
        name: values.get('name'),
        address: values.get('address'),
        sale_lat: nullableNumber(values.get('sale_lat')),
        sale_lng: nullableNumber(values.get('sale_lng')),
        pickup_lat: nullableNumber(values.get('pickup_lat')),
        pickup_lng: nullableNumber(values.get('pickup_lng')),
        checkout_lat: nullableNumber(values.get('checkout_lat')),
        checkout_lng: nullableNumber(values.get('checkout_lng')),
        geofence_radius_m: toNumber(values.get('geofence_radius_m'), 120),
        stock_default_method: values.get('stock_default_method'),
        report_schedule_mode: values.get('report_schedule_mode'),
        report_times: parseReportTimes(values.get('report_times')),
        active: true,
      });
    }

    if (section === 'products') {
      await catalogRepository.saveProduct({
        id: row?.id,
        tenant_id: profile.tenant_id,
        name: values.get('name'),
        general_sale_price: toNumber(values.get('general_sale_price')),
        hpp: toNumber(values.get('hpp')),
        default_qty: toNumber(values.get('default_qty')),
        active: true,
      });
    }

    if (section === 'prices') {
      if (row) {
        await catalogRepository.saveOutletPrice({
          id: row.id,
          sale_price: toNumber(values.get('sale_price')),
        });
      } else if (values.get('outlet_id') === 'all') {
        await catalogRepository.applyOutletPrice({
          tenant_id: profile.tenant_id,
          outlet_id: 'all',
          product_id: values.get('product_id'),
          sale_price: toNumber(values.get('sale_price')),
        });
      } else {
        await catalogRepository.saveOutletPrice({
          tenant_id: profile.tenant_id,
          outlet_id: values.get('outlet_id'),
          product_id: values.get('product_id'),
          sale_price: toNumber(values.get('sale_price')),
        });
      }
    }

    if (section === 'expenses') {
      await ownerRepository.saveGeneralExpense({
        id: row?.id,
        tenant_id: profile.tenant_id,
        category: values.get('category'),
        amount: toNumber(values.get('amount')),
        occurred_at: values.get('occurred_at'),
        note: values.get('note'),
        created_by: row?.created_by || profile.id,
      });
    }

    if (section === 'payroll') {
      await ownerRepository.savePayrollPeriod({
        id: row?.id,
        tenant_id: profile.tenant_id,
        name: values.get('name'),
        starts_on: values.get('starts_on'),
        ends_on: values.get('ends_on'),
        status: values.get('status'),
        created_by: row?.created_by || profile.id,
      });
    }

    store.setState({ ownerDashboard: null, ownerDashboardError: null });
    await refreshOwnerData(section);
    closeEditor();
    toast.success('Data berhasil disimpan.');
  } catch (error) {
    toast.error(error.message || 'Gagal menyimpan data.');
  } finally {
    disableForm(form, false);
  }
}

async function deleteRow(section, row) {
  const label = deleteLabel(section, row);
  if (!confirm(`Hapus/nonaktifkan ${label}? Data transaksi lama tetap aman.`)) return;

  try {
    if (section === 'employees') await employeeRepository.deactivateEmployee(row);
    if (section === 'outlets') await catalogRepository.deleteOutlet(row.id);
    if (section === 'products') await catalogRepository.deleteProduct(row.id);
    if (section === 'prices') await catalogRepository.deleteOutletPrice(row.id);
    if (section === 'expenses') await ownerRepository.deleteGeneralExpense(row.id);
    if (section === 'payroll') await ownerRepository.deletePayrollPeriod(row.id);

    store.setState({ ownerDashboard: null, ownerDashboardError: null });
    await refreshOwnerData(section);
    toast.success('Data berhasil dihapus/nonaktifkan.');
  } catch (error) {
    toast.error(error.message || 'Gagal menghapus data.');
  }
}

function deleteLabel(section, row) {
  if (section === 'employees') return row.user_profiles?.full_name || row.employee_code;
  if (section === 'outlets') return row.name;
  if (section === 'products') return row.name;
  if (section === 'prices') return `${row.products?.name || 'produk'} di ${row.outlets?.name || 'outlet'}`;
  if (section === 'expenses') return row.category;
  if (section === 'payroll') return row.name;
  return 'data ini';
}

function disableForm(form, disabled) {
  form.querySelectorAll('button, input, select, textarea').forEach((node) => {
    node.disabled = disabled;
  });
}

function hiddenTenant(profile) {
  return `<input type="hidden" name="tenant_id" value="${escapeHtml(profile?.tenant_id || '')}" />`;
}

function outletOptions(outlets, selected) {
  return outlets.map((outlet) => option(outlet.id, outlet.name, selected)).join('');
}

function productOptions(products, selected) {
  return products.map((product) => option(product.id, product.name, selected)).join('');
}

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}" ${String(value) === String(selected || '') ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function fieldValue(value) {
  return escapeHtml(value ?? '');
}

function numberValue(value, fallback) {
  return value === null || value === undefined || value === '' ? fallback : Number(value);
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

function timeList(times) {
  return (times || []).map((time) => String(time).slice(0, 5)).join(', ');
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatCoordinate(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return '-';
  return `${formatNumber(lat)}, ${formatNumber(lng)}`;
}

function stockMethodLabel(value) {
  return value === 'previous_remaining' ? 'Sisa shift sebelumnya' : 'Qty default';
}

function payrollStatusLabel(value) {
  if (value === 'paid') return 'Sudah dibayar';
  if (value === 'final') return 'Final';
  return 'Draft';
}
