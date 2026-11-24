"use strict";

const ROSTER = [
  { name:"Wayfarer", description:"A road-worn traveler in a saffron mantle.", coat:"#b9853c", detail:"#e5ba69", shirt:"#743f36", trousers:"#575447", boot:"#4c382b", skin:"#c38c67", hair:"#5f4132", style:"hood" },
  { name:"Mercer", description:"A cloth merchant with a fine burgundy coat.", coat:"#994d48", detail:"#c28b66", shirt:"#ad805a", trousers:"#554039", boot:"#4f332b", skin:"#9a654b", hair:"#39302a", style:"cap" },
  { name:"Herbalist", description:"A gatherer in moss green with a woven headscarf.", coat:"#768655", detail:"#afab6d", shirt:"#80836a", trousers:"#5f5f48", boot:"#4f3e30", skin:"#bc8e64", hair:"#61422c", style:"scarf" },
  { name:"Scribe", description:"A quiet scholar in ink-blue wool.", coat:"#526873", detail:"#9eac9c", shirt:"#757c6b", trousers:"#4a5451", boot:"#423e32", skin:"#d29c77", hair:"#70513b", style:"hair" },
  { name:"Mason", description:"A stoneworker with a leather apron and rolled sleeves.", coat:"#96734e", detail:"#c9a46f", shirt:"#a69c81", trousers:"#665647", boot:"#594334", skin:"#ad7454", hair:"#4e372b", style:"beard" },
  { name:"Pilgrim", description:"A pilgrim in a pale cowl and a blue-grey cloak.", coat:"#9eaa9d", detail:"#d9c7a4", shirt:"#647a7d", trousers:"#5b6158", boot:"#504236", skin:"#9d7258", hair:"#533c2c", style:"hood" },
  { name:"Dyer", description:"An artisan wearing the smoky violet of the dye house.", coat:"#816681", detail:"#c39692", shirt:"#955e58", trousers:"#5f4e57", boot:"#503a34", skin:"#c58c64", hair:"#51392f", style:"scarf" },
  { name:"Baker", description:"An early riser in warm linen and a russet cap.", coat:"#b18b61", detail:"#e1c6a0", shirt:"#955e47", trousers:"#715943", boot:"#564233", skin:"#ce9974", hair:"#704b33", style:"cap" },
];

