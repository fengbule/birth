import { appendRecord } from './records.js';
import { experience, temperamentName } from './experience.js';

// Publicly observed stages. Random outcomes and likelihoods are independently modelled.
export const hobbies = [
  {id:'football',name:'足球',hint:'幸福+ 健康+ 人际关系+',effect:{happiness:4,health:3,relationships:2}},
  {id:'walk',name:'爬山·散步',hint:'幸福+ 健康+',effect:{happiness:4,health:4}},
  {id:'fish',name:'钓鱼',hint:'幸福+ 健康+',effect:{happiness:5,health:2}},
  {id:'paint',name:'画画',hint:'幸福+ 知识+',effect:{happiness:5,knowledge:3}},
  {id:'music',name:'唱歌·演奏乐器',hint:'幸福+ 知识+ 人际关系+',effect:{happiness:4,knowledge:2,relationships:2}},
  {id:'drama',name:'戏剧表演',hint:'幸福+ 人际关系+',effect:{happiness:4,relationships:4}},
  {id:'dance',name:'跳舞',hint:'幸福+ 健康+ 人际关系+',effect:{happiness:4,health:2,relationships:2}},
  {id:'tabletennis',name:'桌球',hint:'幸福+ 健康+',effect:{happiness:4,health:3}},
  {id:'cricket',name:'板球',hint:'幸福+ 健康+ 人际关系+',effect:{happiness:4,health:3,relationships:2}},
];
const clamp = n=>Math.min(100,Math.max(0,n));
const log = (s,text,type='life')=>appendRecord(s,text.slice(0,70),text,type);
const jobs = ['店员','办公室职员','汽车维修技师','护理助理','自营业者'];
const majors = ['工程','艺术·设计','法律','教育','资讯工程'];
const base = c=>c.gdp||5000;
const setChoice = (s,id)=>{ experience(s).chapter=id;s.pending=s.age; };
const englishNames = {
  'Sub-Saharan Africa':[['David','Samuel','Jean','Moussa'],['Grace','Amina','Marie','Sarah']],
  'South Asia':[['Arjun','Ravi','Pankaj','Rahul'],['Priya','Asha','Salma','Anita']],
  'Latin America & Caribbean':[['Mateo','Lucas','Gabriel','Pedro'],['Sofia','Ana','Maria','Lucia']],
};
export function initChronology(s,c,draw) {
  if (s.flowVersion!==2) return;
  const lists=englishNames[c.region?.trim()]||[['Alex','Daniel','Noah','Luca'],['Emma','Sofia','Mia','Anna']];
  const pick=list=>list[Math.floor(draw()*list.length)];
  const kin=Array.from({length:Math.floor(draw()*3)},(_,i)=>({sex:draw()<.5?'男':'女',bornAge:-(3+i*3+Math.floor(draw()*3))}));
  s.home=draw()<(c.urban||56)/100?'城市':'乡村';
  const religions=c.religions||[];
  const religionDraw=draw()*100;
  let totalReligion=0;
  const faith=religions.find(r=>{totalReligion+=Number(r.match(/[\d.]+/)?.[0]||0);return religionDraw<totalReligion;});
  s.profile={month:1+Math.floor(draw()*12),city:s.home==='城市'?(c.cities?.length?pick(c.cities):c.capital||c.name):'乡村',
    quintile:Math.min(5,1+Math.floor(s.family/20)),
    religion:faith?faith.replace(/\s*[\d.]+%$/,''):/Middle East|Pakistan/.test(c.region)?'伊斯兰教':c.code==='IN'?'印度教':c.code==='CN'?'无宗教信仰':/Latin America|Sub-Saharan/.test(c.region)?'基督教':'无宗教信仰',
    parents:[pick(lists[1]),pick(lists[0])],siblings:kin};
  s.education='学龄前';s.occupation='婴儿';
  s.housing='还住在父母家';
  const top=s.profile.quintile;
  const brothers=kin.map(k=>`${-k.bornAge}岁的${k.sex==='男'?'哥哥':'姊姊'}`).join('和');
  s.events=[];
  log(s,`${s.year}年${s.profile.month}月，你出生在${c.name}${s.profile.city==='乡村'?'的乡村':s.profile.city}，一个所得${top===5?'前20%':top===1?'后20%':`第${top}分位`}的家庭，是个${s.sex==='女'?'女孩':'男孩'}。${brothers?'上面有'+brothers+'。':''}家人${s.profile.religion==='无宗教信仰'?'没有宗教信仰':'信仰'+s.profile.religion}。`,'birth');
  log(s,s.family>45?'你在家人的照顾下，按时接种了婴儿疫苗。':'有几种疫苗没能按时接种，家人还在等待下一次机会。');
  const x=experience(s);x.chapters=[];x.chapter=null;x.hobby=null;x.hobbySkill=0;
  x.hobbyOptions=[...hobbies].sort((a,b)=>((s.seed*(hobbies.indexOf(a)+11))%37)-((s.seed*(hobbies.indexOf(b)+11))%37)).slice(0,3).map(h=>h.id);
}

