import { escapeHtml, formatCurrency, formatNumber } from '../core/utils.js';

export function kpiCard(label, value, meta = '') {
  return `
    <article class="kpi-card">
      <small>${escapeHtml(label)}</small>
      <strong>${typeof value === 'number' ? formatCurrency(value) : escapeHtml(value)}</strong>
      ${meta ? `<span>${escapeHtml(meta)}</span>` : ''}
    </article>
  `;
}

export function emptyState(title, body) {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

export function productQtyFields(products, prefix = 'qty') {
  if (!products?.length) {
    return emptyState('Belum ada produk', 'Tambahkan produk dari dashboard owner terlebih dahulu.');
  }

  return `
    <div class="product-grid">
      ${products.map((product) => `
        <label class="field compact">
          <span>${escapeHtml(product.name)}</span>
          <small>
            Harga ${formatCurrency(product.resolved_price ?? product.general_sale_price)}
            ${product.can_view_cost ? ` - HPP ${formatCurrency(product.hpp)}` : ''}
          </small>
          <input inputmode="decimal" name="${prefix}_${product.id}" type="number" min="0" step="0.01" placeholder="0" />
        </label>
      `).join('')}
    </div>
  `;
}

export function productTableRows(items, valueKey = 'qty') {
  return (items || []).map((item) => `
    <tr>
      <td>${escapeHtml(item.products?.name || item.product_name || '-')}</td>
      <td class="right">${formatNumber(item[valueKey] ?? 0)}</td>
    </tr>
  `).join('');
}