function makeFigure(outfit, citizen = false) {
  const body = new Mesh();
  const { coat, detail, shirt, trousers, boot, skin, hair, style } = outfit;
  const cut = (mesh,x,y,z,w,h,d,tint,rings,sides=6) => mesh.gem(x,y,z,w,h,d,tint,sides,Math.PI/6,.06,rings);
  const middle = [[0,.87],[.42,.90],[.94,1],[1,.75]];
  cut(body,0,.73,0,.30,.42,.183,coat,[[0,1],[.72,.74],[1,.73]]);
  cut(body,0,1.04,0,.32,.53,.187,coat,middle);
  cut(body,0,1.44,.008,.28,.155,.18,style==="hood" ? detail : color(coat,1.1),[[0,1],[.50,.94],[1,.55]]);
  cut(body,0,1.00,0,.256,.095,.190,boot,[[0,1],[1,1]]);
  body.box(.016,1.025,-.181,.10,.055,.032,detail);
  body.box(.016,1.040,-.201,.052,.022,.014,boot);
  body.box(.153,1.05,.128,.14,.17,.10,color(boot,1.3),-.16);
  body.box(.153,1.17,.127,.151,.043,.118,color(boot,1.48),-.16);

  if (style === "hood") {
    for (const sign of [-1,1]) {
      body.quad([sign*.07,1.48,.183],[sign*.245,1.43,.150],[sign*.29,.79,.148],[sign*.07,.68,.224],color(coat,sign===1 ? .90 : 1.02),[sign*.27,.04,.96]);
      body.quad([0,1.49,.194],[sign*.07,1.48,.183],[sign*.07,.68,.224],[0,.76,.248],color(detail,sign===1 ? .82 : .91),[sign*.22,.06,.97]);
      body.beam([sign*.075,.72,.230],[sign*.07,1.38,.196],.021,color(detail,.97));
    }
    body.beam([-.198,1.51,-.107],[.21,1.04,-.196],.082,color(boot,1.14),.029);
  } else if (style === "beard" || style === "cap") {
    const apron = style==="beard" ? boot : detail;
    body.quad([-.13,1.38,-.182],[-.22,.74,-.168],[.22,.74,-.168],[.13,1.38,-.182],color(apron,.94),[0,0,-1]);
    body.beam([-.10,1.48,-.114],[.12,1.12,-.196],.047,color(apron,.89),.028);
  } else {
    body.beam([-.19,1.51,-.134],[.213,1.03,-.177],.081,detail,.04);
  }

  body.slabs(0,1.48,-.01,.073,.16,.08,skin,6,Math.PI/6);
  const head = new Mesh();
  cut(head,0,0,-.021,.153,.333,.139,skin,[[0,.65],[.24,.86],[.70,1],[.91,.95],[1,.61]],8);
  const headDark = color(skin,.79);
  head.gem(0,.081,-.126,.034,.106,.071,color(skin,1.05),5,.22,.06,[[0,.50],[.23,1],[1,.32]]);
  if (!citizen) {
    for (const sign of [-1,1]) {
      head.box(sign*.058,.146,-.144,.037,.017,.014,color(hair,.65));
      head.box(sign*.058,.177,-.144,.046,.013,.013,hair);
    }
    head.box(0,.063,-.138,.058,.008,.008,headDark);
  }
  const wraps = [[0,.68],[.24,1],[.72,.95],[1,.62]];
  if (style === "hood") {
    const hood = color(coat,.93);
    head.gem(0,.082,.064,.186,.283,.150,hood,7,.19,.08,wraps);
    for (let i=0;i<8;i++) {
      const a=-.16+i*.435, b=a+.435;
      const rim = (t,r) => [Math.cos(t)*.171*r,.137+Math.sin(t)*.203*r,-.138-(Math.sin(t)+.2)*.025];
      head.quad(rim(a,1),rim(b,1),rim(b,.82),rim(a,.82),i%3 ? color(detail,.89) : detail,[0,0,-1]);
      head.quad(rim(a,1),[Math.cos(a)*.178,.145+Math.sin(a)*.20,.037],
        [Math.cos(b)*.178,.145+Math.sin(b)*.20,.037],rim(b,1),hood,unit([Math.cos((a+b)/2),Math.sin((a+b)/2),-.14]));
    }
    head.beam([-.122,.115,-.14],[-.087,-.042,-.042],.039,hood);
    head.beam([.122,.115,-.14],[.087,-.042,-.042],.039,hood);
  } else if (style === "cap") {
    cut(head,0,.236,-.013,.186,.099,.159,detail,[[0,.87],[.33,1],[1,.73]],8);
    head.slabs(0,.234,-.046,.190,.035,.18,color(coat,.90),8,.09,.163);
  } else if (style === "scarf") {
    cut(head,0,.205,.012,.170,.151,.151,detail,wraps,7);
    head.slabs(0,.204,-.012,.162,.045,.167,color(coat,.88),8,.12,.145);
    head.gem(.09,.023,.084,.086,.24,.075,detail,6,.17);
  } else {
    cut(head,0,.214,-.019,.154,.128,.150,hair,[[0,1],[.53,.97],[1,.73]],7);
    if (style === "beard") head.gem(0,-.029,-.081,.120,.157,.084,hair,7,.03,.09,[[0,.67],[.44,1],[1,.92]]);
    else head.gem(0,.101,.068,.148,.167,.104,hair,7,.23,.07);
  }
  const arms = [], legs = [];
  for (const side of [-1,1]) {
    const arm = new Mesh(), leg = new Mesh();
    cut(arm,side*.032,-.397,.002,.094,.413,.102,shirt,[[0,.61],[.55,.87],[.88,1],[1,.81]]);
    cut(arm,0,-.205,0,.108,.238,.118,coat,[[0,.83],[.63,1],[1,.79]]);
    cut(arm,side*.034,-.455,-.006,.062,.097,.059,skin,[[0,.73],[.40,1],[1,.86]]);
    cut(leg,0,-.67,0,.105,.67,.106,trousers,[[0,.62],[.42,.79],[1,1]]);
    cut(leg,0,-.796,-.006,.091,.333,.103,boot,[[0,.89],[.53,.82],[1,1]]);
    leg.box(0,-.813,-.054,.176,.105,.286,color(boot,.92));
    leg.box(0,-.818,-.058,.181,.032,.289,color(boot,.73));
    arms.push(arm); legs.push(leg);
  }
  return { body, head, arms, legs };
}

