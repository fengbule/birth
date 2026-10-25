import { experience, recordYear } from './experience.js';
import { initSystems, livingCountry, migrate } from './systems.js';
import { appendRecord } from './records.js';
const clamp = (n,a=0,b=100) => Math.min(b,Math.max(a,n));

export function consumptionOptions(s,countries) {
  const d=initSystems(s),x=experience(s),g=livingCountry(s,countries).gdp||8000;
  const adult=s.age>=18, employed=s.income>0&&!s.retired;
  const limit=adult&&(employed||d.partner) ? Math.max(s.income*.25,g*.12) : 0;
  const items=[
    ['dinner','和亲友聚餐',.012,1,'幸福与关系'],
    ['checkup','健康检查',.032,1,'健康与安心'],
    ['bicycle','添一辆自行车',.085,5,'日常出行与健康'],
    ['television','买一台电视',.16,8,'休闲与家庭生活'],
    ['travel','安排一次旅行',.09,2,'换个地方，留下一段回忆'],
    ['donate','为社区捐款',.02,1,'帮助身边的人'],
    ['match','通过介绍认识对象',.015,2,'之后可能收到介绍'],
    ['jobhunt',employed?'寻找新的工作':'找工作',0,2,'等待之后的岗位机会'],
    ['train-technical','技术与维修职训',.035,2,'实用工具、机械与维修'],
    ['train-service','烹饪与美容职训',.035,2,'餐饮、美容与服务'],
    ['train-care','照护职训',.035,2,'学习照顾与协助他人'],
    ['train-office','文书与电脑职训',.035,2,'文书、电脑与办公室技能'],
    ['certificate','证照课程',.045,2,'为职业准备新的资格'],
    ['foreign','打听国外工作机会',.012,3,'了解另一片土地的生活'],
  ];
  return items.filter(([id])=>adult && !(id==='match'&&d.partner) && !(id==='jobhunt'&&s.retired)
    && !(id.startsWith('train-')&&['大学毕业','大学在读'].includes(s.education)))
    .map(([id,title,rate,years,description])=>{
      const cost=Math.round(g*rate),group=id.startsWith('train-')||id==='certificate'?'training':id;
      const remaining=Math.max(0,(x.cooldowns[group]||0)-s.age);
      const allowed=s.money-cost>=-limit;
      return {id,title,cost,years,description,group,remaining,borrow:cost>Math.max(0,s.money),
        disabled:s.stage!=='living'||!!s.pending||d.reflection!==null||remaining>0||!allowed,
        reason:remaining?`${remaining} 年后可再选择`:!allowed?(limit?'超过可借贷的额度':'钱不够'):cost>Math.max(0,s.money)?'借钱支付':''};
    });
}

export function consume(s,id,countries) {
  const d=initSystems(s),x=experience(s),item=consumptionOptions(s,countries).find(i=>i.id===id);
  if(!item||item.disabled)return {ok:false,message:item?.reason||'现在还不能进行这项活动。'};
  s.money-=item.cost;
  d.annual.expenses+=item.cost;
  x.cooldowns[item.group]=s.age+item.years;
  const plus=(key,n)=>s[key]=clamp(s[key]+n);
  if(id==='dinner'){plus('happiness',5);plus('relationships',4);}
  if(id==='checkup')plus('health',8);
  if(id==='bicycle'){plus('health',4);plus('happiness',3);}
  if(id==='television'||id==='travel')plus('happiness',8);
  if(id==='donate'){plus('happiness',4);plus('relationships',3);}
  if(item.group==='training'){
    plus('knowledge',7);d.career.experience++;
    x.specialty=id;
  }
  if(['jobhunt','match','foreign'].includes(id)){
    const delay=id==='jobhunt'&&s.income>0&&!s.retired?2:1;
    x.queued.push({id:`${id}-${s.age}`,type:id,age:s.age+delay,...(id==='match'?{attempt:1}:{})});
  }
  appendRecord(s,item.title,id==='jobhunt'?'你递出了求职申请，等待后续消息。':id==='match'?'你留下了自己的期望，新的相遇还需要一点时间。':id==='foreign'?'你向外地的朋友打听机会，等候进一步的消息。':`你为这件事支出了 ${item.cost.toLocaleString('zh-CN')} PPP 国际元。`,'action');
  recordYear(s);
  return {ok:true,message:item.borrow?'支出已记下，超出现金的部分形成负债。':'这件事已记进人生。'};
}

export function activateQueuedEvent(s) {
  const x=experience(s);
  if(s.stage!=='living'||s.pending||x.activeEvent)return;
  const index=x.queued.findIndex(e=>e.age<=s.age);
  if(index<0)return;
  const [event]=x.queued.splice(index,1);
  x.activeEvent={...event,age:s.age};
  s.pending='life-event';
}

