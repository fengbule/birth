import { formatMoney } from './currency.js';
import { initSystems, netWorth } from './systems.js';
import { experience, lifeReview, temperamentName } from './experience.js';
import { esc, scene } from './presentation.js';
const amount=n=>`${n<0?'−':''}$${Math.round(Math.abs(n)).toLocaleString('zh-CN')}`;
const focusNames={work:'工作',connection:'家人 · 朋友',health:'健康管理',study:'自我提升',rest:'兴趣',balanced:'均衡',help:'帮助家人',jobprep:'求职准备'};

export function deathRecordMarkup(s,countries) {
  const c=countries.find(c=>c.id===s.country),d=initSystems(s),x=experience(s),r=lifeReview(s);
  const amount=n=>formatMoney(n,s);
  const adult=s.age>=18;
  const facts=[['最高学历',s.education],['最后的工作',adult?s.occupation:'—'],
    ['在身边的人',d.partner?d.partner.name:'未婚'],['子女',d.children.length?`${d.children.length} 人`:'无'],
    ['送最后一程的人',d.partner?'家人和朋友':d.parents.some(p=>p.alive)?'父母与家人':'家人和老朋友'],
    ['最幸福的一年',r.happiest?`${r.happiest.age} 岁（${s.year+r.happiest.age} 年）`:'—'],
    ['住过的国家与地区',d.visited.map(id=>countries.find(c=>c.id===id)?.name||id).join('、')],
    ['童年的气质',x.childhoodChoice!==null?temperamentName(s):'尚未形成'],
    [s.flowVersion===2?'留下的财产（以中国大陆物价计）':'留下的财产（PPP）',adult?amount(netWorth(s)):'—']];
  const summary=`出生在${c.name}的${s.home}，在一个${s.familyLabel}的家庭里长大。${s.age>=6?`读到${s.education}。`:''}${adult?`曾经从事${s.occupation}。`:''}${s.partner?'曾与一个人一起生活。':'没有结婚。'}${d.children.length?`有${d.children.length}个孩子。`:''}${s.age}岁时，这一生走到了终点。`;
  return `<div class="record-top page-width"><button class="small-button" data-action="home">← 回到首页</button></div><article class="death-record page-width"><header class="record-band"><b>死亡纪录 · RECORD OF DEATH</b><span>No. ${esc(c.id)}-${s.year}-${String(s.age).padStart(3,'0')}</span></header><div class="record-grid"><section class="record-intro"><p class="record-country">${esc(c.name)} · ${esc(s.sex)}</p><h1>${esc(s.name)}</h1><p class="record-dates">${s.year} – ${s.year+s.age} · 享年${s.age}岁 · ${esc(c.name)}</p><p class="record-summary">${esc(summary)}</p><p class="record-cause">死因 <strong>${esc(x.cause||'疾病')}</strong></p><p class="record-context">出生地的预期寿命为 ${c.life.toFixed(1)} 岁。这一生走过 ${s.age} 年，留下 ${s.events.length} 个被记录的时刻。</p></section><section class="record-facts"><dl>${facts.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${adult?`<div class="record-focus"><h2>成年后时间花在哪里</h2><p>${Object.entries(r.focuses).map(([key,n])=>`${esc(focusNames[key]||key)}${n}年`).join(' · ')||'旧档案没有逐年重心纪录。'}</p></div><section class="record-texture"><h2>这段人生的纹理</h2><p>用四组词，回看时间与选择留下的方向。</p><h3>${r.axes[0].value>55?'认真投入工作的人':r.axes[1].value>40?'在远方寻找生活的人':'在日常里留下牵挂的人'}</h3><p>${r.occupations.length?`这段人生经历过${r.occupations.length}种工作安排。`:'每一段普通的日子，都有自己的重量。'}</p>${r.axes.map(axis=>`<div class="texture-axis"><span>${axis.left}</span><div><i style="left:${axis.value}%"></i></div><span>${axis.right}</span></div>`).join('')}<details><summary>四组词语的意思</summary><p>这些方向来自本局已记录的年度重心、迁居与选择。不同方向没有高下，一段人生也不止这几个词。</p></details></section>`:''}</section></div><div class="record-bottom"><button class="small-button" data-action="replay-ending">再看一次最后的时刻</button><section><h2>回首</h2><p>${r.happiest?`最幸福的一年是 ${r.happiest.age} 岁。`:''}${adult&&r.highestIncome?`收入最高的一年是 ${r.highestIncome.age} 岁。`:''}</p></section><section><h2>留给${esc(s.name)}的话</h2><p>会留在卡片和前世纪录中</p><textarea id="memory-note" class="memory-note" maxlength="500" aria-label="给这一生留下一句话" placeholder="给这一生，留下一句话…">${esc(s.note)}</textarea><button class="small-button" data-action="save-note">留下</button></section>${r.remembered.length?`<section><h2>珍藏的时刻</h2>${r.remembered.map(e=>`<p><span class="record-moment-age">${e.age} 岁</span>${esc(e.title)}</p>`).join('')}</section>`:''}<details class="record-all"><summary>完整人生纪录 · ${s.events.length} 个时刻</summary>${s.events.map(e=>`<article><b>${e.age} 岁 · ${esc(e.title)}</b><p>${esc(e.text)}</p></article>`).join('')}</details><div class="modal-buttons"><button class="small-button" data-action="download-card">↓ 保存人生卡片</button><button class="small-button" data-action="export">↓ 移转纪录</button><button class="small-button" data-deep="publish-preview">将摘要留在公共纪念馆</button></div></div></article><div class="record-sticky"><button class="small-button" data-deep="publish-preview">分享这一生</button><button class="primary-button" data-action="rebirth">再次出生</button></div>`;
}