export function chronologyYear(s,c,draw,countries) {
  if(s.flowVersion!==2)return;
  const x=experience(s),p=s.profile;
  if(s.age===1){
    log(s,`1岁。在${c.name}同年出生的孩子们，正和你一起慢慢长大。`,'milestone');
    log(s,'家人抱着你一起度过了节日。');
    log(s,'你迈出了第一步。摇摇晃晃地向前，家人在旁边为你鼓掌。');
  } else if(s.age===2){log(s,'睡前，父母会陪着你看图画书，讲里面的人和动物。');setChoice(s,'temperament');}
  else if(s.age===3){log(s,'你说的话越来越多了，也开始问许多「为什么」。');log(s,'你试着自己穿好衣服，出门前还要回头看看家人。');}
  else if(s.age===5){log(s,'你到了可以上幼儿园的年纪。','education');log(s,`五岁生日到了。曾经需要被抱在怀里的孩子，已经能自己跑过这条路。`,'milestone');}
  else if(s.age===6){s.education='就读小学';s.occupation='小学生';log(s,'一个同班的孩子成为了你最好的朋友。');}
  else if(s.age===7){log(s,'大人问起长大以后要做什么，你认真说出了自己的愿望。');setChoice(s,'hobby');}
  else if(s.age===12&&s.education==='就读小学'){setChoice(s,'secondary');}
  else if(s.age===(c.id==='CAF'?16:15)&&s.education==='就读国中'){setChoice(s,'highschool');}
  else if(s.age===(c.id==='CAF'?19:18)){setChoice(s,s.education==='就读高中'?'university':'first-job');}
  else if(s.age===22&&s.education==='大学毕业'){setChoice(s,'graduation');}
  else if(s.age===22&&s.education==='军校在读'){s.education='军校毕业';s.occupation='军官';s.salaryFactor=1.8;log(s,'你完成军校课程，开始担任军官。','education');}
  else if(s.age===24&&s.education==='研究所在读'){s.education='研究所毕业';s.occupation='初入职场';setChoice(s,'first-job');}
  else if(s.age===62&&!s.retired){setChoice(s,'retirement');}
  if(s.age>=8&&x.hobby){
    if(s.focus==='rest')x.hobbySkill=Math.min(100,x.hobbySkill+3);
    else if(draw()<.35)x.hobbySkill=Math.min(100,x.hobbySkill+1);
  }
  if(s.age>=6&&s.age<18&&draw()<.4){const gift=Math.max(1,Math.round(base(c)*.002));s.money+=gift;log(s,'家里的长辈给了你一些零用钱，你把它收了起来。');}
  if(!s.pending&&s.age>=8&&s.age<18&&draw()<.12)setChoice(s,'friend');
  if(!s.pending&&s.age>=18&&s.age<55&&!s.partner&&draw()<.12)setChoice(s,'romance');
  if(!s.pending&&s.partner&&!x.married&&s.age>=19&&draw()<.32)setChoice(s,'marriage');
  if(!s.pending&&x.married&&!x.noMoreChildren&&s.age<43&&s.children<3&&draw()<.16)setChoice(s,'child');
  if(!s.pending&&s.age>=20&&s.age<70&&draw()<.06)setChoice(s,'help');
  if(s.age>3){
    const childhood=[
      '母亲为你做了喜欢的饭菜，那个味道留在了记忆里。','你和附近的孩子玩到傍晚，家里人喊了好几遍才肯回去。',
      '长辈讲起从前的故事，你坐在旁边听了很久。','你在路边捡到一颗好看的石头，小心地收进了口袋。',
      '你记住了一首新歌，回家的路上一直轻轻唱着。','你画了一幅全家人的画，把自己放在最中间。'];
    const youth=['放学的路上，你和朋友聊起了以后的生活。','你在书里读到一个从未去过的地方。','一次小考之后，你慢慢找到了适合自己的读书方法。','你和朋友因为小事吵了架，过几天又和好了。'];
    const adult=['下班后的一顿家常饭，让疲惫的一天有了温度。','你和老朋友聊了很久，才发现大家都变了些。','你发现常走的街道开了一家新店。','一张旧照片，让你想起了小时候的日子。','你抽空去了公园，坐在树荫下看人来人往。','家里有东西需要修理，你花了一个下午慢慢处理。'];
    const elder=['午后，你坐在窗边，慢慢回想以前的日子。','你遇见许久不见的熟人，互相问候了近况。','天气不错，你沿着熟悉的路走了一小段。'];
    const pool=s.age<8?childhood:s.age<18?youth:s.age<65?adult:elder;
    const count=1+Math.floor(draw()*3);
    const start=Math.floor(draw()*pool.length);
    for(let i=0;i<count;i++)log(s,pool[(start+i)%pool.length]);
  }
  for(const peer of s.peers.filter(p=>p.deathAge===s.age)){
    const pc=countries.find(c=>c.id===peer.country);
    log(s,`与你在同一秒出生、来自${pc?.name||'远方'}的${peer.name}，在${s.age}岁离世。`,'milestone');
  }
}

