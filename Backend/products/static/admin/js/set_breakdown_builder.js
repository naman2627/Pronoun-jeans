(function () {
  'use strict';

  // ── Master size order ─────────────────────────────────────────────────────
  const ALL_SIZES = [
    'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL',
    '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46',
  ];

  function getMembersBetween(fromSize, toSize) {
    const fromIdx = ALL_SIZES.indexOf(fromSize);
    const toIdx   = ALL_SIZES.indexOf(toSize);
    if (fromIdx === -1 || toIdx === -1 || fromIdx > toIdx) return [];
    return ALL_SIZES.slice(fromIdx, toIdx + 1);
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

  function buildBreakdownString(rowEl) {
    const parts = [];
    rowEl.querySelectorAll('.sb-pill').forEach(function (pill) {
      const qty  = parseInt(pill.querySelector('.sb-qty').value, 10);
      const size = pill.dataset.size;
      if (qty > 0) parts.push(qty + 'x' + size);
    });
    return parts.join(', ');
  }

  // ── Check if we are on the SizeSet page ───────────────────────────────────
  function isSizeSetPage() {
    return window.location.href.includes('/products/sizeset/');
  }

  // ── Get current From/To selections ───────────────────────────────────────
  function getFromTo() {
    const fromSel = document.getElementById('sb-from-select');
    const toSel   = document.getElementById('sb-to-select');
    return {
      from: fromSel ? fromSel.value : '',
      to:   toSel   ? toSel.value   : '',
    };
  }

  function getCurrentMembers() {
    const { from, to } = getFromTo();
    return getMembersBetween(from, to);
  }

  // ── Update the read-only Name field ──────────────────────────────────────
  function updateNameField() {
    const nameInput = document.getElementById('id_name');
    const { from, to } = getFromTo();
    if (!nameInput) return;
    nameInput.value = (from && to) ? (from + ' TO ' + to) : '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BREAKDOWN ROW BUILDER
  // Each row = one SizeSetBreakdown instance
  // Renders pill qty selects + syncs to hidden Django inline inputs
  // ═══════════════════════════════════════════════════════════════════════════

  // Read existing breakdown rows from the hidden Django inline
  // Returns array of { id, label, breakdown_string, deleted }
  function readExistingRows() {
    const rows = [];
    const totalForms = document.querySelector('input[name="sizesetbreakdown_set-TOTAL_FORMS"]');
    if (!totalForms) return rows;
    const total = parseInt(totalForms.value, 10);
    for (let i = 0; i < total; i++) {
      const idInput  = document.querySelector('input[name="sizesetbreakdown_set-' + i + '-id"]');
      const labelEl  = document.querySelector('input[name="sizesetbreakdown_set-' + i + '-label"]');
      const strEl    = document.querySelector('input[name="sizesetbreakdown_set-' + i + '-breakdown_string"]');
      const deleteEl = document.querySelector('input[name="sizesetbreakdown_set-' + i + '-DELETE"]');
      if (!strEl) continue;
      rows.push({
        index:            i,
        id:               idInput ? idInput.value : '',
        label:            labelEl ? labelEl.value : '',
        breakdown_string: strEl.value,
        deleted:          deleteEl ? deleteEl.checked : false,
      });
    }
    return rows;
  }

  // Build one pill for a size with a qty select
  function makePill(size, qty) {
    const pill = document.createElement('span');
    pill.className    = 'sb-pill';
    pill.dataset.size = size;
    pill.style.cssText = [
      'display:inline-flex', 'align-items:center', 'gap:3px',
      'background:#f3f4f6', 'border:1px solid #d1d5db',
      'border-radius:6px', 'padding:2px 7px', 'font-size:12px',
    ].join(';');

    const lbl = document.createElement('span');
    lbl.textContent   = size + ':';
    lbl.style.cssText = 'font-weight:600;color:#374151;white-space:nowrap;';

    const sel = document.createElement('select');
    sel.className = 'sb-qty';
    sel.style.cssText = 'border:none;background:transparent;font-size:12px;font-weight:700;color:#111827;cursor:pointer;padding:0 2px;outline:none;';
    for (let i = 0; i <= 5; i++) {
      const opt       = document.createElement('option');
      opt.value       = i;
      opt.textContent = i;
      if (i === qty) opt.selected = true;
      sel.appendChild(opt);
    }

    pill.appendChild(lbl);
    pill.appendChild(sel);
    return pill;
  }

  // Build one visible breakdown row in the custom UI
  function makeCustomRow(members, existingBreakdown, rowIndex, container) {
    const existing_qtys = parseBreakdown(existingBreakdown || '');

    const row = document.createElement('div');
    row.className = 'sb-custom-row';
    row.dataset.rowIndex = rowIndex;
    row.style.cssText = [
      'display:flex', 'align-items:center', 'gap:10px',
      'padding:8px 10px', 'background:#fff',
      'border:1px solid #e5e7eb', 'border-radius:8px', 'margin-bottom:6px',
    ].join(';');

    // Pills wrapper
    const pillsWrap = document.createElement('div');
    pillsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;flex:1;';

    members.forEach(function (size) {
      const qty  = existing_qtys[size] !== undefined ? existing_qtys[size] : 1;
      const pill = makePill(size, qty);
      pill.querySelector('.sb-qty').addEventListener('change', function () {
        syncRowToHidden(row, rowIndex);
      });
      pillsWrap.appendChild(pill);
    });

    // Preview label
    const preview = document.createElement('span');
    preview.className = 'sb-preview';
    preview.style.cssText = 'font-size:11px;color:#6b7280;min-width:120px;';

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.type          = 'button';
    removeBtn.textContent   = '✕ Remove';
    removeBtn.style.cssText = 'font-size:11px;color:#ef4444;background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:4px;';
    removeBtn.addEventListener('click', function () {
      markRowDeleted(rowIndex);
      row.remove();
      updatePreviewAll(container);
    });

    row.appendChild(pillsWrap);
    row.appendChild(preview);
    row.appendChild(removeBtn);

    // Initial sync
    syncRowToHidden(row, rowIndex);

    return row;
  }

  // Sync one custom row's pill values back into the hidden Django inline inputs
  function syncRowToHidden(rowEl, rowIndex) {
    const breakdown = buildBreakdownString(rowEl);
    const preview   = rowEl.querySelector('.sb-preview');
    if (preview) preview.textContent = breakdown;

    // Write to hidden inputs
    const labelEl = document.querySelector('input[name="sizesetbreakdown_set-' + rowIndex + '-label"]');
    const strEl   = document.querySelector('input[name="sizesetbreakdown_set-' + rowIndex + '-breakdown_string"]');
    if (labelEl) labelEl.value = breakdown;
    if (strEl)   strEl.value   = breakdown;
  }

  // Mark a row as deleted in the Django inline management form
  function markRowDeleted(rowIndex) {
    const deleteEl = document.querySelector('input[name="sizesetbreakdown_set-' + rowIndex + '-DELETE"]');
    if (deleteEl) {
      deleteEl.checked = true;
    } else {
      // For new (unsaved) rows, just reduce TOTAL_FORMS
      const totalEl = document.querySelector('input[name="sizesetbreakdown_set-TOTAL_FORMS"]');
      if (totalEl) {
        const current = parseInt(totalEl.value, 10);
        if (current > 0) totalEl.value = current - 1;
      }
    }
  }

  function updatePreviewAll(container) {
    container.querySelectorAll('.sb-custom-row').forEach(function (row, i) {
      syncRowToHidden(row, parseInt(row.dataset.rowIndex, 10));
    });
  }

  // Add a brand new breakdown row (new Django inline form row)
  function addNewRow(members, container) {
    const totalEl = document.querySelector('input[name="sizesetbreakdown_set-TOTAL_FORMS"]');
    if (!totalEl) return;

    const newIndex = parseInt(totalEl.value, 10);
    totalEl.value  = newIndex + 1;

    // Create hidden inputs for this new row
    const prefix   = 'sizesetbreakdown_set-' + newIndex;
    const sizeSetId = document.querySelector('input[name="sizesetbreakdown_set-' + (newIndex - 1) + '-size_set"]')
      ? document.querySelector('input[name="sizesetbreakdown_set-' + (newIndex - 1) + '-size_set"]').value
      : '';

    const hiddenArea = document.getElementById('sb-hidden-inputs');
    if (hiddenArea) {
      ['id', 'size_set', 'label', 'breakdown_string'].forEach(function (field) {
        const inp  = document.createElement('input');
        inp.type   = 'hidden';
        inp.name   = prefix + '-' + field;
        inp.value  = field === 'size_set' ? sizeSetId : '';
        hiddenArea.appendChild(inp);
      });
      const delInp  = document.createElement('input');
      delInp.type   = 'hidden';
      delInp.name   = prefix + '-DELETE';
      delInp.value  = '';
      hiddenArea.appendChild(delInp);
    }

    const row = makeCustomRow(members, '', newIndex, container);
    container.appendChild(row);
    syncRowToHidden(row, newIndex);
  }

  // ── Build the entire custom breakdown section ─────────────────────────────
  function buildCustomBreakdownSection(members) {
    const existing = document.getElementById('sb-breakdown-section');
    if (existing) existing.remove();

    const section = document.createElement('div');
    section.id = 'sb-breakdown-section';
    section.style.cssText = 'margin-top:24px;';

    // Section header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;';

    const title = document.createElement('h3');
    title.textContent   = 'Size Set Breakdowns';
    title.style.cssText = 'font-size:14px;font-weight:700;color:#374151;margin:0;';

    const addBtn = document.createElement('button');
    addBtn.type          = 'button';
    addBtn.textContent   = '+ Add Breakdown';
    addBtn.style.cssText = [
      'font-size:12px', 'font-weight:600', 'color:#fff',
      'background:#2563eb', 'border:none', 'border-radius:6px',
      'padding:5px 12px', 'cursor:pointer',
    ].join(';');

    header.appendChild(title);
    header.appendChild(addBtn);
    section.appendChild(header);

    // Rows container
    const rowsContainer = document.createElement('div');
    rowsContainer.id = 'sb-rows-container';
    section.appendChild(rowsContainer);

    if (members.length === 0) {
      const msg = document.createElement('p');
      msg.textContent   = 'Select From and To sizes above to start adding breakdowns.';
      msg.style.cssText = 'font-size:12px;color:#9ca3af;font-style:italic;';
      rowsContainer.appendChild(msg);
    } else {
      // Render existing rows
      const existingRows = readExistingRows();
      existingRows.forEach(function (r) {
        if (r.deleted) return;
        const row = makeCustomRow(members, r.breakdown_string, r.index, rowsContainer);
        rowsContainer.appendChild(row);
      });

      addBtn.addEventListener('click', function () {
        addNewRow(members, rowsContainer);
      });
    }

    // Hidden inputs area for new rows
    let hiddenArea = document.getElementById('sb-hidden-inputs');
    if (!hiddenArea) {
      hiddenArea    = document.createElement('div');
      hiddenArea.id = 'sb-hidden-inputs';
      hiddenArea.style.display = 'none';
      section.appendChild(hiddenArea);
    }

    return section;
  }

  function rebuildBreakdownSection() {
    const members = getCurrentMembers();
    const anchor  = document.getElementById('sb-breakdown-anchor');
    if (!anchor) return;
    const section = buildCustomBreakdownSection(members);
    anchor.innerHTML = '';
    anchor.appendChild(section);
  }

  // ── Inject From/To dropdowns and breakdown anchor ────────────────────────
  function injectFromToDropdowns() {
    const nameInput = document.getElementById('id_name');
    if (!nameInput || document.getElementById('sb-from-select')) return;

    // Make name read-only
    nameInput.readOnly = true;
    nameInput.style.background  = '#f9fafb';
    nameInput.style.color       = '#6b7280';
    nameInput.style.cursor      = 'not-allowed';

    // Parse existing name
    const existingName = nameInput.value.trim();
    let existingFrom = '', existingTo = '';
    const match = existingName.match(/^(.+)\s+TO\s+(.+)$/i);
    if (match) {
      existingFrom = match[1].trim();
      existingTo   = match[2].trim();
    }

    function makeSelect(id, preselect) {
      const sel = document.createElement('select');
      sel.id    = id;
      sel.style.cssText = [
        'border:1px solid #d1d5db', 'border-radius:6px',
        'padding:5px 10px', 'font-size:13px',
        'background:#fff', 'cursor:pointer', 'min-width:90px',
      ].join(';');
      const blank       = document.createElement('option');
      blank.value       = '';
      blank.textContent = '— select —';
      sel.appendChild(blank);
      ALL_SIZES.forEach(function (size) {
        const opt       = document.createElement('option');
        opt.value       = size;
        opt.textContent = size;
        if (size === preselect) opt.selected = true;
        sel.appendChild(opt);
      });
      return sel;
    }

    function makeLabel(text) {
      const lbl = document.createElement('span');
      lbl.textContent   = text;
      lbl.style.cssText = 'font-weight:600;font-size:13px;color:#374151;';
      return lbl;
    }

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-bottom:8px;';

    const fromSel = makeSelect('sb-from-select', existingFrom);
    const toSel   = makeSelect('sb-to-select',   existingTo);

    fromSel.addEventListener('change', function () {
      updateNameField();
      rebuildBreakdownSection();
    });
    toSel.addEventListener('change', function () {
      updateNameField();
      rebuildBreakdownSection();
    });

    wrapper.appendChild(makeLabel('From:'));
    wrapper.appendChild(fromSel);
    wrapper.appendChild(makeLabel('To:'));
    wrapper.appendChild(toSel);

    nameInput.parentNode.insertBefore(wrapper, nameInput);

    // Inject the breakdown anchor div after the whole fieldset
    // Find the fieldset or form-row that wraps the name field and insert after it
    const fieldset = nameInput.closest('.card, fieldset, .module');
    if (fieldset) {
      const anchor    = document.createElement('div');
      anchor.id       = 'sb-breakdown-anchor';
      anchor.style.cssText = 'margin-top:16px;padding:0 16px 16px;';
      fieldset.appendChild(anchor);
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function initSizeSetPage() {
    injectFromToDropdowns();
    // Initial build if editing existing SizeSet with a name already set
    rebuildBreakdownSection();
  }

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