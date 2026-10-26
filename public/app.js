import {
  SCHEMA,
  random,
  createLife,
  step,
  choose,
  decisions,
  validateLife,
  pendingDecision,
  referenceCountryIds,
} from "./engine.js";
import {
  configureEras,
  initSystems,
  livingCountry,
  worldCountries,
  specialDecision,
  remember,
} from "./systems.js";
import {
  setupDeepUI,
  pauseForReflection,
  openPublicMemory,
} from "./deep-ui.js";
import { readOwners, validOwners, mergeOwners } from "./ownership.js";
import {
  gameMarkup,
  miniMap,
  registrationMarkup,
} from "./presentation.js";
import { deathRecordMarkup, endingMarkup, endingFrames, endingFrameMarkup } from "./life-record.js";
import { AUTO_READING_MS, yearInterval, autoChoiceIndex, focusOptions } from "./playback.js";
import { clockFor, advanceClock, decisionReady } from './timeline-clock.js';
import { referenceCountry, withReferenceCountries } from './reference-data.js';
const $ = (s) => document.querySelector(s),
  KEY = "birth.v1",
  PREF = "birth.preferences";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const flag = (c) =>
  c?.code?.length === 2
    ? String.fromCodePoint(
        ...c.code
          .toUpperCase()
          .split("")
          .map((x) => 127397 + x.charCodeAt(0)),
      )
    : "🌍";
const number = (n) => Math.round(n).toLocaleString("zh-CN"),
  money = (n) => `${n < 0 ? "−" : ""}$${number(Math.abs(n))}`;
let countries = [],
  meta = {},
  current = null,
  history = [],
  sampling = "births",
  duration = 60,
  running = false,
  speed = 1,
  view = "home",
  timelineLimit = 20,
  storageOK = true,
  preferences = {},
  memoryId = null,
  endingLife = null,
  endingOrigin = "game";
let lastTick = performance.now(),
  elapsed = 0,
  toastTimer,
  music = null,
  musicNodes = [],
  musicOn = false;
const expandedEvents = new Set();
const collapsedPanels = new Set();
let fastForward = false,
  autoPreview = null,
  suppressedDecision = null;
