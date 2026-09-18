/* 公共版游戏核心：只包含游戏、设置与固化内容。 */
let animalCatalog = Array.isArray(window.ANIMAL_CATALOG) ? [...window.ANIMAL_CATALOG] : [];

const WAIT_SECONDS_DEFAULT = 15;
const COVER_SECONDS_DEFAULT = 1;
const ANIMAL_COUNT_DEFAULT = 5;
const SUCCESS_BACKGROUND_PLACEHOLDER = "assets/success-bg-placeholder.svg";

const elements = {
  animals: document.querySelector("#animals"),
  bus: document.querySelector("#bus"),
  status: document.querySelector("#status-text"),
  repeat: document.querySelector("#repeat-btn"),
  next: document.querySelector("#next-btn"),
  music: document.querySelector("#music-btn"),
  refresh: document.querySelector("#refresh-btn"),
  settings: document.querySelector("#settings-btn"),
  settingsDialog: document.querySelector("#settings-dialog"),
  settingsForm: document.querySelector("#settings-form"),
  countInput: document.querySelector("#count-input"),
  coverInput: document.querySelector("#cover-input"),
  waitInput: document.querySelector("#wait-input"),
  closeSettings: document.querySelector("#close-settings-dialog"),
  answer: document.querySelector("#answer-banner"),
  successOverlay: document.querySelector("#success-overlay"),
  successScene: document.querySelector("#success-scene"),
  successAnimalImage: document.querySelector("#success-animal-image"),
  successAnimalName: document.querySelector("#success-animal-name"),
  successNext: document.querySelector("#success-next-btn"),
  successNextArrow: document.querySelector("#success-next-arrow"),
  musicLabel: document.querySelector("#music-label"),
  busImage: document.querySelector("#bus-image"),
  stage: document.querySelector("#stage"),
};

let currentRound = [];
let previousRoundIds = [];
let boardedAnimal = null;
let coverSeconds = COVER_SECONDS_DEFAULT;
let waitSeconds = WAIT_SECONDS_DEFAULT;
let animalCount = ANIMAL_COUNT_DEFAULT;
let state = "waiting";
let timers = [];
let musicOn = false;
let audioContext = null;
let musicTimer = null;
let musicStep = 0;

const TEXT_DEFAULTS = {
  eyebrow: "视觉追踪训练小游戏",
  titleLead: "谁上",
  titleTail: "车了？",
  instruction: "记住站台上的小动物，看看哪一只坐上了公交车。",
  refresh: "刷新",
  repeat: "再看一遍",
  next: "答对了 →",
  musicOn: "开",
  musicOff: "关",
  busLabel: "快乐巴士",
  signLabel: "BUS",
  statusWaiting: "小动物正在等公交车… ",
  statusArriving: "公交车来了，请记住小动物！",
  statusCovered: "公交正在停靠… ",
  statusLeaving: "公交车开走了，想一想：谁上车了？",
  statusAnswer: "看看谁上车了，点击「下一关」继续。",
  answerTemplate: "上车的是：{name}！",
  successArrow: "→",
  successAction: "下一关",
};

const TEXT_FIELDS = [
  { key: "titleLead", label: "标题 · 前段", selector: "#title-lead", group: "标题与说明", max: 8 },
  { key: "titleTail", label: "标题 · 后段", selector: "#title-tail", group: "标题与说明", max: 8 },
  { key: "eyebrow", label: "顶部小标题", selector: "#eyebrow-text", group: "标题与说明", max: 20 },
  { key: "instruction", label: "说明文字", selector: "#instruction-text", group: "标题与说明", max: 48 },
  { key: "refresh", label: "「刷新」按钮", selector: "#refresh-label", group: "按钮文字", max: 10 },
  { key: "repeat", label: "「再看一遍」按钮", selector: "#repeat-label", group: "按钮文字", max: 10 },
  { key: "next", label: "「答对了」按钮", selector: "#next-label", group: "按钮文字", max: 12 },
  { key: "musicOn", label: "音乐：开", selector: "", group: "按钮文字", max: 6 },
  { key: "musicOff", label: "音乐：关", selector: "", group: "按钮文字", max: 6 },
  { key: "busLabel", label: "车头文字", selector: "#bus-label", group: "场景文字", max: 10 },
  { key: "signLabel", label: "站牌文字", selector: "#sign-label", group: "场景文字", max: 10 },
  { key: "statusWaiting", label: "等待提示", selector: "", group: "状态提示", max: 40 },
  { key: "statusArriving", label: "公交到站提示", selector: "", group: "状态提示", max: 40 },
  { key: "statusCovered", label: "停靠提示", selector: "", group: "状态提示", max: 40 },
  { key: "statusLeaving", label: "开走提示", selector: "", group: "状态提示", max: 40 },
  { key: "statusAnswer", label: "揭晓提示", selector: "", group: "状态提示", max: 40 },
  { key: "answerTemplate", label: "答案横幅（{name} 会换成动物名）", selector: "", group: "状态提示", max: 40 },
  { key: "successArrow", label: "「下一关」箭头 / 后置文字", selector: "#success-next-arrow", group: "祝贺弹层", max: 6 },
  { key: "successAction", label: "「下一关」按钮", selector: "#success-next-label", group: "祝贺弹层", max: 10 }
];

