const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = '../node_modules/pdfjs-dist/build/pdf.worker.js';

const btnOpen       = document.getElementById('btn-open');
const btnMerge      = document.getElementById('btn-merge');
const btnSplit      = document.getElementById('btn-split');
const btnCompress   = document.getElementById('btn-compress');
const btnWatermark  = document.getElementById('btn-watermark');
const btnExport     = document.getElementById('btn-export');
const watermarkPanel = document.getElementById('watermark-panel');
const wmText        = document.getElementById('wm-text');
const wmSize        = document.getElementById('wm-size');
const wmOpacity     = document.getElementById('wm-opacity');
const wmOpacityVal  = document.getElementById('wm-opacity-val');
const wmPosition    = document.getElementById('wm-position');
const wmPageNums    = document.getElementById('wm-pagenums');
const splitPanel    = document.getElementById('split-panel');
const splitRangeInput = document.getElementById('split-range');
const btnSplitGo    = document.getElementById('btn-split-go');
const btnSplitCancel = document.getElementById('btn-split-cancel');
const fileNameEl    = document.getElementById('file-name');
const pageCountEl   = document.getElementById('page-count');
const statusEl      = document.getElementById('status');
const container     = document.getElementById('page-container');

const THUMBNAIL_SCALE = 0.3;
let currentPdfBytes = null;
let currentPageCount = 0;
let currentPdfDoc = null;
let dragSrcEl = null;
const annotationLayers = {}; // originalPageIndex -> PNG dataURL

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? '#e06c6c' : '#8bc34a';
}

function updatePageLabels() {
  container.querySelectorAll('.page-label').forEach((el, i) => {
    el.textContent = i + 1;
  });
  const count = container.querySelectorAll('.page-wrapper').length;
  pageCountEl.textContent = `— ${count} page${count !== 1 ? 's' : ''}`;
}

function makeDraggable(wrapper) {
  wrapper.draggable = true;

  wrapper.addEventListener('dragstart', e => {
    dragSrcEl = wrapper;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => wrapper.classList.add('dragging'), 0);
  });

  wrapper.addEventListener('dragend', () => {
    wrapper.classList.remove('dragging');
    container.querySelectorAll('.page-wrapper').forEach(w => w.classList.remove('drag-over'));
    dragSrcEl = null;
  });

  wrapper.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (wrapper !== dragSrcEl) {
      container.querySelectorAll('.page-wrapper').forEach(w => w.classList.remove('drag-over'));
      wrapper.classList.add('drag-over');
    }
  });

  wrapper.addEventListener('dragleave', () => {
    wrapper.classList.remove('drag-over');
  });

  wrapper.addEventListener('drop', e => {
    e.preventDefault();
    wrapper.classList.remove('drag-over');
    if (!dragSrcEl || dragSrcEl === wrapper) return;

    const wrappers = [...container.querySelectorAll('.page-wrapper')];
    const srcIdx = wrappers.indexOf(dragSrcEl);
    const tgtIdx = wrappers.indexOf(wrapper);

    if (srcIdx < tgtIdx) {
      container.insertBefore(dragSrcEl, wrapper.nextSibling);
    } else {
      container.insertBefore(dragSrcEl, wrapper);
    }
    updatePageLabels();
  });
}

function addPageControls(wrapper) {
  const del = document.createElement('button');
  del.className = 'btn-delete-page';
  del.textContent = '×';
  del.title = 'Delete page';
  del.addEventListener('click', () => {
    wrapper.remove();
    updatePageLabels();
    setStatus('Page deleted — click Export to save.');
  });

  const rot = document.createElement('button');
  rot.className = 'btn-rotate-page';
  rot.textContent = '↻';
  rot.title = 'Rotate 90° clockwise';
  rot.addEventListener('click', async () => {
    const current = parseInt(wrapper.dataset.rotation || '0');
    const next = (current + 90) % 360;
    wrapper.dataset.rotation = next;

    const pageNum = parseInt(wrapper.dataset.originalIndex) + 1;
    const page = await currentPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: THUMBNAIL_SCALE, rotation: next });
    const canvas = wrapper.querySelector('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    setStatus('Rotated — click Export to save.');
  });

  const ann = document.createElement('button');
  ann.className = 'btn-annotate-page';
  ann.textContent = '✏';
  ann.title = 'Annotate page';
  ann.addEventListener('click', e => {
    e.stopPropagation();
    window.openAnnotateModal(wrapper);
  });

  wrapper.appendChild(ann);
  wrapper.appendChild(rot);
  wrapper.appendChild(del);
}

