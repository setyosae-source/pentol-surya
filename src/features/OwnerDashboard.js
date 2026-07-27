import { ownerRepository } from '../data/ownerRepository.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { formatCurrency, formatDateTime, formatNumber, todayRange } from '../core/utils.js';
import { kpiCard, emptyState } from '../ui/components.js';

export function OwnerDashboard() {
  queueMicrotask(initOwnerDashboard);
  const state = store.getState();
  const dashboard = state.ownerDashboard;

  if (!dashboard) {
    return `
      <section class="stack">
        ${state.ownerDashboardError ? `
          <div class="empty-state">
            <strong>Dashboard belum bisa dimuat</strong>
            <p>${state.ownerDashboardError}</p>
          </div>
        ` : ''}
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

    <section class="surface stack">
      <div class="section-title">
        <strong>Audit log</strong>
        <small>25 perubahan terbaru</small>
      </div>
      ${auditLogs.length ? auditLogs.map((log) => `
        <div class="list-item">
          <span>
            <strong>${log.table_name} - ${log.action}</strong>
            <small>${formatDateTime(log.created_at)} - ${log.actor_id ? `User ${log.actor_id.slice(0, 8)}` : 'System'}</small>
          </span>
          <span class="badge">${log.record_id ? log.record_id.slice(0, 8) : '-'}</span>
        </div>
      `).join('') : emptyState('Belum ada audit log', 'Perubahan data akan muncul otomatis di sini.')}
    </section>
  `;
}

async function initOwnerDashboard(force = false) {
  const state = store.getState();
  if (state.ownerDashboard && !force) return;
  if (state.ownerDashboardLoading && !force) return;
  if (state.ownerDashboardError && !force) return;

  try {
    store.setState({ ownerDashboardLoading: true });
    const range = todayRange();
    const [kpis, activeShifts, latestLocations, productPerformance, topOutlets, auditLogs] = await Promise.all([
      ownerRepository.getKpis(range),
      ownerRepository.getActiveShifts(),
      ownerRepository.getLatestLocations(),
      ownerRepository.getProductPerformance(range),
      ownerRepository.getTopOutlets(range),
      ownerRepository.getAuditLogs(),
    ]);

    store.setState({
      ownerDashboardLoading: false,
      ownerDashboardError: null,
      ownerDashboard: {
        kpis,
        activeShifts,
        latestLocations,
        productPerformance,
        topOutlets,
        auditLogs,
      },
    });
  } catch (error) {
    store.setState({
      ownerDashboardLoading: false,
      ownerDashboardError: error.message || 'Gagal memuat dashboard owner.',
    });
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
