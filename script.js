/* =========================================================
   SCREEN NAVIGATION
========================================================= */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

/* =========================================================
   SIGN IN
   ---------------------------------------------------------
   This runs entirely on the device — no external requests,
   no server. That's what makes it work instantly on any
   phone, any network, even fully offline. See README.md for
   how to wire up real Google accounts once this is hosted on
   your own domain.
========================================================= */
let currentUser = null;

document.getElementById('googleLoginBtn').addEventListener('click', () => {
  const btn = document.getElementById('googleLoginBtn');
  const loading = document.getElementById('authLoading');
  btn.style.display = 'none';
  loading.style.display = 'flex';

  setTimeout(() => {
    currentUser = { name: 'ผู้ใช้' };
    loading.style.display = 'none';
    btn.style.display = 'flex';
    enterApp();
  }, 900);
});

function enterApp() {
  if (!currentUser) return;
  document.getElementById('menuUserName').textContent = currentUser.name;
  document.getElementById('menuAvatar').textContent = currentUser.name.trim().charAt(0).toUpperCase();
  showScreen('screen-menu');
}

document.getElementById('signOutBtn').addEventListener('click', () => {
  currentUser = null;
  showScreen('screen-login');
});

/* =========================================================
   MENU → TRACKS → WORKSPACE (tab bar)
========================================================= */
function openWorkspace(tab) {
  showScreen('screen-workspace');
  setActiveTab(tab);
}

function setActiveTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === 'panel-' + tab);
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
});

const trackMp3 = document.getElementById('trackMp3');
trackMp3.addEventListener('click', () => openWorkspace('mp3'));
trackMp3.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWorkspace('mp3'); }
});

const trackPdf = document.getElementById('trackPdf');
trackPdf.addEventListener('click', () => openWorkspace('pdf'));
trackPdf.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWorkspace('pdf'); }
});

document.getElementById('backToMenuBtn').addEventListener('click', () => {
  resetApp();
  resetPdfApp();
  showScreen('screen-menu');
});

/* =========================================================
   MP4 → MP3 CONVERTER
   (decodes the MP4's audio track and re-packages it as a
   playable audio file.
   Note: this produces WAV-encoded audio saved with an .mp3
   name/extension, not a true MPEG-encoded MP3 — real MP3
   encoding needs an encoder library, e.g. lamejs, which can
   be added later if you want byte-accurate MP3 output.)
========================================================= */
const mp4file = document.getElementById('mp4file');
const coverart = document.getElementById('coverart');
const videoPreviewBox = document.getElementById('videoPreviewBox');
const videoPlayer = document.getElementById('videoPlayer');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const coverBtnLabel = document.getElementById('coverBtnLabel');

const uploadSection = document.getElementById('uploadSection');
const loadingSection = document.getElementById('loadingSection');
const resultSection = document.getElementById('resultSection');
const convertBtn = document.getElementById('convertBtn');
const audioPlayer = document.getElementById('audioPlayer');
const downloadBtn = document.getElementById('downloadBtn');
const shareBtn = document.getElementById('shareBtn');

let currentVideoUrl = "";
let currentAudioUrl = "";
let audioBlobResult = null;

// One shared AudioContext, reused across conversions. Creating a fresh
// AudioContext every click and never closing it can exhaust the browser's
// audio-context limit on lower-end phones after just a few conversions.
let sharedAudioCtx = null;
function getAudioContext() {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return sharedAudioCtx;
}

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB hard cap — beyond this a low-spec
                                           // phone (4GB RAM) is very likely to run out
                                           // of memory decoding the whole file in one go

mp4file.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  // Same reasoning as the cover-art input: accept="video/mp4" is a UI hint
  // only, so we check the real reported type before touching the file.
  if (!file.type.startsWith('video/')) {
    alert("ไฟล์นี้ไม่ใช่วิดีโอนะเพื่อน ลองเลือกไฟล์ MP4 ใหม่");
    mp4file.value = "";
    return;
  }
  if (file.size > MAX_VIDEO_SIZE) {
    alert("ไฟล์ใหญ่เกินไป (จำกัดไม่เกิน 500MB) เครื่องสเปคต่ำอาจค้างหรือแฮงก์ได้");
    mp4file.value = "";
    return;
  }

  currentVideoUrl = URL.createObjectURL(file);
  videoPlayer.src = currentVideoUrl;
  fileNameDisplay.textContent = "ไฟล์: " + file.name;
  videoPreviewBox.style.display = 'block';
});

