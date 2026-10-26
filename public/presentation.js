import { livingCountry, initSystems, netWorth } from "./systems.js";
import { focusOptions as lifeFocusOptions } from "./playback.js";
import { visibleRecords, decisionReady, newestFirst } from './timeline-clock.js';
import { pixelScene, portrait } from './pixel-scene.js';
import { formatMoney } from './currency.js';
import { hobbies } from './chronology.js';
import mortalityData from './data/mortality.json' with {type:'json'};
import { mortalityCurve } from "./mortality.js";

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

// Original SVG artwork generated from game state. No reference-site assets.
export const scene = pixelScene;

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
    )}</div><div class="certificate-map">${miniMap(land, c)}<p>${esc(c.name)}在世界上的位置</p></div><p class="birth-probability">以本次选定的抽样方式，有 <b>${(probability * 100).toFixed(2)}%</b> 的可能来到${esc(c.name)}。</p>${origin ? `<table class="birth-comparison"><caption>与你实际出生的地方相比</caption><thead><tr><th>统计起点</th><th>${esc(origin.name)}</th><th>${esc(c.name)}</th></tr></thead><tbody><tr><td>预期寿命</td><td>${origin.life.toFixed(1)} 岁</td><td>${c.life.toFixed(1)} 岁</td></tr><tr><td>人均 GDP（PPP）</td><td>${origin.gdp ? amount(origin.gdp) : "—"}</td><td>${c.gdp ? amount(c.gdp) : "—"}</td></tr></tbody></table>` : ""}<section class="certificate-peers"><h3>与你同时来到世界的人</h3><div class="certificate-peer-grid">${s.peers.map((p) => `<div><b>${esc(p.name)}</b><span>${esc(countries.find((c) => c.id === p.country).name)}</span></div>`).join("")}</div><p class="setting-hint">四个不同的起点，也会和这一生一起向前。</p></section><p class="certificate-note">姓名、家庭和人生经历均为虚构。群体统计不决定个人的命运。</p><div class="certificate-actions"><button class="small-button" data-action="exit">暂存并返回</button><button class="small-button" data-action="share">分享出生起点</button><button class="primary-button" data-action="begin-life">开始这一生</button></div></div></article>`;
}

export function gameMarkup({
  s,
  countries,
  running,
  speed,
  timelineLimit,
  musicOn,
  expandedEvents = new Set(),
  fastForward = false,
}) {
  const c = livingCountry(s, countries),
    d = initSystems(s),
    birthCountry = countries.find((c) => c.id === s.country),
    ended = s.stage === "ended";
  const focusOptions = lifeFocusOptions(s);
  const records=visibleRecords(s),p=s.profile;
  const city=p?.city||s.home;
  const school=s.age<6?'婴儿':s.education==='就读小学'?`小学${Math.max(1,s.age-5)}年级`:s.education==='就读国中'?`国中${s.age-11}年级`:s.education;
  const residence=`${c.name}${city==='乡村'?'的乡村':city} · ${s.home==='城市'?'公寓':'房子'} · ${s.age<18?'与父母'+(p?.siblings.length?'和兄弟姊妹'+p.siblings.length+'人':'')+'同住':s.partner?'与伴侣'+(s.children?'和孩子':'')+'同住':s.housing}`;
  const obs=mortalityData.countries[c.id]?.[d.world==='past'?s.year:2023]||{};
  const ref=c.reference;
  const countryFacts=[
    ['每年出生人数',Math.round(c.population*c.birthRate/1000/10000)+'万人'],
    ['人口',Math.round(c.population/10000).toLocaleString('zh-CN')+'万人'],
    ['平均寿命 女 / 男',`${(ref?.lifeFemale||obs.lifeFemale||c.life).toFixed(1)} / ${(ref?.lifeMale||obs.lifeMale||c.life).toFixed(1)}岁`],
    ['5岁以下儿童死亡率',Number.isFinite(ref?.u5??obs.u5)?`每1,000人中${(ref?.u5??obs.u5).toFixed(1)}人`:'—'],
    ['人均GDP（PPP）',c.gdp?'US$'+Math.round(c.gdp).toLocaleString('zh-CN'):'—'],
    ...(ref?[
      ['所得吉尼系数',ref.gini.toFixed(2)],['都市人口比例',ref.urban+'%'],['从事农业',ref.agriculture+'%'],
      ['预期受教育年数',ref.schoolYears+'年'],['高等教育粗在学率',ref.tertiary+'%'],['网路使用率',ref.internet+'%'],
      ['总生育率',ref.fertility+'人'],['孕产妇死亡率（每10万名活产）',String(ref.maternal)],
      ['HIV盛行率（15–49岁）',ref.hiv+'%'],['凶杀率（每10万人）',String(ref.homicide)],
      ['交通事故死亡（每10万人）',String(ref.roadDeaths)],['烟草使用 男 / 女',`${ref.tobaccoMale}% / ${ref.tobaccoFemale}%`],
      ['医疗费用自付比例',ref.medicalOutOfPocket+'%'],['18岁前结婚（女性）',ref.childMarriage+'%'],
      ['生活满意度（0–10）',ref.satisfaction===null?'—':ref.satisfaction.toFixed(2)],
    ]:[])
  ];
  const stats = [
    ["health", "健康"],
    ["happiness", "幸福"],
    ["knowledge", "知识"],
    ["relationships", "人际关系"],
  ];
  const survival=mortalityCurve(c,s.sex,d.world,s.year).survival;
  const curve=Array.from({length:101},(_,age)=>`${30+age*2.6},${145-125*survival[age]}`).join(' ');
  const worldLife=s.sex==='女'?75:70;
  const worldSurvival=mortalityCurve({id:'world-estimate',life:worldLife,region:'World'},s.sex).survival;
  const worldCurve=Array.from({length:101},(_,age)=>`${30+age*2.6},${145-125*worldSurvival[age]}`).join(' ');
  const chart=`<svg class="survival-chart" viewBox="0 0 310 180" role="img" aria-label="同年出生的人中仍存活的比例"><g fill="var(--muted)" font-size="10" font-family="ui-monospace,monospace">${[0,25,50,75,100].map(n=>`<path d="M30 ${145-n*1.25}H290" stroke="var(--line)" stroke-width=".6"/><text x="26" y="${148-n*1.25}" text-anchor="end">${n}%</text>`).join('')}${[0,20,40,60,80,100].map(n=>`<text x="${30+n*2.6}" y="161" text-anchor="middle">${n}</text>`).join('')}<text x="290" y="178" text-anchor="end">年龄</text></g><polygon points="30,145 ${curve} 290,145" fill="var(--green)" opacity=".08"/><polyline points="${worldCurve}" fill="none" stroke="var(--muted)" stroke-dasharray="3 3" stroke-width="1.5"/><polyline points="${curve}" fill="none" stroke="var(--green)" stroke-width="1.8"/><circle cx="${30+Math.min(s.age,100)*2.6}" cy="${145-125*survival[Math.min(s.age,100)]}" r="3" fill="var(--green)"/><text x="${Math.min(220,36+s.age*2.6)}" y="${Math.max(15,145-125*survival[Math.min(s.age,100)]-6)}" fill="var(--ink)" font-size="10">${Math.round(survival[Math.min(s.age,100)]*100)}%存活</text></svg>`;
  return `<header class="game-toolbar"><div class="game-toolbar-inner"><div class="game-heading"><a href="#" data-action="exit">80亿分之1</a><div class="age-display"><strong>${s.age}</strong><span>岁</span></div><p>${s.year + s.age} 年 · ${esc(s.name)} · 1 年≈${Math.round((s.duration * 60) / c.life / speed)}秒</p></div><div class="game-controls"><button data-action="pause" aria-pressed="${!running}" ${ended ? "disabled" : ""}>${running ? "❚❚ 暂停" : "▸ 继续"}</button><div class="speed-controls">${[1, 2, 4, 8, 12, 16].map((n) => `<button data-speed="${n}" aria-pressed="${speed === n}" class="${speed === n ? "active" : ""}">${n}×</button>`).join("")}</div><button data-action="next-choice" aria-pressed="${fastForward}" ${ended ? "disabled" : ""}>快转到下一个抉择 »</button><button class="menu-toggle" data-action="game-menu" aria-label="更多人生操作" aria-expanded="false">⋯</button><div class="game-extra-controls"><button data-action="auto" aria-pressed="${Boolean(s.auto)}">自动抉择</button><button data-action="music" aria-pressed="${musicOn}">♪ 音乐</button><button data-action="reflection-toggle" aria-pressed="${d.reflectionsEnabled}" ${s.auto?'disabled title="自动抉择时略过停顿"':''}>✎ 写下想法${d.reflectionsEnabled ? "" : "（已关闭）"}</button><button data-action="theme" aria-label="切换深色模式">◐</button><a class="feedback-link" href="https://github.com/fengbule/birth/issues/new" target="_blank" rel="noopener">提供意见</a><button data-action="exit">离开</button></div></div></div><div class="game-menu" hidden><button data-deep="career">工作与成长</button><button data-deep="migration">迁居世界</button><button data-deep="journal">人生停顿记录</button><button data-deep="guide">玩法指南</button><button data-action="history">前世记录与移转</button><button data-action="next-year" ${ended ? "disabled" : ""}>只过下一年</button><button data-action="gentle-toggle" aria-pressed="${s.gentle}">温柔模式 ${s.gentle ? "开" : "关"}</button></div></header>
 <div class="game-grid page-width"><aside class="profile-column"><article class="identity-card"><div class="identity-band"><span>身份纪录 · ${esc(birthCountry.id)}</span><b>${s.year}</b></div><div class="identity-body"><div class="identity-portrait" aria-hidden="true">${portrait(s)}</div><div><h1>${esc(s.name)}</h1><dl><dt>性别</dt><dd>${s.sex==="女"?"女性":"男性"}</dd><dt>出生</dt><dd>${esc(birthCountry.name)} · ${s.year}年${p?p.month+"月":""}</dd><dt>居住地</dt><dd>${esc(city)}, ${esc(c.name)}</dd>${p?`<dt>宗教</dt><dd>${esc(p.religion)}</dd>`:""}<dt>出身家庭</dt><dd class="family-dots" aria-label="第${p?.quintile||Math.ceil(s.family/20)}分位">${Array.from({length:5},(_,i)=>i<(p?.quintile||Math.ceil(s.family/20))?"●":"○").join("")}</dd><dt>学历</dt><dd>${esc(s.education)}</dd>${s.age>=4?`<dt>气质</dt><dd>${esc(["好奇心旺盛","活泼主动","贴心温和","坚韧耐心"][s.deep.experience?.temperament.indexOf(Math.max(...s.deep.experience.temperament))]||"逐渐形成")}</dd>`:""}${s.deep.experience?.hobby?`<dt>兴趣</dt><dd>${esc(hobbies.find(h=>h.id===s.deep.experience.hobby)?.name)}</dd>`:""}</dl></div></div><p class="identity-code">I&lt;${esc(birthCountry.id)}${String(s.seed).padStart(20, "0")}&lt;&lt;&lt;&lt;&lt;<br>${s.year}0101&lt;${String(
   s.id,
 )
   .replace(/[^0-9]/g, "")
   .slice(0, 18)}&lt;&lt;&lt;&lt;</p></article>
 <section class="profile-card"><h2 class="panel-title">状态 <small>0–100</small></h2><div class="profile-stats">${stats.map(([key, label]) => `<div class="stat-line"><span>${label}</span><div class="stat-track ${key}"><i style="width:${s[key]}%"></i></div><b>${Math.round(s[key])}</b></div>`).join("")}</div><details class="stat-explanation"><summary>这些状态代表什么？</summary><p>健康影响身体状况；幸福反映当下感受；知识带来学习与工作的机会；人际关系记录与他人的连结。选择和环境都会影响它们。</p></details><div class="financial-summary"><div><span>净资产（以中国大陆物价计）</span><b>${s.age < 6 ? "—" : formatMoney(netWorth(s),s)}</b><small>${esc(s.housing)}</small></div><div><span>年收入（以中国大陆物价计）</span><b>${s.age < 18 ? "—" : formatMoney(s.income,s)}</b><small>家境：第${p?.quintile||Math.min(5,1+Math.floor(s.family/20))}分位</small></div></div>${s.age>=6?'<button class="finance-entry" data-deep="finance">花钱 · 投资</button>':''}</section></aside>
 <div class="life-main"><section class="scene-card">${scene(s, c)}<div class="scene-caption"><button class="scene-family" data-deep="family">${esc(residence)} ▾</button>${s.age>=18?'<button data-deep="finance">花钱 · 投资</button>':''}</div></section><div class="compact-stats" aria-label="状态摘要">${stats.map(([key, label]) => `<div><span>${key==='relationships'?'关系':label}</span><b>${Math.round(s[key])}</b><div class="stat-track ${key}"><i style="width:${s[key]}%"></i></div></div>`).join("")}</div><section class="focus-box"><h2 class="panel-title">今年的重心 <small>${s.age<6?"":s.auto&&d.autoFocus!==false?"自动安排 · 点标签接管":"随时可以更改"}</small></h2>${s.age < 6 ? `<p>${esc(school)} · ${esc(city)} · ${esc(c.name)}</p><p>现在由家人抚养。童年的经历会一点一滴累积，到五岁前后，气质逐渐定型；从六岁起，可以安排每一年的重心。婴儿时期也可以用8×快转。</p>` : `<p>${esc(school)} · ${esc(city)} · ${esc(c.name)}</p><p>点下方的小标签，选择今年要把时间花在哪里。也可以让这一年照着原来的方向继续。</p>`}<div class="focus-choices ${s.age < 6 ? "hidden" : ""}">${focusOptions.map(([id, label, hint]) => `<button data-focus="${id}" aria-pressed="${s.focus === id}" ${ended ? "disabled" : ""}><b>${label}</b><small>${hint}</small></button>`).join("")}</div><label class="focus-select-label ${s.age < 6 ? "hidden" : ""}" for="focus-select">调整年度重心<select id="focus-select" ${ended ? "disabled" : ""}>${focusOptions.map(([id, label]) => `<option value="${id}" ${s.focus === id ? "selected" : ""}>${label}</option>`).join("")}</select></label></section>
 <section class="story-column">${decisionReady(s) ? '<div class="pending-banner">有一个抉择正在等你。<button data-action="decision">重新展开</button></div>' : ""}${ended ? '<div class="pending-banner">这段人生已到终点。<button data-action="memorial">回看这一生</button></div>' : ""}<div class="timeline-heading"><h2>人生纪录</h2><span>最新的在前 · 点选一行即可加☆</span></div><div class="timeline">${newestFirst(records)
   .slice(0,timelineLimit)
   .map(
     (e) =>
       `<article class="event ${["birth","decision","milestone","education"].includes(e.type) ? "major-event" : ""}" data-action="event-expand" data-eventid="${e.id}" tabindex="0" aria-expanded="${expandedEvents.has(s.id + ":" + e.id)}"><span class="event-age">${e.age}岁</span><div><p>${esc(e.text)}</p><button class="event-star" data-star="${e.id}" aria-pressed="${Boolean(e.star)}" aria-label="${e.star ? "取消珍藏" : "珍藏"}：${esc(e.title)}">${e.star ? "★ 已收藏" : "☆ 值得记住的时刻"}</button></div></article>`,
   )
   .join(
     "",
   )}</div>${records.length > timelineLimit ? '<button class="timeline-more" data-action="more-events">查看更早的纪录</button>' : ""}</section></div>
 <aside class="game-insights"><section class="insight-card family-overview"><h2 class="panel-title">家人与生活</h2>${d.parents.map((parent,i) => `<div class="family-row"><span>${esc(parent.name)}</span><div><b>${p?esc(p.parents[i])+" · ":""}${parent.alive ? s.age - parent.bornAge + "岁" : "已离世"}</b><small>${s.family<40?"务农":s.family<80?"受雇工作":"自营业"}</small></div></div>`).join("")}${p?.siblings.length?`<div class="family-row"><span>兄弟姊妹</span><div><b>${p.siblings.map(k=>(k.sex==="男"?"哥哥 ":"姊姊 ")+(s.age-k.bornAge)+"岁").join(" · ")}</b></div></div>`:""}${d.partner ? `<div class="family-row"><span>伴侣</span><div><b>${esc(d.partner.name)}</b><small>相伴 ${s.age - d.partner.since} 年</small></div></div>` : ""}${d.children.length ? `<div class="family-row"><span>孩子</span><div><b>${d.children.length} 人</b><small>${d.children.map((x) => s.age - x.bornAge + "岁").join(" · ")}</small></div></div>` : ""}</section>
 <section class="insight-card"><h2 class="panel-title">在同一秒出生的人们 <small>此刻，在同样的年纪</small></h2>${s.peers
   .map((p) => {
     const pc = countries.find((c) => c.id === p.country),
       gone = s.age >= p.deathAge;
     return `<div class="peer ${gone ? "gone" : ""}"><div><b>${esc(p.name)}</b><small>${esc(pc.name)} · ${esc(p.sex||"女")}</small></div><em>${gone ? "† " + p.deathAge + "岁" : s.age<6?"婴幼儿":s.age<18?"童年":s.age<65?"成年":"晚年"}</em></div>`;
   })
   .join(
     "",
   )}</section><section class="insight-card"><h2 class="panel-title">人生地图 <small>一格 = 1年</small></h2><div class="life-squares">${Array.from({ length: Math.max(Math.ceil(c.life/10)*10,Math.ceil((s.age+1)/10)*10) }, (_, i) => `<i class="${i < s.age ? "lived" : i === s.age ? "current" : ""} ${i === Math.floor(c.life) ? "life-expectancy" : ""}" title="${i} 岁${i === Math.floor(c.life) ? " · 当地预期寿命" : ""}"></i>`).join("")}</div><p class="setting-hint">一格 = 1年 · 颜色越鲜明，那一年越幸福<br>外框格 = ${esc(c.name)}${s.sex==='女'?'女性':'男性'}的平均寿命${c.life.toFixed(1)}岁</p></section><section class="insight-card"><h2 class="panel-title">存活曲线</h2>${chart}<p class="setting-hint">${esc(c.name)}${s.sex==='女'?'女性':'男性'}　 ┄ 世界平均（估算）</p><button class="text-button" data-action="share">分享出生起点 ↗</button></section><section class="insight-card country-overview"><h2 class="panel-title">${esc(c.name)}</h2><dl>${countryFacts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl><p class="country-source">资料来源：${ref?'联合国《世界人口展望2024》、UN IGME、WHO、UNESCO、世界银行、ILO、UNAIDS、UNODC、UNICEF、世界幸福报告。公开统计页中的部分数值包含地区估计。':'世界银行 WDI。'}<a href="https://1in8b.life/zh/c/${c.id.toLowerCase()}" target="_blank" rel="noopener">查看资料出处</a>。</p></section></aside></div><p class="game-bottom-note page-width">统计截面：${d.world === "past" ? s.year : d.world === "future" ? "2050 游戏假设" : "公开统计页 · 多来源最新可用年份"}。人物与事件采用独立游戏规则；完整进度只保存在浏览器。</p>`;
}