export function chronologyDecision(s,c) {
  if(s.flowVersion!==2||!experience(s).chapter)return null;
  const id=experience(s).chapter, choice=(title,hint='',extra={})=>({title,hint,...extra});
  let d;
  if(id==='temperament')d={title:'两岁，陌生的外面世界',text:`${s.name}已经能走稳了，家门外有许多第一次见到的东西。孩子会怎样回应这个世界？这些经历会与天生的倾向一起，慢慢塑造气质。`,choices:[choice('蹲下来，仔细看看泥土与石头'),choice('向前跑，试试自己能走多远'),choice('走过去陪伴正在哭的小朋友'),choice('跌倒后自己站起来，再试一次')]};
  if(id==='hobby')d={title:'找到喜欢的事',text:'空闲时，你最想做哪一件事？',choices:experience(s).hobbyOptions.map(id=>{const h=hobbies.find(h=>h.id===id);return choice(h.name,h.hint,{hobby:id});})};
  if(id==='secondary')d={title:'要升国中吗？',text:'小学毕业了。继续读书需要时间，也需要家里负担学费、制服和交通。',choices:[choice('继续读书','家庭经济状况与学习成绩影响结果'),choice('开始工作，帮忙家里','开始赚取收入，中断学业')]};
  if(id==='highschool')d={title:'要继续读高中吗？',text:'读完国中，下一步要怎么走？',choices:[choice('继续读高中','为大学准备，需要学费和时间'),choice('就读职业学校','学习一门实用技能'),choice('直接开始工作','分担家里的开销')]};
  if(id==='university')d={title:'毕业后的十字路口',text:'高中毕业了。接下来，你想走向哪里？成绩、家境和当地的教育机会，都会影响结果。',choices:[choice('挑战大学入学考试','知识与家境影响录取机会'),choice('直接就业','早点开始赚钱'),choice('报考军官学校','需要通过录取，毕业后服役'),choice('出国留学',s.money<base(c)*8?'家里的经济负担不起':'需要支付学费和生活费',{disabled:s.money<base(c)*8})]};
  if(id==='major')d={title:'要读什么科系呢？',text:'收到录取通知后，你开始认真考虑未来几年要学习的方向。',choices:majors.map(m=>choice(m,'知识与以后的职业机会'))};
  if(id==='graduation')d={title:'毕业之后',text:'大学生活结束了，接下来要怎样安排自己的生活？',choices:[choice('寻找工作','开始独立生活'),choice('继续进修','投入时间和学费'),choice('先照顾家里','把时间留给家人')]};
  if(id==='first-job')d={title:'选择你的第一份工作',text:'你开始了解不同工作的要求、薪水和日常。要尝试哪一个方向？',choices:jobs.map((job,i)=>choice(job,`年收入约 ${Math.round(base(c)*(.16+i*.06)).toLocaleString('zh-CN')}（PPP）`))};
  if(id==='friend')d={title:'要成为朋友吗？',text:'最近，你与一个同龄人常常碰面。对方想和你多聊一会儿。',choices:[choice('好啊，一起玩吧','人际关系+'),choice('暂时保持距离','保留自己的时间')]};
  if(id==='romance')d={title:'爱情来了',text:'相处的日子里，你发现自己开始期待和这个人见面。对方也想更认真地认识你。',choices:[choice('试着交往看看','开始一段感情'),choice('现在还是做朋友吧','保持目前的生活')]};
  if(id==='marriage')d={title:'谈起结婚',text:'你们开始谈起未来。要怎样安排接下来的日子？',choices:[choice('一起结婚','组成家庭'),choice('先继续交往','以后再决定'),choice('选择同居','一起生活'),choice('结束这段关系','各自向前走')]};
  if(id==='child')d={title:`要生第${s.children+1}个孩子吗？`,text:'你们开始讨论家里要不要再多一个成员。时间、收入和照顾，都是需要考虑的事。',choices:[choice('迎接一个孩子','开始养育孩子'),choice('再等一等','先维持现在的生活'),choice('不打算再生育','把时间留给现有的家人')]};
  if(id==='help')d={title:'倒在路边的人',text:'路边有人似乎需要帮助。周围的人还没停下脚步。',choices:[choice('停下来帮忙','付出一些时间，关系+'),choice('请其他人来处理','继续自己的行程')]};
  if(id==='retirement')d={title:'要退休了吗？',text:'工作了这么多年，接下来的生活可以有不同的安排。',choices:[choice('退休，慢慢生活','开始领取退休收入'),choice('继续工作','保留现在的工作节奏')]};
  return d?{...d,id,age:s.age}:null;
}