const MAX_COVER_SIZE = 10 * 1024 * 1024; // 10MB — plenty for a cover image

coverart.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  // Defense-in-depth: the accept="image/*" attribute on the input is only a
  // UI hint — anyone can switch the file picker to "all files" or drag-drop
  // something else in. Never trust the browser's file picker filter alone.
  if (!file.type.startsWith('image/')) {
    alert("ไฟล์นี้ไม่ใช่รูปภาพนะเพื่อน ลองเลือกไฟล์ใหม่");
    coverart.value = "";
    return;
  }
  if (file.size > MAX_COVER_SIZE) {
    alert("รูปปกใหญ่เกินไป (จำกัดไม่เกิน 10MB)");
    coverart.value = "";
    return;
  }

  // textContent, not innerHTML — file.name comes from the user's filesystem
  // and can contain arbitrary characters, so it must never be inserted as HTML.
  coverBtnLabel.textContent = `✅ เลือกรูปปกแล้ว: ${file.name.substring(0, 15)}...`;
  coverBtnLabel.style.color = "var(--accent-soft)";
  coverBtnLabel.style.borderColor = "var(--accent)";
});

function audioBufferToWavBlob(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;

  let result;
  if (numOfChan === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }

  const dataLength = result.length * (bitDepth / 8);
  const bufferLen = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLen);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
  view.setUint16(32, numOfChan * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < result.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, result[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([arrayBuffer], { type: 'audio/mp3' });
}

function interleave(inputL, inputR) {
  let length = inputL.length + inputR.length;
  let result = new Float32Array(length);
  let index = 0, inputIndex = 0;
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

convertBtn.addEventListener('click', async function () {
  const file = mp4file.files[0];
  if (!file) {
    alert("เพื่อน! อย่าลืมเลือกไฟล์ MP4 ก่อนนะ");
    return;
  }

  const isLargeFile = file.size > 200 * 1024 * 1024; // ~200MB
  if (isLargeFile && !confirm("ไฟล์นี้มีขนาดใหญ่ อาจใช้เวลานานหรือค้างได้บนเครื่องสเปคต่ำ ต้องการแปลงต่อไหม?")) {
    return;
  }

  uploadSection.style.display = 'none';
  loadingSection.style.display = 'block';

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = getAudioContext();
    const decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);

    audioBlobResult = audioBufferToWavBlob(decodedAudio);
    currentAudioUrl = URL.createObjectURL(audioBlobResult);

    setTimeout(() => {
      loadingSection.style.display = 'none';
      resultSection.style.display = 'block';
      audioPlayer.src = currentAudioUrl;
    }, 800);

  } catch (err) {
    console.error(err);
    loadingSection.style.display = 'none';
    uploadSection.style.display = 'block';
    alert("เกิดข้อผิดพลาดในการแยกเสียง ลองเลือกไฟล์อื่นดูนะเพื่อน");
  }
});

function sanitizeFileName(name) {
  // Strip characters that are invalid or risky in filenames across
  // Windows/macOS/Linux, collapse whitespace, and cap the length.
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .trim()
    .slice(0, 80);
}

downloadBtn.addEventListener('click', function () {
  if (!audioBlobResult) return;
  const a = document.createElement('a');
  a.href = currentAudioUrl;

  let finalFileName = 'song.mp3';
  const titleInput = sanitizeFileName(document.getElementById('songtitle').value);
  if (titleInput !== '') {
    finalFileName = titleInput + '.mp3';
  }

  a.download = finalFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

shareBtn.addEventListener('click', async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'ฟังเพลงนี้สิ!',
        text: 'ฉันเพิ่งแปลงไฟล์เสียงนี้ผ่าน KKO.com',
        url: window.location.href
      });
    } catch (err) {
      console.log('ยกเลิกการแชร์');
    }
  } else {
    alert('เบราว์เซอร์ของคุณไม่รองรับการแชร์');
  }
});

