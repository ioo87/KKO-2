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
   MENU → TRACKS
========================================================= */
const trackConvert = document.getElementById('trackConvert');
trackConvert.addEventListener('click', () => showScreen('screen-converter'));
trackConvert.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showScreen('screen-converter'); }
});

document.getElementById('backToMenuBtn').addEventListener('click', () => {
  resetApp();
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
