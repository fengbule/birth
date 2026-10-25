import { livingCountry, initSystems, netWorth } from "./systems.js";

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const amount = (n) =>
  `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("zh-CN")}`;
const focusOptions = [
  ["work", "专注工作", "收入与职业经验"],
  ["balanced", "保持平衡", "照顾生活的不同方面"],
  ["connection", "家人与朋友", "陪伴、关系与幸福"],
  ["health", "照顾身体", "运动与健康"],
  ["study", "自我成长", "学习、知识与机会"],
  ["rest", "兴趣与休息", "为快乐留一点时间"],
];

// Original SVG artwork generated from game state. No reference-site assets.
export function scene(s, c) {
  const rural = s.home !== "城市",
    rich = c.income === "HIC",
    night = s.age >= 65;
  let shapes = "";
  const rect = (x, y, w, h, color) =>
    (shapes += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`);
  rect(0, 0, 580, 180, night ? "#839bae" : "#abd3df");
  rect(0, 95, 580, 85, "#bdcdbc");
  rect(0, 123, 580, 57, "#819d79");
  [
    [44, 24],
    [248, 12],
    [451, 36],
  ].forEach(([x, y]) => {
    rect(x, y + 8, 61, 12, "#f2f4e7");
    rect(x + 10, y, 32, 10, "#f2f4e7");
    rect(x + 42, y + 3, 12, 9, "#f2f4e7");
  });
  if (rural) {
    for (let x = 0; x < 580; x += 57) {
      rect(x, 112, 34, 7, "#a7c1a0");
      rect(x + 9, 105, 25, 8, "#a7c1a0");
    }
    rect(34, 106, 72, 49, "#d6bc86");
    for (let i = 0; i < 6; i++)
      rect(27 + i * 7, 100 - i * 6, 86 - i * 14, 7, "#947c52");
    rect(58, 123, 19, 32, "#6c6255");
    rect(84, 119, 13, 14, "#9eb9b3");
    rect(475, 84, 7, 71, "#746f57");
    rect(454, 66, 48, 33, "#60836a");
    rect(444, 78, 67, 17, "#60836a");
  } else {
    for (let i = 0; i < 7; i++) {
      const x = i * 94 - 20,
        h = 56 + ((s.seed + i * 31) % 52);
      rect(x, 140 - h, 67, h, rich ? "#abb6b4" : "#c9bda6");
      for (let y = 149 - h; y < 130; y += 16)
        for (let dx = 7; dx < 57; dx += 16) rect(x + dx, y, 8, 9, "#7e999a");
    }
  }
  rect(0, 155, 580, 25, "#8a735f");
  rect(0, 153, 580, 4, "#b5a187");
  for (let x = 10; x < 580; x += 26) {
    rect(x, 134, 4, 20, "#77684d");
  }
  rect(0, 138, 580, 3, "#a18b62");
  const skin = ["#b88660", "#dda779", "#895d49", "#c49777"][s.seed % 4];
  function person(x, y, shirt, small = false, grey = false) {
    const k = small ? 0.68 : 1;
    shapes += `<g transform="translate(${x} ${y}) scale(${k})">`;
    rect(5, 0, 19, 20, skin);
    rect(3, 0, 23, 6, grey ? "#bbb8ac" : "#3e3b36");
    rect(2, 5, 4, 10, grey ? "#bbb8ac" : "#3e3b36");
    rect(18, 10, 3, 3, "#383c38");
    rect(3, 21, 25, 28, shirt);
    rect(-1, 24, 5, 20, skin);
    rect(28, 24, 5, 20, skin);
    rect(5, 49, 8, 15, "#4d5758");
    rect(18, 49, 8, 15, "#4d5758");
    rect(3, 62, 11, 4, "#353d3b");
    rect(18, 62, 11, 4, "#353d3b");
    shapes += "</g>";
  }
  if (s.age < 18) {
    person(259, 91, "#778c8a", false, s.age > 10);
    person(302, 91, "#a47e83", false, s.age > 10);
    person(339, 112, "#b99b68", true);
  } else {
    person(278, 91, "#6b879c", false, s.age > 60);
    if (s.partner) person(320, 91, "#b0838a", false, s.age > 60);
    for (let i = 0; i < Math.min(3, s.children); i++)
      person(355 + i * 28, 115, "#ab956e", true);
  }
  return `<svg class="life-scene" viewBox="0 0 580 180" role="img" aria-label="${esc(c.name)}的${rural ? "乡村" : "城市"}与${s.age < 18 ? "成长中的家庭" : "此刻的生活"}" shape-rendering="crispEdges">${shapes}</svg>`;
}

export function miniMap(land, c) {
  if (!land.length) return "";
  let paths = "";
  for (const g of land)
    for (const p of g.type === "Polygon" ? [g.coordinates] : g.coordinates) {
      paths += `<path d="${p.map((r) => r.map(([x, y], i) => `${i ? "L" : "M"}${(((x + 180) / 360) * 480).toFixed(1)},${(((83 - y) / 145) * 195).toFixed(1)}`).join("") + "Z").join("")}"/>`;
    }
  return `<svg viewBox="0 0 480 200" role="img" aria-label="${esc(c.name)}在世界地图上的位置"><g fill="currentColor" opacity=".21" fill-rule="evenodd">${paths}</g><circle cx="${((c.lon + 180) / 360) * 480}" cy="${((83 - c.lat) / 145) * 195}" r="8" fill="none" stroke="var(--green)" stroke-width="1.5"/><circle cx="${((c.lon + 180) / 360) * 480}" cy="${((83 - c.lat) / 145) * 195}" r="2" fill="var(--green)"/></svg>`;
}

export function registrationMarkup(s, countries, land, probability, meta) {
  const c = livingCountry(s, countries),
    d = initSystems(s),
    origin = countries.find((c) => c.id === s.origin),
    seconds = Math.round((s.duration * 60) / c.life);
  return `<article class="birth-certificate"><header class="certificate-band"><h1>出生登记</h1><span>No. ${esc(c.id)}-${s.year}-${s.seed.toString().padStart(8, "0")}</span></header><div class="certificate-content"><span class="certificate-label">名字</span><h2>${esc(s.name)}</h2><p class="birth-info">${s.year} 年，你出生在${esc(c.name)}的${esc(s.home)}，一个${esc(s.familyLabel)}的家庭。你是${esc(s.sex)}孩。这段人生，正要开始。</p><p class="setting-hint">按当地平均寿命估算，约 ${s.duration} 分钟走过一生（1 年约 ${seconds} 秒）。离开时会自动暂存，回到这个浏览器可继续。</p><div class="certificate-facts">${[
    ["性别", s.sex],
    ["出生国家／地区", c.name],
    ["出生地", s.home],
    ["家境", s.familyLabel],
    [
      "父母年龄",
      d.parents.map((p) => `${p.name} ${s.age - p.bornAge} 岁`).join(" · "),
    ],
    ["最初的住处", s.housing],
    ["预期寿命", c.life.toFixed(1) + " 岁"],
    ["人均 GDP（PPP）", c.gdp ? amount(c.gdp) : "未提供"],
    [
      "统计截面",
      d.world === "future"
        ? "2050 年情景假设"
        : (d.world === "past" ? s.year : meta.year) + " 年",
    ],
  ]
    .map(
      ([label, value]) =>
        `<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`,
    )
    .join(
      "",
    )}</div><div class="certificate-map">${miniMap(land, c)}<p>${esc(c.name)}在世界上的位置</p></div><p class="birth-probability">以本次选定的抽样方式，有 <b>${(probability * 100).toFixed(2)}%</b> 的可能来到${esc(c.name)}。</p>${origin ? `<table class="birth-comparison"><caption>与你实际出生的地方相比</caption><thead><tr><th>统计起点</th><th>${esc(origin.name)}</th><th>${esc(c.name)}</th></tr></thead><tbody><tr><td>预期寿命</td><td>${origin.life.toFixed(1)} 岁</td><td>${c.life.toFixed(1)} 岁</td></tr><tr><td>人均 GDP（PPP）</td><td>${origin.gdp ? amount(origin.gdp) : "—"}</td><td>${c.gdp ? amount(c.gdp) : "—"}</td></tr></tbody></table>` : ""}<p class="certificate-note">姓名、家庭和人生经历均为虚构。群体统计不决定个人的命运。</p><div class="certificate-actions"><button class="small-button" data-action="exit">暂存并返回</button><button class="small-button" data-action="share">分享出生起点</button><button class="primary-button" data-action="begin-life">开始这一生</button></div></div></article>`;
}

export function gameMarkup({
  s,
  countries,
  running,
  speed,
  timelineLimit,
  musicOn,
}) {
  const c = livingCountry(s, countries),
    d = initSystems(s),
    birthCountry = countries.find((c) => c.id === s.country),
    ended = s.stage === "ended";
  const stats = [
    ["health", "健康"],
    ["happiness", "幸福"],
    ["knowledge", "知识"],
    ["relationships", "人际关系"],
  ];
  const curve = Array.from(
    { length: 51 },
    (_, i) => `${i * 4.4},${85 - 75 / (1 + Math.exp((i * 2.2 - c.life) / 8))}`,
  ).join(" ");
  return `<header class="game-toolbar"><div class="game-toolbar-inner"><div class="game-heading"><a href="#" data-action="exit">80亿分之1</a><div class="age-display"><strong>${s.age}</strong><span>岁</span></div><p>${s.year + s.age} 年 · ${esc(s.name)} · 1 年≈${Math.round((s.duration * 60) / c.life / speed)}秒</p></div><div class="game-controls"><button data-action="pause" aria-pressed="${!running}" ${ended ? "disabled" : ""}>${running ? "❚❚ 暂停" : "▸ 继续"}</button><div class="speed-controls">${[1, 2, 4, 8, 12, 16].map((n) => `<button data-speed="${n}" aria-pressed="${speed === n}" class="${speed === n ? "active" : ""}">${n}×</button>`).join("")}</div><button data-action="next-choice" ${ended ? "disabled" : ""}>下个选择 »</button><button class="menu-toggle" data-action="game-menu" aria-label="更多人生操作" aria-expanded="false">⋯</button><div class="game-extra-controls"><button data-action="auto" aria-pressed="${Boolean(s.auto)}">自动 ${s.auto ? "开" : "关"}</button><button data-action="music" aria-pressed="${musicOn}">♪ 音乐</button><button data-action="reflection-toggle" aria-pressed="${d.reflectionsEnabled}">✎ 停顿${d.reflectionsEnabled ? "开" : "关"}</button><button data-action="theme" aria-label="切换深色模式">◐</button><button data-action="exit">离开</button></div></div></div><div class="game-menu" hidden><button data-deep="career">工作与成长</button><button data-deep="migration">迁居世界</button><button data-deep="journal">人生停顿记录</button><button data-deep="guide">玩法指南</button><button data-action="history">前世记录与移转</button><button data-action="next-year" ${ended ? "disabled" : ""}>只过下一年</button><button data-action="gentle-toggle" aria-pressed="${s.gentle}">温柔模式 ${s.gentle ? "开" : "关"}</button></div></header>
 <div class="game-grid page-width"><aside class="profile-column"><article class="identity-card"><div class="identity-band"><span>身份纪录 · ${esc(birthCountry.id)}</span><b>${s.year}</b></div><div class="identity-body"><div class="identity-portrait" aria-hidden="true">${scene({ ...s, age: 25, partner: false, children: 0 }, c)}</div><div><h1>${esc(s.name)}</h1><dl><dt>性别</dt><dd>${esc(s.sex)}</dd><dt>出生</dt><dd>${esc(birthCountry.name)} · ${s.year}年</dd><dt>居住地</dt><dd>${esc(c.name)} · ${esc(s.home)}</dd><dt>出身家庭</dt><dd>${esc(s.familyLabel)}</dd><dt>学历</dt><dd>${esc(s.education)}</dd></dl></div></div><p class="identity-code">I&lt;${esc(birthCountry.id)}${String(s.seed).padStart(20, "0")}&lt;&lt;&lt;&lt;&lt;<br>${s.year}0101&lt;${String(
   s.id,
 )
   .replace(/[^0-9]/g, "")
   .slice(0, 18)}&lt;&lt;&lt;&lt;</p></article>
 <section class="profile-card"><h2 class="panel-title">状态 <small>0–100</small></h2><div class="profile-stats">${stats.map(([key, label]) => `<div class="stat-line"><span>${label}</span><div class="stat-track ${key}"><i style="width:${s[key]}%"></i></div><b>${Math.round(s[key])}</b></div>`).join("")}</div><details class="stat-explanation"><summary>这些状态代表什么？</summary><p>健康影响身体状况；幸福反映当下感受；知识带来学习与工作的机会；人际关系记录与他人的连结。选择和环境都会影响它们。</p></details><div class="financial-summary"><div><span>净资产（PPP）</span><b>${s.age < 18 ? "—" : amount(netWorth(s))}</b><small>${esc(s.housing)}</small></div><div><span>年收入（PPP）</span><b>${s.age < 18 ? "—" : amount(s.income)}</b><small>${esc(s.occupation)}</small></div></div></section></aside>
 <div class="life-main"><section class="scene-card">${scene(s, c)}<div class="scene-caption"><span>${esc(c.name)}的${esc(s.home)} · ${esc(s.housing)}</span><button data-deep="finance">花钱 · 投资</button></div></section><div class="compact-stats" aria-label="状态摘要">${stats.map(([key, label]) => `<div><span>${label}</span><b>${Math.round(s[key])}</b><div class="stat-track ${key}"><i style="width:${s[key]}%"></i></div></div>`).join("")}</div><section class="focus-box"><h2 class="panel-title">今年的重心 <small>随时可以更改</small></h2>${s.age < 6 ? `<p>童年 · ${esc(c.name)}</p><p>现在还是婴幼儿，正在家人的照顾中慢慢长大。六岁以后，可以选择每年的重心。</p>` : ""}<div class="focus-choices ${s.age < 6 ? "hidden" : ""}">${focusOptions.map(([id, label, hint]) => `<button data-focus="${id}" aria-pressed="${s.focus === id}" ${ended ? "disabled" : ""}><b>${label}</b><small>${hint}</small></button>`).join("")}</div><label class="focus-select-label ${s.age < 6 ? "hidden" : ""}" for="focus-select">调整年度重心<select id="focus-select" ${ended ? "disabled" : ""}>${focusOptions.map(([id, label]) => `<option value="${id}" ${s.focus === id ? "selected" : ""}>${label}</option>`).join("")}</select></label></section>
 <section class="story-column">${s.pending ? '<div class="pending-banner">有一个抉择正在等你。<button data-action="decision">重新展开</button></div>' : ""}${ended ? '<div class="pending-banner">这段人生已到终点。<button data-action="memorial">回看这一生</button></div>' : ""}<div class="timeline-heading"><h2>人生纪录</h2><span>最新的在前 · ☆ 收藏瞬间</span></div><div class="timeline">${s.events
   .slice(-timelineLimit)
   .reverse()
   .map(
     (e) =>
       `<article class="event ${e.type === "decision" ? "decision" : ""}"><span class="event-age">${e.age}岁</span><div><button class="event-star" data-star="${e.id}" aria-label="${e.star ? "取消珍藏" : "珍藏"}：${esc(e.title)}">${e.star ? "★" : "☆"}</button><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></div></article>`,
   )
   .join(
     "",
   )}</div>${s.events.length > timelineLimit ? '<button class="timeline-more" data-action="more-events">查看更早的纪录</button>' : ""}</section></div>
 <aside class="game-insights"><section class="insight-card family-overview"><h2 class="panel-title">家人与生活 <button data-deep="family">查看</button></h2>${d.parents.map((p) => `<div class="family-row"><span>${esc(p.name)}</span><div><b>${p.alive ? s.age - p.bornAge + " 岁" : "已离世"}</b><small>亲密 ${Math.round(p.closeness)}</small></div></div>`).join("")}${d.partner ? `<div class="family-row"><span>伴侣</span><div><b>${esc(d.partner.name)}</b><small>相伴 ${s.age - d.partner.since} 年</small></div></div>` : ""}${d.children.length ? `<div class="family-row"><span>孩子</span><div><b>${d.children.length} 人</b><small>${d.children.map((x) => s.age - x.bornAge + "岁").join(" · ")}</small></div></div>` : ""}</section>
 <section class="insight-card"><h2 class="panel-title">在同一秒出生的人们 <small>此刻，同样的年纪</small></h2>${s.peers
   .map((p) => {
     const pc = countries.find((c) => c.id === p.country),
       gone = s.age >= p.deathAge;
     return `<div class="peer ${gone ? "gone" : ""}"><div><b>${esc(p.name)}</b><small>${esc(pc.name)}</small></div><em>${gone ? "止于 " + p.deathAge + " 岁" : s.age + " 岁"}</em></div>`;
   })
   .join(
     "",
   )}</section><section class="insight-card"><h2 class="panel-title">人生地图 <small>一格 = 1年</small></h2><div class="life-squares">${Array.from({ length: 110 }, (_, i) => `<i class="${i < s.age ? "lived" : i === s.age ? "current" : ""}" title="${i} 岁"></i>`).join("")}</div><p class="setting-hint">已经走过 ${s.age} 年 · 当地预期寿命 ${c.life.toFixed(1)} 岁</p></section><section class="insight-card"><h2 class="panel-title">存活曲线</h2><svg class="survival-chart" viewBox="0 0 220 95" role="img" aria-label="寿命分布示意曲线"><path d="M0 85H220" stroke="var(--line)"/><polyline points="${curve}" fill="none" stroke="var(--green)" stroke-width="1.5"/></svg><p class="setting-hint">以当地预期寿命为中心的游戏示意，非真实生命表。</p><button class="text-button" data-action="share">分享出生起点 ↗</button></section></aside></div><p class="game-bottom-note page-width">统计截面：${d.world === "past" ? s.year : d.world === "future" ? "2050 游戏假设" : "2023 WDI"}。人物与事件采用独立游戏规则；完整进度只保存在浏览器。</p>`;
}

export function endingMarkup(s, countries) {
  const c = countries.find((c) => c.id === s.country),
    d = initSystems(s);
  return `<button class="ending-skip" data-action="ending-record">跳过</button><div class="ending-content"><p class="ending-eyebrow">一生，只走过一次</p><h1>${esc(s.name)}</h1><p class="ending-dates">${s.year} — ${s.year + s.age}</p><p>在${esc(c.name)}出生，走过了 ${s.age} 年。</p><p>${d.children.length ? `留下 ${d.children.length} 个孩子的牵挂。` : s.partner ? "曾与一个人，分享过生活。" : "有过相遇，也有过独自走过的日子。"}</p><h2>八十亿人之中，这一生曾经来过。</h2><button class="primary-button" data-action="ending-record">查看人生纪录</button></div>`;
}
