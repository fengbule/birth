// State-driven pixel illustration, drawn locally without remote image dependencies.
const tones=['#9b6549','#c28b60','#e0b084','#71503c'];
export function pixelPerson(s,{x=0,y=0,scale=1,color='#7c9bab',baby=false,grey=false}={}) {
  const skin=tones[s.seed%tones.length],hair=grey?'#acaaa2':'#453b32',ink='#46504d';
  const r=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  let p='';
  p+=r(7,0,15,3,ink)+r(3,3,23,3,ink)+r(0,6,29,17,ink)+r(3,23,23,3,ink);
  p+=r(5,4,18,18,skin)+r(4,3,19,5,hair)+r(2,6,5,9,hair)+r(21,7,5,7,hair);
  p+=r(7,13,2,3,'#353e3b')+r(19,13,2,3,'#353e3b')+r(13,19,4,2,'#8e5e49');
  p+=r(5,26,20,17,ink)+r(2,29,5,11,ink)+r(24,29,5,11,ink);
  p+=r(7,27,16,14,color)+r(4,30,3,8,skin)+r(23,30,3,8,skin);
  p+=r(7,41,7,9,'#627476')+r(17,41,7,9,'#627476')+r(5,49,10,4,ink)+r(17,49,10,4,ink);
  if(baby)p+=r(2,26,25,16,'#9ebbbb')+r(6,26,17,5,'#c6dada');
  return `<g transform="translate(${x} ${y}) scale(${scale})">${p}</g>`;
}
export function portrait(s){
  return `<svg viewBox="0 0 64 82" aria-hidden="true" shape-rendering="crispEdges"><path fill="#b5d5db" d="M0 0H64V82H0z"/><path fill="#d5e8df" d="M4 5H16V18H4zM44 3H59V22H44zM0 34H64V60H0z"/>${pixelPerson(s,{x:5,y:8,scale:1.85,color:'#9db7ad',baby:true})}</svg>`;
}
export function pixelScene(s,c) {
  const r=(x,y,w,h,color)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
  let p=r(0,0,580,180,'#a9d3df');
  for(const [x,y,w]of [[21,16,64],[247,27,91],[436,36,70]]){
    p+=r(x,y+9,w,12,'#f2f6ec')+r(x+11,y,w-32,25,'#f2f6ec')+r(x+30,y-5,13,5,'#f2f6ec');
  }
  p+=r(0,87,580,65,'#d1dbd3');
  for(let i=0;i<12;i++){
    const x=i*56-10,h=26+((s.seed+i*17)%34);
    p+=r(x,111-h,41,h,'#aec3c3');
    for(let y=121-h;y<111;y+=9)for(let a=5;a<36;a+=10)p+=r(x+a,y,3,5,'#c9d9d2');
  }
  const rural=s.home!=='城市';
  if(rural){
    p+=r(0,105,580,45,'#b1c5a0');
    for(let i=0;i<18;i++)p+=r(i*37,127+(i%3)*4,21,2,'#95ad8a');
    p+=`<path d="M10 103L49 70H70L106 103Z" fill="#8c7660"/>`+r(17,101,80,47,'#d6c4a0')+r(48,118,20,30,'#76766c')+r(24,109,15,19,'#92b6b7');
    for(let i=0;i<4;i++)p+=r(423+i*41,102+(i%2)*4,4,46,'#7d8d76')+r(410+i*41,83+(i%2)*4,28,25,'#8da88b')+r(405+i*41,91+(i%2)*4,38,12,'#8da88b');
  }else{
    // Foreground apartment block with individual floors, trim, windows and entry.
    p+=r(10,29,94,119,'#5d7274')+r(16,22,18,8,'#5d7274')+r(70,22,18,8,'#5d7274');
    p+=r(13,32,88,113,'#d6d6c7')+r(17,26,14,7,'#ecebdb')+r(73,26,12,7,'#ecebdb');
    for(let y=39;y<126;y+=18)for(let x=20;x<93;x+=24){
      p+=r(x,y,15,12,'#b2b6ad')+r(x+2,y+1,11,8,'#89abb6')+r(x+3,y+1,5,3,'#bed7d7')+r(x-1,y+11,17,3,'#c2c5b7');
    }
    p+=r(45,126,24,22,'#5c7274')+r(49,130,15,17,'#a8c1bd')+r(54,130,3,17,'#667e7c')+r(39,124,36,3,'#a38981');
    p+=r(232,53,4,95,'#80908a')+r(220,66,28,4,'#80908a')+r(98,68,465,2,'#82948f');
    p+=r(174,124,5,24,'#81988a')+r(161,112,30,17,'#97b29a')+r(166,108,21,7,'#97b29a');
  }
  p+=r(0,148,580,8,'#c8c9b9')+r(0,156,580,24,'#828681')+r(0,155,580,3,'#e1decb');
  for(let x=10;x<580;x+=47)p+=r(x,168,24,3,'#dedbcb');
  for(let x=0;x<580;x+=23)p+=r(x,130,3,18,'#81928b');
  p+=r(0,135,580,3,'#91a198');
  if(s.age<18){
    p+=pixelPerson(s,{x:258,y:94,color:'#849dac',grey:s.age>12})+pixelPerson({...s,seed:s.seed+1},{x:294,y:94,color:'#a58e9d',grey:s.age>12});
    const scale=s.age<2?.48:s.age<6?.58:s.age<12?.75:.9;
    p+=pixelPerson(s,{x:330,y:147-53*scale,scale,color:'#619f95',baby:s.age<2});
    for(const [i,k] of (s.profile?.siblings||[]).slice(0,3).entries())p+=pixelPerson({...s,seed:s.seed+i+2},{x:356+i*29,y:109,scale:.72,color:['#a16b71','#77739b','#b19b63'][i]});
  }else{
    p+=pixelPerson(s,{x:282,y:94,color:'#6a969c',grey:s.age>=60});
    if(s.partner)p+=pixelPerson({...s,seed:s.seed+1},{x:317,y:94,color:'#ac8795',grey:s.age>=60});
    for(let i=0;i<Math.min(s.children,3);i++)p+=pixelPerson({...s,seed:s.seed+i+2},{x:352+i*27,y:114,scale:.62,color:'#a99a6d'});
  }
  return `<svg class="life-scene" viewBox="0 0 580 180" role="img" aria-label="${c.name}的${rural?'乡村':'城市'}，${s.age}岁时的生活" shape-rendering="crispEdges">${p}</svg>`;
}