let endingPlayback = null;
let chosenDialogClose = false;
const decisionKey = () => current ? [current.id,current.age,current.pending,current.deep?.experience?.activeEvent?.id||current.deep?.experience?.chapter||""].join(":") : "";
try {
  const stored = JSON.parse(localStorage.getItem(PREF) || "{}");
  preferences =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? stored
      : {};
  if (preferences.theme === "dark") document.body.classList.add("dark");
} catch {}
function country(id) {
  return countries.find((c) => c.id === id);
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3500);
}
function save() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        schema: SCHEMA,
        current,
        history: history.slice(0, 50),
      }),
    );
  } catch {
    if (storageOK) {
      storageOK = false;
      toast("浏览器无法保存进度。请导出人生档案，避免关闭后丢失。");
    }
  }
}
function prefs() {
  try {
    localStorage.setItem(PREF, JSON.stringify(preferences));
  } catch {}
}
function saveSetup() {
  preferences.setup = {
    sampling,
    duration,
    world: $("#world-select").value,
    origin: $("#origin-select").value,
    gentle: $("#gentle-mode").checked,
    reflections: $("#reflection-mode").checked,
  };
  prefs();
}
function restoreSetup() {
  const setup = preferences?.setup;
  if (!setup || typeof setup !== "object") return;
  if ([30, 60, 90].includes(setup.duration)) duration = setup.duration;
  if (["births", "population"].includes(setup.sampling))
    sampling = setup.sampling;
  if ([...$("#world-select").options].some((x) => x.value === setup.world))
    $("#world-select").value = setup.world;
  if (countries.some((c) => c.id === setup.origin))
    $("#origin-select").value = setup.origin;
  if (typeof setup.gentle === "boolean")
    $("#gentle-mode").checked = setup.gentle;
  if (typeof setup.reflections === "boolean")
    $("#reflection-mode").checked = setup.reflections;
  document.querySelectorAll("[data-duration]").forEach((b) => {
    b.classList.toggle("selected", Number(b.dataset.duration) === duration);
    b.setAttribute("aria-pressed", Number(b.dataset.duration) === duration);
  });
  setSampling(sampling);
}
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (data.schema === SCHEMA) {
      if (validateLife(data.current, countries)) current = data.current;
      history = Array.isArray(data.history)
        ? data.history.filter((s) => validateLife(s, countries)).slice(0, 50)
        : [];
    }
  } catch {
    toast("本地进度无法读取，可以开始一段新的人生。");
  }
}
function archive(s) {
  const copy = structuredClone(s);
  history = [copy, ...history.filter((x) => x.id !== s.id)].slice(0, 50);
  save();
  renderArchives();
}
function modal(kicker, html) {
  $(".modal-heading .choice-tag")?.remove();
  $("#modal-kicker").textContent = kicker;
  $("#modal-content").innerHTML = html;
  const choice = Boolean($("#modal-content .choices"));
  $("#modal").classList.toggle("choice-dialog", choice);
  const dismiss = $(".modal-heading [data-action=close]");
  const context = $("#modal-content .choice-tag");
  if (choice && context) dismiss.before(context);
  dismiss.textContent = choice ? "先收起来 ▾" : "×";
  dismiss.setAttribute("aria-label", choice ? "收起当前抉择" : "关闭对话框");
  if (!$("#modal").open) $("#modal").showModal();
}
function closeModal(chosen = false) {
  if (!chosen && current?.pending && $("#modal-content .choices")) suppressedDecision = decisionKey();
  autoPreview = null;
  chosenDialogClose = chosen && $("#modal").open;
  $("#modal").close();
  lastTick = performance.now();
}
function showHome() {
  running = false;
  fastForward = false;
  autoPreview = null;
  view = "home";
  document.body.dataset.view = view;
  $("#registration-view").classList.add("hidden");
  $("#ending-view").classList.add("hidden");
  $("#record-view").classList.add("hidden");
  $("#record-view").replaceChildren();
  $("#home-view").classList.remove("hidden");
  $("#game-view").classList.add("hidden");
  $("#resume-button").classList.toggle(
    "hidden",
    !current || current.stage === "ended",
  );
  renderArchives();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function showGame() {
  view = "game";
  document.body.dataset.view = view;
  $("#registration-view").classList.add("hidden");
  $("#ending-view").classList.add("hidden");
  $("#record-view").classList.add("hidden");
  $("#record-view").replaceChildren();
  $("#home-view").classList.add("hidden");
  $("#game-view").classList.remove("hidden");
  lastTick = performance.now();
  elapsed = 0;
  renderGame();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function setSampling(mode) {
  sampling = mode;
  document.querySelectorAll("[data-sampling]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.sampling === mode);
    b.setAttribute("aria-pressed", b.dataset.sampling === mode);
  });
  $("#sampling-hint").textContent =
    mode === "births"
      ? "成为此刻降生的一个婴儿。出生率越高的地方，越有可能遇见你。"
      : "从现有人口中随机抽取一个出生地，人生同样从 0 岁开始。";
  renderBars();
}
function weights(mode = sampling, setting = worldSettings()) {
  const rows = worldCountries(countries, setting.world, setting.year).filter(c=>referenceCountryIds.has(c.id)).map(c=>setting.world==='today'?referenceCountry(c):c).map(
    (c) => ({
      ...c,
      weight: c.population * (mode === "population" ? 1 : c.birthRate / 1000),
    }),
  );
  const total = rows.reduce((a, c) => a + c.weight, 0);
  return rows
    .map((c) => ({ ...c, probability: c.weight / total }))
    .sort((a, b) => b.probability - a.probability);
}
function syncWorldControls() {
  const value = $("#world-select").value;
  const group = value.startsWith("past") ? "past" : value;
  document.querySelectorAll("[data-world]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.world === group);
    b.setAttribute("aria-pressed", b.dataset.world === group);
  });
  $("#world-hint").textContent =
    group === "past"
      ? "采用所选年份的固定统计截面，不重建历史国界。"
      : group === "future"
        ? "2050 年独立游戏情景，非官方预测。"
        : group === "any"
          ? "出生时，在三个历史截面、今日与未来情景之间随机选择。"
          : "以当前统计作为起点，在这个环境里走过一生。";
}
function renderBars() {
  const rows = weights(),
    max = rows[0].probability;
  $("#country-bars").innerHTML =
    rows
      .slice(0, 9)
      .map(
        (c) =>
          `<div class="country-row"><span class="country-label">${esc(c.name)}</span><div class="country-track"><div class="country-fill" style="width:${(c.probability / max) * 100}%"></div></div><span class="country-pct">${(c.probability * 100).toFixed(1)}%</span></div>`,
      )
      .join("") +
    `<div class="country-row other-countries"><span class="country-label">其余 ${rows.length - 9} 个地区</span><div class="country-track"><div class="country-fill" style="width:${Math.min(1, rows.slice(9).reduce((sum, c) => sum + c.probability, 0) / max) * 100}%"></div></div><span class="country-pct">${(rows.slice(9).reduce((sum, c) => sum + c.probability, 0) * 100).toFixed(1)}%</span></div>`;
  const setting = worldSettings();
  $("#data-description").textContent =
    `${worldSource(setting)} · ${rows.length} 个国家和地区`;
  syncWorldControls();
}
function worldSettings(value = $("#world-select")?.value || "today") {
  return {
    world: value.startsWith("past")
      ? "past"
      : value === "future"
        ? "future"
        : "today",
    year: value.startsWith("past")
      ? Number(value.split("-")[1])
      : value === "future"
        ? 2050
        : new Date().getFullYear(),
  };
}
function worldSource(setting = worldSettings()) {
  return setting.world === "future"
    ? "2050 年游戏情景假设（非人口预测）"
    : setting.world === "past" ? `${setting.year} 年世界银行 WDI 固定截面` : "公开统计页 · 多来源最新可用年份";
}
function renderArchives() {
  const lives = history.slice(0, 10);
  $("#history-count").textContent = history.length;
  $("#recent-lives").innerHTML = lives.length
    ? lives.map(lifeCard).join("")
    : '<div class="empty-archive">这里还没有故事。你的第一段人生，正等待开始。</div>';
  $("#resume-button").classList.toggle(
    "hidden",
    !current || current.stage === "ended",
  );
}
function lifeCard(s) {
  const c = country(s.country);
  return `<button class="life-card" data-memory="${esc(s.id)}"><span class="flag">${flag(c)}</span><span class="card-arrow">↗</span><h3>${esc(s.name)}</h3><p>${esc(c.name)} · ${s.year}—${s.stage === "ended" ? s.year + s.age : "未完"} · ${s.age} 岁</p><p>${s.note ? esc(s.note.slice(0, 45)) : s.stage === "ended" ? "一个完整的故事，一段独一无二的人生。" : "一段未完的旅程，随时可以回来。"}</p></button>`;
}
function birth(seed) {
  if (current && current.stage !== "ended") archive(current);
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const setting =
    $("#world-select").value === "any"
      ? worldSettings(
          ["today", "past-1970", "past-1990", "past-2010", "future"][
            (seed || bytes[0]) % 5
          ],
        )
      : worldSettings();
  current = createLife(countries, {
    seed: seed || bytes[0],
    mode: sampling,
    duration,
    origin: $("#origin-select").value,
    gentle: $("#gentle-mode").checked,
    ...setting,
    reflections: $("#reflection-mode").checked,
  });
  running = false;
  speed = 1;
  timelineLimit = 20;
  save();
  showRegistration();
}
function showRegistration() {
  closeModal();
  running = false;
  view = "registration";
  document.body.dataset.view = view;
  $("#home-view").classList.add("hidden");
  $("#game-view").classList.add("hidden");
  $("#ending-view").classList.add("hidden");
  $("#record-view").classList.add("hidden");
  $("#record-view").replaceChildren();
  $("#registration-view").classList.remove("hidden");
  const s = current;
  const probability = weights(s.mode, {
    world: s.deep.world,
    year: s.year,
  }).find((c) => c.id === s.country).probability;
  $("#registration-view").innerHTML = registrationMarkup(
    s,
    countries,
    land,
    probability,
    meta,
  );
  window.scrollTo({ top: 0, behavior: "instant" });
}
function renderTimeline() {
  const timeline=$('.timeline');
  if(!timeline || !current)return;
  const template=document.createElement('template');
  template.innerHTML=gameMarkup({s:current,countries,running,speed,timelineLimit,musicOn,expandedEvents,fastForward});
  const next=template.content.querySelector('.timeline');
  const old=new Map([...timeline.children].map(e=>[e.dataset.eventid,e]));
  let previous=null;
  for(const row of [...next.children]){
    const item=old.get(row.dataset.eventid)||row;
    if(!old.has(row.dataset.eventid))item.classList.add('event-arriving');
    const position=previous?previous.nextElementSibling:timeline.firstElementChild;
    if(item!==position)timeline.insertBefore(item,position);
    old.delete(row.dataset.eventid);previous=item;
  }
  for(const row of old.values())row.remove();
}
function renderGame() {
  if (!current) return;
  const open = $(".game-menu") && !$(".game-menu").hidden;
  $("#game-view").innerHTML = gameMarkup({
    s: current,
    countries,
    running,
    speed,
    timelineLimit,
    musicOn,
    expandedEvents,
    fastForward,
  });
  if (innerWidth <= 1250) $(".game-menu").append($(".game-extra-controls"));
  if (innerWidth <= 650) document.querySelectorAll('.profile-card,.game-insights .insight-card').forEach((panel,index)=>{
    const heading=panel.querySelector('.panel-title');
    const toggle=document.createElement('button');
    toggle.className='panel-collapse';toggle.dataset.action='panel-collapse';toggle.dataset.panel=index;
    toggle.textContent=collapsedPanels.has(index)?'▸':'⌄';
    toggle.setAttribute('aria-expanded',String(!collapsedPanels.has(index)));
    toggle.setAttribute('aria-label',(collapsedPanels.has(index)?'展开':'收起')+heading.textContent.trim());
    panel.classList.toggle('is-collapsed',collapsedPanels.has(index));heading.append(toggle);
  });
  if (open) {
    $(".game-menu").hidden = false;
    $("[data-action=game-menu]").setAttribute("aria-expanded", "true");
  }
}
function showEnding(s) {
  running = false;
  endingLife = s;
  if (view !== "ending") endingOrigin = view;
  view = "ending";
  document.body.dataset.view = view;
  closeModal();
  for (const id of ["home-view", "game-view", "registration-view", "record-view"])
    $("#" + id).classList.add("hidden");
  $("#record-view").replaceChildren();
  $("#ending-view").innerHTML = endingMarkup(s, countries);
  $("#ending-view").classList.remove("hidden");
  endingPlayback = {life:s,frames:endingFrames(s,countries),index:0,elapsed:0,armed:false};
  $("#ending-stage").innerHTML = endingFrameMarkup(endingPlayback.frames[0],s,countries);
  window.scrollTo({ top: 0, behavior: "instant" });
  $("#ending-view .ending-skip").focus();
}
function revealEnding() {
  endingPlayback.index = endingPlayback.frames.length-1;
  $("#ending-stage").classList.add("hidden");
  $(".ending-final").classList.remove("hidden");
}
function performStep() {
  if (!current || current.stage !== "living") return;
  if (pauseForReflection()) return;
  if (current.pending) {
    if (decisionReady(current)) current.auto ? autoChoose() : showDecision();
    return;
  }
  step(current, countries);
  save();
  renderGame();
  if (current.stage === "ended") {
    running = false;
    archive(current);
    showEnding(current);
  } else if (pauseForReflection()) return;
  else if (decisionReady(current)) current.auto ? autoChoose() : showDecision();
}
function showDecision(automatic = false) {
  if (!current?.pending || !decisionReady(current)) return;
  const d = pendingDecision(current,countries);
  if (!d) return;
  modal(
    "重大抉择",
    `<p class="choice-tag">${current.age} 岁 · ${current.year + current.age} 年</p><h2 class="modal-title">${esc(d.title)}</h2><p class="modal-description">${esc(d.text)}</p>${d.age===2?'<aside class="choice-context-note">人格差异与遗传和环境都有关。2015 年一项综合研究的平均遗传率估计约为 40%。<a href="https://pubmed.ncbi.nlm.nih.gov/25961374/" target="_blank" rel="noopener">Vukasović 与 Bratko</a></aside>':''}<div class="choices">${d.choices.map((c, i) => `<button class="choice-button" data-choice="${i}" ${c.disabled?"disabled":""}><span class="choice-number">${i+1}</span><span><b>${esc(c.title)}</b><small>${esc(c.hint)}</small></span></button>`).join("")}</div><div class="choice-auto"><button class="small-button" data-action="choice-auto">接下来的抉择交给自动</button></div><p class="decision-footnote">没有标准答案。收起窗口后，时间会停在这里等你。</p>`,
  );
  $('#modal').dataset.choiceAge=String(current.age);
  if (automatic) {
    suppressedDecision = null;
    const pick = autoChoiceIndex(current,d,()=>random(current));
    autoPreview = { token:decisionKey(), pick, remaining:AUTO_READING_MS };
    const selected = $("[data-choice='"+pick+"']");
    selected.classList.add("auto-preview");
    selected.setAttribute("aria-label",d.choices[pick].title+"，自动预选，点击可接管");
    $(".choice-auto").innerHTML = `<p class="auto-status" role="status">稍后将选择「${esc(d.choices[pick].title)}」<br><small>点击选项可接管这次抉择。</small></p><button class="small-button" data-action="auto-stop">关闭自动抉择</button>`;
  }
}
function autoChoose() {
  if (!current?.pending || !decisionReady(current)) return;
  if (suppressedDecision === decisionKey()) return;
  if (!autoPreview) showDecision(true);
}
function statistics() {
  modal(
    "THE WORLD IN NUMBERS / 世界数据",
    `<h2 class="modal-title">起点不同，人生各异。</h2><p class="modal-description">${worldSource()} · ${weights().length} 个国家和地区。概率按${sampling === "births" ? "人口 × 粗出生率" : "人口"}加权，并在有完整人口、出生率与寿命数据的地区间归一化。</p><input type="search" id="country-search" class="data-search" aria-label="搜索国家或地区" placeholder="搜索国家、地区或英文名…"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>国家和地区</th><th>抽中概率</th><th>预期寿命</th><th>人口</th></tr></thead><tbody id="data-rows"></tbody></table></div><p class="data-links">出生人数估计 = 人口 × 粗出生率 ÷ 1000；四舍五入与统计覆盖范围会影响比例。此表使用开局选择的固定统计环境，不随人生的年岁动态更新；2050 年为游戏假设。<br>数据源：<a href="https://data.worldbank.org/indicator/SP.POP.TOTL" target="_blank" rel="noopener">人口</a> · <a href="https://data.worldbank.org/indicator/SP.DYN.CBRT.IN" target="_blank" rel="noopener">出生率</a> · <a href="https://data.worldbank.org/indicator/SP.DYN.LE00.IN" target="_blank" rel="noopener">预期寿命</a> · <a href="https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.CD" target="_blank" rel="noopener">人均 GDP（PPP）</a></p>`,
  );
  renderDataRows();
}
function renderDataRows(query = "") {
  const q = query.toLowerCase();
  $("#data-rows").innerHTML =
    weights()
      .filter((c) => `${c.name} ${c.en} ${c.code}`.toLowerCase().includes(q))
      .map(
        (c) =>
          `<tr><td>${flag(c)} ${esc(c.name)}</td><td>${(c.probability * 100).toFixed(2)}%</td><td>${c.life.toFixed(1)} 岁</td><td>${(c.population / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 0 })} 万</td></tr>`,
      )
      .join("") || '<tr><td colspan="4">没有找到这个地方。</td></tr>';
}
function showHistory() {
  modal(
    "THE LIVES WE KEEP / 人生档案",
    `<h2 class="modal-title">走过的路，都留在这里。</h2><p class="modal-description">${history.length} 段故事${current && current.stage !== "ended" ? "，还有一段正在发生的人生" : ""}。保存在此浏览器，可导出到其他设备。档案包含私人记录和公开纪念的撤回凭证，请勿公开分享。</p><div class="history-actions"><button class="small-button" data-action="export">↓ 导出全部档案</button><button class="small-button" data-action="import">↑ 导入档案</button>${current && current.stage !== "ended" ? '<button class="small-button" data-action="resume">继续当前人生 →</button>' : ""}</div><div class="history-grid">${history.map(lifeCard).join("") || '<div class="empty-archive">第一段人生，正在等待你。</div>'}</div><p class="history-note">最多保留 50 段人生。浏览器清理站点数据会删除本地进度，建议偶尔导出备份。</p>`,
  );
}
function showMemory(s) {
  memoryId = s.id;
  if (s.stage === "ended") {
    running = false;
    closeModal();
    view = "record";
    document.body.dataset.view = view;
    endingPlayback = null;
    for (const id of ["home-view","game-view","registration-view","ending-view"]) $("#"+id).classList.add("hidden");
    $("#record-view").innerHTML = deathRecordMarkup(s,countries);
    $("#record-view").classList.remove("hidden");
    window.scrollTo({top:0,behavior:"instant"});
    $("#record-view [data-action=home]").focus({preventScroll:true});
    return;
  }
  const c = country(s.country),
    ended = s.stage === "ended",
    notable = s.events.filter((e) => e.star || e.type === "decision").slice(-5);
  modal(
    "A LIFE, REMEMBERED / 人生的回声",
    `<div class="memory-card"><div class="memory-symbol">✳</div><h2>${esc(s.name)}</h2><p class="memory-dates">${s.year} — ${ended ? s.year + s.age : "未完"} · ${esc(c.name)} ${flag(c)}</p><p class="memory-summary">${ended ? "从第一次睁开眼睛，到最后一次看见世界。" : "故事停在了这里，但随时可以继续。"}<br>你走过了 ${s.age} 年，${s.partner ? "学会与人相伴，" : ""}${s.children ? "成为一个孩子的依靠，" : ""}也留下了属于自己的痕迹。</p><div class="memory-stats"><div><strong>${s.age}</strong><span>走过的年岁</span></div><div><strong>${s.events.length}</strong><span>被记录的瞬间</span></div><div><strong>${Math.round(s.happiness)}</strong><span>此刻的快乐</span></div></div><textarea id="memory-note" class="memory-note" maxlength="500" placeholder="给这一生，留下一句话…" aria-label="给这一生留下一句话">${esc(s.note)}</textarea><div class="memory-events">${notable.map((e) => `<p><span>${e.age} 岁</span>${esc(e.title)}</p>`).join("")}</div></div><div class="modal-buttons"><button class="small-button" data-action="save-note">保存这句话</button><button class="small-button" data-action="download-card">↓ 保存人生卡片</button>${ended ? '<button class="small-button" data-action="replay-ending">再看一次人生落幕</button>' : ""}</div><div class="modal-buttons">${!ended ? `<button class="primary-button" data-resume-memory="${esc(s.id)}">继续这段人生 →</button>` : ""}<button class="primary-button" data-action="rebirth">再遇见一种人生 ↗</button></div><div class="modal-buttons">${ended ? '<button class="small-button" data-deep="publish-preview">将摘要留在公共纪念馆 ↗</button>' : ""}</div><p class="history-note">${ended ? "这段人生已自动保存在本地档案。" : "这段故事还未结束。"}珍惜每一种生活，也珍惜你自己。</p>`,
  );
}
function saveNote() {
  const input = $("#memory-note");
  if (!input) return;
  const note = input.value.slice(0, 500);
  const s =
    history.find((x) => x.id === memoryId) ||
    (current?.id === memoryId ? current : null);
  if (s) {
    s.note = note;
    if (current?.id === s.id) current.note = note;
    save();
    renderArchives();
  }
}
function selectedMemory() {
  return (
    history.find((x) => x.id === memoryId) ||
    (current?.id === memoryId ? current : null)
  );
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function exportData() {
  saveNote();
  downloadBlob(
    new Blob(
      [
        JSON.stringify(
          {
            schema: SCHEMA,
            exportedAt: new Date().toISOString(),
            memorialOwners: readOwners(),
            current,
            history,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    "birth-lives-" + new Date().toISOString().slice(0, 10) + ".json",
  );
  toast("人生档案已导出。");
}
function importData() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async () => {
    try {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) throw Error("文件超过 5 MB");
      const data = JSON.parse(await file.text());
      if (
        data.schema !== SCHEMA ||
        !Array.isArray(data.history) ||
        data.history.length > 50 ||
        !validOwners(data.memorialOwners ?? {}) ||
        !data.history.every((s) => validateLife(s, countries)) ||
        (data.current !== null && !validateLife(data.current, countries))
      )
        throw Error("档案格式或版本不匹配");
      mergeOwners(data.memorialOwners);
      let incoming = [...data.history];
      if (data.current) incoming.unshift(data.current);
      const merged = new Map(history.map((x) => [x.id, x]));
      for (const s of incoming) if (!merged.has(s.id)) merged.set(s.id, s);
      history = [...merged.values()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50);
      if (!current && data.current) current = data.current;
      save();
      renderArchives();
      showHistory();
      toast("档案已合并。原有进度保留。");
    } catch (e) {
      toast("无法导入：" + e.message);
    }
  };
  input.click();
}
async function share() {
  if (!current) return;
  const url = new URL(location.href);
  url.hash = "";
  url.search = "";
  url.searchParams.set("seed", current.seed);
  url.searchParams.set("mode", current.mode);
  const d = initSystems(current);
  url.searchParams.set("world", d.world);
  url.searchParams.set("year", current.year);
  const text = `在八十亿分之一，我成为了来自${country(current.country).name}的${current.name}。你会遇见怎样的人生？`;
  try {
    if (navigator.share)
      await navigator.share({ title: "八十亿分之一", text, url: url.href });
    else {
      await navigator.clipboard.writeText(text + " " + url.href);
      toast("出生种子链接已复制，可重现同一个起点。");
    }
  } catch (e) {
    if (e.name !== "AbortError")
      modal(
        "SHARE A BEGINNING / 分享这个起点",
        `<h2 class="modal-title">把一种可能，分享出去。</h2><p class="modal-description">${esc(text)}</p><input class="data-search" aria-label="分享链接" value="${esc(url.href)}" readonly><p class="history-note">复制上面的链接，朋友可以抽中同一个出生身份。人生选择与后续经历仍由各自决定。</p>`,
      );
  }
}
async function downloadCard() {
  saveNote();
  const s = selectedMemory();
  if (!s) return;
  const c = country(s.country),
    canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f1f2e8";
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = "#cbd5c7";
  ctx.strokeRect(52, 52, 976, 1246);
  ctx.fillStyle = "#627365";
  ctx.textAlign = "center";
  ctx.font = "18px sans-serif";
  ctx.fillText("A LIFE, AMONG BILLIONS", 540, 133);
  ctx.fillStyle = "#284c3b";
  ctx.font = "40px serif";
  ctx.fillText("八十亿分之一", 540, 206);
  ctx.font = "120px serif";
  ctx.fillText("✳", 540, 385);
  ctx.font = "66px serif";
  ctx.fillText(s.name, 540, 516);
  ctx.font = "25px sans-serif";
  ctx.fillStyle = "#748077";
  ctx.fillText(
    `${c.name} · ${s.year}—${s.stage === "ended" ? s.year + s.age : "未完"}`,
    540,
    580,
  );
  ctx.fillStyle = "#284c3b";
  ctx.font = "150px serif";
  ctx.fillText(String(s.age), 540, 810);
  ctx.font = "22px sans-serif";
  ctx.fillText("年，独一无二的人生", 540, 865);
  ctx.font = "24px serif";
  const note = s.note || "世界很大。你的一生，独一无二。";
  const lines = [];
  let line = "";
  for (const char of [...note].slice(0, 110)) {
    if (ctx.measureText(line + char).width > 790 || char === "\n") {
      lines.push(line);
      line = char === "\n" ? "" : char;
    } else line += char;
  }
  lines.push(line);
  lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, 540, 997 + i * 43));
  ctx.font = "17px sans-serif";
  ctx.fillStyle = "#748077";
  ctx.fillText(location.host, 540, 1230);
  ctx.font = "14px sans-serif";
  ctx.fillText("一个虚构的人生故事 · BIRTH", 540, 1263);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `birth-${s.seed}.png`);
  }, "image/png");
}
function about() {
  modal(
    "ABOUT THIS EXPERIMENT / 关于这个实验",
    `<h2 class="modal-title">看见别人，也重新看见自己。</h2><div class="about-text"><p>这个独立实现的人生模拟，玩法灵感来自 <a href="https://1in8b.life/en/" target="_blank" rel="noopener">1 in 8 Billion</a>。界面与交互参照公开页面，程序和美术在本仓库实现，国家统计摘录原站公开统计页并保留来源，也不与原站的纪念馆、账户或付费系统互通。</p><h3>哪些来自统计？</h3><p>今日起点覆盖 172 个国家和地区，人口、出生占比、男女预期寿命及经济社会指标摘录自原站公开国家统计页，保留页面显示的四舍五入精度。其来源包括联合国《世界人口展望2024》、UN IGME、WHO、UNESCO、世界银行等，指标年份并不完全一致。出生地按公开出生占比或人口加权抽取，在覆盖地区归一化。还可以选择 1970、1990、2010 年历史截面；2050 年为明确标注的游戏假设，不是人口预测。每一局始终沿用开局选定的统计环境。</p><h3>哪些是游戏？</h3><p>姓名、性别抽签、家庭条件、职业、收入、关系、选择与事件均是虚构规则；城市与宗教按公开统计中的列表及比例抽取。寿命使用公开统计中的婴儿、五岁前、男女预期寿命，以及 WDI 成年死亡概率作锚点，以分年龄曲线插值；可以遇到婴幼儿、未成年或高龄结局。缺失锚点用地区中位数估计，5至14岁风险仍为模型假设，未复用原站生命表。死因为虚构叙事，未按 WHO 死因比例校准。收入以人均 GDP 为游戏基数，缺失时使用收入组估计，不能视作当地实际工资。温柔模式减少普通疾病事件。页面的告别计数使用约每秒 2 人的演示值。</p><h3>你的故事，留在你这里</h3><p>完整进度、人生停顿和本地档案只存于浏览器。你可以自愿预览并公开一段已结束的虚构人生摘要；公开纪念、烛光与留言保存在本站服务器，可凭本机管理凭证撤回。没有账户和第三方分析。分享起点链接包含随机种子、抽样方式与世界设置；下载的卡片保存在你的设备。更换设备前请在「我的人生」导出档案。</p><p>数据：<a href="https://data.worldbank.org" target="_blank" rel="noopener">世界银行 WDI（CC BY 4.0）</a>，地图：<a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">Natural Earth（公共领域）</a>。<a href="https://github.com/fengbule/birth" target="_blank" rel="noopener">源代码与部署说明 ↗</a></p></div>`,
  );
}
function confirmNew() {
  if (!countries.length) {
    toast("世界数据仍在读取，请稍候再开始。");
    return;
  }
  if (current && current.stage !== "ended") {
    modal(
      "ANOTHER POSSIBILITY / 另一个起点",
      `<h2 class="modal-title">再遇见一种人生。</h2><p class="modal-description">现在的故事会保存在人生档案里，你随时可以继续它。</p><div class="modal-buttons"><button class="small-button" data-action="close">留在这里</button><button class="primary-button" data-action="confirm-birth">开启新的人生 ↗</button></div>`,
    );
  } else birth();
}
function musicToggle() {
  try {
    if (!music) {
      music = new (window.AudioContext || window.webkitAudioContext)();
      const master = music.createGain();
      master.gain.value = 0.028;
      master.connect(music.destination);
      [130.81, 196, 261.63, 329.63, 392].forEach((freq, i) => {
        const o = music.createOscillator(),
          gain = music.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        o.detune.value = i % 2 ? 3 : -3;
        gain.gain.value = 0.21;
        o.connect(gain);
        gain.connect(master);
        o.start();
        musicNodes.push(o);
      });
    }
    musicOn = !musicOn;
    if (musicOn) music.resume();
    else music.suspend();
    if (view === "game") renderGame();
    toast(musicOn ? "环境和弦已开启。" : "音乐已关闭。");
  } catch {
    toast("当前浏览器暂不支持环境音乐。");
  }
}
document.addEventListener("click", async (e) => {
  const target = e.target.closest("button,[data-memory],[data-action]");
  if (!target) return;
  if (target.matches("a[data-action]")) e.preventDefault();
  if (target.dataset.world) {
    $("#world-select").value =
      target.dataset.world === "past" ? "past-1990" : target.dataset.world;
    renderBars();
    saveSetup();
    return;
  }
  if (target.dataset.focus) {
    current.focus = target.dataset.focus;
    initSystems(current).autoFocus = false;
    save();
    renderGame();
    return;
  }
  if (target.dataset.sampling) {
    setSampling(target.dataset.sampling);
    saveSetup();
    return;
  }
  if (target.dataset.duration) {
    duration = Number(target.dataset.duration);
    document.querySelectorAll("[data-duration]").forEach((b) => {
      b.classList.toggle("selected", Number(b.dataset.duration) === duration);
      b.setAttribute("aria-pressed", Number(b.dataset.duration) === duration);
    });
    saveSetup();
    return;
  }
  if (target.dataset.speed) {
    speed = Number(target.dataset.speed);
    running = true;
    fastForward = false;
    elapsed = 0;
    renderGame();
    return;
  }
  if (target.dataset.choice !== undefined) {
    if (choose(current, Number(target.dataset.choice), countries)) {
      closeModal(true);
      save();
      renderGame();
      lastTick = performance.now();
      if (current.pending) setTimeout(()=>current.auto?autoChoose():showDecision(),0);
    }
    return;
  }
  if (target.dataset.star !== undefined) {
    const event = current.events.find(
      (x) => x.id === Number(target.dataset.star),
    );
    if (event) {
      event.star = !event.star;
      save();
      if (current.stage === "ended") archive(current);
      renderGame();
      $("[data-star='"+target.dataset.star+"']")?.focus({preventScroll:true});
    }
    return;
  }
  if (target.dataset.memory) {
    const s = history.find((s) => s.id === target.dataset.memory);
    if (s) showMemory(s);
    return;
  }
  if (target.dataset.resumeMemory) {
    const s = history.find((s) => s.id === target.dataset.resumeMemory);
    if (s) {
      if (current && current.id !== s.id && current.stage !== "ended")
        archive(current);
      current = structuredClone(s);
      history = history.filter((x) => x.id !== s.id);
      closeModal();
      save();
      renderArchives();
      if (current.stage === "registered") {
        showRegistration();
      } else {
        showGame();
        running = true;
        renderGame();
        if (decisionReady(current)) showDecision();
      }
    }
    return;
  }
  switch (target.dataset.action) {
    case "panel-collapse": {
      const index = Number(target.dataset.panel);
      if (collapsedPanels.has(index)) collapsedPanels.delete(index);
      else collapsedPanels.add(index);
      renderGame();
      $(".panel-collapse[data-panel='" + index + "']").focus({ preventScroll: true });
      break;
    }
    case "event-expand": {
      const key = current.id + ":" + target.dataset.eventid;
      if (expandedEvents.has(key)) expandedEvents.delete(key);
      else expandedEvents.add(key);
      renderGame();
      $("[data-eventid='" + target.dataset.eventid + "']").focus({ preventScroll: true });
      break;
    }
    case "choice-auto":
      current.auto = true;
      running = true;
      initSystems(current).autoFocus = true;
      suppressedDecision = null;
      renderGame();
      autoChoose();
      save();
      lastTick = performance.now();
      break;
    case "auto-stop":
      current.auto = false;
      autoPreview = null;
      save();
      renderGame();
      showDecision();
      break;
    case "game-menu": {
      const menu = $(".game-menu");
      menu.hidden = !menu.hidden;
      target.setAttribute("aria-expanded", String(!menu.hidden));
      break;
    }
    case "reflection-toggle": {
      if (current.auto) break;
      const d = initSystems(current);
      d.reflectionsEnabled = !d.reflectionsEnabled;
      if (!d.reflectionsEnabled && d.reflection !== null) remember(current, "");
      save();
      renderGame();
      break;
    }
    case "gentle-toggle":
      current.gentle = !current.gentle;
      save();
      renderGame();
      break;
    case "ending-record":
      showMemory(endingLife);
      break;
    case "ending-skip":
      if (endingPlayback?.armed) showMemory(endingLife);
      else if (endingPlayback) {
        endingPlayback.armed = true;
        revealEnding();
        target.textContent = "再点一下就会关闭";
        target.setAttribute("aria-label","再点一下就会关闭");
      }
      break;
    case "replay-ending": {
      const life = selectedMemory();
      if (life && life.stage === "ended") {
        saveNote();
        showEnding(life);
      }
      break;
    }
    case "reload":
      location.reload();
      break;
    case "birth":
      confirmNew();
      break;
    case "confirm-birth":
      birth();
      break;
    case "begin-life":
      current.stage = "living";
      running = true;
      closeModal();
      save();
      showGame();
      break;
    case "resume":
      if (current) {
        closeModal();
        if (current.stage === "registered") showRegistration();
        else {
          showGame();
          running = true;
          renderGame();
          if (decisionReady(current)) showDecision();
        }
      }
      break;
    case "home":
      if ($("#modal").open) closeModal();
      showHome();
      break;
    case "exit":
      save();
      showHome();
      break;
    case "theme":
      document.body.classList.toggle("dark");
      preferences.theme = document.body.classList.contains("dark")
        ? "dark"
        : "light";
      prefs();
      drawMap();
      break;
    case "statistics":
      if (countries.length) statistics();
      break;
    case "history":
      if (countries.length) showHistory();
      break;
    case "about":
      about();
      break;
    case "close":
      closeModal();
      break;
    case "pause":
      running = !running;
      fastForward = false;
      elapsed = 0;
      lastTick = performance.now();
      renderGame();
      if (running && decisionReady(current)) showDecision();
      break;
    case "next-year":
      running = false;
      performStep();
      break;
    case "next-choice":
      fastForward = !fastForward;
      running = fastForward;
      elapsed = 0;
      lastTick = performance.now();
      renderGame();
      break;
    case "auto":
      current.auto = !current.auto;
      if (current.auto) {
        running = true;
        initSystems(current).autoFocus = true;
        suppressedDecision = null;
      }
      save();
      if (current.auto && decisionReady(current)) autoChoose();
      renderGame();
      break;
    case "decision":
      showDecision();
      break;
    case "memorial":
      showMemory(current);
      break;
    case "rebirth":
      saveNote();
      closeModal();
      showHome();
      $("#begin").scrollIntoView({ behavior: "smooth" });
      break;
    case "save-note":
      saveNote();
      toast("这句话已留在你的人生档案里。");
      break;
    case "share":
      await share();
      break;
    case "download-card":
      await downloadCard();
      break;
    case "export":
      exportData();
      break;
    case "import":
      importData();
      break;
    case "more-events":
      timelineLimit += 30;
      renderGame();
      break;
    case "music":
      musicToggle();
      break;
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "focus-select" && current) {
    current.focus = e.target.value;
    initSystems(current).autoFocus = false;
    save();
    renderGame();
    toast("接下来的一年，会多留一点心思在这里。");
  }
  if (e.target.id === "world-select") renderBars();
  if (
    [
      "world-select",
      "origin-select",
      "gentle-mode",
      "reflection-mode",
    ].includes(e.target.id)
  )
    saveSetup();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "country-search") renderDataRows(e.target.value);
});
document.addEventListener("keydown", (e) => {
  if (["Enter", " "].includes(e.key) && e.target.matches("article[data-eventid]")) {
    e.preventDefault();
    e.target.click();
  }
  const menu = $(".game-menu");
  if (e.key === "Escape" && !$("#modal").open && menu && !menu.hidden) {
    menu.hidden = true;
    const toggle = $("[data-action=game-menu]");
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  }
});
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeModal();
  }
});
$("#modal").addEventListener("close", () => {
  if (!chosenDialogClose && current?.pending) suppressedDecision = decisionKey();
  chosenDialogClose = false;
  autoPreview = null;
  lastTick = performance.now();
});
$("#modal-content").addEventListener("click", e => {
  if (!autoPreview || e.target.closest("button,a,input,textarea,select")) return;
  suppressedDecision = decisionKey();
  autoPreview = null;
  $(".auto-preview")?.classList.remove("auto-preview");
  $(".auto-status").textContent = "这次抉择留给你。之后仍会自动选择。";
});
document.addEventListener("visibilitychange", () => {
  lastTick = performance.now();
  elapsed = 0;
  if (document.hidden) {
    save();
    if (music && musicOn) music.suspend();
  } else if (music && musicOn) music.resume().catch(() => {});
});
window.addEventListener("pagehide", save);
setInterval(() => {
  const now = performance.now(),
    delta = Math.min(1000, now - lastTick);
  lastTick = now;
  if (view === "ending" && endingPlayback && !document.hidden) {
    const playback = endingPlayback, frame = playback.frames[playback.index];
    if (frame.kind !== "final") {
      playback.elapsed += delta;
      if (playback.elapsed >= frame.duration) {
        playback.elapsed = 0;
        playback.index++;
        const next = playback.frames[playback.index];
        if (next.kind === "final") revealEnding();
        else $("#ending-stage").innerHTML = endingFrameMarkup(next,playback.life,countries);
      }
    }
    return;
  }
  if (autoPreview) {
    if (!current || autoPreview.token !== decisionKey() || !current.auto) autoPreview = null;
    else if (running && view === "game" && !document.hidden && $("#modal").open) {
      autoPreview.remaining -= delta;
      if (autoPreview.remaining <= 0) {
        const pick = autoPreview.pick;
        autoPreview = null;
        choose(current,pick,countries);
        closeModal(true);
        save();
        renderGame();
        if (current.pending) setTimeout(()=>autoChoose(),0);
      }
      return;
    }
  }
  if (
    !running ||
    view !== "game" ||
    !current ||
    current.stage !== "living" ||
    document.hidden ||
    $("#modal").open
  )
    return;
  if (initSystems(current).reflection !== null) {
    pauseForReflection();
    return;
  }
  if (decisionReady(current)) {
    fastForward = false;
    if (current.auto) autoChoose();
    return;
  }
  const interval = fastForward
    ? Math.min(1000,yearInterval(current.duration,livingCountry(current,countries).life,24))
    : yearInterval(current.duration,livingCountry(current,countries).life,speed);
  const changed = advanceClock(current,delta / interval);
  if (changed) { save(); renderTimeline(); }
  const clock = clockFor(current);
  $(".game-heading > p")?.style.setProperty("--year-progress",`${clock.fraction*100}%`);
  if (decisionReady(current)) {
    fastForward = false;
    renderGame();
    if (current.auto) autoChoose(); else showDecision();
    return;
  }
  if (clock.fraction >= 1) {
    if (current.auto && initSystems(current).autoFocus !== false && current.age >= 6) {
      const choices = focusOptions(current);
      current.focus = choices[Math.floor(random(current)*choices.length)][0];
    }
    performStep();
  }
}, 50);
let land = [],
  mapWidth = 0,
  mapHeight = 0;