function drawFigure(mesh, figure, actor, time) {
  const { x, z, angle, stride=0, phase=0, talking=false, scale=1 } = actor;
  const lift = Math.abs(Math.sin(phase))*.036*stride + Math.sin(time*2.1+actor.seed)*.009;
  const local = (part, u, y, v, rotation=0, twist=0) => {
    mesh.append(part, x+(Math.cos(angle)*u+Math.sin(angle)*v)*scale, (y+lift)*scale,
      z+(-Math.sin(angle)*u+Math.cos(angle)*v)*scale, angle+twist, scale, rotation);
  };
  local(figure.body,0,0,0);
  local(figure.head,0,1.58,0,talking?Math.sin(time*2+actor.seed)*.08:0,talking?Math.sin(time*.8+actor.seed)*.11:0);
  for (let i=0;i<2;i++) {
    const sign=2*i-1, gait=Math.sin(phase)*sign*stride;
    const gestures=talking && i===1 ? Math.sin(time*2.4+actor.seed)*.14+.21 : 0;
    local(figure.arms[i],sign*.301,1.445,-.006,-gait*.41+gestures);
    local(figure.legs[i],sign*.139,.821,0,gait*.51);
  }
}

function addFootprint(mesh, x, z, blended = false, scale = 1) {
  for (let i=0;i<12;i++) {
    const a=i*TAU/12,b=(i+1)*TAU/12;
    const p=(angle,r,y)=>[x+.09+Math.cos(angle)*r*scale,y,z-.03+Math.sin(angle)*r*.67*scale];
    mesh.triangle([x+.09,.019,z-.03],p(b,.31,.02),p(a,.31,.02),"#847663",[0,1,0]);
    if (blended) mesh.quad(p(a,.63,.028),p(b,.63,.028),p(b,.57,.028),p(a,.57,.028),"#d5b66e",[0,1,0]);
  }
}

function makeNavigation(city) {
  const columns=LIMITS.x1-LIMITS.x0, rows=LIMITS.z1-LIMITS.z0, size=columns*rows;
  const walkable = new Uint8Array(size);
  const coords = index => [index%columns+LIMITS.x0+.5,Math.floor(index/columns)+LIMITS.z0+.5];
  const cell = (x,z) => clamp(Math.floor(z)-LIMITS.z0,0,rows-1)*columns+clamp(Math.floor(x)-LIMITS.x0,0,columns-1);
  for (let i=0;i<size;i++) walkable[i] = Number(!blocked(city,...coords(i),.51));
  const nearest = (x,z) => {
    const start=cell(x,z);
    if (walkable[start]) return start;
    const [sx,sz]=coords(start);
    for (let radius=1;radius<9;radius++) {
      for (let d=-radius;d<=radius;d++) {
        for (const [dx,dz] of [[d,-radius],[d,radius],[-radius,d],[radius,d]]) {
          const index=cell(sx+dx,sz+dz);
          if (walkable[index]) return index;
        }
      }
    }
    return -1;
  };
  const queue = new Int32Array(size), prev = new Int32Array(size);
  const route = (x,z,tx,tz) => {
    const start=nearest(x,z), finish=nearest(tx,tz);
    if (start<0 || finish<0) return [];
    if (start===finish) return [coords(finish)];
    prev.fill(-2);
    let read=0,write=1;
    queue[0]=start; prev[start]=-1;
    while (read<write && prev[finish]===-2) {
      const i=queue[read++], col=i%columns;
      for (const step of [-columns,columns,col>0?-1:0,col<columns-1?1:0]) {
        const j=i+step;
        if (step && walkable[j] && prev[j]===-2) {
          prev[j]=i; queue[write++]=j;
        }
      }
    }
    if (prev[finish]===-2) return [];
    const path=[];
    let lastStep = 0;
    for (let i=finish;i!==start;i=prev[i]) {
      const step=i-prev[i];
      if (step!==lastStep) path.push(coords(i));
      lastStep=step;
    }
    return path.reverse();
  };
  return { route };
}

const LANDMARKS = [
  [-14,2],[-12,8],[-20,16],[-3,6],[3,15],[4,-2],[-23,-4],[-4,19],
  [24,-21],[31,-26],[21,-36],[31,-37],[18,-30],[28,-34],[8,-15],[7,-26],[-10,-10],
];
const CIRCLES = [[-12,6],[-17,-2],[1,4],[18,-32],[31,-25],[27,-37]];

function turnTo(from,to,amount) { return from + Math.atan2(Math.sin(to-from),Math.cos(to-from))*amount; }
function walkableMove(city,actor,dx,dz,r=.24) {
  if (!blocked(city,actor.x+dx,actor.z,r)) actor.x+=dx;
  if (!blocked(city,actor.x,actor.z+dz,r)) actor.z+=dz;
}
function driftActor(city,actor,tx,tz,pace,dt) {
  const dx=tx-actor.x,dz=tz-actor.z,d=Math.hypot(dx,dz);
  const x=actor.x,z=actor.z;
  if (d>.07) {
    const advance=Math.min(d,pace*dt);
    walkableMove(city,actor,dx*advance/d,dz*advance/d,.19);
  }
  const velocity=Math.hypot(actor.x-x,actor.z-z)/Math.max(dt,.001);
  if (velocity>.12) actor.angle=turnTo(actor.angle,Math.atan2(-dx,-dz),Math.min(1,dt*8));
  actor.stride=mix(actor.stride,clamp(velocity/1.15,0,1),Math.min(1,dt*8));
  actor.phase+=velocity*dt*7.0;
  return d;
}

