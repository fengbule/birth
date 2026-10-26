import { placeById, routinePlace, routeBetween } from './town-activities.js';
const activityProps=`<g class="activity-prop prop-school"><path d="M11 22l5-1 5 1v6l-5-1-5 1z" fill="#fff1c6"/><path d="M16 21v6" stroke="#a08b61"/></g><g class="activity-prop prop-farm"><path d="M17 23h5v5h-5zM21 25l4-3v2l-3 3" fill="#759da5"/><path d="M17 23v-2h4v2" fill="none" stroke="#426a70"/></g><g class="activity-prop prop-work"><path d="M21 18v9" stroke="#a98254" stroke-width="2"/><path d="M18 17h7v3h-7z" fill="#727e7a"/></g><g class="activity-prop prop-cafe"><path d="M17 23h5v5h-5z" fill="#fff1d3"/><path d="M22 24h2v2h-2" fill="none" stroke="#d1ac74"/></g><g class="activity-prop prop-clinic"><path d="M17 22h7v7h-7z" fill="#e9ead9"/><path d="M20 23v5M18 25h5" stroke="#b76653"/></g><g class="activity-prop prop-park"><circle cx="21" cy="27" r="4" fill="#e2b65b"/><path d="M18 25l5 5M18 29l5-5" stroke="#c77d4a"/></g><g class="activity-prop prop-lake"><path d="M20 27l4-16M24 11l3 15" fill="none" stroke="#b28d56"/><path d="M27 26v4" stroke="#dadfc5"/></g><g class="activity-prop prop-home"><path d="M18 18v-3h3v1h1v-1h3v3l-3 3z" fill="#c97968"/></g>`;

export function personSprite(seed=0,{child=false,elder=false,shirt}={}){
  const skins=['#dba57c','#a66f4d','#edbd94','#79513e'];
  const skin=skins[(seed>>>0)%skins.length],hair=elder?'#d5d1bc':['#443b31','#604332','#292e2b'][seed%3];
  const color=shirt||['#be684e','#6689a0','#a887b2','#dbad52'][seed%4];
  return `<svg viewBox="0 0 24 32" shape-rendering="crispEdges" aria-hidden="true"><ellipse cx="12" cy="30" rx="9" ry="2" fill="#2f493e" opacity=".22"/><g class="sprite-body"><path d="M6 8h12v11H6z" fill="${skin}"/><path d="M5 7h14v5H5zM5 11h3v5H5zM16 11h3v4h-3z" fill="${hair}"/><path d="M8 6h9v2H8z" fill="${hair}"/><path d="M8 13h2v2H8zM15 13h2v2h-2z" fill="#30342c"/><path d="M11 17h3v1h-3z" fill="#9a5f4d"/><path d="M6 19h13v9H6z" fill="${color}"/><path d="M6 19h3v8H6z" fill="#fff" opacity=".17"/><path class="sprite-arm left" d="M3 20h3v7H3z" fill="${skin}"/><path class="sprite-arm right" d="M19 20h3v7h-3z" fill="${skin}"/><path class="sprite-foot left" d="M7 28h5v3H7z" fill="#4d4940"/><path class="sprite-foot right" d="M14 28h5v3h-5z" fill="#4d4940"/>${child?'<path d="M3 4h7v3H3z" fill="#e4bd5b"/>':''}</g></svg>`;
}

export class TownScene {
  constructor({onPhase=()=>{}}={}){
    this.node=null;this.position={x:205,y:320};this.path=[];this.place='home';
    this.operation=null;this.time=0;this.onPhase=onPhase;this.lifeId=null;
  }
  attach(node,life){
    this.node=node;
    if(this.lifeId!==life.id){
      this.cancel();this.lifeId=life.id;this.position={x:205,y:320};this.place='home';this.routine=null;
    }
    const actor=node.querySelector('.town-avatar');
    const appearance=[life.seed,life.age<6,life.age>=65].join(':');
    if(actor.dataset.appearance!==appearance){
      actor.innerHTML=personSprite(life.seed,{child:life.age<6,elder:life.age>=65}).replace('</svg>',activityProps+'</svg>')+'<span class="actor-bubble"></span>';
      actor.dataset.appearance=appearance;
    }
    actor.classList.toggle('is-child',life.age<6);
    node.dataset.life=life.id;node.dataset.season=['spring','summer','autumn','winter'][Math.floor(life.age/3)%4];
    const key=[life.id,life.age,life.focus].join(':');
    if(key!==this.routine&&!this.operation){
      this.routine=key;
      const place=routinePlace(life);
      this.move(place.id,place.verb);
    }
    this.draw();
  }
  move(id,label,options={}){
    const place=placeById(id);
    if(!place)return false;
    this.path=routeBetween(this.position,place);
    this.place=id;this.label=label;
    this.operation=options.complete?{
      ...options,phase:this.path.length?'walking':'acting',elapsed:0,total:Math.max(650,options.duration||1600),
    }:null;
    this.node?.setAttribute('data-activity',id);
    this.onPhase(this.path.length?'walking':'acting');
    this.draw();return true;
  }
  tick(delta,paused=false){
    if(!this.node?.isConnected)return;
    this.node.dataset.paused=String(paused);
    if(paused)return;
    this.time+=delta;
    let travel=delta/1000*(this.operation?.quick?850:190);
    while(this.path.length&&travel>0){
      const next=this.path[0],distance=Math.hypot(next.x-this.position.x,next.y-this.position.y);
      if(distance<=travel){this.position={...next};travel-=distance;this.path.shift();}
      else {this.position.x+=(next.x-this.position.x)/distance*travel;this.position.y+=(next.y-this.position.y)/distance*travel;travel=0;}
    }
    if(!this.path.length&&this.operation){
      if(this.operation.phase==='walking'){this.operation.phase='acting';this.onPhase('acting');}
      this.operation.elapsed+=delta;
      if(this.operation.elapsed>=this.operation.total){
        const complete=this.operation.complete;this.operation=null;this.draw();complete();return;
      }
    }
    this.draw();
  }
  draw(){
    if(!this.node)return;
    const actor=this.node.querySelector('.town-avatar');
    actor.style.left=this.position.x/960*100+'%';actor.style.top=this.position.y/704*100+'%';
    actor.classList.toggle('walking',this.path.length>0);
    actor.classList.toggle('acting',!this.path.length);
    actor.dataset.activity=this.place;
    actor.dataset.step=String(Math.floor(this.time/180)%2);
    const bubble=actor.querySelector('.actor-bubble');
    if(bubble)bubble.textContent=this.path.length?'出发啦':this.label||'在家里';
    const progress=this.node.closest('.town-world')?.querySelector('.town-progress i');
    if(progress)progress.style.width=(this.operation?(this.path.length?24:35+this.operation.elapsed/this.operation.total*65):100)+'%';
    this.node.querySelectorAll('[data-town-place]').forEach(button=>button.classList.toggle('is-current',button.dataset.townPlace===this.place));
    this.node.querySelectorAll('.town-npc').forEach((npc,i)=>{
      const x=Number(npc.dataset.x)+Math.sin(this.time/6500+i*2)*(i%2?25:14);
      npc.style.left=x/960*100+'%';
    });
  }
  cancel(){this.operation=null;this.path=[];}
}