async function renderPages(pdfBytes) {
  container.innerHTML = '';
  const typedArray = new Uint8Array(pdfBytes.slice(0)); // clone so pdf.js doesn't neuter currentPdfBytes
  currentPdfDoc = await pdfjsLib.getDocument({ data: typedArray }).promise;
  currentPageCount = currentPdfDoc.numPages;
  pageCountEl.textContent = `— ${currentPdfDoc.numPages} page${currentPdfDoc.numPages !== 1 ? 's' : ''}`;

  for (let pageNum = 1; pageNum <= currentPdfDoc.numPages; pageNum++) {
    const page = await currentPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });

    const wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';
    wrapper.dataset.originalIndex = pageNum - 1;
    wrapper.dataset.rotation = '0';

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    const label = document.createElement('div');
    label.className = 'page-label';
    label.textContent = pageNum;

    wrapper.appendChild(canvas);
    wrapper.appendChild(label);
    addPageControls(wrapper);
    makeDraggable(wrapper);
    container.appendChild(wrapper);
  }
}

// ── Open PDF ────────────────────────────────────────────────────────────────
btnOpen.addEventListener('click', async () => {
  const result = await window.electronAPI.openPDF();
  if (!result) return;

  const { filePath, data } = result;
  currentPdfBytes = data.slice(0);
  fileNameEl.textContent = filePath.split(/[\\/]/).pop();
  splitPanel.classList.add('hidden');
  setStatus('');

  await renderPages(currentPdfBytes);

  btnSplit.disabled = false;
  btnCompress.disabled = false;
  btnWatermark.disabled = false;
  btnExport.disabled = false;
});

// ── Merge ────────────────────────────────────────────────────────────────────
btnMerge.addEventListener('click', async () => {
  const files = await window.electronAPI.openMultiplePDFs();
  if (!files || files.length < 2) {
    if (files && files.length < 2) setStatus('Select at least 2 PDFs to merge.', true);
    return;
  }

  setStatus(`Merging ${files.length} files…`);
  const { PDFDocument } = PDFLib;
  const merged = await PDFDocument.create();

  for (const { data } of files) {
    const doc = await PDFDocument.load(data);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }

  const bytes = await merged.save();
  const savePath = await window.electronAPI.savePDF('merged.pdf');
  if (!savePath) { setStatus(''); return; }

  await window.electronAPI.writeFile(savePath, bytes);
  setStatus(`Saved: ${savePath.split(/[\\/]/).pop()}`);
});

// ── Split / Extract ──────────────────────────────────────────────────────────
function parsePageRange(input, total) {
  const indices = new Set();
  for (const part of input.split(',')) {
    const trimmed = part.trim();
    const range = trimmed.match(/^(\d+)-(\d+)$/);
    if (range) {
      const from = parseInt(range[1]), to = parseInt(range[2]);
      for (let i = from; i <= to; i++) {
        if (i >= 1 && i <= total) indices.add(i - 1);
      }
    } else {
      const n = parseInt(trimmed);
      if (!isNaN(n) && n >= 1 && n <= total) indices.add(n - 1);
    }
  }
  return [...indices].sort((a, b) => a - b);
}

btnSplit.addEventListener('click', () => {
  splitPanel.classList.remove('hidden');
  splitRangeInput.value = '';
  splitRangeInput.focus();
});

btnSplitCancel.addEventListener('click', () => {
  splitPanel.classList.add('hidden');
  setStatus('');
});

btnSplitGo.addEventListener('click', async () => {
  const indices = parsePageRange(splitRangeInput.value, currentPageCount);
  if (indices.length === 0) { setStatus('No valid pages in that range.', true); return; }

  setStatus(`Extracting ${indices.length} page(s)…`);
  const { PDFDocument } = PDFLib;
  const src = await PDFDocument.load(currentPdfBytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  copied.forEach(p => out.addPage(p));

  const bytes = await out.save();
  const savePath = await window.electronAPI.savePDF('extracted.pdf');
  if (!savePath) { setStatus(''); return; }

  await window.electronAPI.writeFile(savePath, bytes);
  splitPanel.classList.add('hidden');
  setStatus(`Saved: ${savePath.split(/[\\/]/).pop()}`);
});

// ── Compress ─────────────────────────────────────────────────────────────────
btnCompress.addEventListener('click', async () => {
  setStatus('Compressing…');
  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.load(currentPdfBytes, { updateMetadata: false });
  const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });

  const before = currentPdfBytes.byteLength;
  const after  = bytes.byteLength;
  const pct    = Math.round((1 - after / before) * 100);

  const savePath = await window.electronAPI.savePDF('compressed.pdf');
  if (!savePath) { setStatus(''); return; }

  await window.electronAPI.writeFile(savePath, bytes);
  const saved = pct > 0 ? `${pct}% smaller` : 'already well-compressed';
  setStatus(`Saved: ${savePath.split(/[\\/]/).pop()} (${saved})`);
});

