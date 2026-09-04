let animalCatalog = Array.isArray(window.ANIMAL_CATALOG) ? [...window.ANIMAL_CATALOG] : [];

const WAIT_SECONDS_DEFAULT = 15;
const COVER_SECONDS_DEFAULT = 1;
const ANIMAL_COUNT_DEFAULT = 5;

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
  animalsButton: document.querySelector("#animals-btn"),
  animalsDialog: document.querySelector("#animals-dialog"),
  closeAnimalsDialog: document.querySelector("#close-animals-dialog"),
  catalogRows: document.querySelector("#catalog-rows"),
  catalogMessage: document.querySelector("#catalog-message"),
  addAnimal: document.querySelector("#add-animal-btn"),
  saveCatalog: document.querySelector("#save-catalog-btn")
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
let editableCatalog = [];
let catalogFileHandle = null;

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
function buildSpots(count) {
  const spots = [];
  const width = Math.max(8, Math.min(18, 92 / count));
  const step = 100 / count;
  for (let i = 0; i < count; i++) {
    spots.push({ left: i * step + (step - width) / 2, top: 42, width });
  }
  return spots;
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
    image.src = `assets/animals/${animal.src}`;
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
function resetBus() { elements.bus.className = "bus"; }
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
  renderAnimals();
  resetBus();
  startCountdown(waitSeconds, driveIn, "小动物正在等公交车… ");
}
function driveIn() {
  state = "arriving";
  updateStatus("公交车来了，请记住小动物！");
  elements.bus.classList.add("in");
  schedule(() => {
    state = "covered";
    startCountdown(coverSeconds, driveAway, "公交正在停靠… ");
  }, 1050);
}
function driveAway() {
  state = "leaving";
  if (!boardedAnimal || !currentRound.includes(boardedAnimal)) pickBoardedAnimal();
  const target = elements.animals.querySelector(`[data-animal="${boardedAnimal.id}"]`);
  if (target) target.classList.add("missing");
  updateStatus("公交车开走了，想一想：谁上车了？");
  elements.bus.classList.remove("in");
  elements.bus.classList.add("out");
  schedule(() => {
    state = "finished";
    elements.next.disabled = false;
    elements.bus.className = "bus";
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
function showAnswerThenNext() {
  if (state !== "finished") return;
  state = "answer";
  elements.next.disabled = true;
  elements.answer.textContent = `上车的是：${boardedAnimal.name}！`;
  elements.answer.classList.add("show");
  updateStatus("答对了吗？准备开始下一轮…");
  playCheer();
  sayWellDone();
  schedule(() => startRound(true), 2000);
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
  elements.music.textContent = musicOn ? "♫ 开" : "♫ 关";
}
function makeId(src, index) {
  const stem = String(src).trim().replace(/\.[^.]+$/, "").toLowerCase();
  const base = stem.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "animal";
  const used = new Set(editableCatalog.filter((_, rowIndex) => rowIndex !== index).map(animal => animal.id));
  let id = base;
  let number = 2;
  while (used.has(id)) id = `${base}-${number++}`;
  return id;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
function setCatalogMessage(message = "", success = false) {
  elements.catalogMessage.textContent = message;
  elements.catalogMessage.classList.toggle("success", success);
}
function renderCatalogRows() {
  elements.catalogRows.innerHTML = "";
  editableCatalog.forEach((animal, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><output>${escapeHtml(animal.id)}</output></td>
      <td><input data-field="name" data-index="${index}" value="${escapeHtml(animal.name)}" aria-label="第 ${index + 1} 行动物名称"></td>
      <td><input data-field="src" data-index="${index}" value="${escapeHtml(animal.src)}" aria-label="第 ${index + 1} 行图片文件名"></td>
      <td><button class="delete-animal" type="button" data-delete-index="${index}">删除</button></td>`;
    elements.catalogRows.append(row);
  });
}
function openAnimalsDialog() {
  editableCatalog = animalCatalog.map(animal => ({ ...animal }));
  setCatalogMessage();
  renderCatalogRows();
  if (typeof elements.animalsDialog.showModal === "function") elements.animalsDialog.showModal();
}
function getCatalogValidationError(catalog) {
  const minNeeded = animalCount * 2;
  if (catalog.length < minNeeded) return `至少保留 ${minNeeded} 只动物，才能保证刷新时完全更换 ${animalCount} 只动物。`;
  const ids = new Set();
  for (const animal of catalog) {
    if (!animal.name.trim() || !animal.src.trim()) return "请填写每只动物的名称和图片文件名。";
    if (!/\.(png|jpe?g|svg|webp)$/i.test(animal.src.trim())) return "图片文件只支持 PNG、JPG、JPEG、SVG 或 WebP。";
    if (ids.has(animal.id)) return "自动生成的 id 重复，请更换图片文件名。";
    ids.add(animal.id);
  }
  return "";
}
function catalogSource(catalog) {
  return `/* 由“动物素材清单”界面生成，请勿删除 window.ANIMAL_CATALOG。 */\nwindow.ANIMAL_CATALOG = ${JSON.stringify(catalog, null, 2)};\n`;
}
async function saveCatalog() {
  const error = getCatalogValidationError(editableCatalog);
  if (error) return setCatalogMessage(error);
  if (!window.showOpenFilePicker) return setCatalogMessage("此浏览器不支持直接写入文件，请在支持文件授权的桌面浏览器中操作。");
  try {
    if (!catalogFileHandle) {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "JavaScript 清单", accept: { "text/javascript": [".js"] } }],
        multiple: false
      });
      if (handle.name !== "catalog.js") return setCatalogMessage("请选择 assets/animals/catalog.js 文件。" );
      catalogFileHandle = handle;
    }
    const writable = await catalogFileHandle.createWritable();
    await writable.write(catalogSource(editableCatalog));
    await writable.close();
    animalCatalog = editableCatalog.map(animal => ({ ...animal }));
    window.ANIMAL_CATALOG = animalCatalog;
    const validCurrentRound = currentRound.length === animalCount && currentRound.every(animal => animalCatalog.some(item => item.id === animal.id));
    if (!validCurrentRound) {
      currentRound = chooseAnimals([]);
      previousRoundIds = [];
      pickBoardedAnimal();
      startWaiting();
    }
    setCatalogMessage("已保存到 catalog.js，新动物会用于后续刷新和新一轮游戏。", true);
  } catch (error) {
    if (error.name !== "AbortError") setCatalogMessage("未能写入文件，请确认已授权选择正确的 catalog.js。");
  }
}
elements.repeat.addEventListener("click", repeatRound);
elements.refresh.addEventListener("click", refreshRound);
elements.next.addEventListener("click", showAnswerThenNext);
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
elements.animalsButton.addEventListener("click", openAnimalsDialog);
elements.closeAnimalsDialog.addEventListener("click", () => elements.animalsDialog.close());
elements.addAnimal.addEventListener("click", () => {
  editableCatalog.push({ id: makeId("animal", editableCatalog.length), name: "", src: "" });
  renderCatalogRows();
});
elements.catalogRows.addEventListener("input", event => {
  const input = event.target;
  const index = Number(input.dataset.index);
  const field = input.dataset.field;
  if (!field || !editableCatalog[index]) return;
  editableCatalog[index][field] = input.value;
  if (field === "src") editableCatalog[index].id = makeId(input.value, index);
  renderCatalogRows();
  const updatedInput = elements.catalogRows.querySelector(`[data-index="${index}"][data-field="${field}"]`);
  if (updatedInput) { updatedInput.focus(); updatedInput.setSelectionRange(input.value.length, input.value.length); }
});
elements.catalogRows.addEventListener("click", event => {
  const index = Number(event.target.dataset.deleteIndex);
  if (!Number.isInteger(index)) return;
  const minNeeded = animalCount * 2;
  if (editableCatalog.length <= minNeeded) return setCatalogMessage(`至少保留 ${minNeeded} 只动物，不能继续删除。`);
  editableCatalog.splice(index, 1);
  setCatalogMessage();
  renderCatalogRows();
});
elements.saveCatalog.addEventListener("click", saveCatalog);

startRound();
