// The demographic inputs are real. The rules below are deliberately a game,
// not an actuarial, economic, medical, or individual life prediction model.
import { appendRecord } from "./records.js";
import { experience, recordYear, temperamentName } from "./experience.js";
import { activateQueuedEvent, queuedDecision, resolveQueuedEvent } from "./life-events.js";
import { sampleLifetime } from "./mortality.js";
import { initChronology, chronologyYear, chronologyDecision, resolveChronology, validChronology } from './chronology.js';
import { scheduleYear, validClock } from './timeline-clock.js';
import coverage from './data/reference-coverage.json' with {type:'json'};
import { referenceCountry } from './reference-data.js';
export const referenceCountryIds = new Set(coverage.countryIds);
import {
  initSystems,
  livingCountry,
  worldCountries,
  yearSystems,
  afterChoice,
  resolveScene,
  validateSystems,
  specialDecision as specialDecisionFor,
} from "./systems.js";
export const SCHEMA = 1;
export const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
export function random(state) {
  let t = (state.rng += 0x6d2b79f5);
  state.rng >>>= 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function weightedCountry(countries, mode, state) {
  if (!countries.length) throw Error("No countries");
  const weight = (c) =>
    c.population * (mode === "population" ? 1 : c.birthRate / 1000);
  let draw = random(state) * countries.reduce((a, c) => a + weight(c), 0);
  for (const c of countries) {
    draw -= weight(c);
    if (draw < 0) return c;
  }
  return countries.at(-1);
}
const names = {
  CN: [
    ["林知远", "陈子安", "李明川", "周予宁"],
    ["林初夏", "陈安然", "李知微", "周清和"],
  ],
  IN: [
    ["阿拉夫", "维翰", "阿琼", "伊尚"],
    ["阿迪娅", "安雅", "米拉", "迪娅"],
  ],
  JP: [
    ["悠人", "莲", "阳翔"],
    ["结衣", "凛", "阳葵"],
  ],
  KR: [
    ["俊宇", "志浩", "道允"],
    ["瑞妍", "智友", "夏恩"],
  ],
  NG: [
    ["奇迪", "奥卢", "埃梅卡"],
    ["阿米娜", "阿达", "奇奥玛"],
  ],
  BR: [
    ["卢卡斯", "加布里埃尔", "佩德罗"],
    ["安娜", "玛丽亚", "朱莉娅"],
  ],
  US: [
    ["诺亚", "利亚姆", "奥利弗"],
    ["艾玛", "奥利维娅", "夏洛特"],
  ],
  FR: [
    ["路易", "加布里埃尔", "亚瑟"],
    ["露易丝", "艾玛", "爱丽丝"],
  ],
  DE: [
    ["本", "保罗", "埃米尔"],
    ["米娅", "艾米莉亚", "汉娜"],
  ],
  RU: [
    ["亚历山大", "米哈伊尔", "伊万"],
    ["索菲娅", "玛丽亚", "安娜"],
  ],
  ID: [
    ["阿迪", "里兹基", "布迪"],
    ["普特丽", "阿尤", "萨丽"],
  ],
  PK: [
    ["阿里", "哈桑", "奥马尔"],
    ["阿伊莎", "法蒂玛", "玛丽亚姆"],
  ],
  BD: [
    ["拉菲", "哈桑", "伊姆兰"],
    ["努尔", "法蒂玛", "阿伊莎"],
  ],
  ES: [
    ["马特奥", "乌戈", "马丁"],
    ["卢西亚", "索菲娅", "玛蒂娜"],
  ],
};
const regional = {
  "Sub-Saharan Africa": [
    ["科菲", "萨穆埃尔", "达维德", "穆萨"],
    ["阿玛拉", "艾莎", "恩雅", "伊曼"],
  ],
  "Middle East, North Africa, Afghanistan & Pakistan": [
    ["优素福", "阿米尔", "哈桑"],
    ["莱拉", "努尔", "萨拉"],
  ],
  "Middle East & North Africa": [
    ["优素福", "阿米尔", "哈桑"],
    ["莱拉", "努尔", "萨拉"],
  ],
  "South Asia": [
    ["阿琼", "拉胡尔", "纳文"],
    ["普丽娅", "米拉", "阿妮卡"],
  ],
  "Latin America & Caribbean": [
    ["马特奥", "圣地亚哥", "迭戈"],
    ["索菲娅", "瓦伦蒂娜", "露娜"],
  ],
  "East Asia & Pacific": [
    ["安", "凯", "明"],
    ["梅", "琳", "莉娜"],
  ],
};
function nameFor(country, sex, state) {
  const list = (names[country.code] ||
    regional[country.region] || [
      ["亚历克斯", "诺亚", "丹尼尔", "卢卡"],
      ["艾米", "索菲亚", "莉娜", "艾拉"],
    ])[sex === "女" ? 1 : 0];
  return list[Math.floor(random(state) * list.length)];
}
export function incomeBase(c) {
  return (
    c.gdp || { HIC: 50000, UMC: 18000, LMC: 6000, LIC: 2000 }[c.income] || 8000
  );
}
export function estimatedLifetime(country, state, sex = "男", world = "today", year = 2023) {
  return sampleLifetime(country,sex,random(state),world,year);
}
export function createLife(countries, options = {}) {
  const seed = Number(options.seed) >>> 0 || 1;
  const s = {
    schema: SCHEMA,
    flowVersion: options.flowVersion === 1 ? 1 : 2,
    id: `${seed}-${options.createdAt || Date.now()}`,
    seed,
    rng: seed,
    createdAt: options.createdAt || Date.now(),
    year: options.year || 2026,
    age: 0,
    mode: options.mode || "births",
    duration: [5, 15, 30, 60, 90].includes(options.duration)
      ? options.duration
      : 60,
    gentle: options.gentle !== false,
    origin: options.origin || "",
    stage: "registered",
    focus: "balanced",
    health: 87,
    happiness: 70,
    knowledge: 0,
    relationships: 75,
    money: 0,
    income: 0,
    education: "尚未入学",
    occupation: "探索世界",
    partner: false,
    children: 0,
    housing: "与家人同住",
    salaryFactor: 1,
    livingCost: 0.76,
    events: [],
    peers: [],
    pending: null,
    note: "",
    auto: false,
  };
  const available = worldCountries(countries, options.world || "today", s.year);
  const covered = s.flowVersion===2 && countries.length>1 ? available.filter(c=>referenceCountryIds.has(c.id)) : available;
  const pool = (covered.length ? covered : available).map(c=>s.flowVersion===2 && (!options.world||options.world==='today')?referenceCountry(c):c);
  const c = weightedCountry(pool, s.mode, s);
  s.country = c.id;
  s.sex = random(s) < 0.488 ? "女" : "男";
  s.name = nameFor(c, s.sex, s);
  s.family = Math.round(random(s) * 100);
  s.health = Math.round(58 + random(s) * 28);
  s.happiness = Math.round(40 + random(s) * 35);
  s.knowledge = Math.round(35 + random(s) * 30);
  s.relationships = Math.round(35 + random(s) * 35);
  s.deathAge = estimatedLifetime(c, s, s.sex, options.world, s.year);
  s.familyLabel =
    s.family < 22
      ? "经济拮据"
      : s.family < 70
        ? "普通家庭"
        : s.family < 91
          ? "生活宽裕"
          : "家境优渥";
  s.home = random(s) < 0.56 ? "城市" : "乡村";
  s.schoolQuality = clamp(Math.log10(incomeBase(c) / 700) * 29 + 30, 20, 93);
  for (let i = 0; i < 4; i++) {
    const p = weightedCountry(pool, "births", s),
      sex = random(s) < 0.488 ? "女" : "男";
    s.peers.push({
      country: p.id,
      name: nameFor(p, sex, s),
      deathAge: estimatedLifetime(p, s, sex, options.world, s.year),
    });
  }
  initSystems(s, { ...options, reflections: options.reflections === true });
  experience(s);
  recordYear(s);
  addEvent(
    s,
    "第一次与世界相遇",
    `你在${c.name}的一个${s.home}家庭降生。你还不知道世界有多大，家人的怀抱就是全部。`,
    "birth",
  );
  initChronology(s,c,()=>random(s));
  if(s.flowVersion===2) scheduleYear(s,s.events);
  return s;
}
export function addEvent(s, title, text, type = "life") {
  return appendRecord(s, title, text, type);
}
export const decisions = [
  {
    age: 2,
    title: "两岁，第一次主动探索",
    text: "熟悉的家门外，有许多从未见过的事物。这个孩子会怎样迈出自己的脚步？童年经历会慢慢留下气质的痕迹。",
    choices: [
      {title:"停下来研究新鲜的小东西",hint:"好奇与专注",effect:{knowledge:2},result:"你会为了一个小小的发现，安静地看上许久。"},
      {title:"跑到前面，试试自己能做什么",hint:"活力与主动",effect:{health:2,happiness:2},result:"世界很大，你总想先跑过去看一看。"},
      {title:"留意身边的人，走过去陪伴",hint:"体贴与连结",effect:{relationships:3},result:"你开始觉察别人的心情，也学着把温柔递出去。"},
      {title:"遇到挫折后，再自己尝试一次",hint:"耐心与韧性",effect:{happiness:2},result:"你没有马上放弃，慢慢找到了自己的办法。"},
    ],
  },
  {
    age: 6,
    legacy: true,
    title: "世界，从一间教室开始",
    text: "你到了入学的年纪。家人想知道，你希望怎样度过课后的时光。",
    choices: [
      {
        title: "多留一点时间读书",
        hint: "知识 +8，快乐 −2",
        effect: { knowledge: 8, happiness: -2 },
        result: "你在旧书和作业本之间，发现了一个更大的世界。",
      },
      {
        title: "和邻居家的孩子一起玩",
        hint: "关系 +8，快乐 +5",
        effect: { relationships: 8, happiness: 5 },
        result: "放学后的路很短，你们却总能走到天黑。",
      },
      {
        title: "帮家里做一些事",
        hint: "关系 +5，家庭支持增加，知识 +2",
        effect: { relationships: 5, knowledge: 2, family: 5 },
        result: "你学会了照顾家人，也早早懂得了生活的重量。",
      },
    ],
  },
  {
    age: 7,
    title: "七岁，发现喜欢做的事",
    text: "放学后的时间渐渐属于你自己。一个小小的兴趣，可能陪伴你好多年。",
    choices: [
      {title:"读书、提问，弄懂新事物",hint:"学习与好奇",effect:{knowledge:8},result:"你为自己的问题找到了更多答案，也发现了新的问题。"},
      {title:"画画、唱歌，试着表达自己",hint:"创作与感受",effect:{happiness:7,knowledge:3},result:"你开始把看到的世界，变成自己的画面和声音。"},
      {title:"和朋友到户外活动",hint:"运动与友谊",effect:{health:5,relationships:5},result:"在一起玩耍的日子里，你找到了小小的快乐。"},
    ],
  },
  {
    age: 12,
    title: "心里的一颗小种子",
    text: "你渐渐有了自己的兴趣。一位老师说，不用急着决定未来，可以先试一试。",
    choices: [
      {
        title: "探索科学与技术",
        hint: "知识 +12，职业潜力提高",
        effect: { knowledge: 12, salaryFactor: 0.12 },
        result: "你把问题写满笔记本。每找到一个答案，又冒出三个新问题。",
      },
      {
        title: "画画、写作，或者音乐",
        hint: "快乐 +10，知识 +5",
        effect: { happiness: 10, knowledge: 5 },
        result: "你开始用自己的方式，记录别人没有留意的细节。",
      },
      {
        title: "加入一支运动队",
        hint: "健康 +10，关系 +8",
        effect: { health: 10, relationships: 8 },
        result: "训练很累，但有人并肩奔跑的感觉很好。",
      },
    ],
  },
  {
    age: 16,
    title: "在更远的地方看见自己",
    text: "求学的机会与家庭的需要，同时摆在眼前。没有一条路适合所有人。",
    choices: [
      {
        title: "认真备考，争取继续升学",
        hint: "知识 +14，快乐 −4",
        effect: { knowledge: 14, happiness: -4 },
        set: { education: "高中" },
        result: "你把未来写在课桌的一角，开始为那张录取通知书努力。",
      },
      {
        title: "学习一门实用手艺",
        hint: "知识 +6，职业潜力提高",
        effect: { knowledge: 6, salaryFactor: 0.13 },
        set: { education: "职业教育", occupation: "学徒" },
        result: "工具在手中慢慢变得熟悉。你发现，把一件事做好也很有力量。",
      },
      {
        title: "先帮家人分担生活",
        hint: "关系 +12，提前开始工作",
        effect: { relationships: 12, money: 400 },
        set: { education: "基础教育", occupation: "初入职场" },
        result:
          "你比同龄人早一些进入职场。第一笔收入交到家人手上时，你很自豪。",
      },
    ],
  },
  {
    age: 18,
    title: "十八岁，路口的风",
    text: "独立的生活开始了。继续学习需要付出时间和费用，也可能打开新的门。",
    choices: [
      {
        title: "申请大学或奖学金",
        hint: "录取取决于知识、教育资源与运气；可能产生学费支出",
        special: "university",
      },
      {
        title: "直接进入职场",
        hint: "开始获得收入，关系 +3",
        effect: { relationships: 3 },
        set: { occupation: "初入职场" },
        result: "第一天上班，你提早到了二十分钟。世界忽然变得具体起来。",
      },
      {
        title: "边工作边自学",
        hint: "知识 +8，健康 −3，开始工作",
        effect: { knowledge: 8, health: -3 },
        set: { occupation: "半工半读", education: "在职学习" },
        result: "白天工作，夜里学习。日子忙碌，你仍为自己留着一种可能。",
      },
    ],
  },
  {
    age: 23,
    title: "把时间，交给怎样的工作",
    text: "你开始思考工作的意义。薪水、安全感与热爱，有时不在同一个方向。",
    choices: [
      {
        title: "争取更有挑战的岗位",
        hint: "收入潜力提高，健康 −4",
        effect: { salaryFactor: 0.38, health: -4, knowledge: 5 },
        set: { occupation: "专业技术人员" },
        result: "你接下了更复杂的工作，也拥有了更大的成长空间。",
      },
      {
        title: "选择一份稳定的工作",
        hint: "收入潜力小幅提高，快乐 +5",
        effect: { salaryFactor: 0.12, happiness: 5 },
        set: { occupation: "稳定受雇" },
        result: "规律的日子让你安心。你开始有余力安排生活。",
      },
      {
        title: "试着经营自己的小事业",
        hint: "可能成功，也可能亏损",
        special: "business",
      },
    ],
  },
  {
    age: 27,
    title: "有一个人，想多认识你一点",
    text: "在一些普通的日子里，你与一个人慢慢靠近。你也开始思考，自己想要怎样的关系。",
    choices: [
      {
        title: "认真经营这段感情",
        hint: "关系 +12，快乐 +8，建立伴侣关系",
        effect: { relationships: 12, happiness: 8 },
        set: { partner: true },
        result: "你们没有隆重的誓言，却开始把对方放进未来的计划里。",
      },
      {
        title: "先照顾好自己",
        hint: "健康 +6，快乐 +4",
        effect: { health: 6, happiness: 4 },
        result: "你选择慢一点，把独处过成一种自在。",
      },
      {
        title: "把更多时间留给朋友",
        hint: "关系 +10，快乐 +6",
        effect: { relationships: 10, happiness: 6 },
        result: "你发现，家也可以由那些愿意倾听你的人组成。",
      },
    ],
  },
  {
    age: 32,
    title: "一扇属于自己的窗",
    text: "你想让生活安定下来。住房的选择，也会影响接下来许多年的开销。",
    choices: [
      {
        title: "为一处小房子付首付",
        hint: "需要一定积蓄；住房开销增加",
        special: "house",
      },
      {
        title: "继续租住，把日子过好",
        hint: "快乐 +5，保持灵活",
        effect: { happiness: 5 },
        set: { housing: "租住的小家" },
        result: "房子不大，但你选了喜欢的窗帘。清晨的光，让它像一个家。",
      },
      {
        title: "和家人互相照应",
        hint: "关系 +8，生活支出减少",
        effect: { relationships: 8 },
        set: { housing: "与家人相伴", livingCost: 0.65 },
        result: "一起吃饭的餐桌有点挤，却常常充满笑声。",
      },
    ],
  },
  {
    age: 36,
    title: "家的形状",
    text: "你开始想象未来的家庭。成为父母是一种选择，照顾好自己的人生也是。",
    choices: [
      {
        title: "迎接一个新生命或领养孩子",
        hint: "快乐 +8，关系 +10，家庭开销增加",
        effect: { happiness: 8, relationships: 10, children: 1 },
        set: { livingCost: 0.9 },
        result:
          "家里多了一双好奇的眼睛。你第一次意识到，自己也成了别人的整个世界。",
      },
      {
        title: "保持现在的生活",
        hint: "健康 +5，快乐 +6",
        effect: { health: 5, happiness: 6 },
        result: "你珍惜眼前的节奏。人生不必拥有同一种完整。",
      },
      {
        title: "用时间陪伴社区里的孩子",
        hint: "关系 +12，快乐 +7",
        effect: { relationships: 12, happiness: 7 },
        result: "你定期去做志愿者。有人开始期待你的到来。",
      },
    ],
  },
  {
    age: 43,
    title: "忙碌之中，留一点空白",
    text: "责任越来越多，你常常觉得一天不够用。也许该重新决定，什么值得花时间。",
    choices: [
      {
        title: "继续向事业的高处走",
        hint: "收入潜力提高，健康 −8，关系 −5",
        effect: { salaryFactor: 0.35, health: -8, relationships: -5 },
        result: "你得到了更大的舞台。某些夜晚，也会想起错过的晚餐。",
      },
      {
        title: "把周末还给家人与朋友",
        hint: "关系 +14，快乐 +8",
        effect: { relationships: 14, happiness: 8 },
        result: "你开始关掉工作消息。那些平常的下午，后来都成了珍贵的记忆。",
      },
      {
        title: "学一件毫无功利的新东西",
        hint: "知识 +10，快乐 +10",
        effect: { knowledge: 10, happiness: 10 },
        result: "原来到了这个年纪，仍然可以笨拙地开始，快乐地进步。",
      },
    ],
  },
  {
    age: 52,
    title: "身体寄来的一封信",
    text: "你比从前更容易感到疲惫。一次普通的体检，让你开始认真看待自己的身体。",
    choices: [
      {
        title: "建立运动和体检的习惯",
        hint: "健康 +15，支出相当于半个月收入",
        effect: { health: 15 },
        special: "checkup",
      },
      {
        title: "调整工作节奏，休息一阵",
        hint: "健康 +10，快乐 +6，收入潜力略减",
        effect: { health: 10, happiness: 6, salaryFactor: -0.1 },
        result: "你终于睡了几个好觉，也有空慢慢吃一顿早餐。",
      },
      {
        title: "目前还能应付，先忙完再说",
        hint: "收入潜力略增，健康 −8",
        effect: { health: -8, salaryFactor: 0.08 },
        result: "你把提醒放到了一边。日子继续忙碌，只是身体需要更多照顾。",
      },
    ],
  },
  {
    age: 62,
    title: "人生，开始有另一种速度",
    text: "回头看，你已经走了很远。接下来的时间，可以试着按自己的心意安排。",
    choices: [
      {
        title: "退休，开始缓慢的生活",
        hint: "领取模拟退休收入，健康 +8，快乐 +8",
        effect: { health: 8, happiness: 8 },
        set: { occupation: "退休", retired: true },
        result: "闹钟不再是每天必须回应的声音。你慢慢找到了新的生活秩序。",
      },
      {
        title: "继续做些喜欢的工作",
        hint: "收入潜力略减，知识 +4",
        effect: { salaryFactor: -0.1, knowledge: 4 },
        set: { occupation: "资深工作者" },
        result: "你留下的不只是经验，也是一种面对工作的耐心。",
      },
      {
        title: "把经验分享给年轻人",
        hint: "退休，关系 +14，快乐 +10",
        effect: { relationships: 14, happiness: 10 },
        set: { occupation: "社区志愿者", retired: true },
        result: "年轻人带着问题来找你。你也从他们身上，重新看见了世界。",
      },
    ],
  },
  {
    age: 72,
    title: "那些始终留在心里的人",
    text: "旧相册里，有些面孔很久没有见过了。你想起许多没说出口的话。",
    choices: [
      {
        title: "给老朋友打一个电话",
        hint: "关系 +15，快乐 +10",
        effect: { relationships: 15, happiness: 10 },
        result: "电话接通的那一刻，几十年的时光，忽然只隔着一句问候。",
      },
      {
        title: "把自己的故事写下来",
        hint: "知识 +6，快乐 +8",
        effect: { knowledge: 6, happiness: 8 },
        result: "你写下了那些看起来不重要的小事。它们拼在一起，就是你的一生。",
      },
      {
        title: "出门，看看附近的新风景",
        hint: "健康 +8，快乐 +8",
        effect: { health: 8, happiness: 8 },
        result: "你走得慢了，却看见了从前匆忙时忽略的许多事。",
      },
    ],
  },
  {
    age: 82,
    title: "把温柔留给后来的人",
    text: "你已经度过了许多四季。现在，你最想留下些什么？",
    choices: [
      {
        title: "把回忆讲给家人和朋友",
        hint: "关系 +12，快乐 +10",
        effect: { relationships: 12, happiness: 10 },
        result: "大家围坐在你身旁。你讲着往事，也听见了自己的笑声。",
      },
      {
        title: "捐出一部分积蓄",
        hint: "积蓄减少 20%，快乐 +12",
        special: "donate",
      },
      {
        title: "安静地享受每一个今天",
        hint: "健康 +5，快乐 +10",
        effect: { health: 5, happiness: 10 },
        result: "窗外的树又长出了新叶。今天没有大事发生，这本身就很好。",
      },
    ],
  },
];
const smallEvents = [
  [
    "一顿热乎乎的饭",
    "有人记得你爱吃什么。生活里的小小心意，让今天变得明亮。",
    { happiness: 3, relationships: 2 },
  ],
  [
    "认识了一个新朋友",
    "你们偶然聊了起来，发现彼此有说不完的话。",
    { relationships: 4, happiness: 2 },
  ],
  [
    "一本意外喜欢的书",
    "原本只是随手翻开，却让你想了很久。",
    { knowledge: 3, happiness: 1 },
  ],
  [
    "一个不太顺利的日子",
    "计划被打乱了。你花了一点时间，接受事情没有按预想发生。",
    { happiness: -4 },
  ],
  [
    "久违的好天气",
    "你在外面多走了一会儿，心情也轻了一些。",
    { health: 2, happiness: 3 },
  ],
  [
    "一张被保存的照片",
    "镜头里的你还不知道，未来会多么怀念这个普通的下午。",
    { happiness: 2, relationships: 2 },
  ],
  [
    "意外的修理开销",
    "生活里总有一些计划之外的账单。你重新调整了本月的安排。",
    { money: -150, happiness: -2 },
  ],
  [
    "有人对你说谢谢",
    "你做了一件很小的好事。对方却认真地记在了心里。",
    { relationships: 3, happiness: 4 },
  ],
  [
    "学会与失落相处",
    "一件期待的事没有发生。难过之后，你仍愿意尝试新的可能。",
    { happiness: -3, knowledge: 2 },
  ],
];
function applyEffects(s, e) {
  for (const [k, v] of Object.entries(e || {})) {
    s[k] = (Number(s[k]) || 0) + v;
    if (
      ["health", "happiness", "knowledge", "relationships", "family"].includes(
        k,
      )
    )
      s[k] = clamp(s[k]);
    if (k === "salaryFactor") s[k] = clamp(s[k], 0.25, 4);
  }
}
export function annualIncome(s, c) {
  const d = initSystems(s);
  if (s.flowVersion===2 && /学生|大学生|研究生|军校学生|婴儿|全职家管/.test(s.occupation)) return 0;
  if (s.flowVersion===2 && s.age>=12 && s.age<18 && /帮忙家里|初入职场/.test(s.occupation)) return Math.round(incomeBase(c)*.08);
  if (s.age < 18 || s.education === "大学在读") return 0;
  if (d.career.unemployed > 0 && !s.retired)
    return Math.round(incomeBase(c) * 0.035);
  const education =
    s.education === "大学毕业" ? 1.45 : s.education === "职业教育" ? 1.13 : 1;
  return Math.round(
    incomeBase(c) *
      0.35 *
      education *
      s.salaryFactor *
      (1 + d.career.level * 0.12) *
      (0.65 + s.knowledge / 150) *
      (s.retired ? 0.35 : 1),
  );
}
export function step(s, countries) {
  const deep = initSystems(s);
  if (s.stage !== "living" || s.pending || deep.reflection !== null) return s;
  delete s.clock;
  const beforeEvent = s.events.at(-1)?.id ?? -1;
  const c = livingCountry(s, countries);
  if (!c) throw Error("Country missing");
  if (s.deathAge > 0) s.age++;
  const r = () => random(s);
  s.health = clamp(
    s.health - (s.age > 50 ? 0.8 : s.age > 30 ? 0.35 : 0.05) + (r() - 0.5) * 2,
  );
  s.happiness = clamp(s.happiness + (r() - 0.51) * 5 + (s.partner ? 0.25 : 0));
  s.relationships = clamp(s.relationships + (r() - 0.5) * 3);
  if (s.age >= 6 && s.age <= 22)
    s.knowledge = clamp(s.knowledge + s.schoolQuality / 90 + r() * 1.2);
  const focus = {
    health: { health: 1.7, happiness: 0.3 },
    study: { knowledge: 1.7, happiness: -0.15 },
    connection: { relationships: 1.8, happiness: 0.6 },
    work:
      s.age >= 18
        ? { money: incomeBase(c) * 0.02, health: -0.3, knowledge: 0.4 }
        : { knowledge: 1 },
    rest: { happiness: 1.6, health: 0.5 },
    help: { relationships: 1.5, family: 0.4, knowledge: -0.2 },
    jobprep: { knowledge: 1.5, happiness: -0.2 },
    balanced: {
      health: 0.4,
      knowledge: 0.4,
      relationships: 0.5,
      happiness: 0.3,
    },
  };
  if (s.age >= 6) applyEffects(s, focus[s.focus] || focus.balanced);
  if (s.age === 4 && experience(s).childhoodChoice !== null)
    addEvent(s, "慢慢长成自己的样子", `这个孩子的气质渐渐清晰：${temperamentName(s)}。童年的选择仍会和之后的经历一起，塑造不同的可能。`, "childhood");
  if (s.age === 6) {
    s.education = "基础教育";
    s.occupation = "学生";
    if (s.focus === "balanced") s.focus = "study";
    addEvent(s,"第一次走进教室","你开始了学校里的日子，认识老师、同学，也慢慢接触更大的世界。","education");
  }
  if (s.age === 22 && s.education === "大学在读") {
    s.education = "大学毕业";
    s.occupation = "初入职场";
    s.knowledge = clamp(s.knowledge + 12);
    addEvent(
      s,
      "毕业的那一天",
      "你穿过校园的大门。那些熬过的夜，终于有了一个温柔的句号。",
    );
  }
  if (s.age === 18 && s.family > 60)
    s.money += incomeBase(c) * ((s.family - 60) / 100);
  s.income = annualIncome(s, c);
  if (s.income > 0) {
    s.money +=
      s.income * (1 - s.livingCost) -
      (s.money < 0 ? Math.abs(s.money) * 0.04 : 0);
    if (s.money > 0) s.money *= 1.015;
  }
  s.money = Math.round(s.money);
  // Smooth tail around each country's life expectancy; no claim to life-table fidelity.
  if (s.age >= s.deathAge || s.health <= 0 || s.age >= 110) {
    s.stage = "ended";
    s.pending = null;
    s.income = 0;
    const causes = s.age<1 ? ["早产并发症","新生儿感染"] : s.age<15 ? ["呼吸道感染","腹泻疾病","感染性疾病"] : s.age<80 ? ["心血管疾病","恶性肿瘤","呼吸系统疾病"] : ["高龄相关的身体衰弱","心血管疾病","呼吸系统疾病"];
    experience(s).cause ||= causes[(s.seed+s.age)%causes.length];
    recordYear(s);
    addEvent(
      s,
      "这一生，轻轻合上了书页",
      `你在 ${s.age} 岁时走到了生命的终点。有些故事没有被世界记住，但它们真实地组成了你。`,
      "end",
    );
    return s;
  }
  if (s.flowVersion !== 2 && s.age > 3 && r() < 0.3) {
    const e = smallEvents[Math.floor(r() * smallEvents.length)];
    applyEffects(s, e[2]);
    addEvent(s, e[0], e[1]);
  }
  if (!s.gentle && s.age > 8 && r() < 0.035) {
    applyEffects(s, {
      health: deep.insurance ? -4 : -8,
      money: -s.income * (deep.insurance ? 0.02 : 0.08),
    });
    addEvent(
      s,
      "需要慢下来的日子",
      "一场疾病让你停下脚步。休息与照料，成为这段时间最重要的事。",
    );
  }
  const d = s.flowVersion===2 ? null : decisions.find((d) => d.age === s.age && (!d.legacy || !s.deep.experience));
  if (d) s.pending = d.age;
  yearSystems(s, countries);
  chronologyYear(s,c,r,countries);
  activateQueuedEvent(s);
  recordYear(s);
  if (s.flowVersion !== 2 && s.age % 10 === 0 && !d)
    addEvent(
      s,
      `${s.age} 岁，新的十年`,
      `你走过了许多普通的日子，也在不知不觉中成为了今天的自己。`,
    );
  if(s.flowVersion===2) scheduleYear(s,s.events.filter(e=>e.id>beforeEvent));
  return s;
}
export function choose(s, index, countries) {
  if (s.stage !== "living") return false;
  if (s.pending && s.deep?.experience?.chapter) {
    const c = livingCountry(s,countries);
    const resolved = resolveChronology(s,index,c,()=>random(s));
    if(resolved){
      afterChoice(s,countries);s.income=annualIncome(s,c);activateQueuedEvent(s);recordYear(s);
    }
    return resolved;
  }
  if (s.pending === "life-event") {
    const resolved=resolveQueuedEvent(s,index,countries);
    if(resolved){s.income=annualIncome(s,livingCountry(s,countries));recordYear(s);}
    return resolved;
  }
  if (s.pending === "scene") return resolveScene(s, index, countries);
  const d = decisions.find((d) => d.age === s.pending),
    choice = d?.choices[index];
  if (!choice) return false;
  const c = livingCountry(s, countries);
  let result = choice.result;
  if (d.age === 2) {
    const x = experience(s);
    x.childhoodChoice = index;
    x.temperament[index] = Math.min(100, x.temperament[index] + 25);
  }
  applyEffects(s, choice.effect);
  Object.assign(s, choice.set || {});
  switch (choice.special) {
    case "university": {
      const chance = clamp(
        (s.knowledge * 0.65 + s.schoolQuality * 0.25 + s.family * 0.1) / 100,
        0.08,
        0.94,
      );
      if (random(s) < chance) {
        s.education = "大学在读";
        s.occupation = "大学生";
        s.money -= incomeBase(c) * (0.12 + (100 - s.family) * 0.004);
        s.knowledge = clamp(s.knowledge + 8);
        result =
          "你收到了大学的录取通知。为了学费，你和家人重新算了一遍积蓄，但你仍期待接下来的日子。";
      } else {
        s.education = "职业教育";
        s.occupation = "学徒";
        s.knowledge = clamp(s.knowledge + 5);
        result =
          "这一次没有拿到录取通知。失落之后，你选择先学一门手艺。通往未来的路，还不止一条。";
      }
      break;
    }
    case "business":
      if (random(s) < 0.46 + s.knowledge / 500) {
        s.salaryFactor = clamp(s.salaryFactor + 0.65, 0.25, 4);
        s.occupation = "小企业经营者";
        s.happiness = clamp(s.happiness + 8);
        result =
          "小事业慢慢有了起色。第一个老顾客再次走进来时，你终于松了一口气。";
      } else {
        s.money -= incomeBase(c) * 0.22;
        s.health = clamp(s.health - 4);
        s.occupation = "重新求职";
        result =
          "这一次创业没有成功。你付出了积蓄，也带走了一些只有亲身经历才懂的经验。";
      }
      break;
    case "house": {
      const cost = incomeBase(c) * 0.65;
      if (s.money >= cost) {
        s.money -= cost;
        s.housing = "按揭中的家";
        s.livingCost = 0.88;
        s.happiness = clamp(s.happiness + 10);
        result =
          "钥匙放在掌心里，有一点凉。往后的日子多了一笔月供，也多了一处归属。";
      } else {
        s.happiness = clamp(s.happiness - 2);
        s.housing = "租住的小家";
        result = "算过账后，你决定暂时不买。把生活照顾好，也是一种稳妥的选择。";
      }
      break;
    }
    case "checkup":
      s.money -= s.income / 24;
      s.deathAge = Math.min(110, s.deathAge + 2);
      result =
        "你开始定期散步、认真体检。身体未必能完全掌控，但你愿意为它多做一点。";
      break;
    case "donate":
      s.money = s.money > 0 ? s.money * 0.8 : s.money;
      s.happiness = clamp(s.happiness + 12);
      result = "你把自己拥有的一部分，留给还在路上的人。这让你感到平静。";
      break;
  }
  s.money = Math.round(s.money);
  s.income = annualIncome(s, c);
  addEvent(s, d.title, result, "decision");
  s.pending = null;
  afterChoice(s, countries);
  activateQueuedEvent(s);
  recordYear(s);
  return true;
}
export function pendingDecision(s,countries) {
  if (!s?.pending) return null;
  if (s.pending === "life-event") return queuedDecision(s,countries);
  if (s.deep?.experience?.chapter) return chronologyDecision(s,livingCountry(s,countries));
  const d = s.pending === "scene" ? specialDecisionFor(s) : decisions.find(d=>d.age===s.pending);
  if (d?.age !== 2 || s.seed % 2 === 0) return d;
  return {...d,title:"两岁，家里来了新面孔",text:"家里来了几位不熟悉的客人。有人聊天，有人在门边招手。你会怎样认识这些新面孔？"};
}
export function stageName(age) {
  return age < 6
    ? "在家人的怀抱里认识世界"
    : age < 13
      ? "童年 · 世界刚刚展开"
      : age < 18
        ? "少年 · 心里有了一点远方"
        : age < 30
          ? "青年 · 寻找自己的方向"
          : age < 50
            ? "成年 · 在选择中慢慢扎根"
            : age < 65
              ? "中年 · 重新理解生活"
              : age < 80
                ? "晚年 · 把日子过得缓慢"
                : "暮年 · 每一天都是礼物";
}
export function validateLife(s, countries) {
  if (!s || s.schema !== SCHEMA || !countries.some((c) => c.id === s.country))
    return false;
  if (
    !["registered", "living", "ended"].includes(s.stage) ||
    !["births", "population"].includes(s.mode)
  )
    return false;
  if (
    !Number.isInteger(s.age) ||
    s.age < 0 ||
    s.age > 110 ||
    !Number.isInteger(s.seed) ||
    s.seed < 0 ||
    s.seed > 4294967295
  )
    return false;
  for (const k of [
    "rng",
    "year",
    "deathAge",
    "family",
    "health",
    "happiness",
    "knowledge",
    "relationships",
    "money",
    "income",
    "salaryFactor",
    "livingCost",
    "schoolQuality",
  ])
    if (!Number.isFinite(s[k]) || Math.abs(s[k]) > 1e10) return false;
  if (s.deathAge < 0 || s.deathAge > 110 || s.year < 1900 || s.year > 2100)
    return false;
  if (
    !Number.isInteger(s.year) ||
    !Number.isInteger(s.rng) ||
    s.rng < 0 ||
    s.rng > 4294967295 ||
    !Number.isFinite(s.createdAt)
  )
    return false;
  if (s.stage !== "living" && s.pending !== null) return false;
  if (s.pending === "scene" && !s.deep) return false;
  if (s.pending === "life-event" && !s.deep?.experience?.activeEvent) return false;
  if (
    !["health", "happiness", "knowledge", "relationships"].every(
      (k) => s[k] >= 0 && s[k] <= 100,
    )
  )
    return false;
  if (
    typeof s.name !== "string" ||
    s.name.length > 100 ||
    typeof s.note !== "string" ||
    s.note.length > 600
  )
    return false;
  for (const k of [
    "id",
    "sex",
    "familyLabel",
    "home",
    "education",
    "occupation",
    "housing",
    "origin",
    "focus",
  ])
    if (typeof s[k] !== "string" || s[k].length > 150) return false;
  if (
    ![5, 15, 30, 60, 90].includes(s.duration) ||
    ![null, "scene", "life-event", 15, 22, ...decisions.map((d) => d.age), ...(s.deep?.experience?.chapter?[s.age]:[])].includes(s.pending) ||
    (s.pending !== null && !["scene","life-event"].includes(s.pending) && s.pending !== s.age)
  )
    return false;
  if (
    !Array.isArray(s.events) ||
    s.events.length > 2000 ||
    !s.events.every(
      (e, i) =>
        e &&
        Number.isInteger(e.id) &&
        Number.isInteger(e.age) &&
        e.age >= 0 &&
        e.age <= s.age &&
        (e.phase === undefined || (Number.isFinite(e.phase) && e.phase >= 0 && e.phase <= 1)) &&
        (i === 0 || e.id > s.events[i - 1].id) &&
        typeof e.title === "string" &&
        e.title.length < 200 &&
        typeof e.text === "string" &&
        e.text.length < 2000,
    )
  )
    return false;
  if (
    !Array.isArray(s.peers) ||
    s.peers.length !== 4 ||
    !s.peers.every(
      (p) =>
        countries.some((c) => c.id === p.country) &&
        typeof p.name === "string" &&
        p.name.length < 100 &&
        Number.isFinite(p.deathAge) &&
        p.deathAge >= 0 &&
        p.deathAge <= 110,
    )
  )
    return false;
  return validateSystems(s, countries) && validChronology(s) && validClock(s.clock,s);
}
