(function () {
  'use strict';

  const SET_MAP = {
    'S TO XXL':   ['S', 'M', 'L', 'XL', 'XXL'],
    'L TO 2XL':   ['L', 'XL', 'XXL'],
    'L TO 3XL':   ['L', 'XL', 'XXL', '3XL'],
    'L TO 4XL':   ['L', 'XL', 'XXL', '3XL', '4XL'],
    'L TO 5XL':   ['L', 'XL', 'XXL', '3XL', '4XL', '5XL'],
    'M TO 3XL':   ['M', 'L', 'XL', 'XXL', '3XL'],
    'M TO 4XL':   ['M', 'L', 'XL', 'XXL', '3XL', '4XL'],
    '4XL TO 5XL': ['4XL', '5XL'],
    '28 TO 34':   ['28', '30', '32', '34'],
    '28 TO 36':   ['28', '30', '32', '34', '36'],
    '30 TO 36':   ['30', '32', '34', '36'],
    '30 TO 38':   ['30', '32', '34', '36', '38'],
    '32 TO 38':   ['32', '34', '36', '38'],
  };

  function buildBreakdownString(builderEl) {
    const parts = [];
    builderEl.querySelectorAll('.sb-item').forEach(function (item) {
      const qty  = parseInt(item.querySelector('.sb-qty').value, 10);
      const size = item.dataset.size;
      if (qty > 0) parts.push(qty + 'x' + size);
    });
    return parts.join(', ');
  }

  function syncToInput(builderEl, inputEl) {
    inputEl.value = buildBreakdownString(builderEl);
  }

  function parseBreakdown(str) {
    const map = {};
    if (!str) return map;
    str.split(',').forEach(function (part) {
      const m = part.trim().match(/^(\d+)x(.+)$/);
      if (m) map[m[2].trim()] = parseInt(m[1], 10);
    });
    return map;
  }

  function renderBuilder(sizeSelect) {
    const row = sizeSelect.closest('tr, .dynamic-productvariation_set, fieldset');
    if (!row) return;
    const inputEl = row.querySelector('input[id*="set_breakdown"], input[name*="set_breakdown"]');
    if (!inputEl) return;
    const sizeVal = sizeSelect.value;
    const members = SET_MAP[sizeVal];
    const existing = row.querySelector('.sb-builder');
    if (existing) existing.remove();
    if (!members) {
      inputEl.style.display = '';
      return;
    }
    inputEl.style.display = 'none';
    const existing_qtys = parseBreakdown(inputEl.value);
    const builder = document.createElement('div');
    builder.className = 'sb-builder';
    builder.style.cssText = 'display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;padding:4px 0;';
    members.forEach(function (size) {
      const item = document.createElement('span');
      item.className = 'sb-item';
      item.dataset.size = size;
      item.style.cssText = 'display:inline-flex;align-items:center;gap:3px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;padding:2px 6px;font-size:12px;';
      const label = document.createElement('span');
      label.textContent = size + ':';
      label.style.cssText = 'font-weight:600;color:#374151;white-space:nowrap;';
      const qtySelect = document.createElement('select');
      qtySelect.className = 'sb-qty';
      qtySelect.style.cssText = 'border:none;background:transparent;font-size:12px;font-weight:700;color:#111827;cursor:pointer;padding:0 2px;outline:none;';
      for (let i = 0; i <= 5; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        if (i === (existing_qtys[size] ?? 1)) opt.selected = true;
        qtySelect.appendChild(opt);
      }
      qtySelect.addEventListener('change', function () { syncToInput(builder, inputEl); });
      item.appendChild(label);
      item.appendChild(qtySelect);
      builder.appendChild(item);
    });
    inputEl.parentNode.insertBefore(builder, inputEl.nextSibling);
    syncToInput(builder, inputEl);
  }

  function attachToSelect(sel) {
    if (sel.dataset.sbAttached) return;
    sel.dataset.sbAttached = '1';
    sel.addEventListener('change', function () { renderBuilder(sel); });
    renderBuilder(sel);
  }

  function attachAll() {
    document.querySelectorAll(
      'select[id*="size"][id*="productvariation"], select[name*="size"][name*="productvariation"],' +
      'tr select[id$="-size"], tr select[name$="-size"]'
    ).forEach(attachToSelect);
  }

  function observeInline() {
    const target = document.querySelector('#productvariation_set-group, .inline-group, #content');
    if (!target) return;
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          const selects = node.querySelectorAll ? node.querySelectorAll('select[id*="size"], select[name*="size"]') : [];
          selects.forEach(attachToSelect);
          if (node.matches && node.matches('select[id*="size"], select[name*="size"]')) attachToSelect(node);
        });
      });
    });
    observer.observe(target, { childList: true, subtree: true });
  }

  function init() { attachAll(); observeInline(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
