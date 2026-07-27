import { catalogRepository } from '../data/catalogRepository.js';
import { employeeRepository } from '../data/employeeRepository.js';
import { shiftRepository } from '../data/shiftRepository.js';
import { stockRepository } from '../data/stockRepository.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { toNumber } from '../core/utils.js';
import { productQtyFields } from '../ui/components.js';

export function ShiftFinalView() {
  queueMicrotask(initFinal);
  const { activeShift, products } = store.getState();

  if (!activeShift) {
    return `
      <section class="hero-panel">
        <h1>Tutup Shift</h1>
        <p>Belum ada shift aktif.</p>
      </section>
    `;
  }

  return `
    <section class="hero-panel">
      <small>${activeShift.outlets?.name || 'Outlet'}</small>
      <h1>Laporan akhir</h1>
      <p>Isi stok akhir, uang masuk, piutang, dan setoran cash.</p>
    </section>

    <form class="surface stack" data-form="final-report">
      <div class="grid two">
        <label class="field">
          <span>Cash</span>
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
        <label class="field">
          <span>Piutang</span>
          <input name="receivable_amount" type="number" min="0" value="0" />
        </label>
        <label class="field">
          <span>Setoran cash</span>
          <input name="cash_deposit_amount" type="number" min="0" value="0" />
        </label>
      </div>

      <div class="section-title">
        <strong>Stok akhir</strong>
        <small>Penjualan bisa dihitung dari selisih stok.</small>
      </div>
      ${productQtyFields(products, 'ending')}

      <label class="field checkbox">
        <input name="continue_shift" type="checkbox" />
        <span>Lanjutkan shift setelah laporan akhir</span>
      </label>
      <label class="field">
        <span>Catatan</span>
        <textarea name="note" rows="3"></textarea>
      </label>
      <button class="primary" type="submit">Simpan Laporan Akhir</button>
    </form>

    ${activeShift.final_report_submitted_at ? `
      <form class="surface stack" data-form="check-out">
        <h2>Absen pulang</h2>
        <label class="field">
          <span>Foto absen pulang</span>
          <input name="photo" type="file" accept="image/*" capture="environment" required />
        </label>
        <button class="danger" type="submit">Absen Pulang & Akhiri Shift</button>
      </form>
    ` : ''}
  `;
}

async function initFinal() {
  try {
    if (!store.getState().employee && store.getState().profile?.role === 'employee') {
      await employeeRepository.loadContext();
    }
    const employeeId = store.getState().employee?.id;
    if (!store.getState().activeShift) await shiftRepository.loadActiveShift(employeeId);
    const shift = store.getState().activeShift;
    if (shift) await catalogRepository.loadProducts(shift.outlet_id);
    bindFinalForms();
  } catch (error) {
    toast.error(error.message || 'Gagal memuat tutup shift.');
  }
}

function bindFinalForms() {
  document.querySelector('[data-form="final-report"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { activeShift, products } = store.getState();
    const expectedMap = await stockRepository.expectedStockMap(activeShift.id);
    const stockItems = products.map((product) => ({
      product_id: product.id,
      ending_qty: toNumber(form.get(`ending_${product.id}`)),
      expected_qty: expectedMap.get(product.id) ?? toNumber(form.get(`ending_${product.id}`)),
    }));

    await submit(event.currentTarget, () => shiftRepository.submitFinalReport({
      shift: activeShift,
      values: {
        cash_amount: toNumber(form.get('cash_amount')),
        qris_amount: toNumber(form.get('qris_amount')),
        transfer_amount: toNumber(form.get('transfer_amount')),
        receivable_amount: toNumber(form.get('receivable_amount')),
        cash_deposit_amount: toNumber(form.get('cash_deposit_amount')),
        continue_shift: form.get('continue_shift') === 'on',
        note: form.get('note'),
      },
      stockItems,
    }), 'Laporan akhir tersimpan.');
  });

  document.querySelector('[data-form="check-out"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit(event.currentTarget, () => shiftRepository.checkOut({
      shift: store.getState().activeShift,
      photoFile: form.get('photo'),
    }), 'Shift selesai.');
  });
}

async function submit(form, action, successMessage) {
  form.querySelectorAll('button, input, select, textarea').forEach((node) => {
    node.disabled = true;
  });
  try {
    await action();
    toast.success(successMessage);
  } catch (error) {
    toast.error(error.message || 'Gagal menyimpan data.');
  } finally {
    form.querySelectorAll('button, input, select, textarea').forEach((node) => {
      node.disabled = false;
    });
  }
}