document.getElementById('reconvertLink').addEventListener('click', resetApp);

function resetApp() {
  resultSection.style.display = 'none';
  uploadSection.style.display = 'block';
  videoPreviewBox.style.display = 'none';
  mp4file.value = "";
  coverart.value = "";
  coverBtnLabel.textContent = `🖼️ แตะเพื่อเลือกรูปปก`;
  coverBtnLabel.style.color = "var(--text-muted)";
  coverBtnLabel.style.borderColor = "var(--border-soft)";
  audioBlobResult = null;
}

/* =========================================================
   IMG → PDF CONVERTER
   Multiple images in, one PDF out — each image gets its own
   A4 page, auto-scaled and centered so nothing is stretched
   or cut off. Uses jsPDF (loaded from cdnjs in index.html).
========================================================= */
const imgfiles = document.getElementById('imgfiles');
const thumbGrid = document.getElementById('thumbGrid');
const imgCountEl = document.getElementById('imgCount');

const pdfUploadSection = document.getElementById('pdfUploadSection');
const pdfLoadingSection = document.getElementById('pdfLoadingSection');
const pdfResultSection = document.getElementById('pdfResultSection');
const convertPdfBtn = document.getElementById('convertPdfBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const previewPdfBtn = document.getElementById('previewPdfBtn');
const sharePdfBtn = document.getElementById('sharePdfBtn');
const pdfPageSummary = document.getElementById('pdfPageSummary');

const MAX_IMAGES = 40;                    // a sensible ceiling per PDF — each image
                                           // gets decoded + redrawn onto a canvas in
                                           // memory, which adds up fast on a 4GB phone
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;  // 25MB per photo

let selectedImages = []; // [{ file, thumbUrl }]
let pdfBlobResult = null;
let pdfBlobUrl = "";

imgfiles.addEventListener('change', function (e) {
  const files = Array.from(e.target.files || []);
  imgfiles.value = ""; // clear so picking the exact same file(s) again still fires 'change'

  for (const file of files) {
    // Same defense-in-depth as the other file inputs: never trust accept=""
    // alone, always verify the real reported type before touching the file.
    if (!file.type.startsWith('image/')) {
      alert(`ข้าม "${file.name}" เพราะไม่ใช่ไฟล์รูปภาพ`);
      continue;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      alert(`ข้าม "${file.name}" เพราะไฟล์ใหญ่เกิน 25MB`);
      continue;
    }
    if (selectedImages.length >= MAX_IMAGES) {
      alert(`เลือกได้สูงสุด ${MAX_IMAGES} รูปต่อ PDF หนึ่งไฟล์`);
      break;
    }
    selectedImages.push({ file, thumbUrl: URL.createObjectURL(file) });
  }
  renderThumbs();
});

function renderThumbs() {
  // Every node below is built with createElement/textContent/src — never
  // string-concatenated HTML — so a crafted filename can't inject markup.
  thumbGrid.innerHTML = '';
  selectedImages.forEach((item, index) => {
    const cell = document.createElement('div');
    cell.className = 'thumb-item';

    const img = document.createElement('img');
    img.src = item.thumbUrl;
    img.alt = '';
    cell.appendChild(img);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'thumb-remove';
    removeBtn.setAttribute('aria-label', 'ลบรูปนี้');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeImage(index));
    cell.appendChild(removeBtn);

    thumbGrid.appendChild(cell);
  });
  imgCountEl.textContent = String(selectedImages.length);
}

function removeImage(index) {
  URL.revokeObjectURL(selectedImages[index].thumbUrl);
  selectedImages.splice(index, 1);
  renderThumbs();
}

function loadImageAsCanvasData(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      // Flatten onto a white background first — a transparent PNG would
      // otherwise print as solid black on the PDF page.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      URL.revokeObjectURL(url);
      resolve({ dataUrl, width: canvas.width, height: canvas.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('โหลดรูปไม่สำเร็จ: ' + file.name));
    };
    img.src = url;
  });
}

