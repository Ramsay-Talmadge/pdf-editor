// Annotation modal — depends on globals from renderer.js:
//   currentPdfDoc, setStatus, annotationLayers

const ANNOTATE_SCALE = 1.5;

let annotateOriginalIndex = null;
let currentTool    = 'draw';
let isDrawing      = false;
let lastX = 0, lastY = 0;
let stampDataURL   = null;
let textClickReady = false;

const annotateModal        = document.getElementById('annotate-modal');
const annotatePageLabel    = document.getElementById('annotate-page-label');
const annotatePageCanvas   = document.getElementById('annotate-page-canvas');
const annotateOverlay      = document.getElementById('annotate-overlay-canvas');
const annotateColorInput   = document.getElementById('annotate-color');
const annotateSizeInput    = document.getElementById('annotate-size');
const annotateSubToolbar   = document.getElementById('annotate-sub-toolbar');
const stampControls        = document.getElementById('stamp-controls');
const textControls         = document.getElementById('text-controls');
const stampOverlayEl       = document.getElementById('stamp-overlay');
const stampImgEl           = document.getElementById('stamp-img');
const btnStampPlace        = document.getElementById('btn-stamp-place');
const annotateTextInput    = document.getElementById('annotate-text-input');
const annotateTextColor    = document.getElementById('annotate-text-color');
const annotateTextSize     = document.getElementById('annotate-text-size');
const annotateCanvasWrapper = document.getElementById('annotate-canvas-wrapper');

// ── Open modal ───────────────────────────────────────────────────────────────
window.openAnnotateModal = async function(wrapper) {
  annotateOriginalIndex = parseInt(wrapper.dataset.originalIndex);
  annotatePageLabel.textContent = `Page ${annotateOriginalIndex + 1}`;

  const rotation = parseInt(wrapper.dataset.rotation || '0');
  const page = await currentPdfDoc.getPage(annotateOriginalIndex + 1);
  const viewport = page.getViewport({ scale: ANNOTATE_SCALE, rotation });

  annotatePageCanvas.width  = viewport.width;
  annotatePageCanvas.height = viewport.height;
  annotateOverlay.width     = viewport.width;
  annotateOverlay.height    = viewport.height;

  await page.render({ canvasContext: annotatePageCanvas.getContext('2d'), viewport }).promise;

  const overlayCtx = annotateOverlay.getContext('2d');
  overlayCtx.clearRect(0, 0, viewport.width, viewport.height);
  if (annotationLayers[annotateOriginalIndex]) {
    await new Promise(resolve => {
      const img = new Image();
      img.onload = () => { overlayCtx.drawImage(img, 0, 0); resolve(); };
      img.src = annotationLayers[annotateOriginalIndex];
    });
  }

  setActiveTool('draw');
  annotateModal.classList.remove('hidden');
};

// ── Tool selection ────────────────────────────────────────────────────────────
function setActiveTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
  if (btn) btn.classList.add('active');

  annotateSubToolbar.classList.add('hidden');
  stampControls.classList.add('hidden');
  textControls.classList.add('hidden');
  stampOverlayEl.classList.add('hidden');
  textClickReady = false;
  annotateOverlay.style.cursor = tool === 'text' ? 'text' : 'crosshair';

  if (tool === 'stamp') {
    annotateSubToolbar.classList.remove('hidden');
    stampControls.classList.remove('hidden');
    initStamp();
  }
  if (tool === 'text') {
    annotateSubToolbar.classList.remove('hidden');
    textControls.classList.remove('hidden');
    textClickReady = true;
  }
}

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
});

// ── Stamp ─────────────────────────────────────────────────────────────────────
async function initStamp() {
  if (!stampDataURL) {
    stampDataURL = await window.electronAPI.loadSignature();
  }
  if (stampDataURL) {
    showStampOverlay();
    btnStampPlace.disabled = false;
  }
}

function showStampOverlay() {
  stampImgEl.src = stampDataURL;
  stampOverlayEl.classList.remove('hidden');
  stampOverlayEl.style.left   = '20px';
  stampOverlayEl.style.top    = '20px';
  stampOverlayEl.style.width  = '200px';
  stampOverlayEl.style.height = '120px';
}

let stampDragging = false, stampResizing = false;
let stampDragOffX = 0, stampDragOffY = 0;
let stampInitW = 0, stampInitH = 0, stampMouseStartX = 0, stampMouseStartY = 0;

stampOverlayEl.addEventListener('mousedown', e => {
  const wRect = annotateCanvasWrapper.getBoundingClientRect();
  if (e.target.classList.contains('stamp-handle')) {
    stampResizing = true;
    stampInitW = stampOverlayEl.offsetWidth;
    stampInitH = stampOverlayEl.offsetHeight;
    stampMouseStartX = e.clientX;
    stampMouseStartY = e.clientY;
  } else {
    stampDragging = true;
    stampDragOffX = (e.clientX - wRect.left) - stampOverlayEl.offsetLeft;
    stampDragOffY = (e.clientY - wRect.top)  - stampOverlayEl.offsetTop;
  }
  e.stopPropagation();
  e.preventDefault();
});