export function resolveChronology(s,index,c,draw) {
  const d=chronologyDecision(s,c), ch=d?.choices[index];
  if(!ch||ch.disabled||!Number.isInteger(index))return false;
  const x=experience(s);x.chapters.push({id:d.id,age:s.age,choice:index});x.chapter=null;s.pending=null;
  const boost=(key,n)=>s[key]=clamp(s[key]+n);
  let text='';
  if(d.id==='temperament'){x.childhoodChoice=index;x.temperament[index]=Math.min(100,x.temperament[index]+25);text=['你喜欢专心地观察新鲜的小东西。','你总想跑在前面，亲自试一试。','你会留意身边人的心情。','你愿意在失败以后再试一次。'][index];}
  if(d.id==='hobby'){x.hobby=ch.hobby;x.hobbySkill=1;const h=hobbies.find(h=>h.id===ch.hobby);for(const[k,v]of Object.entries(h.effect))boost(k,v);text=`你开始喜欢${h.name}。空闲的时候，会想多花一点时间练习。`;}
  if(d.id==='secondary'){
    if(index===0){s.education='就读国中';s.occupation='学生';boost('knowledge',4);text='你继续升学，开始了国中的生活。';}
    else{s.education='小学毕业';s.occupation='帮忙家里';s.salaryFactor=.65;text='你开始帮家里做事，赚取一点收入。';}
  }
  if(d.id==='highschool'){s.education=['就读高中','职业教育','国中毕业'][index];s.occupation=index===2?'初入职场':'学生';text=['你升上高中，继续为以后的升学准备。','你选择就读职业学校，开始练习实用技能。','你离开学校，开始寻找工作。'][index];}
  if(d.id==='university'){
    if(index===0||index===3){
      const chance=Math.min(.97,Math.max(.1,s.knowledge*.007+s.family*.003-.15));
      if(index===3||draw()<chance){s.education='大学在读';s.occupation='大学生';if(index===3)s.money-=Math.round(base(c)*8);text='你收到大学录取通知，开始准备入学。';setChoice(s,'major');}
      else{s.education='高中毕业';s.occupation='初入职场';text='这次没有考上大学。你决定先开始工作。';setChoice(s,'first-job');}
    }else if(index===2){s.education='军校在读';s.occupation='军校学生';text='你通过录取，进入军官学校学习。';}
    else{s.occupation='初入职场';text='你开始准备进入职场。';setChoice(s,'first-job');}
  }
  if(d.id==='major'){x.major=majors[index];boost('knowledge',5);text=`你进入大学，主修${x.major}。`;}
  if(d.id==='graduation'){
    if(index===0){text='大学毕业后，你开始找工作。';setChoice(s,'first-job');}
    if(index===1){s.education='研究所在读';s.occupation='研究生';s.money-=Math.round(base(c)*.12);text='你继续进入研究所学习。';}
    if(index===2){s.occupation='全职家管';text='你决定先把时间留给家里。';}
  }
  if(d.id==='first-job'){s.occupation=jobs[index];s.salaryFactor=.65+index*.22;experience(s).employed=true;text=`你找到了第一份工作，成为${s.occupation}。`;}
  if(d.id==='friend'){if(index===0){s.deep.friends.push({name:'新认识的朋友',since:s.age,closeness:65});boost('relationships',5);text='你们成为了朋友。';}else text='你选择先保持距离。';}
  if(d.id==='romance'){if(index===0){s.partner=true;s.deep.partner={name:'与你相伴的人',since:s.age,closeness:78};boost('happiness',5);text='你们开始交往。';}else text='你决定暂时保持朋友的关系。';}
  if(d.id==='marriage'){if(index===0){x.married=true;text='你们结婚了，开始安排共同的生活。';}else if(index===3){s.partner=false;s.deep.partner=null;text='你们结束了交往，各自走向下一段生活。';}else{text=index===2?'你们决定先住在一起。':'你们决定再相处一段时间。';}}
  if(d.id==='child'){if(index===0){s.children++;text='家里迎来了一个孩子，你开始学习照顾一个新的生命。';}else {text=index===1?'你们决定再等一等。':'你们决定不再生育。';if(index===2)x.noMoreChildren=true;}}
  if(d.id==='help'){if(index===0){boost('relationships',3);boost('happiness',2);text='你停下来帮忙，直到有人赶来照顾。';}else text='你请附近的人协助处理，继续赶路。';}
  if(d.id==='retirement'){if(index===0){s.retired=true;s.occupation='退休';text='你退休了，日子有了新的节奏。';}else text='你决定继续工作一段时间。';}
  log(s,text,'decision');return true;
}

