(function () {
  'use strict';

  const PREFIX = 'gallery_images';

  function init() {
    const addRowLink = document.querySelector('.add-row a.addlink');
    if (!addRowLink) return;

    // Hidden multi-file picker
    const picker = document.createElement('input');
    picker.type     = 'file';
    picker.multiple = true;
    picker.accept   = 'image/*';
    picker.style.display = 'none';
    document.body.appendChild(picker);

    // "Add multiple images" button
    const multiBtn = document.createElement('a');
    multiBtn.role      = 'button';
    multiBtn.className = addRowLink.className;
    multiBtn.href      = '#';
    multiBtn.textContent = 'Add multiple images';
    multiBtn.style.marginRight = '8px';

    multiBtn.addEventListener('click', (e) => {
      e.preventDefault();
      picker.value = '';
      picker.click();
    });

    picker.addEventListener('change', () => {
      const files = Array.from(picker.files);
      if (!files.length) return;

      files.forEach((file) => {
        // Trigger Django's built-in "add row" to create a fresh inline form
        addRowLink.click();

        // Grab the last real file input in this formset (exclude the __prefix__ template)
        const allInputs = document.querySelectorAll(
          `input[name^="${PREFIX}-"][name$="-image"][type="file"]:not([name*="__prefix__"])`
        );
        const lastInput = allInputs[allInputs.length - 1];

        if (lastInput) {
          const dt = new DataTransfer();
          dt.items.add(file);
          lastInput.files = dt.files;
        }
      });
    });

    // Insert before the existing "Add another" button
    addRowLink.parentNode.insertBefore(multiBtn, addRowLink);
  }

  window.addEventListener('load', init);
})();
