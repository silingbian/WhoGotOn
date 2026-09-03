let animalCatalog = Array.isArray(window.ANIMAL_CATALOG) ? [...window.ANIMAL_CATALOG] : [];

const SPOTS = [
  [4, 42], [23, 41], [42, 42], [61, 41], [80, 42]
];
const WAIT_SECONDS = 15;
const elements = {
  animals: document.querySelector("#animals"),
  bus: document.querySelector("#bus"),
  status: document.querySelector("#status-text"),
  repeat: document.querySelector("#repeat-btn"),
  next: document.querySelector("#next-btn"),
  timer: document.querySelector("#timer-btn"),
  dialog: document.querySelector("#timer-dialog"),
  timerForm: document.querySelector("#timer-form"),
  timerInput: document.querySelector("#timer-input"),
  closeDialog: document.querySelector("#close-dialog"),
  answer: document.querySelector("#answer-banner"),
  music: document.querySelector("#music-btn"),
  refresh: document.querySelector("#refresh-btn"),
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
let coverSeconds = 5;
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
  return shuffle(source).slice(0, 5);
}
function renderAnimals() {
  elements.animals.innerHTML = "";
  currentRound.forEach((animal, index) => {
    const [left, top] = SPOTS[index];
    const item = document.createElement("div");
    item.className = "animal";
    item.dataset.animal = animal.id;
    item.style.left = `${left}%`;
    item.style.top = `${top}%`;
    const image = document.createElement("img");
    image.src = `assets/animals/${animal.src}`;
    image.alt = animal.name;
    image.addEventListener("error", () => {
      if (animal.fallback && image.getAttribute("src") !== `assets/animals/${animal.fallback}`) {
        image.src = `assets/animals/${animal.fallback}`;
      }
    }, { once: true });
    item.append(image, Object.assign(document.createElement("span"), { className: "name-tag", textContent: animal.name }));
    elements.animals.append(item);
  });
}
function updateStatus(text) { elements.status.textContent = text; }
function updateTimerButton() { elements.timer.textContent = `公交遮挡：${coverSeconds} 秒`; }
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
  startCountdown(WAIT_SECONDS, driveIn, "小动物正在等公交车… ");
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
  boardedAnimal = currentRound[Math.floor(Math.random() * currentRound.length)];
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
  }
  if (!currentRound.length) currentRound = chooseAnimals();
  startWaiting();
}
function repeatRound() { startRound(false); }
function refreshRound() {
  const excludedIds = currentRound.map(animal => animal.id);
  currentRound = chooseAnimals(excludedIds);
  previousRoundIds = [];
  startWaiting();
}
function showAnswerThenNext() {
  if (state !== "finished") return;
  state = "answer";
  elements.next.disabled = true;
  elements.answer.textContent = `上车的是：${boardedAnimal.name}！`;
  elements.answer.classList.add("show");
  updateStatus("答对了吗？准备开始下一轮…");
  schedule(() => startRound(true), 2000);
}
function openTimerDialog() {
  elements.timerInput.value = coverSeconds;
  if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
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
  elements.music.textContent = musicOn ? "♫ 音乐：开" : "♫ 音乐：关";
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
  if (catalog.length < 10) return "至少保留 10 只动物，才能保证刷新时完全更换 5 只动物。";
  const ids = new Set();
  for (const animal of catalog) {
    if (!animal.name.trim() || !animal.src.trim()) return "请填写每只动物的名称和图片文件名。";
    if (!/\.(png|jpe?g|svg)$/i.test(animal.src.trim())) return "图片文件只支持 PNG、JPG、JPEG 或 SVG。";
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
    const validCurrentRound = currentRound.length === 5 && currentRound.every(animal => animalCatalog.some(item => item.id === animal.id));
    if (!validCurrentRound) {
      currentRound = chooseAnimals([]);
      previousRoundIds = [];
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
elements.timer.addEventListener("click", openTimerDialog);
elements.closeDialog.addEventListener("click", () => elements.dialog.close());
elements.music.addEventListener("click", toggleMusic);
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
  if (editableCatalog.length <= 10) return setCatalogMessage("至少保留 10 只动物，不能继续删除。");
  editableCatalog.splice(index, 1);
  setCatalogMessage();
  renderCatalogRows();
});
elements.saveCatalog.addEventListener("click", saveCatalog);
elements.timerForm.addEventListener("submit", event => {
  event.preventDefault();
  const seconds = Number(elements.timerInput.value);
  if (!Number.isInteger(seconds) || seconds < 5 || seconds > 60) {
    elements.timerInput.setCustomValidity("请输入 5 到 60 之间的整数");
    elements.timerInput.reportValidity();
    return;
  }
  elements.timerInput.setCustomValidity("");
  coverSeconds = seconds;
  updateTimerButton();
  elements.dialog.close();
});

updateTimerButton();
startRound();
