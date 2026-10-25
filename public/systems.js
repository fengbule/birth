// Independent game systems. All probabilities and prices here are game rules.
import { appendRecord } from "./records.js";
import { validExperience, recordYear } from "./experience.js";
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
function rng(s) {
  let t = (s.rng += 0x6d2b79f5);
  s.rng >>>= 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const base = (c) =>
  c.gdp || { HIC: 50000, UMC: 18000, LMC: 6000, LIC: 2000 }[c.income] || 8000;
function log(s, title, text, type = "life") {
  return appendRecord(s, title, text, type);
}
let eras = {};
export function configureEras(data) {
  eras = data?.eras || {};
}
export function worldCountries(countries, world = "today", year = 2026) {
  if (world === "past")
    return countries
      .filter((c) => eras[year]?.[c.id])
      .map((c) => ({ ...c, ...eras[year][c.id] }));
  if (world === "future")
    return countries.map((c) => ({
      ...c,
      population: Math.round(
        c.population * Math.exp((c.birthRate / 1000 - 0.009) * 27 * 0.6),
      ),
      birthRate: Math.max(5, c.birthRate * 0.85),
      life: Math.min(95, c.life + 3),
      gdp: c.gdp ? c.gdp * 1.015 ** 27 : null,
    }));
  return countries;
}
export function initSystems(s, options = {}) {
  if (s.deep) return s.deep;
  // A separate local seed preserves old birth identity and main RNG when migrating.
  const local = { rng: s.seed ^ 0x891daf };
  const person = (id, label, offset) => ({
    id,
    name: label,
    bornAge: -offset,
    deathAge: Math.round(66 + rng(local) * 26),
    alive: offset + s.age < 86,
    closeness: 75,
  });
  s.deep = {
    version: 2,
    world: options.world || "today",
    residence: s.country,
    moves: [],
    parents: [
      person("mother", "母亲", 22 + Math.floor(rng(local) * 14)),
      person("father", "父亲", 25 + Math.floor(rng(local) * 16)),
    ],
    partner: s.partner
      ? { name: "与你相伴的人", since: s.age, closeness: 75 }
      : null,
    children: Array.from({ length: s.children || 0 }, (_, i) => ({
      id: i,
      name: `孩子 ${i + 1}`,
      bornAge: Math.max(0, s.age - 8 - i * 3),
      bond: 75,
      education: 0,
    })),
    friends: [],
    career: { level: 0, experience: Math.max(0, s.age - 22), unemployed: 0 },
    assets: { bonds: 0, stocks: 0, house: 0, mortgage: 0 },
    annual: { age: s.age, actions: [], income: 0, expenses: 0, returns: 0 },
    insurance: false,
    reflectionsEnabled: options.reflections !== false,
    reflection: null,
    journal: [],
    milestones: [],
    pendingScene: null,
    lastMarket: 0,
    visited: [s.country],
  };
  for (const p of s.deep.parents) p.alive = s.age - p.bornAge < p.deathAge;
  return s.deep;
}
export function livingCountry(s, countries) {
  const d = initSystems(s),
    pool = worldCountries(countries, d.world, s.year);
  return (
    pool.find((c) => c.id === d.residence) ||
    countries.find((c) => c.id === d.residence) ||
    countries.find((c) => c.id === s.country)
  );
}
export function netWorth(s) {
  const a = initSystems(s).assets;
  return Math.round(s.money + a.bonds + a.stocks + a.house - a.mortgage);
}
export function remember(s, text = "") {
  const d = initSystems(s);
  if (d.reflection === null) return false;
  const age = d.reflection;
  d.journal.push({ age, text: String(text).trim().slice(0, 500) });
  d.reflection = null;
  if (text.trim())
    log(
      s,
      `${age} 岁，留给自己的一句话`,
      text.trim().slice(0, 500),
      "reflection",
    );
  return true;
}
export const reflectionQuestions = {
  5: "在这个孩子的世界里，什么让他感到安全？你小时候又依赖过什么？",
  15: "如果你站在这个少年的起点，最希望有人告诉你什么？",
  30: "你愿意为了怎样的生活，重新做一次选择？",
  50: "走到这里，哪些看起来普通的日子，反而最值得记住？",
  70: "如果还能和一个人认真说说话，你会选择谁？",
};
const sceneCatalog = {
  21: {
    title: "远方寄来一封邀请",
    text: "一位朋友提到了外面的机会。搬到陌生的地方，可能意味着新的资源，也意味着重新开始。",
    choices: [
      ["先研究机会，再积累路费", "知识 +6，开启迁居规划"],
      ["把根扎在眼前", "关系 +8，快乐 +4"],
      ["练习语言与一门新技能", "知识 +10，花费收入基数的 3%"],
    ],
  },
  25: {
    title: "一次意料之外的岗位调整",
    text: "所在行业正在变化。你可以选择争取新机会，也可以暂时稳住生活。",
    choices: [
      ["主动申请新岗位", "知识与经验影响成功率"],
      ["先维持现状", "快乐 +4，职业经验 +2"],
      ["准备自己的小项目", "收入基数的 5% 成本，可能提高收入"],
    ],
  },
  31: {
    title: "关系也需要被照顾",
    text: "忙碌让一些重要的话越积越多。你愿意怎么回应那些一直在身边的人？",
    choices: [
      ["认真安排一次谈心", "关系 +12，伴侣或朋友的亲密度提高"],
      ["约一次共同的旅行", "花费收入基数的 4%，快乐 +10"],
      ["先把工作忙完", "收入潜力提高，关系 −8"],
    ],
  },
  38: {
    title: "不是每一年都顺风顺水",
    text: "市场的变化影响了身边许多人的工作。你的技能和储备，开始发挥作用。",
    choices: [
      ["花时间更新自己的技能", "知识 +10，减少失业风险"],
      ["寻找新的行业或岗位", "成功率取决于知识与工作经验"],
      ["继续原来的工作", "可能失业两年，也可能平稳度过"],
    ],
  },
  45: {
    title: "家人也渐渐需要你",
    text: "你发现，关心长辈和照顾下一代，可能会同时来到人生里。",
    choices: [
      ["留时间陪伴家人", "关系 +14，家人的亲密度提高"],
      ["为照护留一笔预算", "花费收入基数的 4%，家人关系与健康提高"],
      ["和大家一起商量分担", "知识 +4，关系 +8，快乐 +5"],
    ],
  },
  55: {
    title: "还来得及，重新出发",
    text: "一个新的方向让你心动。你知道，改变需要勇气，也需要准备。",
    choices: [
      ["学习，转向新的职业领域", "花费收入基数的 6%，知识 +12"],
      ["继续积累已有的经验", "职业经验 +4，收入潜力提高"],
      ["给生活减一点负担", "健康 +8，快乐 +8"],
    ],
  },
  67: {
    title: "那些还没有抵达的地方",
    text: "你有了一些可以自由安排的时间，也开始重新想象生活的边界。",
    choices: [
      ["去一个从未到过的地方", "花费收入基数的 5%，快乐 +12"],
      ["在社区中找到新的伙伴", "关系 +12，结识一位朋友"],
      ["把自己的故事整理成册", "知识 +6，快乐 +8"],
    ],
  },
  76: {
    title: "如何把经验留给后来的人",
    text: "回忆不是一份履历。你最想传递的，也许是自己走过弯路后才懂得的事。",
    choices: [
      ["成为年轻人的陪伴者", "关系 +12，快乐 +8"],
      ["资助社区的一项小计划", "花费收入基数的 4%，快乐 +12"],
      ["把故事讲给亲近的人", "关系 +10，留下一个被收藏的瞬间"],
    ],
  },
};
export function specialDecision(s) {
  const d = initSystems(s);
  if (!d.pendingScene) return null;
  const scene = sceneCatalog[d.pendingScene];
  return scene
    ? {
        ...scene,
        age: s.age,
        choices: scene.choices.map(([title, hint]) => ({ title, hint })),
        special: true,
      }
    : null;
}
export function resolveScene(s, index, countries) {
  const d = initSystems(s),
    age = d.pendingScene;
  if (!sceneCatalog[age] || !Number.isInteger(index) || index < 0 || index > 2)
    return false;
  const c = livingCountry(s, countries),
    g = base(c),
    cost = (fraction) => {
      const n = Math.round(g * fraction);
      s.money -= n;
      return n;
    };
  const boost = (key, n) => (s[key] = clamp(s[key] + n));
  let result = "";
  if (age === 21) {
    if (index === 0) {
      boost("knowledge", 6);
      result =
        "你开始认真了解语言、资格和生活成本。迁居不再只是一个遥远的念头。";
    } else if (index === 1) {
      boost("relationships", 8);
      boost("happiness", 4);
      result = "你决定先把眼前的生活经营好。留下，也可以是主动的选择。";
    } else {
      cost(0.03);
      boost("knowledge", 10);
      result = "学习语言很慢，但你发现自己能听懂的世界正在变大。";
    }
  }
  if (age === 25) {
    if (index === 0 || index === 2) {
      if (index === 2) cost(0.05);
      if (rng(s) < 0.35 + s.knowledge / 180) {
        s.salaryFactor = clamp(s.salaryFactor + 0.22, 0.25, 4);
        d.career.level = Math.min(6, d.career.level + 1);
        result = "新的尝试得到了回应。你在工作中有了更多空间。";
      } else {
        boost("knowledge", 4);
        result = "这次没有如愿，但你弄清楚了下一步需要补上的东西。";
      }
    } else {
      boost("happiness", 4);
      d.career.experience += 2;
      result = "你选择先把熟悉的工作做好。稳定也为生活腾出了一些余地。";
    }
  }
  if (age === 31) {
    if (index === 2) {
      s.salaryFactor = clamp(s.salaryFactor + 0.15, 0.25, 4);
      boost("relationships", -8);
      result = "工作确实有了进展。你也发现，有些约定不能永远往后推。";
    } else {
      if (index === 1) cost(0.04);
      boost("relationships", 12);
      boost("happiness", index === 1 ? 10 : 4);
      if (d.partner) d.partner.closeness = clamp(d.partner.closeness + 15);
      result = "你们终于把话说开。被认真听见，有时比一个答案更重要。";
    }
  }
  if (age === 38) {
    if (index === 0) {
      boost("knowledge", 10);
      d.career.experience += 2;
      result = "新的技能给你多留了一条退路。";
    } else if (index === 1) {
      if (rng(s) < 0.4 + s.knowledge / 180) {
        d.career.unemployed = 0;
        s.salaryFactor = clamp(s.salaryFactor + 0.15, 0.25, 4);
        result = "你在另一个团队找到了新的位置。";
      } else {
        d.career.unemployed = 1;
        result = "求职比想象中漫长。积蓄开始为这段等待提供支撑。";
      }
    } else if (rng(s) < 0.3) {
      d.career.unemployed = 2;
      boost("happiness", -6);
      result = "岗位被裁撤了。接下来的日子，你需要重新规划开销与求职。";
    } else result = "这一轮调整中，你的岗位保留了下来。你更加珍惜已有的储备。";
  }
  if (age === 45) {
    if (index === 1) {
      cost(0.04);
      boost("health", 4);
    }
    boost("relationships", index === 2 ? 8 : 14);
    if (index === 2) {
      boost("knowledge", 4);
      boost("happiness", 5);
    }
    for (const p of d.parents) p.closeness = clamp(p.closeness + 12);
    result = "你没有一个人承担所有事情。有人愿意一起商量，日子就轻了一些。";
  }
  if (age === 55) {
    if (index === 0) {
      cost(0.06);
      boost("knowledge", 12);
      s.occupation = "转型中的专业人员";
      d.career.unemployed = 0;
      result = "你又一次做起了新手。经验和好奇心，开始慢慢走到一起。";
    } else if (index === 1) {
      d.career.experience += 4;
      s.salaryFactor = clamp(s.salaryFactor + 0.15, 0.25, 4);
      result = "你把这些年的经验，变成了能让别人安心的能力。";
    } else {
      boost("health", 8);
      boost("happiness", 8);
      result = "你放下了一些不再重要的目标，反而有了更踏实的日常。";
    }
  }
  if (age === 67) {
    if (index === 0) {
      cost(0.05);
      boost("happiness", 12);
      result = "陌生街角的风，让你再次拥有了初来世界时的好奇。";
    } else if (index === 1) {
      boost("relationships", 12);
      d.friends.push({ name: "社区里的新朋友", since: s.age, closeness: 70 });
      result = "你有了新的饭搭子，也多了一个可以分享日常的人。";
    } else {
      boost("knowledge", 6);
      boost("happiness", 8);
      result = "你把往事写成一页一页。它们原来一直如此鲜明。";
    }
  }
  if (age === 76) {
    boost("relationships", index === 2 ? 10 : 12);
    boost("happiness", index === 1 ? 12 : 8);
    if (index === 1) cost(0.04);
    result =
      index === 2
        ? "你讲起那些平凡的日子。身边的人认真听着，仿佛也走进了你的过去。"
        : "你留下的不只是一份帮助，还有继续认真生活的勇气。";
  }
  s.money = Math.round(s.money);
  log(s, sceneCatalog[age].title, result, "decision");
  if (age === 76 && index === 2) s.events.at(-1).star = true;
  d.pendingScene = null;
  s.pending = null;
  return true;
}
export function afterChoice(s, countries) {
  const d = initSystems(s),
    c = livingCountry(s, countries);
  if (s.partner && !d.partner)
    d.partner = { name: "与你相伴的人", since: s.age, closeness: 78 };
  if (!s.partner) d.partner = null;
  while (d.children.length < s.children)
    d.children.push({
      id: d.children.length,
      name: `孩子 ${d.children.length + 1}`,
      bornAge: s.age,
      bond: 78,
      education: 0,
    });
  if (s.housing === "按揭中的家" && !d.assets.house) {
    d.assets.house = Math.round(base(c) * 3.25);
    d.assets.mortgage = Math.round(base(c) * 2.6);
    s.livingCost = 0.66;
  }
  if (
    d.reflectionsEnabled &&
    reflectionQuestions[s.age] &&
    !d.journal.some((j) => j.age === s.age)
  )
    d.reflection = s.age;
}
export function yearSystems(s, countries) {
  const d = initSystems(s),
    c = livingCountry(s, countries),
    a = d.assets,
    g = base(c);
  d.annual = {
    age: s.age,
    actions: [],
    income: s.income,
    expenses: Math.round(s.income * s.livingCost),
    returns: 0,
  };
  const market = clamp((rng(s) - 0.5) * 0.46 + 0.055, -0.4, 0.4);
  d.lastMarket = market;
  const returns = Math.round(a.bonds * 0.025 + a.stocks * market);
  a.bonds = Math.round(a.bonds * 1.025);
  a.stocks = Math.max(0, Math.round(a.stocks * (1 + market)));
  a.house = Math.round(a.house * (1 + (rng(s) - 0.35) * 0.04));
  d.annual.returns = returns;
  if (a.mortgage > 0) {
    const interest = Math.round(a.mortgage * 0.035),
      principal = Math.min(a.mortgage, Math.round(g * 0.065));
    s.money -= interest + principal;
    a.mortgage -= principal;
    d.annual.expenses += interest + principal;
    if (a.mortgage === 0)
      log(s, "终于，付清了最后一期房贷", "这处小小的家，装满了很多年的生活。");
  }
  if (d.insurance) {
    const premium = Math.round(g * 0.012);
    s.money -= premium;
    d.annual.expenses += premium;
  }
  for (const p of d.parents) {
    if (p.alive && s.age - p.bornAge >= p.deathAge) {
      p.alive = false;
      log(
        s,
        `与${p.name}告别`,
        "家人的位置，后来变成了记忆里一盏一直亮着的灯。",
      );
      s.happiness = clamp(s.happiness - 9);
    }
  }
  if (d.partner) {
    d.partner.closeness = clamp(
      d.partner.closeness + (s.focus === "connection" ? 2 : -0.5),
    );
    if (d.partner.closeness < 22 && rng(s) < 0.18) {
      d.partner = null;
      s.partner = false;
      s.happiness = clamp(s.happiness - 8);
      log(
        s,
        "你们决定各自走一段路",
        "谈过很久之后，你们决定分开。曾经认真相待的日子，也不会因此消失。",
      );
    }
  }
  for (const child of d.children) {
    const age = s.age - child.bornAge;
    if (age === 6)
      log(
        s,
        `${child.name}开始上学`,
        "你在校门外站了很久，忽然理解了当年家人的心情。",
      );
    if (age === 18)
      log(
        s,
        `${child.name}长大了`,
        "孩子有了自己的方向。你学着把关心，变成信任。",
      );
    child.bond = clamp(child.bond + (s.focus === "connection" ? 2 : -0.3));
  }
  if (s.age >= 18 && !s.retired) {
    d.career.experience++;
    if (d.career.unemployed > 0) {
      d.career.unemployed--;
      if (!d.career.unemployed)
        log(s, "重新找到生活的节奏", "等待之后，你回到了工作中。");
    } else if (
      s.age % 5 === 0 &&
      rng(s) < 0.2 + s.knowledge / 250 &&
      d.career.level < 6
    ) {
      d.career.level++;
      log(
        s,
        "工作中，一个被认可的时刻",
        `你的经验和投入得到了认可，职业等级提升到 ${d.career.level}。收入也会在下一年发生变化。`,
      );
    }
  }
  if (s.age === 10)
    d.friends.push({ name: "从小一起长大的朋友", since: 10, closeness: 78 });
  if (s.age === 24)
    d.friends.push({ name: "工作中认识的朋友", since: 24, closeness: 65 });
  if (!s.pending && sceneCatalog[s.age]) {
    d.pendingScene = s.age;
    s.pending = "scene";
  }
  if (
    d.reflectionsEnabled &&
    reflectionQuestions[s.age] &&
    !d.journal.some((j) => j.age === s.age)
  ) {
    if (s.auto) d.journal.push({ age: s.age, text: "" });
    else d.reflection = s.age;
  }
  if (s.money < 0) {
    s.happiness = clamp(s.happiness - 2);
    if (s.age % 3 === 0)
      log(
        s,
        "重新计算生活的开销",
        "债务开始影响心情。你决定更认真地安排接下来的收入与支出。",
      );
  }
  if (a.stocks > 0 && market < -0.1)
    log(
      s,
      "市场低落的一年",
      "投资账面出现回撤。你重新审视风险与未来需要的现金。",
    );
  s.money = Math.round(s.money);
  updateMilestones(s);
}
function updateMilestones(s) {
  const d = initSystems(s),
    checks = [
      ["first-job", "第一份工作", s.age >= 18 && s.income > 0],
      ["graduate", "把一段学习走完", s.education === "大学毕业"],
      ["family", "家有新的成员", s.children > 0],
      ["home", "一扇自己的窗", d.assets.house > 0],
      ["traveler", "在另一片土地生活", d.moves.length > 0],
      ["nest-egg", "留下一份生活储备", netWorth(s) > 100000],
      [
        "old-friends",
        "半生的朋友",
        d.friends.some((f) => s.age - f.since >= 30),
      ],
      ["long-life", "八十个春夏秋冬", s.age >= 80],
    ];
  for (const [id, title, met] of checks)
    if (met && !d.milestones.some((m) => m.id === id))
      d.milestones.push({ id, title, age: s.age });
}
export function actionList(s, countries) {
  const d = initSystems(s),
    g = base(livingCountry(s, countries)),
    child = d.children.length > 0;
  return [
    {
      id: "exercise",
      title: "运动与恢复",
      description: "健康 +8，快乐 +2",
      cost: Math.round(g * 0.006),
      minAge: 6,
    },
    {
      id: "learn",
      title: "进修一门技能",
      description: "知识 +9，职业经验 +1",
      cost: Math.round(g * 0.025),
      minAge: 16,
    },
    {
      id: "checkup",
      title: "安排一次体检",
      description: "健康 +12；保险降低支出",
      cost: Math.round(g * (d.insurance ? 0.008 : 0.025)),
      minAge: 18,
    },
    {
      id: "travel",
      title: "给自己一次旅行",
      description: "快乐 +10，关系 +3",
      cost: Math.round(g * 0.045),
      minAge: 18,
    },
    {
      id: "parents",
      title: "陪伴家人",
      description: "关系 +9，家人亲密度提高",
      cost: 0,
      minAge: 6,
    },
    {
      id: "partner",
      title: d.partner ? "和伴侣认真相处" : "认识一个新的人",
      description: d.partner
        ? "亲密度 +14，快乐 +5"
        : "有机会建立一段感情，关系影响成功率",
      cost: Math.round(g * 0.008),
      minAge: 20,
    },
    {
      id: "child",
      title: "陪孩子一起成长",
      description: "孩子亲密度 +12，教育支持 +1",
      cost: Math.round(g * 0.018),
      minAge: 18,
      hidden: !child,
    },
    {
      id: "friend",
      title: "与老朋友见面",
      description: "关系 +10，快乐 +5",
      cost: Math.round(g * 0.004),
      minAge: 12,
    },
    {
      id: "job",
      title: "寻找新的工作",
      description: "知识与经验影响结果，成功后恢复工作并提高收入潜力",
      cost: Math.round(g * 0.01),
      minAge: 18,
      hidden: s.retired,
    },
    {
      id: "insurance",
      title: d.insurance ? "取消健康保障" : "购买健康保障",
      description: "每年支付基数的 1.2%，降低普通疾病与体检的费用",
      cost: 0,
      minAge: 18,
    },
    {
      id: "volunteer",
      title: "做一些志愿服务",
      description: "关系 +7，快乐 +7",
      cost: 0,
      minAge: 12,
    },
    {
      id: "childbirth",
      title: "迎接一个家庭新成员",
      description: "增加一个孩子，生活开销与责任也会增加",
      cost: Math.round(g * 0.08),
      minAge: 24,
      maxAge: 50,
      hidden: d.children.length >= 3,
    },
  ].filter((a) => !a.hidden && s.age >= a.minAge && s.age <= (a.maxAge || 110));
}
export function performAction(s, id, countries) {
  const d = initSystems(s);
  if (s.stage !== "living")
    return { ok: false, message: "这段人生尚未开始或已经结束。" };
  if (s.pending || d.reflection !== null)
    return { ok: false, message: "请先完成眼前的选择或人生停顿。" };
  const a = actionList(s, countries).find((a) => a.id === id);
  if (!a) return { ok: false, message: "现在还不能进行这项活动。" };
  if (d.annual.age !== s.age)
    d.annual = { age: s.age, actions: [], income: 0, expenses: 0, returns: 0 };
  if (d.annual.actions.length >= 3)
    return {
      ok: false,
      message: "这一年已经安排了三件事。为生活留一点空白，明年再来。",
    };
  if (d.annual.actions.includes(id))
    return { ok: false, message: "今年已经做过这件事了。" };
  if (a.cost > Math.max(0, s.money))
    return { ok: false, message: "目前的现金还不够。可以先积累一些收入。" };
  s.money -= a.cost;
  d.annual.expenses += a.cost;
  d.annual.actions.push(id);
  const plus = (key, n) => (s[key] = clamp(s[key] + n));
  let text = a.description;
  if (id === "exercise") {
    plus("health", 8);
    plus("happiness", 2);
  }
  if (id === "learn") {
    plus("knowledge", 9);
    d.career.experience++;
  }
  if (id === "checkup") plus("health", 12);
  if (id === "travel") {
    plus("happiness", 10);
    plus("relationships", 3);
  }
  if (id === "parents") {
    plus("relationships", 9);
    for (const p of d.parents)
      if (p.alive) p.closeness = clamp(p.closeness + 12);
  }
  if (id === "partner") {
    if (d.partner) {
      d.partner.closeness = clamp(d.partner.closeness + 14);
      plus("happiness", 5);
    } else if (rng(s) < 0.25 + s.relationships / 160) {
      d.partner = { name: "与你相伴的人", since: s.age, closeness: 65 };
      s.partner = true;
      plus("happiness", 8);
      text = "你们开始认真了解彼此。未来的生活，多了一种可能。";
    } else text = "这一次没有走近彼此。你仍珍惜这场相遇。";
  }
  if (id === "child") {
    for (const c of d.children) {
      c.bond = clamp(c.bond + 12);
      c.education++;
    }
    plus("relationships", 5);
  }
  if (id === "friend") {
    plus("relationships", 10);
    plus("happiness", 5);
    for (const f of d.friends) f.closeness = clamp(f.closeness + 10);
  }
  if (id === "job") {
    if (rng(s) < 0.25 + s.knowledge / 160 + d.career.experience / 160) {
      d.career.unemployed = 0;
      s.salaryFactor = clamp(s.salaryFactor + 0.12, 0.25, 4);
      s.occupation = "在新岗位工作";
      text = "你收到了一份新的工作邀请，经验开始在新的地方发挥作用。";
    } else {
      plus("knowledge", 3);
      text = "暂时还没有合适的机会。几次面试也让你看清了需要准备的方向。";
    }
  }
  if (id === "insurance") d.insurance = !d.insurance;
  if (id === "volunteer") {
    plus("relationships", 7);
    plus("happiness", 7);
  }
  if (id === "childbirth") {
    d.children.push({
      id: d.children.length,
      name: `孩子 ${d.children.length + 1}`,
      bornAge: s.age,
      bond: 80,
      education: 0,
    });
    s.children = d.children.length;
    s.livingCost = Math.min(0.94, s.livingCost + 0.045);
    plus("happiness", 8);
    text = "家中迎来一个新的成员。你开始学习一种全新的责任。";
  }
  log(s, a.title, text, "action");
  updateMilestones(s);
  return { ok: true, message: "这一刻，已记进人生。" };
}
export function transact(s, type, amount, countries) {
  const d = initSystems(s),
    a = d.assets;
  if (s.stage !== "living" || s.age < 18 || s.pending || d.reflection !== null)
    return { ok: false, message: "成年且完成当前选择后，才可以安排财务。" };
  if (!Number.isFinite(amount) || amount < 1 || amount > 1e9)
    return { ok: false, message: "请输入有效金额。" };
  amount = Math.round(amount);
  if (["bonds", "stocks"].includes(type)) {
    if (amount > Math.max(0, s.money))
      return { ok: false, message: "可用现金不足。" };
    s.money -= amount;
    a[type] += amount;
  } else if (["sell-bonds", "sell-stocks"].includes(type)) {
    const key = type.slice(5);
    if (amount > a[key])
      return { ok: false, message: "卖出金额超过持有金额。" };
    a[key] -= amount;
    s.money += amount;
  } else if (type === "repay") {
    if (amount > Math.max(0, s.money) || amount > a.mortgage)
      return { ok: false, message: "还款金额超过现金或房贷余额。" };
    s.money -= amount;
    a.mortgage -= amount;
  } else return { ok: false, message: "未知的财务操作。" };
  log(
    s,
    "重新安排手中的储备",
    `${{ bonds: "配置稳健组合", stocks: "配置波动组合", "sell-bonds": "赎回稳健组合", "sell-stocks": "赎回波动组合", repay: "提前偿还房贷" }[type]}：${amount.toLocaleString("zh-CN")} PPP 国际元。`,
    "finance",
  );
  return { ok: true, message: "财务安排已完成。" };
}
export function migrationCost(s, target, countries) {
  return Math.round(
    (base(livingCountry(s, countries)) * 0.12 + base(target) * 0.035) *
      (initSystems(s).world === "past" ? 1.2 : 1),
  );
}
export function migrate(s, targetId, countries) {
  const d = initSystems(s),
    pool = worldCountries(countries, d.world, s.year),
    target = pool.find((c) => c.id === targetId);
  if (!target || s.stage !== "living" || s.age < 18 || s.age > 75)
    return { ok: false, message: "当前无法前往这个地方。" };
  if (s.pending || d.reflection !== null)
    return { ok: false, message: "请先完成当前的人生路口。" };
  if (targetId === d.residence)
    return { ok: false, message: "你已经生活在这里。" };
  if (d.moves.at(-1)?.age === s.age)
    return { ok: false, message: "搬家需要时间，同一年只能迁居一次。" };
  const cost = migrationCost(s, target, countries);
  if (s.money < cost)
    return { ok: false, message: "路费和安置费用还不够，需要更多现金储备。" };
  if (s.knowledge < 20)
    return { ok: false, message: "先积累一些知识与技能，再开始这次迁居。" };
  const from = livingCountry(s, countries);
  s.money -= cost;
  d.moves.push({ age: s.age, from: d.residence, to: targetId, cost });
  d.residence = targetId;
  if (!d.visited.includes(targetId)) d.visited.push(targetId);
  d.career.unemployed = 1;
  s.relationships = clamp(s.relationships - 6);
  s.happiness = clamp(s.happiness + 6);
  s.schoolQuality = clamp(Math.log10(base(target) / 700) * 29 + 30, 20, 93);
  log(
    s,
    "在另一片土地，重新开始",
    `你从${from.name}迁居到${target.name}，花费 ${cost.toLocaleString("zh-CN")} PPP 国际元。适应环境需要一年，新地点的经济基数会影响之后的工作。`,
    "migration",
  );
  updateMilestones(s);
  return { ok: true, message: "旅程开始了。先给自己一年适应新的生活。" };
}
export function validateSystems(s, countries) {
  if (s.deep === undefined) return true;
  const d = s.deep,
    finite = (n, min = -1e10, max = 1e10) =>
      Number.isFinite(n) && n >= min && n <= max,
    text = (t, n = 150) => typeof t === "string" && t.length <= n;
  if (
    !d ||
    d.version !== 2 ||
    !["today", "past", "future"].includes(d.world) ||
    !countries.some((c) => c.id === d.residence) ||
    typeof d.insurance !== "boolean" ||
    typeof d.reflectionsEnabled !== "boolean"
  )
    return false;
  if (
    !d.assets ||
    !["bonds", "stocks", "house", "mortgage"].every((k) =>
      finite(d.assets[k], 0),
    ) ||
    !d.career ||
    !["level", "experience", "unemployed"].every(
      (k) =>
        Number.isInteger(d.career[k]) &&
        finite(d.career[k], 0, k === "level" ? 6 : 200),
    )
  )
    return false;
  if (
    !d.annual ||
    !Number.isInteger(d.annual.age) ||
    !finite(d.annual.age, 0, s.age) ||
    !["income", "expenses", "returns"].every((k) => finite(d.annual[k])) ||
    !Array.isArray(d.annual.actions) ||
    d.annual.actions.length > 3 ||
    new Set(d.annual.actions).size !== d.annual.actions.length ||
    !d.annual.actions.every((a) =>
      [
        "exercise",
        "learn",
        "checkup",
        "travel",
        "parents",
        "partner",
        "child",
        "friend",
        "job",
        "insurance",
        "volunteer",
        "childbirth",
      ].includes(a),
    )
  )
    return false;
  if (
    !Array.isArray(d.parents) ||
    d.parents.length !== 2 ||
    !d.parents.every(
      (p) =>
        text(p.name) &&
        finite(p.bornAge, -100, 0) &&
        finite(p.deathAge, 1, 120) &&
        finite(p.closeness, 0, 100) &&
        typeof p.alive === "boolean",
    )
  )
    return false;
  if (
    d.partner !== null &&
    (!d.partner ||
      !text(d.partner.name) ||
      !finite(d.partner.since, 0, 110) ||
      !finite(d.partner.closeness, 0, 100))
  )
    return false;
  if (
    !Array.isArray(d.children) ||
    d.children.length > 10 ||
    !d.children.every(
      (c) =>
        text(c.name) &&
        finite(c.bornAge, 0, 110) &&
        finite(c.bond, 0, 100) &&
        finite(c.education, 0, 110),
    )
  )
    return false;
  if (
    !Array.isArray(d.friends) ||
    d.friends.length > 20 ||
    !d.friends.every(
      (f) =>
        text(f.name) && finite(f.since, 0, 110) && finite(f.closeness, 0, 100),
    )
  )
    return false;
  if (
    !Array.isArray(d.moves) ||
    d.moves.length > 110 ||
    !d.moves.every(
      (m) =>
        finite(m.age, 0, 110) &&
        countries.some((c) => c.id === m.from) &&
        countries.some((c) => c.id === m.to) &&
        finite(m.cost, 0),
    )
  )
    return false;
  if (
    !Array.isArray(d.journal) ||
    d.journal.length > 10 ||
    !d.journal.every((j) => finite(j.age, 0, 110) && text(j.text, 500))
  )
    return false;
  if (
    !Array.isArray(d.milestones) ||
    d.milestones.length > 20 ||
    !d.milestones.every(
      (m) => text(m.id) && text(m.title) && finite(m.age, 0, 110),
    )
  )
    return false;
  if (
    ![null, ...Object.keys(reflectionQuestions).map(Number)].includes(
      d.reflection,
    ) ||
    ![null, ...Object.keys(sceneCatalog).map(Number)].includes(d.pendingScene)
  )
    return false;
  if ((s.pending === "scene") !== (d.pendingScene !== null)) return false;
  if (d.pendingScene !== null && d.pendingScene !== s.age) return false;
  if (d.reflection !== null && (d.reflection !== s.age || s.stage !== "living"))
    return false;
  if (
    d.world === "past" &&
    !worldCountries(countries, "past", s.year).some((c) => c.id === d.residence)
  )
    return false;
  if (
    !Array.isArray(d.visited) ||
    d.visited.length > 217 ||
    !d.visited.every((id) => countries.some((c) => c.id === id))
  )
    return false;
  if (!validExperience(d.experience, s, countries)) return false;
  if (d.autoFocus !== undefined && typeof d.autoFocus !== "boolean") return false;
  return true;
}