document.addEventListener('mousemove', e => {
  if (stampDragging) {
    const wRect = annotateCanvasWrapper.getBoundingClientRect();
    stampOverlayEl.style.left = (e.clientX - wRect.left - stampDragOffX) + 'px';
    stampOverlayEl.style.top  = (e.clientY - wRect.top  - stampDragOffY) + 'px';
  }
  if (stampResizing) {
    stampOverlayEl.style.width  = Math.max(40, stampInitW + (e.clientX - stampMouseStartX)) + 'px';
    stampOverlayEl.style.height = Math.max(20, stampInitH + (e.clientY - stampMouseStartY)) + 'px';
  }
});

document.addEventListener('mouseup', () => { stampDragging = false; stampResizing = false; });

document.getElementById('btn-stamp-pick').addEventListener('click', async () => {
  const result = await window.electronAPI.openImage();
  if (!result) return;
  stampDataURL = result.dataURL;
  await window.electronAPI.saveSignature(stampDataURL);
  showStampOverlay();
  btnStampPlace.disabled = false;
});

btnStampPlace.addEventListener('click', () => {
  if (!stampDataURL || stampOverlayEl.classList.contains('hidden')) return;
  const wRect = annotateCanvasWrapper.getBoundingClientRect();
  const sRect = stampOverlayEl.getBoundingClientRect();

  // offsetWidth can be 0 for absolutely-positioned canvases; fall back to attribute value
  const dispW = annotateOverlay.offsetWidth  || annotateOverlay.width;
  const dispH = annotateOverlay.offsetHeight || annotateOverlay.height;
  const scaleX = annotateOverlay.width  / dispW;
  const scaleY = annotateOverlay.height / dispH;
  const x = (sRect.left - wRect.left) * scaleX;
  const y = (sRect.top  - wRect.top)  * scaleY;
  const w = sRect.width  * scaleX;
  const h = sRect.height * scaleY;

  const img = new Image();
  img.onload = () => {
    annotateOverlay.getContext('2d').drawImage(img, x, y, w, h);
    stampOverlayEl.classList.add('hidden');
    setStatus('Stamp placed — place another or click Done.');
  };
  img.onerror = () => setStatus('Failed to load stamp image.', true);
  img.src = stampDataURL;
});

document.getElementById('btn-stamp-cancel').addEventListener('click', () => setActiveTool('draw'));

// ── Text ──────────────────────────────────────────────────────────────────────
document.getElementById('btn-text-cancel').addEventListener('click', () => setActiveTool('draw'));

// ── Drawing ───────────────────────────────────────────────────────────────────
function overlayPos(e) {
  const rect = annotateOverlay.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (annotateOverlay.width  / rect.width),
    y: (e.clientY - rect.top)  * (annotateOverlay.height / rect.height),
  };
}

annotateOverlay.addEventListener('mousedown', e => {
  if (currentTool === 'stamp') return;

  if (currentTool === 'text' && textClickReady) {
    const text = annotateTextInput.value.trim();
    if (!text) { setStatus('Type some text first.', true); return; }
    const pos = overlayPos(e);
    const ctx = annotateOverlay.getContext('2d');
    const size = parseInt(annotateTextSize.value);
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = `${size}px sans-serif`;
    ctx.fillStyle = document.getElementById('annotate-text-color').value;
    ctx.fillText(text, pos.x, pos.y + size);
    ctx.restore();
    return;
  }

  isDrawing = true;
  const pos = overlayPos(e);
  lastX = pos.x;
  lastY = pos.y;
  if (currentTool === 'highlight') {
    annotateOverlay.dataset.hlStartX = pos.x;
    annotateOverlay.dataset.hlStartY = pos.y;
  }
});

annotateOverlay.addEventListener('mousemove', e => {
  if (!isDrawing || currentTool !== 'draw') return;
  const pos = overlayPos(e);
  const ctx = annotateOverlay.getContext('2d');
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.strokeStyle = annotateColorInput.value;
  ctx.lineWidth   = parseInt(annotateSizeInput.value);
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.stroke();
  lastX = pos.x;
  lastY = pos.y;
});

annotateOverlay.addEventListener('mouseup', e => {
  if (!isDrawing) return;
  isDrawing = false;
  if (currentTool === 'highlight') {
    const pos = overlayPos(e);
    const sx = parseFloat(annotateOverlay.dataset.hlStartX);
    const sy = parseFloat(annotateOverlay.dataset.hlStartY);
    const ctx = annotateOverlay.getContext('2d');
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(sx, sy, pos.x - sx, pos.y - sy);
    ctx.restore();
  }
});

annotateOverlay.addEventListener('mouseleave', () => { isDrawing = false; });

// ── Clear & Done ──────────────────────────────────────────────────────────────
document.getElementById('btn-annotate-clear').addEventListener('click', () => {
  annotateOverlay.getContext('2d').clearRect(0, 0, annotateOverlay.width, annotateOverlay.height);
});

document.getElementById('btn-annotate-done').addEventListener('click', () => {
  const pixels = annotateOverlay.getContext('2d')
    .getImageData(0, 0, annotateOverlay.width, annotateOverlay.height).data;
  let hasContent = false;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 0) { hasContent = true; break; }
  }

  if (hasContent) {
    annotationLayers[annotateOriginalIndex] = annotateOverlay.toDataURL('image/png');
  } else {
    delete annotationLayers[annotateOriginalIndex];
  }

  annotateModal.classList.add('hidden');
  setStatus(hasContent ? 'Annotation saved — click Export to bake into PDF.' : '');
});