convertPdfBtn.addEventListener('click', async function () {
  if (selectedImages.length === 0) {
    alert("เพื่อน! อย่าลืมเลือกรูปก่อนนะ");
    return;
  }
  if (typeof window.jspdf === 'undefined') {
    alert("โหลดตัวสร้าง PDF ไม่สำเร็จ ตรวจสอบการเชื่อมต่อเน็ตแล้วลองใหม่นะ");
    return;
  }

  pdfUploadSection.style.display = 'none';
  pdfLoadingSection.style.display = 'block';

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // A4 in mm, with a small margin so images never touch the edge of the page.
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    for (let i = 0; i < selectedImages.length; i++) {
      const { dataUrl, width, height } = await loadImageAsCanvasData(selectedImages[i].file);

      // "Contain" fit: scale to the largest size that fits the page without
      // distorting the aspect ratio, then center it.
      const imgRatio = width / height;
      const boxRatio = maxWidth / maxHeight;
      let renderWidth, renderHeight;
      if (imgRatio > boxRatio) {
        renderWidth = maxWidth;
        renderHeight = maxWidth / imgRatio;
      } else {
        renderHeight = maxHeight;
        renderWidth = maxHeight * imgRatio;
      }
      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;

      if (i > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(dataUrl, 'JPEG', x, y, renderWidth, renderHeight);
    }

    pdfBlobResult = pdf.output('blob');
    pdfBlobUrl = URL.createObjectURL(pdfBlobResult);

    pdfLoadingSection.style.display = 'none';
    pdfResultSection.style.display = 'block';
    pdfPageSummary.textContent = `รวม ${selectedImages.length} หน้า`;

  } catch (err) {
    console.error(err);
    pdfLoadingSection.style.display = 'none';
    pdfUploadSection.style.display = 'block';
    alert("เกิดข้อผิดพลาดตอนสร้าง PDF ลองใหม่อีกครั้งนะเพื่อน");
  }
});

downloadPdfBtn.addEventListener('click', function () {
  if (!pdfBlobResult) return;
  const a = document.createElement('a');
  a.href = pdfBlobUrl;

  let finalFileName = 'document.pdf';
  const titleInput = sanitizeFileName(document.getElementById('pdftitle').value);
  if (titleInput !== '') {
    finalFileName = titleInput + '.pdf';
  }

  a.download = finalFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

previewPdfBtn.addEventListener('click', () => {
  if (!pdfBlobUrl) return;
  window.open(pdfBlobUrl, '_blank', 'noopener,noreferrer');
});

sharePdfBtn.addEventListener('click', async () => {
  if (!pdfBlobResult) return;

  const titleInput = sanitizeFileName(document.getElementById('pdftitle').value);
  const shareFileName = (titleInput !== '' ? titleInput : 'document') + '.pdf';
  const fileToShare = new File([pdfBlobResult], shareFileName, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
    try {
      await navigator.share({ files: [fileToShare], title: 'เอกสาร PDF' });
    } catch (err) {
      console.log('ยกเลิกการแชร์');
    }
  } else if (navigator.share) {
    try {
      await navigator.share({
        title: 'เอกสาร PDF',
        text: 'ฉันเพิ่งสร้างไฟล์ PDF ผ่าน KKO.com',
        url: window.location.href
      });
    } catch (err) {
      console.log('ยกเลิกการแชร์');
    }
  } else {
    alert('เบราว์เซอร์ของคุณไม่รองรับการแชร์ ลองดาวน์โหลดแล้วส่งไฟล์แทนนะ');
  }
});

document.getElementById('reconvertPdfLink').addEventListener('click', resetPdfApp);

function resetPdfApp() {
  pdfResultSection.style.display = 'none';
  pdfUploadSection.style.display = 'block';
  selectedImages.forEach(item => URL.revokeObjectURL(item.thumbUrl));
  selectedImages = [];
  renderThumbs();
  imgfiles.value = "";
  document.getElementById('pdftitle').value = '';
  pdfBlobResult = null;
  if (pdfBlobUrl) {
    URL.revokeObjectURL(pdfBlobUrl);
    pdfBlobUrl = "";
  }
}