let baseCatalog = Array.isArray(window.ANIMAL_CATALOG) ? window.ANIMAL_CATALOG.map(animal => ({ ...animal })) : [];
let customAnimals = [];
let customBackground = "";
let backgroundFit = "width";
let successBackground = "";
let customBus = null;
let busWidth = 100;
let animalSpread = 100;
let texts = { ...TEXT_DEFAULTS };

function schedule(fn, delay) { const id = window.setTimeout(fn, delay); timers.push(id); return id; }
function clearTimeline() { timers.forEach(clearTimeout); timers = []; }
function shuffle(items) { return [...items].sort(() => Math.random() - .5); }
function chooseAnimals(excludedIds = previousRoundIds) {
  const source = excludedIds.length ? animalCatalog.filter(animal => !excludedIds.includes(animal.id)) : animalCatalog;
  return shuffle(source).slice(0, animalCount);
}
function pickBoardedAnimal() {
  if (currentRound.length) boardedAnimal = currentRound[Math.floor(Math.random() * currentRound.length)];
}
/* 小动物站位：spread 100% = 铺满站台（默认），越小越向中间靠拢，越容易被公交车挡住 */
function buildSpots(count) {
  const spots = [];
  const spread = Math.max(.3, Math.min(1, animalSpread / 100));
  const baseWidth = Math.max(8, Math.min(18, 92 / count));
  const step = 100 / count;
  for (let i = 0; i < count; i++) {
    const center = 50 + ((i + .5) * step - 50) * spread;
    const width = Math.max(6, Math.min(baseWidth, step * spread));
    spots.push({ left: center - width / 2, top: 42, width });
  }
  return spots;
}
/* 拖动「小动物左右间距」时直接刷新现有小动物位置，不打断游戏流程 */
function applyAnimalSpots() {
  if (elements.animalSpread) elements.animalSpread.value = String(animalSpread);
  if (elements.animalSpreadValue) elements.animalSpreadValue.textContent = `${animalSpread}%`;
  if (!elements.animals) return;
  const items = Array.from(elements.animals.children);
  if (!items.length) return;
  const spots = buildSpots(items.length);
  items.forEach((item, index) => {
    const spot = spots[index];
    if (!spot) return;
    item.style.left = `${spot.left}%`;
    item.style.top = `${spot.top}%`;
    item.style.width = `${spot.width}%`;
  });
}
function renderAnimals() {
  elements.animals.innerHTML = "";
  const stage = elements.animals.parentElement;
  if (stage) stage.dataset.count = String(currentRound.length);
  const spots = buildSpots(currentRound.length);
  currentRound.forEach((animal, index) => {
    const spot = spots[index];
    const item = document.createElement("div");
    item.className = "animal";
    item.dataset.animal = animal.id;
    item.style.left = `${spot.left}%`;
    item.style.top = `${spot.top}%`;
    item.style.width = `${spot.width}%`;
    const image = document.createElement("img");
    image.src = animalImageSrc(animal);
    image.alt = animal.name;
    image.addEventListener("error", () => {
      if (animal.fallback && image.getAttribute("src") !== animal.fallback) {
        image.src = animal.fallback;
      }
    }, { once: true });
    item.append(image, Object.assign(document.createElement("span"), { className: "name-tag", textContent: animal.name }));
    elements.animals.append(item);
  });
}
function updateStatus(text) { elements.status.textContent = text; }
/* 保留自定义公交车标记，避免回合重置时被清掉 */
function busBaseClass() {
  return customBus && customBus.src ? "bus has-custom-image" : "bus";
}
function resetBus() {
  elements.bus.className = busBaseClass();
  if (elements.stage) elements.stage.classList.remove("bus-covering");
}
function startCountdown(seconds, onDone, label) {
  let remaining = seconds;
  const tick = () => {
    updateStatus(`${label}${remaining} 秒`);
    if (remaining <= 0) return onDone();
    remaining -= 1;
    schedule(tick, 1000);
  };
  tick();
}
function startWaiting() {
  clearTimeline();
  state = "waiting";
  elements.next.disabled = true;
  elements.answer.classList.remove("show");
  hideSuccessOverlay();
  renderAnimals();
  resetBus();
  startCountdown(waitSeconds, driveIn, texts.statusWaiting);
}
function driveIn() {
  state = "arriving";
  updateStatus(texts.statusArriving);
  elements.bus.classList.add("in");
  schedule(() => {
    state = "covered";
    if (elements.stage) elements.stage.classList.add("bus-covering");
    hideBoardedAnimal();
    startCountdown(coverSeconds, driveAway, texts.statusCovered);
  }, 1050);
}
function hideBoardedAnimal() {
  if (!boardedAnimal || !currentRound.includes(boardedAnimal)) pickBoardedAnimal();
  if (!boardedAnimal) return;
  const target = elements.animals.querySelector(`[data-animal="${boardedAnimal.id}"]`);
  if (target) target.classList.add("missing");
}
function driveAway() {
  state = "leaving";
  hideBoardedAnimal();
  if (elements.stage) elements.stage.classList.remove("bus-covering");
  updateStatus(texts.statusLeaving);
  elements.bus.classList.remove("in");
  elements.bus.classList.add("out");
  schedule(() => {
    state = "finished";
    elements.next.disabled = false;
    elements.bus.className = busBaseClass();
  }, 1050);
}
function startRound(isNewRound = false) {
  if (isNewRound) {
    previousRoundIds = currentRound.map(animal => animal.id);
    currentRound = chooseAnimals();
    pickBoardedAnimal();
  }
  if (!currentRound.length) {
    currentRound = chooseAnimals();
    pickBoardedAnimal();
  }
  startWaiting();
}
function repeatRound() { startRound(false); }
function refreshRound() {
  const excludedIds = currentRound.map(animal => animal.id);
  currentRound = chooseAnimals(excludedIds);
  previousRoundIds = [];
  pickBoardedAnimal();
  startWaiting();
}
function showSuccessOverlay() {
  if (state !== "finished" || !boardedAnimal) return;
  state = "answer";
  elements.next.disabled = true;
  elements.answer.textContent = texts.answerTemplate.replace("{name}", boardedAnimal.name);
  elements.answer.classList.add("show");
  applyTexts();
  elements.successAnimalName.textContent = boardedAnimal.name;
  elements.successAnimalImage.src = animalImageSrc(boardedAnimal);
  elements.successAnimalImage.alt = boardedAnimal.name;
  elements.successNext.disabled = false;
  elements.successOverlay.hidden = false;
  document.body.classList.add("success-open");
  updateStatus(texts.statusAnswer);
  playCheer();
  sayWellDone();
  window.requestAnimationFrame(() => {
    elements.successOverlay.classList.add("show");
    elements.successNext.focus({ preventScroll: true });
  });
}
function hideSuccessOverlay() {
  if (!elements.successOverlay) return;
  elements.successOverlay.classList.remove("show");
  elements.successOverlay.hidden = true;
  document.body.classList.remove("success-open");
}
function goToNextLevel() {
  if (state !== "answer") return;
  elements.successNext.disabled = true;
  hideSuccessOverlay();
  startRound(true);
}
function playCheer() {
  try {
    const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    audioContext = ctx;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      const t = now + index * 0.09;
      const oscillator = ctx.createOscillator();
      const volume = ctx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, t);
      volume.gain.setValueAtTime(0.0001, t);
      volume.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      oscillator.connect(volume).connect(ctx.destination);
      oscillator.start(t);
      oscillator.stop(t + 0.24);
    });
  } catch (error) { /* 音效失败不影响游戏 */ }
}
function sayWellDone() {
  try {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance("你真棒！");
    utterance.lang = "zh-CN";
    utterance.rate = 1.1;
    utterance.pitch = 1.2;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch (error) { /* 语音合成失败不影响游戏 */ }
}
function openSettingsDialog() {
  elements.countInput.value = animalCount;
  elements.coverInput.value = coverSeconds;
  elements.waitInput.value = waitSeconds;
  if (typeof elements.settingsDialog.showModal === "function") elements.settingsDialog.showModal();
}
function playNote(frequency, duration, startAt) {
  const oscillator = audioContext.createOscillator();
  const volume = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  volume.gain.setValueAtTime(0.0001, startAt);
  volume.gain.exponentialRampToValueAtTime(0.035, startAt + 0.02);
  volume.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(volume).connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}
function startMusic() {
  audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
  const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 783.99, 698.46];
  const beat = () => {
    playNote(melody[musicStep % melody.length], 0.28, audioContext.currentTime);
    musicStep += 1;
  };
  beat();
  musicTimer = window.setInterval(beat, 360);
}
function toggleMusic() {
  musicOn = !musicOn;
  if (musicOn) startMusic();
  else window.clearInterval(musicTimer);
  elements.music.setAttribute("aria-pressed", String(musicOn));
  if (elements.musicLabel) elements.musicLabel.textContent = musicOn ? texts.musicOn : texts.musicOff;
}
elements.repeat.addEventListener("click", repeatRound);
elements.refresh.addEventListener("click", refreshRound);
elements.next.addEventListener("click", showSuccessOverlay);
elements.successNext.addEventListener("click", goToNextLevel);
elements.successOverlay.addEventListener("keydown", event => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  elements.successNext.focus();
});
elements.music.addEventListener("click", toggleMusic);
elements.settings.addEventListener("click", openSettingsDialog);
elements.closeSettings.addEventListener("click", () => elements.settingsDialog.close());
elements.settingsForm.addEventListener("submit", event => {
  event.preventDefault();
  const count = Number(elements.countInput.value);
  const cover = Number(elements.coverInput.value);
  const wait = Number(elements.waitInput.value);
  let valid = true;
  if (!Number.isInteger(count) || count < 3 || count > 10) {
    elements.countInput.setCustomValidity("请输入 3 到 10 之间的整数");
    elements.countInput.reportValidity();
    valid = false;
  } else if (count * 2 > animalCatalog.length) {
    elements.countInput.setCustomValidity(`动物素材至少需要 ${count * 2} 只，当前仅 ${animalCatalog.length} 只`);
    elements.countInput.reportValidity();
    valid = false;
  }
  if (valid && (!Number.isInteger(cover) || cover < 0 || cover > 60)) {
    elements.coverInput.setCustomValidity("请输入 0 到 60 之间的整数");
    elements.coverInput.reportValidity();
    valid = false;
  }
  if (valid && (!Number.isInteger(wait) || wait < 1 || wait > 100)) {
    elements.waitInput.setCustomValidity("请输入 1 到 100 之间的整数");
    elements.waitInput.reportValidity();
    valid = false;
  }
  if (!valid) return;
  elements.countInput.setCustomValidity("");
  elements.coverInput.setCustomValidity("");
  elements.waitInput.setCustomValidity("");
  const countChanged = count !== animalCount;
  animalCount = count;
  coverSeconds = cover;
  waitSeconds = wait;
  elements.settingsDialog.close();
  if (countChanged) {
    currentRound = chooseAnimals([]);
    previousRoundIds = [];
    pickBoardedAnimal();
    startWaiting();
  }
});
/* ================= 自定义：文字与图片 ================= */

