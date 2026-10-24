import {
  SCHEMA,
  clamp,
  random,
  createLife,
  step,
  choose,
  decisions,
  stageName,
  validateLife,
  incomeBase,
} from "./engine.js";
import {
  configureEras,
  initSystems,
  livingCountry,
  worldCountries,
  specialDecision,
} from "./systems.js";
import {
  setupDeepUI,
  decorateGame,
  pauseForReflection,
  openPublicMemory,
} from "./deep-ui.js";
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
  duration = 5,
  running = false,
  speed = 1,
  view = "home",
  timelineLimit = 20,
  storageOK = true,
  preferences = {},
  memoryId = null;
let lastTick = performance.now(),
  elapsed = 0,
  toastTimer,
  music = null,
  musicNodes = [],
  musicOn = false;
try {
  preferences = JSON.parse(localStorage.getItem(PREF) || "{}");
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
  $("#modal-kicker").textContent = kicker;
  $("#modal-content").innerHTML = html;
  if (!$("#modal").open) $("#modal").showModal();
}
function closeModal() {
  $("#modal").close();
  lastTick = performance.now();
}
function showHome() {
  running = false;
  view = "home";
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
  const rows = worldCountries(countries, setting.world, setting.year).map(
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
function renderBars() {
  const rows = weights(),
    max = rows[0].probability;
  $("#country-bars").innerHTML = rows
    .slice(0, 7)
    .map(
      (c) =>
        `<div class="country-row"><span class="country-label"><span>${flag(c)}</span>${esc(c.name)}</span><div class="country-track"><div class="country-fill" style="width:${(c.probability / max) * 100}%"></div></div><span class="country-pct">${(c.probability * 100).toFixed(1)}%</span></div>`,
    )
    .join("");
  const setting = worldSettings();
  $("#data-description").textContent =
    `${setting.world === "past" ? setting.year : setting.world === "future" ? "2050 情景假设" : meta.year} 年${setting.world === "future" ? "游戏情景" : "世界银行数据"} · ${rows.length} 个国家和地区`;
}
function worldSettings() {
  const value = $("#world-select")?.value || "today";
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
    : `${setting.world === "past" ? setting.year : meta.year} 年世界银行 WDI 固定截面`;
}
function renderArchives() {
  const lives = history.slice(0, 3);
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
  current = createLife(countries, {
    seed: seed || bytes[0],
    mode: sampling,
    duration,
    origin: $("#origin-select").value,
    gentle: $("#gentle-mode").checked,
    ...worldSettings(),
    reflections: $("#reflection-mode").checked,
  });
  running = false;
  speed = 1;
  timelineLimit = 20;
  save();
  showRegistration();
}
function showRegistration() {
  const s = current,
    c = livingCountry(s, countries);
  modal(
    "BIRTH REGISTRATION / 出生登记",
    `<div class="birth-registration"><div class="profile-flag">${flag(c)}</div><h2>你好，${esc(s.name)}。</h2><p class="birth-info">${s.year} 年 · ${esc(c.name)} · ${esc(s.sex)}孩</p><div class="registration-grid"><div><span>你降生的地方</span><strong>${esc(c.name)} · ${esc(s.home)}</strong></div><div><span>你最初的家</span><strong>${esc(s.familyLabel)}</strong></div><div><span>当地预期寿命（${s.deep.world === "past" ? s.year : s.deep.world === "future" ? "2050 假设" : meta.year}）</span><strong>${c.life.toFixed(1)} 岁</strong></div><div><span>这次抽中该地的概率</span><strong>${(weights(s.mode, { world: s.deep.world, year: s.year }).find((x) => x.id === c.id).probability * 100).toFixed(2)}%</strong></div></div><p class="birth-quote">你还不知道，<br>怎样的世界正在等你。</p><p class="field-hint">姓名、家庭及人生经历均为虚构。预期寿命是群体统计，与你实际走过的年岁不同。</p><button class="primary-button full-width" data-action="begin-life">开始这一生 <span>→</span></button><button class="text-button" data-action="share" style="margin-top:17px">分享这个起点 ↗</button></div>`,
  );
}
function renderGame() {
  if (!current) return;
  const s = current,
    c = livingCountry(s, countries),
    isEnded = s.stage === "ended";
  const stats = [
    ["health", "健康"],
    ["happiness", "快乐"],
    ["knowledge", "知识"],
    ["relationships", "关系"],
  ];
  const events = s.events.slice(-timelineLimit).reverse();
  const curve = Array.from({ length: 51 }, (_, i) => {
    const age = i * 2.2,
      y = 1 / (1 + Math.exp((age - c.life) / 8));
    return `${i * 4.4},${85 - y * 75}`;
  }).join(" ");
  const survival = 1 / (1 + Math.exp((s.age - c.life) / 8));
  const origin = country(s.origin);
  $("#game-view").innerHTML =
    `<div class="game-toolbar"><div class="game-toolbar-left"><button data-action="exit">← 暂存并返回</button><span class="small-index">LIFE NO. ${String(s.seed).padStart(10, "0")}</span></div><div class="game-controls"><button data-action="pause" class="${running ? "active" : ""}" ${isEnded ? "disabled" : ""}>${running ? "Ⅱ 暂停" : "▶ 继续"}</button>${[1, 4, 16].map((n) => `<button data-speed="${n}" class="${speed === n ? "active" : ""}" aria-pressed="${speed === n}">${n}×</button>`).join("")}<button data-action="next-year" ${isEnded ? "disabled" : ""}>下一年</button><button data-action="next-choice" ${isEnded ? "disabled" : ""}>下个选择 ↠</button><button data-action="auto" class="${s.auto ? "active" : ""}" aria-pressed="${Boolean(s.auto)}">自动 ${s.auto ? "开" : "关"}</button><button data-action="music" aria-pressed="${musicOn}">${musicOn ? "♫" : "♪"} 音乐</button></div></div>
  <div class="game-grid"><aside class="profile-card"><div class="profile-identity"><div class="profile-flag">${flag(c)}</div><h1>${esc(s.name)}</h1><p class="profile-country">${esc(country(s.country).name)} · ${s.year} 年出生 · ${esc(s.sex)}</p><div class="age-display"><strong>${s.age}</strong><span>岁 / ${s.year + s.age}</span></div><p class="life-stage">${stageName(s.age)}</p></div><div class="profile-stats">${stats.map(([key, label]) => `<div class="stat-row"><span>${label}</span><span>${Math.round(s[key])} / 100</span></div><div class="stat-track ${key}"><i style="width:${s[key]}%"></i></div>`).join("")}<p class="field-hint">每一项状态都会随生活与选择变化。</p></div><div class="profile-meta"><div><span>家庭</span><b>${esc(s.familyLabel)}</b></div><div><span>学习</span><b>${esc(s.education)}</b></div><div><span>现在</span><b>${esc(s.occupation)}</b></div><div><span>积蓄</span><b>${money(s.money)}</b></div><div><span>年收入</span><b>${money(s.income)}</b></div><div><span>身边的人</span><b>${s.partner ? "有伴侣" : "独自生活"}${s.children ? " · " + s.children + " 个孩子" : ""}</b></div><div><span>住处</span><b>${esc(s.housing)}</b></div></div><div class="focus-box"><label for="focus-select">这一年，把心思放在…</label><select id="focus-select" ${isEnded ? "disabled" : ""}>${[
    ["balanced", "平衡生活"],
    ["health", "照顾身体"],
    ["study", "学习新知"],
    ["connection", "陪伴家人与朋友"],
    ["work", "努力工作"],
    ["rest", "休息与感受快乐"],
  ]
    .map(
      ([k, n]) =>
        `<option value="${k}" ${s.focus === k ? "selected" : ""}>${n}</option>`,
    )
    .join(
      "",
    )}</select><p>专注会逐年影响状态。金额为简化模型下的 PPP 国际元，不是实际工资或资产。</p></div></aside>
  <section class="story-column">${s.pending ? '<div class="pending-banner">人生的一个路口，正在等你。<button data-action="decision">做出选择 →</button></div>' : ""}${isEnded ? '<div class="pending-banner">这段人生已经走到终点。<button data-action="memorial">回望这一生 →</button></div>' : ""}<div class="timeline-heading"><h2>人生，慢慢发生。</h2><span>最新在前 · ☆ 珍藏这一刻</span></div><div class="timeline">${events.map((e) => `<article class="event ${e.type === "decision" ? "decision" : ""}"><div class="event-age">${s.year + e.age} &nbsp; / &nbsp; ${e.age} 岁</div><button class="event-star" data-star="${e.id}" aria-label="${e.star ? "取消珍藏" : "珍藏"}：${esc(e.title)}">${e.star ? "★" : "☆"}</button><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></article>`).join("")}</div>${s.events.length > timelineLimit ? '<button data-action="more-events" class="timeline-more">看看更早的日子 ↓</button>' : ""}</section>
  <aside class="game-insights"><section class="insight-card"><h3>与你同时降生的人</h3><p>同一个世界，相似的时间，不同的起点。</p>${s.peers
    .map((p) => {
      const pc = country(p.country),
        gone = s.age >= p.deathAge;
      return `<div class="peer ${gone ? "gone" : ""}"><span>${flag(pc)}</span><div><b>${esc(p.name)}</b><small>${esc(pc.name)}</small></div><em>${gone ? "止于 " + p.deathAge + " 岁" : s.age + " 岁"}</em></div>`;
    })
    .join(
      "",
    )}</section><section class="insight-card"><h3>一格一年，一格一生</h3><p>每一个被点亮的小格子，都是你走过的日子。</p><div class="life-squares">${Array.from({ length: 110 }, (_, i) => `<i class="${i < s.age ? "lived" : i === s.age ? "current" : ""}" title="${i} 岁"></i>`).join("")}</div><div class="map-legend"><span>0 岁</span><span>109 岁</span></div></section><section class="insight-card"><h3>时间与人生</h3><p>${esc(c.name)}的预期寿命为 ${c.life.toFixed(1)} 岁。图线仅为围绕该均值的游戏示意，非真实生命表。</p><svg class="survival-chart" viewBox="0 0 220 95" role="img" aria-label="以当地预期寿命为中心的寿命分布示意"><path d="M0 85H220" stroke="var(--line)" fill="none"/><polyline points="${curve}" fill="none" stroke="var(--green)" stroke-width="1.5"/><circle cx="${(s.age / 110) * 220}" cy="${85 - survival * 75}" r="3" fill="var(--accent)"/></svg>${origin ? `<p>你的真实出生地：${esc(origin.name)}<br>当地预期寿命 ${origin.life.toFixed(1)} 岁，与此处相差 ${Math.abs(origin.life - c.life).toFixed(1)} 年。</p>` : ""}<button class="text-button" data-action="share" style="margin-top:13px">分享这段人生 ↗</button></section></aside></div><p class="game-bottom-note">${worldSource({ world: s.deep.world, year: s.year })} · 寿命、姓名、家庭、收入及经历使用游戏模型，不是个人命运预测。${!c.gdp ? "该地 PPP 数据缺失，收入基数采用收入组的游戏估计值。" : ""} 进度自动保存在此浏览器，可在「我的人生」导出。</p>`;
  decorateGame();
}
function performStep() {
  if (!current || current.stage !== "living") return;
  if (pauseForReflection()) return;
  if (current.pending) {
    if (current.auto) autoChoose();
    else showDecision();
    return;
  }
  step(current, countries);
  save();
  renderGame();
  if (current.stage === "ended") {
    running = false;
    archive(current);
    showMemory(current);
  } else if (pauseForReflection()) return;
  else if (current.pending) {
    if (current.auto) autoChoose();
    else showDecision();
  }
}
function showDecision() {
  if (!current?.pending) return;
  const d =
    current.pending === "scene"
      ? specialDecision(current)
      : decisions.find((d) => d.age === current.pending);
  if (!d) return;
  modal(
    "A TURN IN YOUR LIFE / 人生的路口",
    `<p class="choice-tag">${current.age} 岁 · ${current.year + current.age} 年</p><h2 class="modal-title">${esc(d.title)}</h2><p class="modal-description">${esc(d.text)}</p><div class="choices">${d.choices.map((c, i) => `<button class="choice-button" data-choice="${i}"><b>${esc(c.title)} <span>↗</span></b><small>${esc(c.hint)}</small></button>`).join("")}</div><p class="decision-footnote">没有标准答案。选择会改变状态、关系与经济状况，结果也受环境和运气影响。关闭窗口后，时间会停在这里等你。</p>`,
  );
}
function autoChoose() {
  if (!current?.pending) return;
  let pick =
    current.focus === "study"
      ? 0
      : current.focus === "connection"
        ? 1
        : Math.floor(random(current) * 3);
  choose(current, pick, countries);
  save();
  renderGame();
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
    `<h2 class="modal-title">走过的路，都留在这里。</h2><p class="modal-description">${history.length} 段故事${current && current.stage !== "ended" ? "，还有一段正在发生的人生" : ""}。保存在此浏览器，可导出到其他设备。</p><div class="history-actions"><button class="small-button" data-action="export">↓ 导出全部档案</button><button class="small-button" data-action="import">↑ 导入档案</button>${current && current.stage !== "ended" ? '<button class="small-button" data-action="resume">继续当前人生 →</button>' : ""}</div><div class="history-grid">${history.map(lifeCard).join("") || '<div class="empty-archive">第一段人生，正在等待你。</div>'}</div><p class="history-note">最多保留 50 段人生。浏览器清理站点数据会删除本地进度，建议偶尔导出备份。</p>`,
  );
}
function showMemory(s) {
  memoryId = s.id;
  const c = country(s.country),
    ended = s.stage === "ended",
    notable = s.events.filter((e) => e.star || e.type === "decision").slice(-5);
  modal(
    "A LIFE, REMEMBERED / 人生的回声",
    `<div class="memory-card"><div class="memory-symbol">✳</div><h2>${esc(s.name)}</h2><p class="memory-dates">${s.year} — ${ended ? s.year + s.age : "未完"} · ${esc(c.name)} ${flag(c)}</p><p class="memory-summary">${ended ? "从第一次睁开眼睛，到最后一次看见世界。" : "故事停在了这里，但随时可以继续。"}<br>你走过了 ${s.age} 年，${s.partner ? "学会与人相伴，" : ""}${s.children ? "成为一个孩子的依靠，" : ""}也留下了属于自己的痕迹。</p><div class="memory-stats"><div><strong>${s.age}</strong><span>走过的年岁</span></div><div><strong>${s.events.length}</strong><span>被记录的瞬间</span></div><div><strong>${Math.round(s.happiness)}</strong><span>此刻的快乐</span></div></div><textarea id="memory-note" class="memory-note" maxlength="500" placeholder="给这一生，留下一句话…" aria-label="给这一生留下一句话">${esc(s.note)}</textarea><div class="memory-events">${notable.map((e) => `<p><span>${e.age} 岁</span>${esc(e.title)}</p>`).join("")}</div></div><div class="modal-buttons"><button class="small-button" data-action="save-note">保存这句话</button><button class="small-button" data-action="download-card">↓ 保存人生卡片</button></div><div class="modal-buttons">${!ended ? `<button class="primary-button" data-resume-memory="${esc(s.id)}">继续这段人生 →</button>` : ""}<button class="primary-button" data-action="rebirth">再遇见一种人生 ↗</button></div><div class="modal-buttons">${ended ? '<button class="small-button" data-deep="publish-preview">将摘要留在公共纪念馆 ↗</button>' : ""}</div><p class="history-note">${ended ? "这段人生已自动保存在本地档案。" : "这段故事还未结束。"}珍惜每一种生活，也珍惜你自己。</p>`,
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
        !data.history.every((s) => validateLife(s, countries)) ||
        (data.current !== null && !validateLife(data.current, countries))
      )
        throw Error("档案格式或版本不匹配");
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
    `<h2 class="modal-title">看见别人，也重新看见自己。</h2><div class="about-text"><p>这个独立实现的人生模拟，玩法灵感来自 <a href="https://1in8b.life/en/" target="_blank" rel="noopener">1 in 8 Billion</a>。没有复制原站源代码、美术、文字或玩家内容，也不与原站的纪念馆、账户或付费系统互通。</p><h3>哪些来自统计？</h3><p>出生地使用世界银行 WDI 2023 年人口与粗出生率加权抽取，覆盖 ${countries.length} 个有完整人口、出生率和寿命数据的国家和地区。预期寿命与人均 GDP（PPP）同样来自 WDI。人口合计约 ${(countries.reduce((a, c) => a + c.population, 0) / 1e8).toFixed(1)} 亿，估计年出生人数约 ${(countries.reduce((a, c) => a + (c.population * c.birthRate) / 1000, 0) / 1e8).toFixed(2)} 亿。还可以选择 1970、1990、2010 年历史截面；2050 年为明确标注的游戏假设，不是人口预测。每一局始终沿用开局选定的统计环境。</p><h3>哪些是游戏？</h3><p>姓名、性别抽签、家庭条件、城市或乡村、职业、收入、关系、选择与事件均是虚构规则。寿命以当地均值和简化随机分布生成，不使用真实生命表；不模拟婴儿死亡、战争、暴力或自伤。收入以人均 GDP 为游戏基数，缺失时使用收入组估计，不能视作当地实际工资。温柔模式减少普通疾病事件。页面的告别计数使用约每秒 2 人的演示值。</p><h3>你的故事，留在你这里</h3><p>完整进度、人生停顿和本地档案只存于浏览器。你可以自愿预览并公开一段已结束的虚构人生摘要；公开纪念、烛光与留言保存在本站服务器，可凭本机管理凭证撤回。没有账户和第三方分析。分享起点链接包含随机种子、抽样方式与世界设置；下载的卡片保存在你的设备。更换设备前请在「我的人生」导出档案。</p><p>数据：<a href="https://data.worldbank.org" target="_blank" rel="noopener">世界银行 WDI（CC BY 4.0）</a>，地图：<a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">Natural Earth（公共领域）</a>。<a href="https://github.com/fengbule/birth" target="_blank" rel="noopener">源代码与部署说明 ↗</a></p></div>`,
  );
}
function confirmNew() {
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
  const target = e.target.closest("button,[data-memory]");
  if (!target) return;
  if (target.dataset.sampling) {
    setSampling(target.dataset.sampling);
    return;
  }
  if (target.dataset.duration) {
    duration = Number(target.dataset.duration);
    document.querySelectorAll("[data-duration]").forEach((b) => {
      b.classList.toggle("selected", Number(b.dataset.duration) === duration);
      b.setAttribute("aria-pressed", Number(b.dataset.duration) === duration);
    });
    return;
  }
  if (target.dataset.speed) {
    speed = Number(target.dataset.speed);
    elapsed = 0;
    renderGame();
    return;
  }
  if (target.dataset.choice !== undefined) {
    if (choose(current, Number(target.dataset.choice), countries)) {
      closeModal();
      save();
      renderGame();
      lastTick = performance.now();
      elapsed = 0;
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
        if (current.pending) showDecision();
      }
    }
    return;
  }
  switch (target.dataset.action) {
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
          if (current.pending) showDecision();
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
      elapsed = 0;
      lastTick = performance.now();
      renderGame();
      if (running && current.pending) showDecision();
      break;
    case "next-year":
      running = false;
      performStep();
      break;
    case "next-choice":
      running = false;
      for (
        let i = 0;
        i < 111 &&
        current.stage === "living" &&
        !current.pending &&
        initSystems(current).reflection === null;
        i++
      )
        step(current, countries);
      save();
      renderGame();
      if (current.stage === "ended") {
        archive(current);
        showMemory(current);
      } else if (!pauseForReflection()) showDecision();
      break;
    case "auto":
      current.auto = !current.auto;
      save();
      if (current.auto && current.pending) autoChoose();
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
    save();
    toast("接下来的一年，会多留一点心思在这里。");
  }
  if (e.target.id === "world-select") renderBars();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "country-search") renderDataRows(e.target.value);
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
  lastTick = performance.now();
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
  if (current.pending) {
    if (current.auto) autoChoose();
    return;
  }
  elapsed += delta;
  const interval =
    (current.duration * 60000) / livingCountry(current, countries).life / speed;
  if (elapsed >= interval) {
    elapsed = 0;
    performStep();
  }
}, 160);
let land = [],
  mapFrame = 0,
  mapPoints = [],
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
  ctx.globalAlpha = 0.32;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  mapPoints = countries
    .filter((c) => c.lat && c.lon && c.birthRate > 0)
    .map((c) => ({ ...c, point: project([c.lon, c.lat]) }));
  mapFrame = 0;
}
function animateMap() {
  if (
    !matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !document.hidden &&
    view === "home" &&
    land.length
  ) {
    const canvas = $("#world-map"),
      ctx = canvas.getContext("2d");
    if (mapFrame % 100 === 0) drawMap();
    mapFrame++;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    ctx.save();
    ctx.scale(ratio, ratio);
    const top = mapPoints.filter((c) => c.population * c.birthRate > 2e9);
    for (let i = 0; i < Math.min(10, top.length); i++) {
      const c = top[(i * 7) % top.length],
        t = ((mapFrame + i * 11) % 100) / 100;
      ctx.beginPath();
      ctx.arc(
        c.point[0],
        c.point[1],
        1.6 + Math.sin(t * Math.PI) * 1.7,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = i % 3 === 0 ? "#b16c4d" : "#597b5a";
      ctx.fill();
    }
    ctx.restore();
  }
  requestAnimationFrame(animateMap);
}
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawMap, 150);
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
    countries = meta.countries;
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
    const opts = [...countries].sort((a, b) =>
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
    $("#birth-button").innerHTML = "让这一生，发生 <span>↗</span>";
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
        animateMap();
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