function drawMap() {
  const canvas = $("#world-map");
  if (!land.length || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  mapWidth = rect.width;
  mapHeight = rect.height;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  const w = mapWidth,
    h = mapHeight * 0.91,
    project = (p) => [((p[0] + 180) / 360) * w, ((83 - p[1]) / 145) * h];
  ctx.fillStyle = getComputedStyle(document.body)
    .getPropertyValue("--green")
    .trim();
  ctx.beginPath();
  for (const g of land) {
    const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const polygon of polygons)
      for (const ring of polygon) {
        ring.forEach((p, i) => {
          const [x, y] = project(p);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.closePath();
      }
  }
  ctx.fill("evenodd");
  ctx.globalCompositeOperation = "source-in";
  ctx.beginPath();
  for (let x = 2; x < w; x += 4.5)
    for (let y = 2; y < h; y += 4.5) {
      ctx.moveTo(x + 1, y);
      ctx.arc(x, y, 0.9, 0, Math.PI * 2);
    }
  ctx.globalAlpha = 0.2;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    drawMap();
    if (view === "game") renderGame();
  }, 150);
});
async function init() {
  try {
    const [r, eraResponse] = await Promise.all([
      fetch("/data/countries.json"),
      fetch("/data/eras.json"),
    ]);
    if (!r.ok) throw Error("data");
    if (!eraResponse.ok) throw Error("historical data");
    configureEras(await eraResponse.json());
    meta = await r.json();
    countries = withReferenceCountries(meta.countries);
    if (!countries.length) throw Error("data");
    load();
    if (current) initSystems(current);
    setupDeepUI({
      getCurrent: () => current,
      getCountries: () => countries,
      getMemory: selectedMemory,
      modal,
      save,
      render: renderGame,
      close: closeModal,
      toast,
      saveNote,
      showMemory,
    });
    const opts = countries.filter(c=>referenceCountryIds.has(c.id)).sort((a, b) =>
      a.name.localeCompare(b.name, "zh-CN"),
    );
    $("#origin-select").innerHTML =
      '<option value="">让一切保持未知</option>' +
      opts
        .map(
          (c) => `<option value="${c.id}">${flag(c)} ${esc(c.name)}</option>`,
        )
        .join("");
    $("#birth-button").disabled = false;
    $("#birth-button").innerHTML = "出生";
    restoreSetup();
    renderBars();
    renderArchives();
    const start = performance.now(),
      birthsPerSecond =
        countries.reduce((a, c) => a + (c.population * c.birthRate) / 1000, 0) /
        (365.25 * 86400);
    setInterval(() => {
      const seconds = (performance.now() - start) / 1000;
      $("#born-counter").textContent = number(seconds * birthsPerSecond);
      $("#death-counter").textContent = number(seconds * 2);
    }, 1000);
    fetch("/data/land.json")
      .then((r) => {
        if (!r.ok) throw Error("map");
        return r.json();
      })
      .then((data) => {
        land = data;
        drawMap();
        if (view === "registration") {
          $(".certificate-map").insertAdjacentHTML(
            "afterbegin",
            miniMap(land, livingCountry(current, countries)),
          );
        }
      })
      .catch(() => {
        $(".map-footnote").textContent =
          "世界地图暂时无法显示，人生模拟仍可继续。";
      });
    const params = new URLSearchParams(location.search),
      seedText = params.get("seed");
    const sharedWorld = params.get("world"),
      sharedYear = Number(params.get("year"));
    if (sharedWorld === "past" && [1970, 1990, 2010].includes(sharedYear))
      $("#world-select").value = "past-" + sharedYear;
    else if (sharedWorld === "future") $("#world-select").value = "future";
    renderBars();
    if (/^[a-f0-9]{24}$/.test(params.get("memorial") || "")) {
      await openPublicMemory(params.get("memorial"));
      return;
    }
    if (
      seedText &&
      /^\d{1,10}$/.test(seedText) &&
      Number(seedText) > 0 &&
      Number(seedText) <= 4294967295
    ) {
      setSampling(
        params.get("mode") === "population" ? "population" : "births",
      );
      const seed = Number(seedText);
      modal(
        "A SHARED BEGINNING / 朋友分享的起点",
        `<h2 class="modal-title">一段人生，邀请你来。</h2><p class="modal-description">沿用朋友的出生种子，遇见同一个虚构身份。后面的路，可以由你来走。</p><button class="primary-button full-width" id="shared-birth">遇见这个人 ↗</button>`,
      );
      $("#shared-birth").addEventListener("click", () => {
        birth(seed);
        window.history.replaceState(null, "", location.pathname);
      });
    }
  } catch (e) {
    $("#load-error").classList.remove("hidden");
    $("#birth-button").textContent = "数据加载失败，请刷新";
    console.error("Birth initialization failed", e);
  }
}
init();