function makeCrowd(city) {
  const nav = makeNavigation(city), random=randomStream(70911);
  const groups = [];
  const figures = ROSTER.map((outfit,i) => makeFigure({...outfit,coat:color(outfit.coat,i%2?.85:.9),detail:color(outfit.detail,.86)},true));
  const next = (group, nx, nz) => {
    group.path=nav.route(group.x,group.z,nx,nz);
    group.wait=0;
  };
  const makeGroup = (x,z,count,circle,number) => {
    const group={x,z,angle:random()*TAU,pace:.83+random()*.37,wait:circle ? 9+random()*19 : 0,
      path:[],actors:[],circle,number,nextStop:(number*3+4)%LANDMARKS.length};
    for (let i=0;i<count;i++) {
      const angle=i*TAU/count+group.angle;
      const radius=circle ? .66+count*.13 : .36+count*.11;
      const tx=x+Math.sin(angle)*radius, tz=z+Math.cos(angle)*radius;
      const free=!blocked(city,tx,tz,.20);
      group.actors.push({
        x:free ? tx : x,z:free ? tz : z,angle:circle ? angle : random()*TAU,
        seed:random()*TAU,stride:0,phase:random()*TAU,scale:.86+random()*.20,
        outfit:(number*5+i*3+1)%figures.length,talking:circle && count>1,
      });
    }
    if (!circle) next(group,...LANDMARKS[group.nextStop]);
    groups.push(group);
  };
  CIRCLES.forEach(([x,z],i)=>makeGroup(x,z,i%3+3,true,i));
  [[3,12,3],[-11,19,3],[-24,1,2],[9,3,2],[-2,-8,2],[15,-27,3],[28,-20,2],[36,-31,3],
    [-9,-9,1],[-2,16,1],[2,-10,1],[31,2,1],[33,-37,1],[-27,-21,1],[15,-11,1],[8,-34,1]]
    .forEach(([x,z,n],i)=>makeGroup(x,z,n,false,i+CIRCLES.length));
  function update(dt) {
    for (const group of groups) {
      if (group.path.length) {
        const [tx,tz]=group.path[0], dx=tx-group.x,dz=tz-group.z,d=Math.hypot(dx,dz);
        const step=group.pace*dt;
        if (d<=step) {
          group.x=tx; group.z=tz;
          group.path.shift();
          if (!group.path.length) group.wait=group.circle ? 12+random()*13 : 2+random()*5;
        } else {
          group.x+=dx*step/d;
          group.z+=dz*step/d;
          group.angle=turnTo(group.angle,Math.atan2(-dx,-dz),Math.min(1,dt*4));
        }
      } else {
        group.wait-=dt;
        if (group.wait<=0) {
          const points=group.circle?CIRCLES:LANDMARKS;
          const index=(group.nextStop+1+Math.floor(random()*(points.length-1)))%points.length;
          group.nextStop=index;
          next(group,...points[index]);
          if (!group.path.length) group.wait=2;
        }
      }
      const stationary = !group.path.length;
      const roomy = stationary || !blocked(city,group.x,group.z,1.25);
      const count=group.actors.length;
      for (let i=0;i<count;i++) {
        const actor=group.actors[i];
        const angle=i*TAU/count+group.angle;
        const radius=group.circle&&stationary ? .66+count*.13 : .40+count*.08;
        const lane=(i-(count-1)/2)*.43;
        let tx=group.x+(roomy?Math.sin(angle)*radius:Math.sin(group.angle)*lane);
        let tz=group.z+(roomy?Math.cos(angle)*radius:Math.cos(group.angle)*lane);
        if (blocked(city,tx,tz,.24)) { tx=group.x; tz=group.z; }
        const dist=driftActor(city,actor,tx,tz,stationary?1.05:group.pace+.39,dt);
        actor.talking=stationary && group.circle && count>1 && dist<.34;
        if (actor.talking) actor.angle=turnTo(actor.angle,Math.atan2(actor.x-group.x,actor.z-group.z),Math.min(1,dt*6));
      }
    }
  }
  return { groups, figures, update };
}