export function validChronology(s) {
  if(s.flowVersion===undefined||s.flowVersion===1)return true;
  if(s.flowVersion!==2)return false;
  const p=s.profile,x=s.deep?.experience,ids=['temperament','hobby','secondary','highschool','university','major','graduation','first-job','friend','romance','marriage','child','help','retirement'];
  return p&&Number.isInteger(p.month)&&p.month>=1&&p.month<=12
    &&Number.isInteger(p.quintile)&&p.quintile>=1&&p.quintile<=5
    &&['city','religion'].every(k=>typeof p[k]==='string'&&p[k].length<=100)
    &&Array.isArray(p.parents)&&p.parents.length===2&&p.parents.every(n=>typeof n==='string'&&n.length<=100)
    &&Array.isArray(p.siblings)&&p.siblings.length<=20&&p.siblings.every(k=>['男','女'].includes(k.sex)&&Number.isInteger(k.bornAge)&&k.bornAge>=-25&&k.bornAge<=s.age)
    &&x&&Array.isArray(x.chapters)&&x.chapters.length<=500&&x.chapters.every(ch=>ids.includes(ch.id)&&Number.isInteger(ch.age)&&ch.age>=0&&ch.age<=s.age&&Number.isInteger(ch.choice)&&ch.choice>=0&&ch.choice<=5)
    &&(x.chapter===null||ids.includes(x.chapter))&&(!x.chapter||s.pending===s.age)
    &&Array.isArray(x.hobbyOptions)&&x.hobbyOptions.length===3&&x.hobbyOptions.every(id=>hobbies.some(h=>h.id===id))
    &&(x.hobby===null||hobbies.some(h=>h.id===x.hobby))&&Number.isFinite(x.hobbySkill)&&x.hobbySkill>=0&&x.hobbySkill<=100;
}
