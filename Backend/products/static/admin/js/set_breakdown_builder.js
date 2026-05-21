(function () {
  'use strict';

  // ── Master size order ─────────────────────────────────────────────────────
  // This is the single source of truth for size ordering.
  // From/To dropdowns are built from this list.
  const ALL_SIZES = [
    'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL',
    '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46',
  ];

  // ── Derive members between two sizes (inclusive) ──────────────────────────
  function getMembersBetween(fromSize, toSize) {
    const fromIdx = ALL_SIZES.indexOf(fromSize);
    const toIdx   = ALL_SIZES.indexOf(toSize);
    if (fromIdx === -1 || toIdx === -1 || fromIdx > toIdx) return [];
    return ALL_SIZES.slice(fromIdx, toIdx + 1);
  }

  // ── Build breakdown string from builder element ───────────────────────────
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

  // ── Render quantity picker pills into a hidden input ──────────────────────
  function renderBuilderIntoInput(inputEl, members) {
    if (!inputEl) return;
    const existing = inputEl.parentNode.querySelector('.sb-builder');
    if (existing) existing.remove();
    if (!members || members.length === 0) {
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
      item.className    = 'sb-item';
      item.dataset.size = size;
      item.style.cssText = 'display:inline-flex;align-items:center;gap:3px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;padding:2px 6px;font-size:12px;';
      const lbl = document.createElement('span');
      lbl.textContent  = size + ':';
      lbl.style.cssText = 'font-weight:600;color:#374151;white-space:nowrap;';
      const qtySelect = document.createElement('select');
      qtySelect.className = 'sb-qty';
      qtySelect.style.cssText = 'border:none;background:transparent;font-size:12px;font-weight:700;color:#111827;cursor:pointer;padding:0 2px;outline:none;';
      for (let i = 0; i <= 5; i++) {
        const opt      = document.createElement('option');
        opt.value      = i;
        opt.textContent = i;
        if (i === (existing_qtys[size] !== undefined ? existing_qtys[size] : 1)) opt.selected = true;
        qtySelect.appendChild(opt);
      }
      qtySelect.addEventListener('change', function () { syncToInput(builder, inputEl); });
      item.appendChild(lbl);
      item.appendChild(qtySelect);
      builder.appendChild(item);
    });
    inputEl.parentNode.insertBefore(builder, inputEl.nextSibling);
    syncToInput(builder, inputEl);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE 2: SizeSet edit/add page
  // Injects From/To dropdowns, makes Name read-only, renders breakdown builder
  // ═══════════════════════════════════════════════════════════════════════════

  function isSizeSetPage() {
    return !!(document.querySelector('#id_name') &&
              window.location.href.includes('/products/sizeset/'));
  }

  function getCurrentMembers() {
    const fromSel = document.getElementById('sb-from-select');
    const toSel   = document.getElementById('sb-to-select');
    if (!fromSel || !toSel) return [];
    return getMembersBetween(fromSel.value, toSel.value);
  }

  function updateNameField() {
    const nameInput = document.getElementById('id_name');
    const fromSel   = document.getElementById('sb-from-select');
    const toSel     = document.getElementById('sb-to-select');
    if (!nameInput || !fromSel || !toSel) return;
    const from = fromSel.value;
    const to   = toSel.value;
    if (from && to) {
      nameInput.value = from + ' TO ' + to;
    } else {
      nameInput.value = '';
    }
  }

  function refreshAllBreakdownBuilders() {
    const members = getCurrentMembers();
    // Reset attached flags so builders re-render with updated members
    document.querySelectorAll('input[id*="breakdown_string"], input[name*="breakdown_string"]')
      .forEach(function (el) {
        delete el.dataset.sbAttached;
        renderBuilderIntoInput(el, members);
        el.dataset.sbAttached = '1';
      });
  }

  function injectFromToDropdowns() {
    const nameInput = document.getElementById('id_name');
    if (!nameInput || document.getElementById('sb-from-select')) return;

    // Make the name field read-only and styled as such
    nameInput.readOnly = true;
    nameInput.style.cssText += 'background:#f9fafb;color:#6b7280;cursor:not-allowed;';

    // Parse existing name to pre-select From/To if editing
    const existingName = nameInput.value.trim();
    let existingFrom = '', existingTo = '';
    const match = existingName.match(/^(.+)\s+TO\s+(.+)$/i);
    if (match) {
      existingFrom = match[1].trim();
      existingTo   = match[2].trim();
    }

    // Build the wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-bottom:8px;';

    const fromLabel = document.createElement('span');
    fromLabel.textContent  = 'From:';
    fromLabel.style.cssText = 'font-weight:600;font-size:13px;color:#374151;';

    const fromSel = document.createElement('select');
    fromSel.id = 'sb-from-select';
    fromSel.style.cssText = 'border:1px solid #d1d5db;border-radius:6px;padding:4px 8px;font-size:13px;background:#fff;';

    const toLabel = document.createElement('span');
    toLabel.textContent  = 'To:';
    toLabel.style.cssText = 'font-weight:600;font-size:13px;color:#374151;margin-left:8px;';

    const toSel = document.createElement('select');
    toSel.id = 'sb-to-select';
    toSel.style.cssText = 'border:1px solid #d1d5db;border-radius:6px;padding:4px 8px;font-size:13px;background:#fff;';

    // Populate both selects with ALL_SIZES
    [fromSel, toSel].forEach(function (sel) {
      const blank = document.createElement('option');
      blank.value       = '';
      blank.textContent = '— select —';
      sel.appendChild(blank);
      ALL_SIZES.forEach(function (size) {
        const opt      = document.createElement('option');
        opt.value      = size;
        opt.textContent = size;
        sel.appendChild(opt);
      });
    });

    // Pre-select if editing an existing SizeSet
    if (existingFrom) fromSel.value = existingFrom;
    if (existingTo)   toSel.value   = existingTo;

    // Wire up change handlers
    fromSel.addEventListener('change', function () {
      updateNameField();
      refreshAllBreakdownBuilders();
    });
    toSel.addEventListener('change', function () {
      updateNameField();
      refreshAllBreakdownBuilders();
    });

    wrapper.appendChild(fromLabel);
    wrapper.appendChild(fromSel);
    wrapper.appendChild(toLabel);
    wrapper.appendChild(toSel);

    // Insert above the name input
    nameInput.parentNode.insertBefore(wrapper, nameInput);
  }

  function initSizeSetPage() {
    injectFromToDropdowns();
    // Initial render of any existing breakdown rows
    refreshAllBreakdownBuilders();

    // Watch for new breakdown rows added via "Add another"
    const target = document.querySelector('#content');
    if (!target) return;
    const observer = new MutationObserver(function () {
      refreshAllBreakdownBuilders();
    });
    observer.observe(target, { childList: true, subtree: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE 1: ProductVariation inline on Product page
  // Size set dropdown → filters breakdown dropdown (handled by Django form)
  // No JS builder needed here — breakdown is chosen from existing options
  // ═══════════════════════════════════════════════════════════════════════════

  function isSizeSetPage_NOT() {
    return !!(document.querySelector('#id_name') &&
              window.location.href.includes('/products/sizeset/'));
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function init() {
    if (isSizeSetPage()) {
      initSizeSetPage();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();