function drawCloth(mesh,cloth,time) {
  for (const flag of cloth) {
    const sway=Math.sin(time*2.4+flag.phase)*.16;
    const normal=unit([-flag.dz,.16,flag.dx]);
    const dx=flag.dx*flag.size*.51,dz=flag.dz*flag.size*.51;
    mesh.triangle([flag.x-dx,flag.y,flag.z-dz],[flag.x+dx,flag.y,flag.z+dz],
      [flag.x-flag.dz*sway,flag.y-flag.size*1.67,flag.z+flag.dx*sway],flag.c,normal);
  }
}

function makeMap(canvas,city) {
  const width=canvas.width,height=canvas.height;
  const base=document.createElement("canvas"); base.width=width; base.height=height;
  const ctx=base.getContext("2d"), output=canvas.getContext("2d");
  const mx=x=>Math.round(12+(x-LIMITS.x0)/(LIMITS.x1-LIMITS.x0)*(width-24));
  const mz=z=>Math.round(14+(z-LIMITS.z0)/(LIMITS.z1-LIMITS.z0)*(height-28));
  const rect=(r,fill,stroke) => {
    const args=[mx(r.x0),mz(r.z0),mx(r.x1)-mx(r.x0),mz(r.z1)-mz(r.z0)];
    ctx.fillStyle=fill; ctx.fillRect(...args);
    if (stroke) { ctx.strokeStyle=stroke; ctx.strokeRect(...args); }
  };
  ctx.fillStyle="#282b20"; ctx.fillRect(0,0,width,height);
  for (let x=12;x<width;x+=14) {
    ctx.strokeStyle="#76745225"; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke();
  }
  for (let z=12;z<height;z+=14) {
    ctx.strokeStyle="#76745225"; ctx.beginPath(); ctx.moveTo(0,z); ctx.lineTo(width,z); ctx.stroke();
  }
  rect(LIMITS,"#5c5740","#a58f5e");
  rect(MARKET,"#8d7c55","#a59566");
  rect(CHAPEL,"#8c7a52","#a59566");
  for (const lot of city.lots) rect(lot,"#38392c","#5a5541");
  for (const [x,z] of [[-8,-1],[26,-29],[2,-39]]) {
    ctx.fillStyle="#d1af6a"; ctx.beginPath(); ctx.arc(mx(x),mz(z),3.5,0,TAU); ctx.fill();
  }
  return (player,yaw,crowd) => {
    output.drawImage(base,0,0);
    output.fillStyle="#d9ceb096";
    for (const group of crowd.groups) {
      if (group.actors.length===1) continue;
      output.beginPath(); output.arc(mx(group.x),mz(group.z),2.3,0,TAU); output.fill();
    }
    output.save();
    output.translate(mx(player.x),mz(player.z)); output.rotate(-yaw);
    output.shadowColor="#1b1c12"; output.shadowBlur=7;
    output.fillStyle="#ffe19b"; output.beginPath();
    output.moveTo(0,-10); output.lineTo(7,6); output.lineTo(0,2); output.lineTo(-7,6);
    output.closePath(); output.fill();
    output.restore();
  };
}