function animalImageSrc(animal) {
  const src = String(animal.src || "");
  if (/^(data:|blob:|https?:|\/)/i.test(src)) return src;
  return `assets/animals/${src}`;
}

function rebuildCatalog() {
  animalCatalog = [...baseCatalog, ...customAnimals];
  window.ANIMAL_CATALOG = animalCatalog;
}
function savedCustomDefaults() {
  return window.SAVED_CUSTOM && typeof window.SAVED_CUSTOM === "object" ? window.SAVED_CUSTOM : {};
}
function applyTexts() {
  TEXT_FIELDS.forEach(field => {
    if (!field.selector) return;
    const node = document.querySelector(field.selector);
    if (node) node.textContent = texts[field.key];
  });
  if (elements.musicLabel) elements.musicLabel.textContent = musicOn ? texts.musicOn : texts.musicOff;
  if (elements.successNextArrow) {
    elements.successNextArrow.textContent = texts.successArrow;
    elements.successNextArrow.hidden = !texts.successArrow.trim();
  }
}

/* 大图上传后按宽度适配，避免显得过大或被拉伸 */
function backgroundSizeFor(fit) {
  if (fit === "contain") return "contain";
  if (fit === "width") return "100% auto";
  return "cover";
}

function applyBackground() {
  if (!elements.stage) return;
  if (customBackground) {
    elements.stage.style.backgroundImage = `url("${customBackground}")`;
    elements.stage.style.backgroundSize = backgroundSizeFor(backgroundFit);
    elements.stage.style.backgroundRepeat = "no-repeat";
    elements.stage.style.backgroundPosition = "center";
    elements.stage.classList.add("has-custom-bg");
  } else {
    elements.stage.style.backgroundImage = "";
    elements.stage.style.backgroundSize = "";
    elements.stage.style.backgroundRepeat = "";
    elements.stage.style.backgroundPosition = "";
    elements.stage.classList.remove("has-custom-bg");
  }
  if (elements.bgFit) {
    elements.bgFit.value = backgroundFit;
    elements.bgFit.disabled = !customBackground;
  }
  if (!elements.bgPreview) return;
  elements.bgPreview.hidden = !customBackground;
  elements.bgPreview.style.backgroundImage = customBackground ? `url("${customBackground}")` : "";
  elements.bgPreview.style.backgroundSize = backgroundSizeFor(backgroundFit);
}
function applySuccessBackground() {
  const image = successBackground || SUCCESS_BACKGROUND_PLACEHOLDER;
  if (elements.successScene) elements.successScene.style.setProperty("--success-bg-image", `url("${image}")`);
  if (elements.successBgPreview) {
    elements.successBgPreview.style.backgroundImage = `url("${image}")`;
  }
  if (elements.successBgRemove) elements.successBgRemove.disabled = !successBackground;
}

