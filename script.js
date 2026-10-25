
const TARGET = 1000;
const STORAGE_KEY = "dhikr_rain_count_v1";

const $ = id => document.getElementById(id);

let count = 0;
let audioContext = null;
let masterGain = null;
let rainSource = null;
let audioEnabled = false;
let noiseBuffer = null;
let lastTap = 0;

try {
  count = Math.max(0, Math.min(
    TARGET,
    Number(localStorage.getItem(STORAGE_KEY)) || 0
  ));
} catch (_) {
  count = 0;
}

const circumference = 2 * Math.PI * 98;
$("progress").style.strokeDasharray = circumference;

function updateUI() {
  $("count").textContent = count;
  $("remaining").textContent = TARGET - count;

  $("progress").style.strokeDashoffset =
    circumference * (1 - count / TARGET);

  if (count >= TARGET) {
    $("main").classList.add("hidden");
    $("finish").classList.remove("hidden");
  } else {
    $("main").classList.remove("hidden");
    $("finish").classList.add("hidden");
  }

  try {
    localStorage.setItem(STORAGE_KEY, String(count));
  } catch (_) {}
}

function increment() {
  const now = performance.now();

  // منع التسجيل المكرر الناتج عن اللمسات السريعة جدًا
  if (now - lastTap < 100 || count >= TARGET) return;
  lastTap = now;

  count++;
  updateUI();

  if (audioEnabled && count % 25 === 0 &&
      navigator.vibrate) {
    navigator.vibrate(10);
  }

  if (count === TARGET && audioEnabled &&
      navigator.vibrate) {
    navigator.vibrate([30, 60, 30]);
  }
}

$("tap").addEventListener("click", increment);

function reset() {
  count = 0;
  lastTap = 0;
  updateUI();
}

$("reset").addEventListener("click", reset);
$("again").addEventListener("click", reset);

// المطر المرئي: نرسم القطرات على Canvas
const canvas = $("rain");
const ctx = canvas.getContext("2d");
let drops = [];
let width = 0;
let height = 0;
let previousFrame = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const amount = Math.min(95, Math.floor(width / 4));

  drops = Array.from({ length: amount }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    speed: 250 + Math.random() * 450,
    length: 9 + Math.random() * 17,
    opacity: .12 + Math.random() * .35
  }));
}

function drawRain(time) {
  requestAnimationFrame(drawRain);

  const dt = previousFrame
    ? Math.min((time - previousFrame) / 1000, .04)
    : 0;

  previousFrame = time;
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 1;

  for (const drop of drops) {
    drop.y += drop.speed * dt;
    drop.x -= 30 * dt;

    if (drop.y > height + 30 || drop.x < -20) {
      drop.y = -drop.length;
      drop.x = Math.random() * (width + 30);
    }

    ctx.strokeStyle = `rgba(155,220,255,${drop.opacity})`;
    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x - 3, drop.y + drop.length);
    ctx.stroke();
  }
}

window.addEventListener("resize", resize);
resize();
requestAnimationFrame(drawRain);

// صوت مطر إلكتروني دون أي ملف أو إنترنت
async function startRainSound() {
  const AudioAPI = window.AudioContext || window.webkitAudioContext;

  if (!AudioAPI) {
    $("status").textContent =
      "متصفحك لا يدعم توليد الصوت. يمكنك استخدام المطر المرئي.";
    return;
  }

  if (!audioContext) {
    audioContext = new AudioAPI();

    // ضوضاء عشوائية متكررة مع انتقال ناعم
    const bufferLength = audioContext.sampleRate * 4;
    noiseBuffer = audioContext.createBuffer(
      1, bufferLength, audioContext.sampleRate
    );

    const data = noiseBuffer.getChannelData(0);
    let previous = 0;

    for (let i = 0; i < bufferLength; i++) {
      const white = Math.random() * 2 - 1;
      previous = previous * .92 + white * .08;
      data[i] = previous * .8 + white * .2;
    }

    const filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 950;
    filter.Q.value = .6;

    const highpass = audioContext.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 100;

    masterGain = audioContext.createGain();
    masterGain.gain.value = 0;

    rainSource = audioContext.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;

    rainSource.connect(filter);
    filter.connect(highpass);
    highpass.connect(masterGain);
    masterGain.connect(audioContext.destination);

    rainSource.start();
  }

  await audioContext.resume();

  masterGain.gain.cancelScheduledValues(audioContext.currentTime);
  masterGain.gain.setTargetAtTime(
    .13, audioContext.currentTime, .8
  );

  audioEnabled = true;
  $("sound").textContent = "🔇 إيقاف صوت المطر";
  $("status").textContent =
    "المطر يعمل 🌧️ يمكنك الاستغفار بهدوء";
}

async function stopRainSound() {
  if (audioContext && masterGain) {
    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
    masterGain.gain.setTargetAtTime(
      0, audioContext.currentTime, .15
    );
  }

  audioEnabled = false;
  $("sound").textContent = "🌧️ تشغيل المطر";
  $("status").textContent = "خذ وقتك، واذكر الله بقلب حاضر 🤍";
}

$("sound").addEventListener("click", async () => {
  try {
    if (audioEnabled) {
      await stopRainSound();
    } else {
      await startRainSound();
    }
  } catch (error) {
    $("status").textContent =
      "تعذّر تشغيل الصوت. جرّب الضغط على الزر مرة أخرى.";
  }
});

updateUI();
