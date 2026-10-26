import { livingCountry, initSystems } from "./systems.js";



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
    )}</div><div class="certificate-map">${miniMap(land, c)}<p>${esc(c.name)}在世界上的位置</p></div><p class="birth-probability">以本次选定的抽样方式，有 <b>${(probability * 100).toFixed(2)}%</b> 的可能来到${esc(c.name)}。</p>${origin ? `<table class="birth-comparison"><caption>与你实际出生的地方相比</caption><thead><tr><th>统计起点</th><th>${esc(origin.name)}</th><th>${esc(c.name)}</th></tr></thead><tbody><tr><td>预期寿命</td><td>${origin.life.toFixed(1)} 岁</td><td>${c.life.toFixed(1)} 岁</td></tr><tr><td>人均 GDP（PPP）</td><td>${origin.gdp ? amount(origin.gdp) : "—"}</td><td>${c.gdp ? amount(c.gdp) : "—"}</td></tr></tbody></table>` : ""}<section class="certificate-peers"><h3>与你同时来到世界的人</h3><div class="certificate-peer-grid">${s.peers.map((p) => `<div><b>${esc(p.name)}</b><span>${esc(countries.find((c) => c.id === p.country).name)}</span></div>`).join("")}</div><p class="setting-hint">四个不同的起点，也会和这一生一起向前。</p></section><p class="certificate-note">姓名、家庭和人生经历均为虚构。群体统计不决定个人的命运。</p><div class="certificate-actions"><button class="small-button" data-action="exit">暂存并返回</button><button class="small-button" data-action="share">分享出生起点</button><button class="primary-button" data-action="begin-life">开始这一生</button></div></div></article>`;
}