function boot() {
  const $=selector=>document.querySelector(selector);
  const bind=(selector,type,handler)=>$(selector).addEventListener(type,handler);
  const game=$("#game"), canvas=$("#world"), roster=$("#roster"), overlay=$("#pause-overlay");
  const city=buildCity();
  const renderer=new Renderer(canvas);
  renderer.bake(city.scene,city.casters);
  city.scene.data.length=0;
  city.casters.data.length=0;
  const crowd=makeCrowd(city), figures=ROSTER.map(outfit=>makeFigure(outfit));
  const drawMap=makeMap($("#map"),city);
  const start={x:4,z:16,angle:.20};
  const player={...start,stride:0,phase:0,seed:1.7,scale:1.18};
  const directionNames=["N","NE","E","SE","S","SW","W","NW"];
  const keys=new Set(), touch={x:0,y:0,running:false};
  const camera={yaw:.22,pitch:.22,range:5.45,eye:null,target:null};
  const cameraGoals={pitch:.22,range:5.45};
  const mesh=new Mesh();
  let selected=0, mode="select", blend=null, blendMessage="", blendMessageTime=0;
  let elapsed=0, previous=performance.now(), lastMap=-1, lastHeading, lastDistrict, drag=null;
  const portraitCanvas=document.createElement("canvas");
  portraitCanvas.width=156; portraitCanvas.height=174;
  let portraitRenderer;
  try { portraitRenderer=new Renderer(portraitCanvas,{portrait:true}); }
  catch (error) { console.warn("Character portrait rendering unavailable",error.message); }
  const renderPortrait=i=>{
    if (!portraitRenderer) return null;
    const portrait=new Mesh();
    drawFigure(portrait,figures[i],{x:0,z:0,angle:0,seed:0},0);
    portraitRenderer.draw(portrait,[.92,1.72,-2.59],[0,1.47,0],{fov:.43});
    return portraitCanvas.toDataURL("image/png");
  };
  const buttons=ROSTER.map((outfit,i)=>{
    const button=document.createElement("button");
    button.type="button"; button.className="character";
    button.setAttribute("aria-label",outfit.name);
    button.title=outfit.name;
    const portrait=renderPortrait(i);
    if (portrait) {
      const img=new Image(); img.src=portrait; img.alt=""; button.append(img);
    }
    button.insertAdjacentHTML("beforeend",`<span class="character-label">${outfit.name}</span><svg class="character-check" aria-hidden="true"><use href="#i-check"/></svg>`);
    button.addEventListener("click",()=>select(i));
    roster.append(button);
    return button;
  });
  portraitRenderer?.gl.getExtension("WEBGL_lose_context")?.loseContext();

  function select(index) {
    selected=index;
    buttons.forEach((button,i)=>button.setAttribute("aria-pressed",String(i===index)));
    $("#character-name").textContent="The "+ROSTER[index].name;
    $("#character-description").textContent=ROSTER[index].description;
  }
  select(0);

  function clearInput() {
    keys.clear();
    touch.x=0; touch.y=0; touch.running=false;
    $("#stick span").style.transform="";
    $("#touch-run").setAttribute("aria-pressed","false");
    drag=null;
    canvas.classList.remove("dragging");
  }
  function setMode(next) {
    mode=next; game.dataset.mode=next;
    overlay.hidden=next!=="pause";
    $(".topbar").inert=next==="pause";
    $("#selection").inert=next!=="select";
    canvas.tabIndex=next==="play" ? 0 : -1;
    clearInput();
    if (next==="play") {
      canvas.focus({preventScroll:true});
    } else if (next==="pause") {
      $("#crowd-status").hidden=true;
      $("#resume").focus();
    } else {
      $("#crowd-status").hidden=true;
      buttons[selected].focus({preventScroll:true});
    }
  }
  function reset() {
    Object.assign(player,start,{stride:0,phase:0});
    Object.assign(camera,{yaw:.22,eye:null,target:null});
    Object.assign(cameraGoals,{pitch:.22,range:5.45});
    blend=null; blendMessage="";
  }
  function nearestCrowd() {
    let closest=null,distance=3.5;
    for (const group of crowd.groups) {
      if (group.actors.length<2) continue;
      const next=Math.hypot(group.x-player.x,group.z-player.z);
      if (next<distance) { closest=group; distance=next; }
    }
    return closest;
  }
  function toggleBlend() {
    if (mode!=="play") return;
    if (blend) { blend=null; return; }
    const group=nearestCrowd();
    if (!group) {
      blendMessage="Move closer to a group"; blendMessageTime=elapsed+2.3;
      return;
    }
    const angle=Math.atan2(player.x-group.x,player.z-group.z);
    blendMessage="";
    blend={group,angle,relative:angle-group.angle};
  }
  function updatePlayer(dt) {
    const forward=Number(keys.has("KeyW")||keys.has("ArrowUp"))-Number(keys.has("KeyS")||keys.has("ArrowDown"))-touch.y;
    const strafe=Number(keys.has("KeyD")||keys.has("ArrowRight"))-Number(keys.has("KeyA")||keys.has("ArrowLeft"))+touch.x;
    const magnitude=Math.hypot(forward,strafe);
    const running=keys.has("ShiftLeft")||keys.has("ShiftRight")||touch.running;
    const speed=running?5.1:2.6;
    const x=player.x,z=player.z;
    if (magnitude>.05) {
      blend=null;
      const unit=Math.max(1,magnitude), sin=Math.sin(camera.yaw), cos=Math.cos(camera.yaw);
      const dx=(-sin*forward+cos*strafe)/unit,dz=(-cos*forward-sin*strafe)/unit;
      walkableMove(city,player,dx*speed*dt,dz*speed*dt,.32);
      player.angle=turnTo(player.angle,Math.atan2(-dx,-dz),Math.min(1,dt*12));
    } else if (blend) {
      const { group,angle,relative }=blend, walking=group.path.length>0;
      const a=walking?group.angle+relative:angle;
      let tx=group.x+Math.sin(a)*1.42,tz=group.z+Math.cos(a)*1.42;
      if (blocked(city,tx,tz,.34)) {
        tx=group.x+Math.sin(group.angle)*.36;
        tz=group.z+Math.cos(group.angle)*.36;
      }
      driftActor(city,player,tx,tz,2.15,dt);
      if (!walking && Math.hypot(player.x-tx,player.z-tz)<.21) {
        player.angle=turnTo(player.angle,Math.atan2(player.x-group.x,player.z-group.z),Math.min(1,dt*6));
      }
      if (Math.hypot(player.x-group.x,player.z-group.z)>4.5) blend=null;
      return;
    }
    const velocity=Math.hypot(player.x-x,player.z-z)/Math.max(.001,dt);
    player.stride=mix(player.stride,clamp(velocity/2.2,0,1.42),Math.min(1,dt*9));
    player.phase+=velocity*dt*(running?4.7:5.2);
  }
  function updateCamera(dt) {
    camera.pitch=mix(camera.pitch,cameraGoals.pitch,Math.min(1,dt*10));
    camera.range=mix(camera.range,cameraGoals.range,Math.min(1,dt*10));
    const sin=Math.sin(camera.yaw),cos=Math.cos(camera.yaw), target=[player.x-sin*2.8,1.62,player.z-cos*2.8];
    const boom=mode==="select"?5.58:camera.range;
    let usable=boom;
    for (let step=.6;step<=boom;step+=.25) {
      const y=1.64+(.075+Math.sin(camera.pitch)*boom*.64)*step/boom;
      if (blocked(city,player.x+sin*step,player.z+cos*step,.27,y)) {
        usable=Math.max(.62,step-.31); break;
      }
    }
    const lift=.075+Math.sin(camera.pitch)*boom*.64, ratio=usable/boom;
    const eye=[player.x+sin*usable,1.67+lift*ratio,player.z+cos*usable];
    const aimHeight=1.74-Math.sin(camera.pitch-.22)*3.55;
    target[1]=aimHeight;
    if (!camera.eye) { camera.eye=eye; camera.target=target; }
    else {
      const rate=Math.min(1,dt*(drag?19:11));
      for (let i=0;i<3;i++) {
        camera.eye[i]=mix(camera.eye[i],eye[i],i===1 ? Math.min(1,rate*1.4) : rate);
        camera.target[i]=mix(camera.target[i],target[i],rate);
      }
      if (blocked(city,camera.eye[0],camera.eye[2],.22,camera.eye[1])) camera.eye=eye;
    }
  }
  function syncHUD() {
    const district=districtAt(player.x,player.z);
    if (lastDistrict!==district) {
      lastDistrict=district;
      $("#district-name").textContent=district;
      $("#place-name").textContent=district;
    }
    const index=((Math.round(-camera.yaw/(TAU/8))%8)+8)%8;
    if (lastHeading!==index) {
      lastHeading=index;
      $("#bearing-left").textContent=directionNames[(index+7)%8];
      $("#bearing-main").textContent=directionNames[index];
      $("#bearing-right").textContent=directionNames[(index+1)%8];
    }
    const status=mode!=="play" ? "" : blend ? "Blending with the crowd"
      : blendMessage && elapsed<blendMessageTime ? blendMessage
      : nearestCrowd() ? (matchMedia("(pointer: coarse)").matches ? "Tap the crowd button to blend" : "Press E to blend") : "";
    const label=$("#crowd-text");
    if (label.textContent!==status) label.textContent=status;
    $("#crowd-status").hidden=!status;
    if (elapsed-lastMap>.080) { drawMap(player,camera.yaw,crowd); lastMap=elapsed; }
  }

  bind("#enter","click",()=>{ reset(); setMode("play"); });
  bind("#pause","click",()=>setMode("pause"));
  bind("#resume","click",()=>setMode("play"));
  bind("#change","click",()=>{ reset(); setMode("select"); });
  bind("#reset-camera","click",()=>{
    camera.yaw=player.angle; cameraGoals.pitch=.22; cameraGoals.range=5.45;
    canvas.focus({preventScroll:true});
  });
  const movement=new Set(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowLeft","ArrowDown","ArrowRight","ShiftLeft","ShiftRight"]);
  window.addEventListener("keydown",event=>{
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.code==="Escape" && mode!=="select" && !event.repeat) {
      event.preventDefault(); setMode(mode==="pause"?"play":"pause"); return;
    }
    if (mode!=="play") return;
    if (movement.has(event.code)) { event.preventDefault(); keys.add(event.code); }
    if (event.code==="KeyE" && !event.repeat) toggleBlend();
  });
  window.addEventListener("keyup",event=>keys.delete(event.code));
  window.addEventListener("blur",clearInput);
  document.addEventListener("visibilitychange",()=>{ if (document.hidden) clearInput(); });
  canvas.addEventListener("pointerdown",event=>{
    if(mode!=="play" || event.button!==0 || drag) return;
    canvas.setPointerCapture(event.pointerId);
    drag={id:event.pointerId,x:event.clientX,y:event.clientY};
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove",event=>{
    if (event.pointerId!==drag?.id) return;
    camera.yaw-=(event.clientX-drag.x)*.008;
    cameraGoals.pitch=clamp(cameraGoals.pitch+(event.clientY-drag.y)*.008,-.10,.77);
    drag.x=event.clientX; drag.y=event.clientY;
  });
  canvas.addEventListener("lostpointercapture",event=>{
    if (event.pointerId===drag?.id) { drag=null; canvas.classList.remove("dragging"); }
  });
  canvas.addEventListener("wheel",event=>{
    if (mode!=="play") return;
    event.preventDefault();
    cameraGoals.range=clamp(cameraGoals.range+event.deltaY*.004,3.15,8.4);
  },{passive:false});
  const stick=$("#stick");
  const moveStick=event=>{
    const r=stick.getBoundingClientRect();
    const dx=(event.clientX-r.left-r.width/2)/32,dy=(event.clientY-r.top-r.height/2)/32;
    const magnitude=Math.max(1,Math.hypot(dx,dy));
    touch.x=dx/magnitude; touch.y=dy/magnitude;
    stick.firstElementChild.style.transform=`translate(${touch.x*29}px,${touch.y*29}px)`;
  };
  stick.addEventListener("pointerdown",event=>{ stick.setPointerCapture(event.pointerId); moveStick(event); });
  stick.addEventListener("pointermove",event=>{ if (stick.hasPointerCapture(event.pointerId)) moveStick(event); });
  stick.addEventListener("lostpointercapture",()=>{
    touch.x=0; touch.y=0; stick.firstElementChild.style.transform="";
  });
  bind("#touch-run","click",event=>{
    touch.running=!touch.running;
    event.currentTarget.setAttribute("aria-pressed",String(touch.running));
  });
  bind("#touch-blend","click",toggleBlend);

  function frame(now) {
    const dt=Math.min(.085,Math.max(.001,(now-previous)/1000));
    previous=now;
    const ratio=Math.min(devicePixelRatio || 1,1.55,1720/Math.max(1,canvas.clientWidth));
    const width=Math.max(1,Math.round(canvas.clientWidth*ratio)), height=Math.max(1,Math.round(canvas.clientHeight*ratio));
    const resized=canvas.width!==width || canvas.height!==height;
    if (resized) { canvas.width=width; canvas.height=height; }
    if (mode!=="pause" || resized) {
      if (mode!=="pause") { elapsed+=dt; crowd.update(dt); }
      if (mode==="play") updatePlayer(dt);
      updateCamera(dt);
      mesh.data.length=0;
      drawCloth(mesh,city.cloth,elapsed);
      const aspect=width/height, fov=aspect<.78 ? 1.12 : .93;
      const span=Math.tan(fov/2)*aspect*(mode==="select" ? 1.46 : 1.09);
      const sin=Math.sin(camera.yaw), cos=Math.cos(camera.yaw);
      for (const group of crowd.groups) for (const actor of group.actors) {
        const dx=actor.x-camera.eye[0], dz=actor.z-camera.eye[2];
        const depth=-dx*sin-dz*cos, side=dx*cos-dz*sin;
        if (depth<-.7 || depth>61 || Math.abs(side)>1.8+depth*span) continue;
        addFootprint(mesh,actor.x,actor.z,false,actor.scale);
        drawFigure(mesh,crowd.figures[actor.outfit],actor,elapsed);
      }
      addFootprint(mesh,player.x,player.z,Boolean(blend),player.scale);
      drawFigure(mesh,figures[selected],player,elapsed);
      const shiftX=mode==="select" ? (aspect<.78?-.05:-.34) : 0;
      const shiftY=mode==="select" && aspect<.78 ? -.60 : 0;
      renderer.draw(mesh,camera.eye,camera.target,{shiftX,shiftY,pitch:camera.pitch,yaw:camera.yaw,fov});
      syncHUD();
    }
    requestAnimationFrame(frame);
  }
  canvas.addEventListener("webglcontextlost",event=>{ event.preventDefault(); $("#error").hidden=false; });
  canvas.addEventListener("webglcontextrestored",()=>location.reload());
  requestAnimationFrame(frame);
}

try { boot(); }
catch (error) {
  console.error(error);
  document.querySelector("#error").hidden=false;
}