function applyBus() {
  if (!elements.bus) return;
  const hasImage = Boolean(customBus && customBus.src);
  if (elements.busImage) {
    if (hasImage) {
      if (elements.busImage.getAttribute("src") !== customBus.src) elements.busImage.src = customBus.src;
      elements.busImage.hidden = false;
    } else {
      elements.busImage.hidden = true;
      elements.busImage.removeAttribute("src");
    }
  }
  elements.bus.classList.toggle("has-custom-image", hasImage);
  elements.bus.style.setProperty("--bus-image-width", `${hasImage ? busWidth : 102}%`);
  if (elements.busWidth) { elements.busWidth.disabled = !hasImage; elements.busWidth.value = String(busWidth); }
  if (elements.busWidthValue) elements.busWidthValue.textContent = `${busWidth}%`;
  if (elements.busPreview) {
    elements.busPreview.hidden = !hasImage;
    elements.busPreview.style.backgroundImage = hasImage ? `url("${customBus.src}")` : "";
  }
}
const storedCustom = savedCustomDefaults();
if (storedCustom.texts && typeof storedCustom.texts === "object") {
  Object.keys(TEXT_DEFAULTS).forEach(key => {
    if (typeof storedCustom.texts[key] === "string") texts[key] = storedCustom.texts[key];
  });
}
customBackground = typeof storedCustom.background === "string" ? storedCustom.background : "";
backgroundFit = ["width", "contain", "cover"].includes(storedCustom.backgroundFit) ? storedCustom.backgroundFit : "width";
successBackground = typeof storedCustom.successBackground === "string" ? storedCustom.successBackground : "";
busWidth = Number.isFinite(Number(storedCustom.busWidth)) ? Math.max(50, Math.min(140, Number(storedCustom.busWidth))) : 100;
animalSpread = Number.isFinite(Number(storedCustom.animalSpread)) ? Math.max(40, Math.min(100, Number(storedCustom.animalSpread))) : 100;
customBus = storedCustom.bus && typeof storedCustom.bus.src === "string" && storedCustom.bus.src ? { src: storedCustom.bus.src } : null;
customAnimals = Array.isArray(storedCustom.animals)
  ? storedCustom.animals.filter(animal => animal && animal.id && animal.name && animal.src)
  : [];
const savedCatalogIds = new Set(baseCatalog.map(animal => animal.id));
customAnimals = customAnimals.filter(animal => !savedCatalogIds.has(animal.id));
rebuildCatalog();
applyTexts();
applyBackground();
applySuccessBackground();
applyBus();
applyAnimalSpots();

startRound();
