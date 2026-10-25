import {
  initSystems,
  livingCountry,
  worldCountries,
  netWorth,
  actionList,
  performAction,
  transact,
  migrate,
  migrationCost,
  remember,
  reflectionQuestions,
} from "./systems.js";
import { readOwners as ownerTokens } from "./ownership.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("zh-CN")}`;
let app,
  memorialPage = null,
  memorialId = null;
const $ = (s) => document.querySelector(s);
async function api(path, body, method = "POST", token) {
  const r = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "暂时无法连接纪念馆。");
  return data;
}
export function setupDeepUI(config) {
  app = config;
  document.addEventListener("click", handle);
  document.addEventListener("change", (e) => {
    if (e.target.id === "memorial-country") showMemorials();
    if (e.target.id === "migration-target") migration();
  });
  refreshCommunity();
}
export function decorateGame() {
  const s = app.getCurrent();
  if (!s) return;
  const d = initSystems(s),
    c = livingCountry(s, app.getCountries());
  const bar = document.createElement("div");
  bar.className = "game-system-bar";
  bar.innerHTML = `<div class="system-tabs"><button data-deep="family">家庭与关系</button><button data-deep="finance">消费与投资</button><button data-deep="career">工作与成长</button><button data-deep="migration">迁居世界</button><button data-deep="journal">人生停顿</button><button data-deep="guide">玩法指南 ↗</button></div><p>现居 <b>${esc(c.name)}</b> <span>·</span> 净资产 <b>${money(netWorth(s))}</b> <span>·</span> ${d.world === "past" ? s.year + " 年历史截面" : d.world === "future" ? "2050 未来情景" : "2023 年统计截面"}</p>`;
  $("#game-view .game-toolbar").after(bar);
  const panel = document.createElement("section");
  panel.className = "insight-card progress-card";
  panel.innerHTML = `<h3>一路走来的回声</h3><p>${d.milestones.length} 个人生里程碑 · ${d.moves.length} 次迁居 · ${d.journal.filter((j) => j.text).length} 句人生停顿</p><div class="milestone-tags">${
    d.milestones
      .slice(-5)
      .map((m) => `<span title="${m.age} 岁">${esc(m.title)}</span>`)
      .join("") || "<span>你的故事才刚刚开始</span>"
  }</div><button class="text-button" data-deep="guide">试试更多生活方式 ↗</button>`;
  $("#game-view .game-insights").append(panel);
}
export function pauseForReflection() {
  const s = app.getCurrent();
  if (!s || initSystems(s).reflection === null) return false;
  const age = s.deep.reflection;
  app.modal(
    "A PAUSE / 停下来，想一想",
    `<p class="choice-tag">${age} 岁 · ${s.year + age} 年</p><h2 class="modal-title">如果你就是这个人。</h2><p class="modal-description">${esc(reflectionQuestions[age])}</p><textarea id="reflection-text" class="memory-note" maxlength="500" aria-label="人生停顿的回答" placeholder="只写给自己，保存在此浏览器…"></textarea><div class="modal-buttons"><button class="small-button" data-deep="skip-reflection">这次先记在心里</button><button class="primary-button" data-deep="save-reflection">留下这句话 →</button></div>`,
  );
  return true;
}
function family() {
  const s = app.getCurrent(),
    d = initSystems(s);
  app.modal(
    "FAMILY & RELATIONSHIPS / 家庭与关系",
    `<h2 class="modal-title">那些构成你生活的人。</h2><p class="modal-description">关系需要被照顾，也会随着岁月发生变化。</p><div class="people-grid">${d.parents.map((p) => `<article class="person-card ${p.alive ? "" : "person-gone"}"><span>家人</span><h3>${esc(p.name)}</h3><p>${p.alive ? s.age - p.bornAge + " 岁" : "留在记忆里"} · 亲密 ${Math.round(p.closeness)}</p></article>`).join("")}${d.partner ? `<article class="person-card"><span>相伴 ${s.age - d.partner.since} 年</span><h3>${esc(d.partner.name)}</h3><p>亲密 ${Math.round(d.partner.closeness)} · 陪伴会改变关系</p></article>` : ""}${d.children.map((c) => `<article class="person-card"><span>${s.age - c.bornAge < 18 ? "成长中的孩子" : "已经长大的孩子"}</span><h3>${esc(c.name)}</h3><p>${s.age - c.bornAge} 岁 · 亲密 ${Math.round(c.bond)} · 教育支持 ${c.education}</p></article>`).join("")}${d.friends.map((f) => `<article class="person-card"><span>相识 ${s.age - f.since} 年</span><h3>${esc(f.name)}</h3><p>亲密 ${Math.round(f.closeness)}</p></article>`).join("")}</div><h3 class="panel-subtitle">今年，留一点时间给他们</h3>${actionButtons(["parents", "partner", "child", "friend", "childbirth", "volunteer"])}<p class="decision-footnote">每年最多安排三件主动活动，每项一年一次。虚构亲人和朋友只属于这段模拟。</p>`,
  );
}
function actionButtons(ids) {
  const s = app.getCurrent(),
    d = initSystems(s),
    actions = actionList(s, app.getCountries()).filter((a) =>
      ids.includes(a.id),
    );
  return `<div class="activity-list">${actions.map((a) => `<button class="activity-button" data-life-action="${a.id}" ${d.annual.actions.includes(a.id) || d.annual.actions.length >= 3 || a.cost > Math.max(0, s.money) || s.stage !== "living" ? "disabled" : ""}><span><b>${esc(a.title)}</b><small>${esc(a.description)}</small></span><em>${a.cost ? money(a.cost) : "投入时间"}</em></button>`).join("") || '<p class="history-note">这些选择会在你长大一些以后开放。</p>'}</div>`;
}
function finance() {
  const s = app.getCurrent(),
    d = initSystems(s),
    a = d.assets;
  app.modal(
    "SPEND & INVEST / 消费与投资",
    `<h2 class="modal-title">让生活，有一点余地。</h2><div class="balance-grid"><div><span>可用现金</span><strong>${money(s.money)}</strong></div><div><span>净资产</span><strong>${money(netWorth(s))}</strong></div><div><span>本年收入</span><strong>${money(d.annual.income)}</strong></div><div><span>生活与专项开销</span><strong>${money(d.annual.expenses)}</strong></div></div><div class="asset-lines"><p><span>稳健组合</span><b>${money(a.bonds)}</b></p><p><span>波动组合</span><b>${money(a.stocks)}</b></p><p><span>房产 / 房贷</span><b>${money(a.house)} / ${money(a.mortgage)}</b></p><p><span>本年模拟市场回报</span><b>${(d.lastMarket * 100).toFixed(1)}%</b></p></div><h3 class="panel-subtitle">重新安排手中的储备</h3><div class="trade-form"><select id="trade-type" aria-label="财务操作"><option value="bonds">配置稳健组合</option><option value="stocks">配置波动组合</option><option value="sell-bonds">赎回稳健组合</option><option value="sell-stocks">赎回波动组合</option><option value="repay">提前偿还房贷</option></select><input type="number" id="trade-amount" min="1" max="1000000000" value="${Math.max(1, Math.round(Math.max(0, s.money) * 0.1))}" aria-label="金额"><button class="small-button" data-deep="trade" ${s.age < 18 || s.stage !== "living" ? "disabled" : ""}>确认</button></div><p class="history-note">稳健组合每年模拟增长 2.5%；波动组合每年随机变化，可能亏损。现金有原模型存款收益，负现金会产生债务成本。所有金额与回报均为游戏参数。</p><h3 class="panel-subtitle">花一些时间，也花一些心思</h3>${actionButtons(["exercise", "learn", "checkup", "travel", "insurance"])}<p class="decision-footnote">主动活动：${d.annual.actions.length} / 3。本页面的投资与医疗只是虚构游戏规则。</p>`,
  );
}
function career() {
  const s = app.getCurrent(),
    d = initSystems(s);
  app.modal(
    "WORK & GROWTH / 工作与成长",
    `<h2 class="modal-title">你可以慢慢成为。</h2><div class="balance-grid"><div><span>现在的工作</span><strong class="small-value">${esc(d.career.unemployed ? "正在寻找机会" : s.occupation)}</strong></div><div><span>模拟职业等级</span><strong>${d.career.level} / 6</strong></div><div><span>工作经验</span><strong>${d.career.experience} 年</strong></div><div><span>知识储备</span><strong>${Math.round(s.knowledge)} / 100</strong></div></div><p class="modal-description">知识、教育与职业等级共同影响收入。每五年有机会晋升；失业后需要适应时间，也可以主动求职。移居的第一年收入会下降。</p><h3 class="panel-subtitle">为下一步做一点准备</h3>${actionButtons(["learn", "job", "exercise", "volunteer"])}<div class="milestone-tags">${d.milestones.map((m) => `<span>${m.age} 岁 · ${esc(m.title)}</span>`).join("")}</div>`,
  );
}
function migration() {
  const s = app.getCurrent(),
    d = initSystems(s),
    pool = worldCountries(app.getCountries(), d.world, s.year),
    previous = $("#migration-target")?.value,
    target =
      pool.find((c) => c.id === previous) ||
      pool.find((c) => c.id === "JPN" && c.id !== d.residence) ||
      pool.find((c) => c.id !== d.residence);
  app.modal(
    "ANOTHER PLACE / 在另一片土地生活",
    `<h2 class="modal-title">远方，也会变成日常。</h2><p class="modal-description">你目前生活在${esc(livingCountry(s, app.getCountries()).name)}。迁居改变经济环境，也需要路费、技能和重新适应的一年。</p><select class="data-search" id="migration-target" aria-label="迁居目的地">${pool
      .filter((c) => c.id !== d.residence)
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
      .map(
        (c) =>
          `<option value="${c.id}" ${c.id === target.id ? "selected" : ""}>${esc(c.name)}</option>`,
      )
      .join(
        "",
      )}</select><div class="balance-grid"><div><span>预计安置成本</span><strong>${money(migrationCost(s, target, app.getCountries()))}</strong></div><div><span>可用现金</span><strong>${money(s.money)}</strong></div></div><p class="history-note">成年至 75 岁、知识至少 20、现金足够时可迁居；每年一次。移居规则是游戏抽象，不代表签证或实际迁居资格。各地数据仍沿用出生时选定的统计截面。</p><button class="primary-button full-width" data-deep="move" ${s.age < 18 || s.age > 75 || s.stage !== "living" ? "disabled" : ""}>开始这次迁居 ↗</button><h3 class="panel-subtitle">走过的地方</h3><div class="journey-list">${d.moves.map((m) => `<p>${m.age} 岁 · ${esc(app.getCountries().find((c) => c.id === m.from)?.name)} → ${esc(app.getCountries().find((c) => c.id === m.to)?.name)}</p>`).join("") || "<p>故事的起点，也可以是你选择留下的地方。</p>"}</div>`,
  );
}
function journal() {
  const s = app.getCurrent(),
    d = initSystems(s);
  app.modal(
    "A PAUSE / 人生停顿",
    `<h2 class="modal-title">走慢一点，也很好。</h2><div class="setting-line"><label for="reflection-toggle">在 5、15、30、50、70 岁暂停 <span>自动模式会略过提问，记录年龄</span></label><input id="reflection-toggle" type="checkbox" role="switch" ${d.reflectionsEnabled ? "checked" : ""}></div><button class="small-button" data-deep="toggle-reflections" style="margin-top:16px">保存停顿设置</button>${d.reflection !== null ? '<button class="small-button" data-deep="reflection">回答此刻的问题 →</button>' : ""}<div class="journal-list">${
      d.journal
        .filter((j) => j.text)
        .map(
          (j) =>
            `<article><span>${j.age} 岁</span><p>${esc(j.text)}</p></article>`,
        )
        .join("") ||
      '<p class="history-note">有些问题没有标准答案。等你愿意时，可以给某个年龄的自己留一句话。</p>'
    }</div>`,
  );
}
function guide() {
  app.modal(
    "HOW A LIFE UNFOLDS / 深入玩法",
    `<h2 class="modal-title">不止是，下一年。</h2><div class="about-text"><h3>先准备，再选择</h3><p>童年把心思放在学习和陪伴上。知识影响升学、求职与迁居；关系影响亲密关系的稳定。家庭条件会影响教育机会，但不决定每次选择的结果。</p><h3>每年有三件可以主动做的事</h3><p>在「家庭与关系」「消费与投资」「工作与成长」里安排活动。免费陪伴、志愿服务也有作用。每种活动一年一次，不必把所有时间都花满。</p><h3>储备让你拥有调整的余地</h3><p>现金支持求学、迁居和失业期；房产、房贷、稳健与波动组合会持续变化。净资产包含投资和房产，并扣除房贷。只有可用现金能直接支付活动费用。</p><h3>世界不只一个起点</h3><p>开局可以选择 1970、1990、2010 年的历史数据，今日截面，或明确标注为假设的 2050 年情景。成年后可以迁居，重新适应当地经济环境。</p><h3>让人生留下回声</h3><p>开启人生停顿，收藏一个瞬间。在结束后保存卡片，或明确选择把虚构角色摘要放进公共纪念馆。完整存档始终在浏览器，公共发布只上传你预览过的摘要。</p></div>`,
  );
}
export async function refreshCommunity() {
  try {
    const data = await api("memorials");
    const count = $("#community-count");
    if (count) count.textContent = `${data.total} 段被留下的人生`;
    const list = $("#community-lives");
    if (list)
      list.innerHTML =
        data.items.slice(0, 3).map(publicCard).join("") ||
        '<p class="empty-archive">这里还没有公开的故事。一个平凡的人生，也值得被记得。</p>';
  } catch {
    if ($("#community-count"))
      $("#community-count").textContent =
        "纪念馆暂时无法连接，本地人生仍可继续";
  }
}
function publicCard(m) {
  const c = app.getCountries().find((c) => c.id === m.country);
  return `<button class="life-card" data-public-memory="${esc(m.id)}"><span class="small-index">A LIFE, REMEMBERED</span><h3>${esc(m.name)}</h3><p>${esc(c?.name || m.country)} · ${m.birth_year}—${m.birth_year + m.age} · ${m.age} 岁</p><p>${esc(m.note || m.summary)}</p><p>✧ ${m.candles} 盏烛光 · ${m.comments} 句回声</p></button>`;
}
async function showMemorials(cursor) {
  try {
    const selected = $("#memorial-country")?.value || "",
      data = await api(
        "memorials?" +
          new URLSearchParams({
            ...(selected ? { country: selected } : {}),
            ...(cursor ? { before: cursor } : {}),
          }),
      );
    memorialPage = data.next;
    app.modal(
      "THE MEMORIAL / 公共纪念馆",
      `<h2 class="modal-title">每一种人生，都被看见。</h2><p class="modal-description">${data.total} 段由玩家自愿留下的虚构人生。你可以点一盏烛光，也可以轻轻留下一句话。</p><div class="history-actions"><select id="memorial-country" class="small-button" aria-label="筛选纪念馆地区"><option value="">世界的每一个地方</option>${[
        ...app.getCountries(),
      ]
        .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
        .map(
          (c) =>
            `<option value="${c.id}" ${selected === c.id ? "selected" : ""}>${esc(c.name)}</option>`,
        )
        .join(
          "",
        )}</select><button class="small-button" data-deep="random-memorial">偶遇一段人生 ↗</button></div><div class="history-grid">${data.items.map(publicCard).join("") || '<p class="empty-archive">这个地方还没有公开的人生。</p>'}</div>${data.next ? '<button class="small-button" data-deep="more-memorials" style="margin-top:20px">更早的故事 →</button>' : ""}<p class="history-note">公共内容来自访客的自愿分享。发布者可用本机管理凭证撤回纪念及其留言。</p>`,
    );
  } catch (e) {
    app.toast(e.message);
  }
}
export async function openPublicMemory(id) {
  try {
    const m = await api("memorials/" + id);
    memorialId = id;
    const c = app.getCountries().find((c) => c.id === m.country),
      owns = Boolean(ownerTokens()[id]);
    app.modal(
      "A SHARED LIFE / 一段被记得的人生",
      `<div class="memory-card"><div class="memory-symbol">✳</div><h2>${esc(m.name)}</h2><p class="memory-dates">${m.birth_year}—${m.birth_year + m.age} · ${esc(c?.name || m.country)}</p><p class="memory-summary">${esc(m.summary)}</p>${m.note ? `<p class="public-note">“${esc(m.note)}”</p>` : ""}<div class="memory-events">${m.moments.map((e) => `<p><span>${e.age} 岁</span>${esc(e.title)}</p>`).join("")}</div></div><div class="modal-buttons"><button class="primary-button" data-deep="candle">✧ 点一盏烛光 · ${m.candles}</button><button class="small-button" data-deep="share-memorial">分享这一生 ↗</button></div><textarea id="public-message" class="memory-note" maxlength="160" placeholder="留一句温柔的话，不要填写个人联系方式…" aria-label="纪念馆留言"></textarea><button class="small-button" data-deep="public-comment">留下这句话</button><div class="journal-list">${m.messages.map((x) => `<article><p>${esc(x.text)}</p><span>${esc(x.created_at.slice(0, 10))}</span></article>`).join("")}</div>${owns ? '<button class="small-button danger-button" data-deep="confirm-delete-memorial">撤回我发布的这段人生</button>' : ""}`,
    );
  } catch (e) {
    app.toast(e.message);
  }
}
function publishPreview() {
  const s = app.getMemory();
  if (!s || s.stage !== "ended") {
    app.toast("走完这一生后，才可以选择公开。");
    return;
  }
  app.saveNote();
  app.modal(
    "SHARE WITH THE WORLD / 留在公共纪念馆",
    `<h2 class="modal-title">把这一生，轻轻留下。</h2><p class="modal-description">将公开虚构角色「${esc(s.name)}」的出生地、年份、年岁、最多五个选择标题，以及你填写的这句话。完整存档和人生停顿的回答仍留在本机。</p><div class="public-preview"><p>${esc(s.name)} · ${s.year}—${s.year + s.age} · ${esc(app.getCountries().find((c) => c.id === s.country)?.name)}</p><p>${esc(s.note || "没有留下额外的话。")}</p></div><p class="history-note">任何访客都能阅读摘要、点烛光和留言。发布后会保存本机管理凭证，凭证可撤回这段纪念。请确认留言没有真实身份或联系方式。</p><div class="modal-buttons"><button class="small-button" data-deep="cancel-publish">先保存在本机</button><button class="primary-button" data-deep="publish">确认公开这段人生 ↗</button></div>`,
  );
}
async function handle(e) {
  const button = e.target.closest("button");
  if (!button) return;
  const s = app.getCurrent();
  try {
    if (button.dataset.publicMemory) {
      await openPublicMemory(button.dataset.publicMemory);
      return;
    }
    if (button.dataset.lifeAction) {
      const r = performAction(s, button.dataset.lifeAction, app.getCountries());
      app.save();
      app.render();
      app.toast(r.message);
      if (r.ok) {
        if (
          [
            "parents",
            "partner",
            "child",
            "friend",
            "childbirth",
            "volunteer",
          ].includes(button.dataset.lifeAction)
        )
          family();
        else finance();
      }
      return;
    }
    switch (button.dataset.deep) {
      case "family":
        family();
        break;
      case "finance":
        finance();
        break;
      case "career":
        career();
        break;
      case "migration":
        migration();
        break;
      case "journal":
        journal();
        break;
      case "guide":
        guide();
        break;
      case "reflection":
        pauseForReflection();
        break;
      case "save-reflection":
        remember(s, $("#reflection-text")?.value || "");
        app.close();
        app.save();
        app.render();
        break;
      case "skip-reflection":
        remember(s, "");
        app.close();
        app.save();
        app.render();
        break;
      case "toggle-reflections": {
        const d = initSystems(s);
        d.reflectionsEnabled = $("#reflection-toggle").checked;
        if (!d.reflectionsEnabled && d.reflection !== null) remember(s, "");
        app.save();
        journal();
        app.toast("人生停顿设置已保存。");
        break;
      }
      case "trade": {
        const r = transact(
          s,
          $("#trade-type").value,
          Number($("#trade-amount").value),
          app.getCountries(),
        );
        app.save();
        app.render();
        app.toast(r.message);
        if (r.ok) finance();
        break;
      }
      case "move": {
        const r = migrate(s, $("#migration-target").value, app.getCountries());
        app.save();
        app.render();
        app.toast(r.message);
        if (r.ok) migration();
        break;
      }
      case "memorials":
        await showMemorials();
        break;
      case "more-memorials":
        await showMemorials(memorialPage);
        break;
      case "random-memorial": {
        const data = await api("memorials?random=1");
        if (data.items[0]) await openPublicMemory(data.items[0].id);
        else app.toast("还没有公开的人生。");
        break;
      }
      case "publish-preview":
        publishPreview();
        break;
      case "cancel-publish":
        app.showMemory(app.getMemory());
        break;
      case "publish": {
        const life = app.getMemory();
        if (!life || life.stage !== "ended") return;
        const tokens = ownerTokens();
        localStorage.setItem("birth.memorialOwners", JSON.stringify(tokens));
        button.disabled = true;
        const result = await api("memorials", {
          name: life.name,
          country: life.country,
          year: life.year,
          age: life.age,
          summary: `走过 ${life.age} 年，记录了 ${life.events.length} 个瞬间。${life.partner ? "曾与人相伴。" : ""}${life.children ? "曾照顾孩子成长。" : ""}`,
          note: life.note,
          moments: life.events
            .filter((e) => e.star || e.type === "decision")
            .slice(-5)
            .map(({ age, title }) => ({ age, title })),
        });
        tokens[result.id] = result.ownerToken;
        try {
          localStorage.setItem("birth.memorialOwners", JSON.stringify(tokens));
        } catch {
          await api("memorials/" + result.id, {}, "DELETE", result.ownerToken);
          throw Error(
            "本机无法保存撤回凭证，已取消本次公开。请释放浏览器存储后重试。",
          );
        }
        await openPublicMemory(result.id);
        refreshCommunity();
        break;
      }
      case "candle": {
        button.disabled = true;
        const r = await api("memorials/" + memorialId + "/candle", {});
        app.toast(r.added ? "烛光已点亮。" : "今天你已经来过了。");
        await openPublicMemory(memorialId);
        break;
      }
      case "public-comment": {
        button.disabled = true;
        await api("memorials/" + memorialId + "/comments", {
          text: $("#public-message").value,
        });
        await openPublicMemory(memorialId);
        app.toast("这句话，留在了这里。");
        break;
      }
      case "share-memorial": {
        const url = new URL(location.origin);
        url.searchParams.set("memorial", memorialId);
        try {
          await navigator.clipboard.writeText(url.href);
          app.toast("纪念馆链接已复制。");
        } catch {
          app.toast(url.href);
        }
        break;
      }
      case "confirm-delete-memorial":
        app.modal(
          "WITHDRAW A MEMORY / 撤回纪念",
          `<h2 class="modal-title">让这段故事回到本机。</h2><p class="modal-description">会删除公开摘要、烛光与留言。你的本地人生存档仍在。</p><button class="primary-button full-width" data-deep="delete-memorial">确认撤回</button>`,
        );
        break;
      case "delete-memorial": {
        const tokens = ownerTokens();
        await api("memorials/" + memorialId, {}, "DELETE", tokens[memorialId]);
        delete tokens[memorialId];
        localStorage.setItem("birth.memorialOwners", JSON.stringify(tokens));
        await showMemorials();
        refreshCommunity();
        app.toast("公开纪念已撤回。");
        break;
      }
    }
  } catch (error) {
    button.disabled = false;
    app.toast(error.message || "操作暂时没有完成，请重试。");
  }
}