// ── Watermark / Page numbers ──────────────────────────────────────────────────
wmOpacity.addEventListener('input', () => { wmOpacityVal.textContent = wmOpacity.value + '%'; });

btnWatermark.addEventListener('click', () => {
  watermarkPanel.classList.toggle('hidden');
});

document.getElementById('btn-wm-cancel').addEventListener('click', () => {
  watermarkPanel.classList.add('hidden');
});

document.getElementById('btn-wm-apply').addEventListener('click', async () => {
  const text      = wmText.value.trim();
  const addNums   = wmPageNums.checked;
  if (!text && !addNums) { setStatus('Enter watermark text or enable page numbers.', true); return; }

  setStatus('Applying watermark…');

  const { PDFDocument, rgb, StandardFonts, degrees } = PDFLib;
  const src  = await PDFDocument.load(currentPdfBytes);
  const font = await src.embedFont(StandardFonts.HelveticaBold);
  const opacity = parseInt(wmOpacity.value) / 100;
  const fontSize = parseInt(wmSize.value);
  const position = wmPosition.value;

  const pages = src.getPages();
  pages.forEach((page, i) => {
    const { width, height } = page.getSize();

    if (text) {
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      let x, y, rotate;

      if (position === 'center') {
        x = width  / 2 - textWidth / 2;
        y = height / 2;
        rotate = degrees(45);
      } else if (position === 'bottom') {
        x = width  / 2 - textWidth / 2;
        y = 40;
        rotate = degrees(0);
      } else {
        x = width  / 2 - textWidth / 2;
        y = height - 40 - fontSize;
        rotate = degrees(0);
      }

      page.drawText(text, {
        x, y, size: fontSize,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity,
        rotate,
      });
    }

    if (addNums) {
      const numStr = `${i + 1}`;
      const numWidth = font.widthOfTextAtSize(numStr, 12);
      page.drawText(numStr, {
        x: width / 2 - numWidth / 2,
        y: 20,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3),
        opacity: 0.8,
      });
    }
  });

  const bytes = await src.save();
  const savePath = await window.electronAPI.savePDF('watermarked.pdf');
  if (!savePath) { setStatus(''); return; }

  await window.electronAPI.writeFile(savePath, bytes);
  watermarkPanel.classList.add('hidden');
  setStatus(`Saved: ${savePath.split(/[\\/]/).pop()}`);
});

// ── Export (reordered / deleted / rotated pages) ─────────────────────────────
btnExport.addEventListener('click', async () => {
  const wrappers = [...container.querySelectorAll('.page-wrapper')];
  if (wrappers.length === 0) { setStatus('No pages to export.', true); return; }

  const indices   = wrappers.map(w => parseInt(w.dataset.originalIndex));
  const rotations = wrappers.map(w => parseInt(w.dataset.rotation || '0'));
  setStatus('Building PDF…');

  const { PDFDocument, degrees } = PDFLib;
  const src = await PDFDocument.load(currentPdfBytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);

  for (let i = 0; i < copied.length; i++) {
    const p = copied[i];
    if (rotations[i] !== 0) {
      p.setRotation(degrees((p.getRotation().angle + rotations[i]) % 360));
    }
    out.addPage(p);

    const annotDataURL = annotationLayers[indices[i]];
    if (annotDataURL) {
      const b64 = annotDataURL.split(',')[1];
      const pngBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const annotImg = await out.embedPng(pngBytes);
      p.drawImage(annotImg, { x: 0, y: 0, width: p.getWidth(), height: p.getHeight() });
    }
  }

  const bytes = await out.save();
  const savePath = await window.electronAPI.savePDF('output.pdf');
  if (!savePath) { setStatus(''); return; }

  await window.electronAPI.writeFile(savePath, bytes);
  setStatus(`Saved: ${savePath.split(/[\\/]/).pop()}`);
});