export function endingFrames(s,countries) {
  const c=countries.find(c=>c.id===s.country),x=experience(s),d=initSystems(s);
  const moments=s.events.filter(e=>['birth','decision','migration','childhood','education'].includes(e.type)||e.star);
  const count=Math.min(s.age<18?5:9,moments.length);
  const selected=Array.from({length:count},(_,i)=>moments[Math.round(i*(moments.length-1)/Math.max(1,count-1))]);
  return [
    {kind:'last-year',duration:1900,title:`${s.year+s.age}年 · ${s.age}岁`,text:`${s.name}，在${c.name}走过了这一生。`,age:s.age},
    {kind:'last-moment',duration:2700,title:'最后的时刻',text:s.events.at(-2)?.text||'熟悉的日常，慢慢安静下来。',age:s.age},
    {kind:'cause',duration:2000,title:x.cause||'生命的终点',text:'这一生，走到了告别的时候。'},
    {kind:'close-eyes',duration:3000,title:'',text:''},
    ...selected.map(e=>({kind:'memory',duration:3000,title:`${e.age}岁 · ${s.year+e.age}年`,text:e.title,age:e.age})),
    {kind:'farewell',duration:3200,title:'后来，他们聚在一起',text:d.partner?'家人和朋友，记起一起走过的日子。':d.parents.some(p=>p.alive)?'父母与家人，送你最后一程。':'家人和老朋友，讲起你的故事。',age:s.age},
    ...(s.age>=18?[{kind:'legacy',duration:6000,title:'留下来的牵挂',text:d.children.length?`${d.children.length}个孩子，继续走着他们的人生。`:'那些相遇与陪伴，留在了别人的记忆里。'}]:[]),
    {kind:'last-words',duration:3000,title:'这一生曾经来过',text:'世界继续转动，有人记得你。'},
    {kind:'final',duration:0,title:s.name,text:`${s.year} – ${s.year+s.age}`},
  ];
}

export function endingMarkup(s,countries) {
  return `<button class="ending-skip" data-action="ending-skip">略过</button><div id="ending-stage" aria-live="polite"></div><div class="ending-final hidden"><h1>${esc(s.name)}</h1><p class="ending-dates">${s.year} – ${s.year+s.age}</p><p>${esc(countries.find(c=>c.id===s.country).name)}，是这一生的起点。</p><p>走过了 ${s.age} 年，约 ${Math.round(s.age*365.25).toLocaleString("zh-CN")} 个日夜。</p><h2>八十亿人之中，这一生曾经来过。</h2><button class="primary-button" data-action="ending-record">查看纪录</button></div>`;
}

export function endingFrameMarkup(frame,s,countries) {
  const c=countries.find(c=>c.id===s.country);
  return `<div class="ending-frame ${frame.kind}">${frame.age!==undefined?`<div class="ending-picture">${scene({...s,age:frame.age},c)}</div>`:''}${frame.title?`<h2>${esc(frame.title)}</h2>`:''}${frame.text?`<p>${esc(frame.text)}</p>`:''}</div>`;
}