export function queuedDecision(s,countries) {
  const x=experience(s),event=x.activeEvent;
  if(!event)return null;
  const roles={'train-technical':'维修技师','train-service':'餐饮服务人员','train-care':'照护工作人员','train-office':'文书助理',certificate:'专业技术人员'};
  const role=roles[x.specialty]||(s.education==='大学毕业'?'专业职员':'店铺工作人员');
  if(event.type==='jobhunt')return {title:'求职有了新的消息',text:`之前投出的申请有了回应。一个${role}的岗位正在招人，你愿意接下这个机会吗？`,choices:[
    {title:`接受${role}的工作`,hint:'开始适应新的岗位'},
    {title:'暂时婉拒，继续寻找',hint:'保留现在的生活安排'},
  ]};
  if(event.type==='match')return {title:'有人想介绍你们认识',text:'通过之前留下的介绍，你认识了一位愿意慢慢了解彼此的人。你想怎样回应？',choices:[
    {title:'认真交往，看看以后的生活',hint:'开始一段关系'},
    {title:'再多见几次，慢慢了解',hint:'之后继续收到消息'},
    {title:'先做朋友',hint:'留下一个新的朋友'},
    {title:'这次就到这里',hint:(event.attempt||1)<3?'看看下一位介绍的人':'结束这轮介绍'},
  ]};
  if(event.type==='foreign'){
    const target=countries.find(c=>c.id==='AUS'&&c.id!==s.deep.residence)||countries.find(c=>c.id!==s.deep.residence);
    return {title:'远方的工作机会',text:`之前的打听有了回音，有人提到了${target.name}的机会。迁居需要储备和重新适应。`,choices:[
      {title:`尝试前往${target.name}`,hint:'按现有迁居条件与安置费用办理'},
      {title:'留在熟悉的地方',hint:'继续眼前的生活'},
    ]};
  }
  if(event.type==='foreign-work')return {title:'在新地方寻找工作',text:'安顿下来之后，一份工作机会有了回应。新的语言、同事和工作方式，都需要重新熟悉。',choices:[
    {title:'接受这份工作',hint:'在新地方积累工作经历'},
    {title:'继续寻找',hint:'保留目前的安排'},
  ]};
  if(event.type==='foreign-residency')return {title:'留下来的可能',text:'工作和生活渐渐有了秩序，你可以决定是否继续办理长期居留。在这段虚构人生里，手续会成为下一段生活的起点。',choices:[
    {title:'申请永久居留',hint:'把这里作为长期生活的地方'},
    {title:'暂时维持现状',hint:'先继续眼前的生活'},
  ]};
  return null;
}

export function resolveQueuedEvent(s,index,countries) {
  const d=initSystems(s),x=experience(s),event=x.activeEvent,decision=queuedDecision(s,countries);
  if(!decision?.choices[index]||!Number.isInteger(index))return false;
  let text=decision.choices[index].title;
  if(event.type==='jobhunt'&&index===0){
    s.occupation=decision.choices[0].title.replace(/^接受|的工作$/g,'');
    d.career.unemployed=0;s.salaryFactor=clamp(s.salaryFactor+.12,.25,4);
  }
  if(event.type==='match'){
    if(index===0){s.partner=true;d.partner={name:'与你相伴的人',since:s.age,closeness:70};s.happiness=clamp(s.happiness+6);}
    const attempt=event.attempt||1;
    if(attempt<3&&(index===1||index===3))x.queued.push({id:`match-${s.age}-${attempt+1}`,type:'match',age:s.age+(index===1?1:0),attempt:attempt+1});
    if(index===2&&d.friends.length<20)d.friends.push({name:'通过介绍认识的朋友',since:s.age,closeness:60});
  }
  s.pending=null;x.activeEvent=null;
  if(event.type==='foreign'&&index===0){
    const target=countries.find(c=>c.id==='AUS'&&c.id!==d.residence)||countries.find(c=>c.id!==d.residence);
    const result=migrate(s,target.id,countries);text=result.message;
    if(result.ok){
      x.residency={country:target.id,status:'work'};
      x.queued.push({id:`foreign-work-${s.age}`,type:'foreign-work',age:s.age+1,country:target.id});
    }
  }
  if(event.type==='foreign-work'&&index===0&&event.country===d.residence){
    s.occupation='当地企业职员';d.career.unemployed=0;
    x.queued.push({id:`foreign-residency-${s.age}`,type:'foreign-residency',age:s.age+1,country:event.country});
  }
  if(event.type==='foreign-residency'&&index===0&&event.country===d.residence){
    x.residency={country:event.country,status:'permanent'};
    text='经过这段时间的工作和适应，长期居留的申请完成了。';
  }
  appendRecord(s,decision.title,text,'decision');
  recordYear(s);
  activateQueuedEvent(s);
  return true;
}
