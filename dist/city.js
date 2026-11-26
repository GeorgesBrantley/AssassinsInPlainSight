"use strict";

const LIMITS = { x0: -43, x1: 43, z0: -50, z1: 28 };
const MARKET = { x0: -32, x1: 13, z0: -8, z1: 24 };
const CHAPEL = { x0: 10, x1: 41, z0: -40, z1: -15 };
const within = (x,z,rect) => x >= rect.x0 && x <= rect.x1 && z >= rect.z0 && z <= rect.z1;

const CITY_MAPS = {
  testa: {
    name:"Testa", limits:LIMITS, courts:[MARKET,CHAPEL],
    playerSpawns:Array.from({length:18},(_,i)=>({x:4+(i%4)*1.2,z:16+Math.floor(i/4)*1.2,angle:.2})),
    rivalSpawn:{x:6,z:16,angle:0},
    conversations:[[-12,6],[3,12],[18,-32],[31,-25]],
    landmarks:[
      [-14,2],[-12,8],[-20,16],[-3,6],[3,15],[4,-2],[-23,-4],[-4,19],
      [24,-21],[31,-26],[21,-36],[31,-37],[18,-30],[28,-34],[8,-15],[7,-26],[-10,-10],
    ],
    crowdSpawns:[
      [-24,1,2],[9,3,2],[15,-27,3],[28,-20,2],
      [-9,-9,1],[-2,16,1],[2,-10,1],[31,2,1],[33,-37,1],[-27,-21,1],[15,-11,1],[8,-34,1],
      [-17,-2,2],[1,4,2],[27,-37,2],[-11,19,2],[-2,-8,1],[36,-31,2],
    ],
  },
  betrahold: {
    name:"Betrahold", limits:{x0:-51,x1:51,z0:-31,z1:31},
    courts:[
      {x0:-41,x1:-22,z0:-27,z1:-13,name:"Canopy Market"},
      {x0:16,x1:31,z0:-27,z1:-13,name:"North Fountain"},
      {x0:-47,x1:-24,z0:13,z1:28,name:"South Fountain"},
      {x0:-6,x1:6,z0:14,z1:27,name:"Coopers’ Court"},
      {x0:21,x1:34,z0:13,z1:27,name:"South Terrace"},
    ],
    playerSpawns:[
      {x:-22.5,z:11.5,angle:1.5},{x:8.5,z:-27.5,angle:0},
      {x:24.5,z:12.5,angle:-1.55},{x:-12.5,z:-27.5,angle:0},
      {x:-26.5,z:20.5,angle:1.55},{x:47.5,z:-26.5,angle:0},
      {x:-4.5,z:25.5,angle:0},{x:33.5,z:-11.5,angle:-1.55},
      {x:-31.5,z:-25.5,angle:0},{x:21.5,z:26.5,angle:0},
      {x:-39.5,z:2.5,angle:Math.PI},{x:38.5,z:9.5,angle:0},
      {x:-21,z:-.5,angle:0},{x:36,z:-.5,angle:Math.PI},
      {x:-40.5,z:26.5,angle:Math.PI},{x:16.5,z:-27.5,angle:0},
      {x:-20.5,z:-24.5,angle:0},{x:34.5,z:27.5,angle:Math.PI},
    ],
    rivalSpawn:{x:-20.5,z:10.5,angle:-1.55},
    conversations:[
      [-31,-20],[-20,-11],[18,-11],[26,-25],[46,-13],[-43,16],[-27,16],[1,22],[28,26],
    ],
    landmarks:[
      [-40.5,26.5],[-21,27],[0,27],[20,27],[36,27],[36,12],[20,12],[0,12],[-21,12],[-39,12],
      [-39,0],[-39,-11],[-21,-11],[0,-11],[20,-11],[36,-11],[47,-11],[47,-27],
      [24,-27],[16,-27],[0,-28],[-19,-27],[-31,-27],[-21,0],[20,0],[36,0],
      [-29,-16],[29,20],[0,22],[-32,15],
    ],
    crowdSpawns:[
      [-20,-25,2],[4,-26.5,2],[17,-20,1],[48,-18,1],[-38,-9,2],[-21,3,2],
      [20,5,2],[37,-4,2],[-32,26,2],[-18,13,2],[5,12,2],[19,25,1],[37,26,2],
    ],
  },
};

function buildCity(mapId="testa") {
  const map=CITY_MAPS[mapId], {limits,courts}=map;
  const betrahold=mapId==="betrahold";
  const ground = new Mesh(), structures = new Mesh(), distant = new Mesh();
  const walls = [], lots = [], cloth = [], markets = [];
  const random = randomStream(betrahold ? 327407 : 128309);
  const pick = values => values[Math.floor(random() * values.length)];
  const block = (x,z,w,d,building = false,height = 2.1) => {
    const rect = { x0:x-w/2, x1:x+w/2, z0:z-d/2, z1:z+d/2, height };
    walls.push(rect);
    if (building) lots.push(rect);
  };
  const stone = betrahold ? ["#b7ad9a","#c3b9a6","#9e9c8e","#d1c6ae","#aaa599","#a39e90","#beb7a6"]
    : ["#b9aa91","#c0b19a","#ad9e85","#d1bda0","#b9a489","#a89983","#c5b196"];
  const plaster = ["#d5b98c","#c89471","#d9cdb6","#d3b98f","#b7866e","#d9c4a0","#aeb3a1","#bcb18b"];
  const roofing = betrahold ? ["#586b6c","#826457","#5b6662","#91755a","#6b625e","#626e72","#8a6456"]
    : ["#a25d46","#8d5947","#87574a","#a96855","#aa7352","#786459","#a45c43"];
  const timbers = ["#573d2a","#694835","#714e35","#513c30"];
  const wood = "#795335";
  const edge = "#9c9078";

  ground.box(0,-.70,-7,230,.66,230,"#a59b7c");
  if (betrahold) ground.box(0,-.13,0,110,.12,70,"#a5a08e");
  else ground.box(0,-.13,-10,97,.12,90,"#ad9d83");
  const north=limits.z0-4, south=limits.z1+6;
  for (let row = north; row < south; row += .51) {
    for (let col = limits.x0-3; col < limits.x1+3; col += .72) {
      const x = col + (Math.round((row - north)/.51) % 2) * .36, z = row;
      const court = courts.some(rect=>within(x,z,rect));
      if (random() < (court ? .014 : .05)) continue;
      const shiftX = (random()-.5)*.064, shiftZ = (random()-.5)*.04;
      const w = (court ? .71 : .69) - random() * .078, d = .505 - random()*.069;
      const tint = color(pick(stone), random() * .078 + (court ? .96 : .90));
      const p = (u,v) => [x+shiftX+u*w,.012+Math.cos(x*.29+z*.21)*.007,z+shiftZ+v*d];
      ground.quad(p(-.5,-.5),p(-.48,.49),p(.5,.47),p(.48,-.5),tint,[0,1,0]);
    }
  }
  function border(rect) {
    for (let x = rect.x0+.5; x < rect.x1; x+=1) {
      for (const z of [rect.z0,rect.z1]) ground.box(x,0,z,.97,.041,.24,pick(stone));
    }
    for (let z = rect.z0+.5; z < rect.z1; z+=1) {
      for (const x of [rect.x0,rect.x1]) ground.box(x,0,z,.24,.041,.96,pick(stone));
    }
  }
  courts.forEach(border);

  function facade(x,y,z,w,h,angle,trim,wall,level,main) {
    const t = (u,v,q) => [x+u*Math.cos(angle)+q*Math.sin(angle),y+v,z-u*Math.sin(angle)+q*Math.cos(angle)];
    const box = (u,v,q,a,b,c,tint) => structures.box(...t(u,v,q),a,b,c,tint,angle);
    const beam = (u,v,uu,vv,q,thickness,tint) => structures.beam(t(u,v,q),t(uu,vv,q),thickness,tint,thickness*.78);
    const bayCount = Math.max(1,Math.floor(w/2.0));
    if (level === 0) {
      for (let i=0;i<Math.floor(w/.84)*2;i++) {
        const u=(random()-.5)*(w-.4), v=.22+random()*1.85;
        box(u,v,.007,.34+random()*.55,.086+random()*.11,.047,color(wall,.84+random()*.3));
      }
      if (main) {
        box(0,0,.055,1.25,2.22,.14,edge);
        box(0,.13,.142,.99,1.93,.075,"#523e2e");
        for (let i=-2;i<=2;i++) box(i*.174,.16,.188,.149,1.87,.036,color(wood,1+i*.045));
        box(0,.15,.24,1.21,.12,.20,"#b6a58a");
        box(.27,1.01,.245,.067,.058,.070,"#ac8750");
        box(0,2.24,.095,1.41,.12,.28,color(stone[2],1.12));
      }
    } else {
      box(0,.01,.07,w+.1,.13,.17,trim);
      box(0,h-.14,.06,w+.1,.13,.15,trim);
      for (let i=0;i<=bayCount;i++) box(-w/2+i*w/bayCount,.075,.066,.12,h-.14,.13,trim);
      if (w > 4) {
        for (let i=0;i<bayCount;i+=2) {
          const side = -w/2 + i*w/bayCount, length = w/bayCount;
          beam(side+.07,.19,side+length-.08,h-.22,.075,.095,trim);
        }
      }
    }
    for (let i=0;i<bayCount;i++) {
      const u = (i+.5-bayCount/2)*w/bayCount;
      if (level === 0 && (Math.abs(u)<1.1 && main || (i+bayCount)%3 === 0)) continue;
      const v = level === 0 ? 1.13 : Math.min(h-.99,.59), width = level === 0 ? .54 : .74;
      box(u,v-.055,.08,width+.17,.95,.13,trim);
      box(u,v,.153,width,.8,.055,level === 0 ? "#514b39" : "#48483d");
      box(u,v,.186,.042,.8,.038,color(trim,1.32));
      box(u,v+.39,.187,width,.04,.035,color(trim,1.32));
      box(u,v-.11,.143,width+.26,.09,.25,level === 0 ? "#b1a089" : trim);
      if (level > 0 && (i + bayCount)%2) {
        box(u-width*.64,v-.02,.125,width*.26,.88,.105,color(trim,1.38));
        box(u+width*.64,v-.02,.125,width*.26,.88,.105,color(trim,1.38));
      }
    }
  }
  function house(x,z,w,d,levels,index,options={}) {
    const base = options.base ?? 2.72, upper = options.upper ?? 2.30;
    const h = base + levels*upper;
    const foundation = options.stone || stone[index % stone.length];
    const wall = options.wall || plaster[index % plaster.length];
    const trim = timbers[(index*3+1)%timbers.length], roof = options.roof || roofing[index % roofing.length];
    let wx = w, dz = d;
    structures.box(x,0,z,w,base,d,foundation);
    structures.box(x,0,z,w+.2,.21,d+.2,color(foundation,.84));
    const faceLevel = (j,y,height,paint) => {
      facade(x,y,z+dz/2,wx,height,0,trim,paint,j,true);
      facade(x,y,z-dz/2,wx,height,Math.PI,trim,paint,j,Boolean(options.backDoor));
      facade(x+wx/2,y,z,dz,height,Math.PI/2,trim,paint,j,false);
      facade(x-wx/2,y,z,dz,height,-Math.PI/2,trim,paint,j,false);
    };
    faceLevel(0,0,base,foundation);
    for (let i=0;i<levels;i++) {
      const y = base + i*upper;
      wx += .26; dz += .29;
      structures.box(x,y,z,wx,upper,dz,color(wall,1-i*.035));
      faceLevel(i+1,y,upper,wall);
      for (let s=-1;s<=1;s+=2) for (let k=-1;k<=1;k++) {
        structures.box(x+k*(wx-.7)/2,y-.20,z+s*(dz/2-.13),.18,.22,.40,trim);
      }
    }
    const ridgeAlongX = options.ridge ?? w>d;
    const half = (ridgeAlongX ? dz : wx)/2+.40, length=(ridgeAlongX ? wx : dz)/2+.40;
    const rise = options.rise ?? (1.6 + (index % 4)*.21 + (ridgeAlongX ? dz : wx)*.045);
    const point = (u,y,v) => ridgeAlongX ? [x+u,y,z+v] : [x+v,y,z-u];
    for (const s of [-1,1]) {
      const zSide = s*half;
      const roofPoint = (u,f) => point(u,h+rise*f,zSide*(1-f));
      const roofingRows = Math.floor(half*2.35);
      for (let j=0;j<roofingRows;j++) {
        const from=j/roofingRows, to=(j+1)/roofingRows;
        const count = Math.max(4,Math.round(length*3.0));
        for (let k=0;k<count;k++) {
          const u0=-length+2*length*k/count, u1=-length+2*length*(k+1)/count;
          const tint=color(roof,.87+random()*.25);
          const a=roofPoint(u0,from), b=roofPoint(u1,from), c=roofPoint(u1,to), d=roofPoint(u0,to);
          if (s===1) structures.quad(a,b,c,d,tint);
          else structures.quad(b,a,d,c,tint);
        }
      }
      structures.beam(roofPoint(-length,0),roofPoint(length,0),.138,trim,.16);
      structures.beam(roofPoint(-length,0),roofPoint(-length,1),.12,trim);
      structures.beam(roofPoint(length,0),roofPoint(length,1),.12,trim);
    }
    for (const s of [-1,1]) {
      const u = (length-.35)*s;
      const a=point(u,h,-half+.26), b=point(u,h,half-.26), c=point(u,h+rise,0);
      structures.triangle(...(s===1 ? [a,c,b] : [a,b,c]),wall);
      structures.beam(point(u,h,0),point(u,h+rise,0),.13,trim);
    }
    structures.beam(point(-length,h+rise,0),point(length,h+rise,0),.16,color(roof,.84));
    const chimney = point(-length*.48,h+rise*.47,half*.28);
    structures.box(...chimney,.53,1.47,.55,color(foundation,.79));
    structures.box(chimney[0],chimney[1]+1.3,chimney[2],.69,.19,.69,color(foundation,.93));
    structures.box(chimney[0],chimney[1]+1.49,chimney[2],.37,.047,.37,"#5a5143");
    block(x,z,wx+.24,dz+.24,true,h+rise+.3);
  }

  const houses = betrahold ? [
    [-46,-24,8,11,2,2],[-46,-11,8,13,2,0],[-46,2,8,11,2,5],[-46,9.8,8,2.8,1,6],
    [46,-3,8,10,2,1],[46,9,8,12,3,5],[46,22,8,12,2,6],
    [-30,1,8,18,2,1,{ridge:false}],[27,1,8,17,2,2,{ridge:false}],
    [-1,-21,31,6.6,2,3,{backDoor:true,wall:"#b8bdad",roof:"#577170",rise:2.1}],
    [0,1,29,17,2,5,{base:3.45,upper:2.55,stone:"#bbb19d",wall:"#d7c9aa",roof:"#5a686d",backDoor:true}],
    [38,-20,10,11,2,4,{base:3.15,wall:"#c9bc9e",roof:"#855d4d"}],
    [-12,20,9,8,2,3,{backDoor:true}],[12,20,9,8,2,0,{backDoor:true}],
  ] : [
    [-37,20,7,9,2,4],[-37,7,7.5,9.3,2,1],[-37,-5,7.7,8.4,3,6],[-37,-17,7.9,9,2,2],[-37,-30,8.4,10,2,3],[-37,-43,8,10,2,0],
    [-25,-14,9,7.6,2,1],[-15,-16,8,8,2,3],[-5,-17,7,7.1,3,2],
    [-25,-28,8.1,10,3,5],[-14,-31,7.6,9.7,2,4],[-4,-31,7,9,2,7],
    [-25,-43,8.5,9,3,6],[-13,-44,9,8.1,3,0],[-4,-44,6.8,7.8,2,1],
    [15,20,8,9,2,1],[24,21,7.2,7.2,2,6],[36,21,12,8.4,2,2],
    [18,9,7.7,9,3,0],[29,10,7,8.7,2,3],[38,8,7.3,7.4,2,5],
    [14,-3,7,8.2,2,2],[24,-3,8,8.2,3,4],[37,-4,10,8.3,2,6],
    [40,-21,4.8,7.5,2,3],[41,-33,4.7,8.6,2,0],[37,-47,8.8,6.5,2,6],
    [-24,28,11,5.4,2,0],[-11,29,10.2,5.0,2,3],[12,30,9,5.5,2,1],[27,30,10,5.3,2,2],
  ];
  houses.forEach(args => house(...args));

  function arch(x,y,z,radius,h,stoneTint,depth=.18) {
    for (let i=0;i<9;i++) {
      const a=i*Math.PI/9,b=(i+1)*Math.PI/9;
      const point = (rad, t) => [x+Math.cos(t)*rad,y+h+Math.sin(t)*rad,z];
      structures.quad(point(radius,a),point(radius+.19,a),point(radius+.19,b),point(radius,b),color(stoneTint,.88+i*.026),[0,0,1]);
    }
    for (const s of [-1,1]) structures.box(x+s*(radius+.09),y,z-depth/2,.19,h,depth,stoneTint);
  }
  function archDark(x,y,z,radius,h,tint) {
    structures.box(x,y,z,radius*2,h,.044,tint);
    for (let i=0;i<11;i++) {
      const a=i*Math.PI/11,b=(i+1)*Math.PI/11;
      structures.triangle([x,y+h,z+.027],[x+Math.cos(a)*radius,y+h+Math.sin(a)*radius,z+.027],[x+Math.cos(b)*radius,y+h+Math.sin(b)*radius,z+.027],tint,[0,0,1]);
    }
  }
  const limestone = "#c5b290";
  const sand = "#b7a485";
  const bellTower = (x,z,w,h,spire) => {
    structures.box(x,0,z,w,h,w,limestone);
    structures.box(x,0,z,w+.43,.33,w+.43,sand);
    for (const y of [2.9,h-4.7,h-.52]) structures.box(x,y,z,w+.37,.21,w+.37,"#dac5a0");
    for (const dx of [-w/2+.22,w/2-.22]) {
      for (const dz of [-w/2+.22,w/2-.22]) {
        for (let y=.44;y<h-.53;y+=.57) structures.box(x+dx,y,z+dz,.46+(Math.round(y*2)%2)*.1,.37,.49,color(sand,.89+random()*.23));
      }
    }
    for (const dx of [-w*.23,w*.23]) {
      archDark(x+dx,h-4.15,z+w/2+.018,.39,2.06,"#514a3a");
      arch(x+dx,h-4.16,z+w/2+.066,.42,2.08,"#dfc6a0");
      for (let j=0;j<4;j++) structures.box(x+dx,h-3.83+j*.42,z+w/2+.092,.72,.055,.12,"#796956");
    }
    if (spire) {
      structures.slabs(x,h-.1,z,w*.79,1.0,w*.72,"#7c6453",4,Math.PI/4);
      structures.slabs(x,h+.87,z,w*.71,h*.40,.06,"#6e6356",4,Math.PI/4);
      structures.slabs(x,h*1.4+.65,z,.11,1.05,.036,"#c1a571",6);
      structures.gem(x,h*1.4+1.43,z,.17,.31,.17,"#e4c282",5,0);
    } else {
      structures.box(x,h-.20,z,w+.60,.36,w+.60,"#96866c");
      for (let i=-1;i<=1;i++) {
        for (const s of [-1,1]) {
          structures.box(x+i*w*.33,h+.10,z+s*w*.48,w*.18,.61,.35,limestone);
          structures.box(x+s*w*.48,h+.10,z+i*w*.33,.35,.61,w*.18,limestone);
        }
      }
    }
    block(x,z,w+.6,w+.6,true,h*(spire?1.4:1));
  };
  if (betrahold) {
    bellTower(0,-1,4.8,14.9,true);
    bellTower(-51.5,-31.5,4.4,10.5,false);
    bellTower(51.5,31.5,4.4,10.5,false);
  } else {
    bellTower(2,-39,5.6,14.8,true);
    bellTower(-41,-48,4.5,11.2,false);
    bellTower(45,-43,4.5,10.6,false);
    house(21,-46,14.5,8.2,2,7,{stone:limestone,wall:"#c9b794",roof:"#896856",base:3.6,upper:2.55,rise:3.55,ridge:false});
    const chapelZ = -41.54;
    archDark(21,0,chapelZ,1.09,2.61,"#4c4133");
    arch(21,0,chapelZ+.09,1.12,2.62,"#d5c09d");
    structures.box(21,.18,chapelZ+.61,3.2,.16,1.36,stone[0]);
    structures.box(21,.01,chapelZ+.78,3.6,.17,1.65,edge);
    // The rose window is mounted vertically on the chapel façade.
    for (let i=0;i<12;i++) {
      const a=i*TAU/12,b=(i+1)*TAU/12;
      const p = (r,t) => [21+Math.cos(t)*r,5.38+Math.sin(t)*r,chapelZ+.16];
      structures.triangle(p(0,0),p(.66,a),p(.66,b),i%2 ? "#766f5d" : "#657d76",[0,0,1]);
      structures.quad(p(.66,a),p(.80,a),p(.80,b),p(.66,b),"#e0c9a4",[0,0,1]);
      if (i%2===0) structures.beam(p(0,0),p(.66,a),.045,"#dbc19c");
    }
  }

  function cityWall(x,z,w,d,h) {
    structures.box(x,0,z,w,h,d,"#a89578");
    structures.box(x,h-.38,z,w+.22,.29,d+.23,"#bcaa88");
    const horizontal=w>d, length=horizontal?w:d;
    for (let i=-length/2+.6;i<length/2;i+=1.24) {
      structures.box(x+(horizontal?i:0),h-.09,z+(horizontal?0:i),horizontal?.74:w+.12,.62,horizontal?d+.12:.74,"#b6a485");
    }
    block(x,z,w,d,true,h+.54);
  }
  if (betrahold) {
    cityWall(-51.7,0,1.3,64,5.2);
    cityWall(51.7,0,1.3,64,5.5);
    cityWall(0,-31.7,104,1.3,5.5);
    cityWall(0,31.7,104,1.3,5);
  } else {
    cityWall(-44,-10,1.3,83,5.2);
    cityWall(44.6,-10,1.3,83,5.5);
    cityWall(0,-51,88,1.4,5.5);
    cityWall(-25,30,38,1.2,5);
    cityWall(26,30,39.2,1.2,5);
  }

  function barrel(x,z,scale=1) {
    structures.gem(x,0,z,.33*scale,.82*scale,.33*scale,"#92633d",8,.14,.15,[[0,.86],[.23,1],[.75,1],[1,.84]]);
    for (const y of [.15,.60]) structures.slabs(x,y*scale,z,.338*scale,.045*scale,.338*scale,"#554d3d",8,.14);
    structures.slabs(x,.818*scale,z,.276*scale,.025*scale,.276*scale,"#aa7950",8,.14);
  }
  function crate(x,z,size,angle=0) {
    structures.box(x,.01,z,size,size*.87,size,color(wood,1.22),angle);
    for (const sign of [-1,1]) {
      const p=(u,v)=>[x+u*Math.cos(angle)+Math.sin(angle)*size*.505*sign,v,z-u*Math.sin(angle)+Math.cos(angle)*size*.505*sign];
      for (const u of [-size*.43,size*.43]) structures.beam(p(u,.025),p(u,size*.87),size*.083,"#b68856");
      structures.beam(p(-size*.39,.12),p(size*.39,size*.77),size*.073,"#b68856");
    }
  }
  const fruit = ["#dbaf4c","#b9513f","#7b8644","#d98a46","#9a603e"];
  function stall(x,z,angle,tints) {
    const w=3.45,d=2.12;
    const point = (u,y,v)=>[x+u*Math.cos(angle)+v*Math.sin(angle),y,z-u*Math.sin(angle)+v*Math.cos(angle)];
    const box = (u,y,v,ww,h,dd,tint) => structures.box(...point(u,y,v),ww,h,dd,tint,angle);
    for (const u of [-w/2,w/2]) for (const v of [-d/2,d/2]) box(u,0,v,.10,2.62,.11,wood);
    box(0,.76,.22,w-.36,.15,d-.35,"#a87e50");
    box(0,.12,-.23,w-.50,.53,.75,"#8a6340");
    for (const u of [-w/2,w/2]) structures.beam(point(u,2.62,-d/2),point(u,2.62,d/2),.08,wood);
    structures.beam(point(-w*.57,2.97,.01),point(w*.57,2.97,.01),.079,wood);
    const stripes=9;
    for (let i=0;i<stripes;i++) {
      const u0=(i/stripes-.5)*(w+.48),u1=((i+1)/stripes-.5)*(w+.48);
      const tint=tints[i%2];
      for (const s of [-1,1]) {
        const v=(d/2+.17)*s;
        const a=point(u0,2.59,v),b=point(u1,2.59,v),c=point(u1,2.96,0),d0=point(u0,2.96,0);
        structures.quad(...(s===1 ? [a,b,c,d0] : [b,a,d0,c]),tint,[0,.95,s*.31]);
        const e=point(u0,2.36,v),f=point(u1,2.36,v);
        structures.quad(a,e,f,b,color(tint,.93),[Math.sin(angle)*s,0,Math.cos(angle)*s]);
      }
    }
    for (let k=0;k<4;k++) {
      const u=(k-1.5)*.67;
      box(u,.90,.4,.47,.073,.63,color(wood,.88));
      for (let j=0;j<9;j++) {
        const p=point(u+(random()-.5)*.36,.97,.4+(random()-.5)*.49);
        structures.gem(...p,.08,.13,.08,fruit[(k+Math.round(x)+fruit.length*30)%fruit.length],5,random());
      }
    }
    block(x,z,Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*d,Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*d,false,2.7);
    {
      const [frontX,,frontZ]=point(0,0,1.60);
      const seats=Array.from({length:5},(_,i)=>{
        const [x,,z]=point((i-2)*.84,0,1.60);
        return {x,z,angle};
      });
      markets.push({x:frontX,z:frontZ,angle,seats,radius:2.19,depth:.48,type:"market"});
    }
  }
  const stalls = betrahold ? [
    [-36,-23,Math.PI/2,["#466e68","#d5cba9"]],[-36,-17,Math.PI/2,["#ae764f","#dfceab"]],
    [-26,-23,-Math.PI/2,["#986357","#e2cfad"]],[-26,-17,-Math.PI/2,["#687e83","#e1cfac"]],
    [-10,-15.6,0,["#89925e","#e0cc9b"]],[-1,-15.6,0,["#a86552","#dfcfac"]],
    [8,-15.6,0,["#5d7a79","#d9c7a7"]],[0,-25.8,Math.PI,["#796681","#d8c6a5"]],
    [-43,25,0,["#8b6b57","#dbc9a5"]],[-26,25,0,["#688579","#dfcc9f"]],
  ] : [
    [-21,10,Math.PI*.5,["#b65f49","#e3bc89"]],[-22,4,Math.PI*.5,["#798c77","#d6c295"]],
    [-21,-2,Math.PI*.5,["#c08d50","#ddc7a2"]],[-13,13,0,["#c06b4f","#e4c397"]],
    [-5,13,0,["#798680","#d8c9a9"]],[9,-5,.07,["#bd8a54","#e5cba3"]],
    [33,-21,-Math.PI*.5,["#a9614e","#d2b89b"]],[14,-22,.04,["#7d8372","#d3be95"]],
    [35,-35,-Math.PI*.5,["#89816e","#d5bd93"]],
  ];
  stalls.forEach(args => stall(...args));
  const supplies = betrahold ? [
    [-40,-24],[-38,-16],[-33,-24],[-24,-15],[-15,-15.9],[-5,-15.7],[12,-15.8],
    [31.5,-21.6],[40,-13],[-35.5,4],[-25,-3],[15.9,5],[31.8,0],[40.5,-3],[40.5,22],
    [-45,22],[-29,24],[-18.1,22],[-6,18],[6,22],[18,17],[33,24],
  ] : [[-19,8],[-19,1],[-14,14],[-8,14],[10,-3],[15,5],[30,-6],[7,-33],[-12,-11],[-29,-21],[32,-20],[17,-23],[31,16],[11,23]];
  for (const [x,z] of supplies) {
    barrel(x,z,.85+random()*.33);
    crate(x+.61,z+.18,.54+random()*.27,random()*.6);
    block(x+.30,z+.08,1.27,.78,false,.86);
  }

  function fountain(x,z,scale) {
    const s=scale;
    structures.slabs(x,.02,z,2.48*s,.13,2.48*s,"#a5977d",10,.16);
    structures.slabs(x,.14,z,2.21*s,.18,2.07*s,"#bdb096",10,.16);
    structures.slabs(x,.32,z,2.03*s,.48,1.92*s,limestone,10,.16);
    structures.slabs(x,.81,z,1.80*s,.026,1.80*s,"#698f88",10,.16);
    for (let i=0;i<10;i++) {
      const a=i*TAU/10+.16,b=(i+1)*TAU/10+.16;
      const p=(r,t,y)=>[x+Math.cos(t)*r*s,y,z+Math.sin(t)*r*s];
      structures.quad(p(1.74,a,.90),p(1.74,b,.90),p(2.03,b,.90),p(2.03,a,.90),"#d7c3a0",[0,1,0]);
      structures.quad(p(2.03,a,.73),p(2.03,a,.90),p(2.03,b,.90),p(2.03,b,.73),edge);
      structures.triangle(p(.55,(a+b)/2,.844),p(1.65,a,.844),p(1.65,b,.844),color("#77a39a",.89+random()*.22),[0,1,0]);
    }
    structures.slabs(x,.79,z,.77*s,.34,.59*s,"#b5a386",8,.15);
    structures.slabs(x,1.13,z,.33*s,1.0,.25*s,"#cdb594",8,.15);
    structures.slabs(x,2.09,z,.67*s,.27,.83*s,limestone,8,.15);
    structures.slabs(x,2.37,z,.24*s,.43,.17*s,"#c6ae89",6,.16);
    structures.gem(x,2.78,z,.24*s,.42,.24*s,"#dac19a",6,.17,.07,[[0,.7],[.4,1],[1,0]]);
    block(x,z,4.30*s,4.30*s,false,1.1);
  }
  const fountains=betrahold ? [[23,-19.5,1.16],[-35,21,1.24]] : [[-8,-1,1.14],[26,-29,.86]];
  fountains.forEach(args=>fountain(...args));

  function tree(x,z,scale,tint) {
    const y = scale*2.60;
    structures.slabs(x,0,z,.20*scale,y,.135*scale,"#73543c",7,.3);
    for (let i=0;i<5;i++) {
      const angle=i*TAU/5+random(), distance=(.55+random()*.75)*scale;
      const px=x+Math.sin(angle)*distance,pz=z+Math.cos(angle)*distance, py=y+(random()-.33)*scale;
      structures.beam([x,y*.50,z],[px,py+.35*scale,pz],.14*scale,"#6c5139");
      structures.gem(px,py,pz,scale*(.98+random()*.29),scale*(1.33+random()*.5),scale*(.9+random()*.4),color(tint,.8+random()*.38),7,random(),.16);
    }
    structures.gem(x,y+.89*scale,z,1.06*scale,1.77*scale,1.04*scale,tint,7,.35,.19);
    block(x,z,.60*scale,.60*scale,false,2.25*scale);
  }
  const trees = betrahold ? [
    [-40,-27,1.18,"#7b8e65"],[-38,-13.7,.91,"#919461"],[-23,-24,.83,"#8b9b66"],
    [17,-24,1.10,"#7f936b"],[29,-18,1.13,"#8d955e"],[30,-27,.77,"#9c995e"],
    [47,-22,.86,"#839473"],[-40,17,1.22,"#83945e"],[-30,19,1.03,"#8a9c66"],
    [-37,25.2,1.02,"#929862"],[-47,27,.91,"#839473"],[-4,19,.81,"#92945b"],
    [6,24,.89,"#819669"],[22,18,.90,"#8d9764"],[32,18,1.22,"#81956a"],[30,29,.85,"#8d9d65"],
    [-37.5,9,.77,"#95985f"],[33,-6,.85,"#879867"],[42,29,.82,"#9c965d"],
  ] : [
    [-30,17,1.24,"#889157"],[-30,-2,.94,"#899657"],[-26,-8,.72,"#93935c"],
    [8,22,1.34,"#929653"],[12,12,.88,"#92965a"],[11,-12,.82,"#889356"],
    [14,-37,1.00,"#7f9060"],[34,-37,1.11,"#7e8d59"],[37,-26,.85,"#88935a"],
    [-31,-38,.85,"#868d55"],[-7,-6,.61,"#979756"],[4,-30,.71,"#878f55"],
  ];
  trees.forEach(args => tree(...args));

  function smallBench([x,z,angle],index) {
    const p=(u,y,v)=>[x+Math.cos(angle)*u+Math.sin(angle)*v,y,z-Math.sin(angle)*u+Math.cos(angle)*v];
    structures.box(...p(0,.42,0),1.61,.10,.42,"#916949",angle);
    for (const u of [-.6,.6]) structures.box(...p(u,0,0),.18,.43,.35,"#8e816a",angle);
    const sideways=Math.abs(Math.sin(angle))>.5;
    block(x,z,sideways ? .54 : 1.58,sideways ? 1.58 : .54,false,.53);
    const seats=[-.425,.425].map(offset=>{
      const [x,,z]=p(offset,0,-.12);
      return {x,z,angle};
    });
    return {id:`small-bench-${index}`,x,z,seats};
  }
  const wallBenches=betrahold ? [
    [-41,-3,-Math.PI/2],[-25,2,-Math.PI/2],[15.9,-1,-Math.PI/2],[40.9,3.35,Math.PI/2],
    [-6.7,20,-Math.PI/2],[17.4,21,-Math.PI/2],[41,17.8,Math.PI/2],
  ] : [[-28,17,-Math.PI/2],[-27,0,Math.PI/2],[-12,-6,0],[8,23.3,Math.PI],[30,-36,0],[35,-27,Math.PI/2],[15,-28,Math.PI/2]];
  const smallBenches=wallBenches.map(smallBench);

  function flags(a,b,num,colors) {
    const pos = t => [mix(a[0],b[0],t),mix(a[1],b[1],t)-Math.sin(t*Math.PI)*.91,mix(a[2],b[2],t)];
    for (let i=0;i<num*2;i++) structures.beam(pos(i/(num*2)),pos((i+1)/(num*2)),.029,"#78694c");
    const right=unit(minus(b,a));
    for (let i=0;i<num;i++) {
      const t=(i+.5)/num;
      const [x,y,z]=pos(t);
      cloth.push({x,y,z,dx:right[0],dz:right[2],size:.32+random()*.13,c:colors[i%colors.length],phase:random()*TAU});
    }
  }
  if (betrahold) {
    flags([-42,6.3,-23],[-16.5,6.8,-23],14,["#648785","#e2c997","#a76f57","#8d935e"]);
    flags([-14,7.2,-18],[13,7.1,-7.7],15,["#597f7b","#d7bc8d","#a66e54"]);
    flags([15,6.8,-8],[33,6.8,-14.4],11,["#668986","#dfc190","#a97158"]);
    flags([-7.5,6.4,20],[7.5,6.4,20],9,["#a96c52","#e3c798","#6e8980"]);
  } else {
    flags([-29,6.2,-7.4],[-4,7.0,-10.3],13,["#b86c54","#dac299","#9b975d","#6d857e"]);
    flags([-2,6.5,-13.5],[14,6.9,-6.8],10,["#b56350","#dbc299","#997951"]);
    flags([12,6.3,-40.1],[36,6.1,-38.7],12,["#bb995c","#7d9390","#e2c495","#a45d4c"]);
  }
  const banners=betrahold ? [
    [-8,-7.82,-1],[8,-7.82,-1],[-8,9.83,-1],[8,9.83,-1],[-9,-17.46,-1],[7,-17.46,-1],[38,-14.25,1],
  ] : [[16,13,-1],[17,14,1],[-8,-12,1],[4.4,-36,1],[18,-41,1],[24,-41,1],[37,-19,1]];
  for (const [x,z,sign] of banners) {
    const yy = z < -20 ? 6.55 : 5.66;
    structures.beam([x-.40,yy,z],[x+.40,yy,z],.08,color(wood,.83));
    const a=[x-.32,yy,z+.016],b=[x+.32,yy,z+.016],c=[x+.31,yy-1.3,z+.048],d=[x-.31,yy-1.3,z+.06],e=[x,yy-1.56,z+.09];
    const tint = sign===1?"#a75445":"#74816e";
    structures.quad(a,d,c,b,tint,[0,0,1]); structures.triangle(d,e,c,tint,[0,0,1]);
    structures.triangle([x-.15,yy-.58,z+.055],[x,yy-.31,z+.055],[x+.15,yy-.58,z+.055],"#dbbd7b",[0,0,1]);
    structures.triangle([x-.15,yy-.58,z+.055],[x+.15,yy-.58,z+.055],[x,yy-.85,z+.055],"#dbbd7b",[0,0,1]);
  }

  for(let i=0;i<43;i++) {
    const x = -133+i*6.3, z = -87-random()*43;
    const h = 8+random()*25;
    distant.gem(x,-2,z,9+random()*18,h,13+random()*19,pick(["#8b998c","#8b978e","#a0a78f","#929a88"]),5,random(),.115,[[0,1],[.35,.80],[.7,.49],[1,.04]]);
  }
  for(let i=0;i<34;i++) {
    const x= -73+random()*150,z=-78+random()*20;
    distant.gem(x,0,z,2+random()*4,2.7+random()*5,2+random()*3,pick(["#8a946d","#849174","#9a9c78"]),6,random(),.14);
  }
  const hayPositions=betrahold ? [
    [-40,-19],[-18.3,-16.8],[13,-25.5],[31,-24],[-35.5,7],[-16,5],[39,5],[-39,25],[-5,15.7],[32,21],
  ] : [[1,16],[9,19],[-8,18],[4,-12],[20,-20]];
  const haybales=hayPositions.map(([x,z],i)=>({id:`hay-${i}`,kind:"hay",x,z}));
  for (const {x,z} of haybales) {
    structures.box(x,.04,z,1.8,1.05,1.5,"#c5a052");
    structures.gem(x,.85,z,1, .38,.85,"#d9b563",8,0);
    for (const offset of [-.55,.55]) {
      structures.box(x+offset,.045,z,.075,1.07,1.52,"#80643a");
    }
    for (let i=0;i<36;i++) {
      const u=Math.sin(i*12.3)*.86,v=Math.cos(i*7.7)*.70;
      structures.beam([x+u,1.05,z+v],[x+u+.13,1.14+(i%3)*.035,z+v+.10],.018,i%2 ? "#edcf82" : "#ab863d");
    }
    block(x,z,1.8,1.5,false,1.08);
  }
  const benchPositions=betrahold ? [
    [-31,-28.7,4],[-2,-9.2,4],[27,-16,2],[-36,28.6,4],[2,25.5,2],[27,17,4],[27,22,4],
  ] : [[-4,21,2],[-12,22,4],[-20,18,4],[6,-18,2],[25,-23,4]];
  const benches=benchPositions.map(([x,z,count],i)=>({
    id:`bench-${i}`,x,z,seats:Array.from({length:count},(_,seat)=>({x:x+(seat-(count-1)/2)*.85,z:z-.16,angle:0}))
  }));
  for (const bench of benches) {
    const {x,z,seats}=bench,w=seats.length*.85+.15;
    for (const offset of [-.22,0,.22]) structures.box(x,.46,z+offset,w,.09,.19,"#a0784c");
    for (const offset of [-w/2+.18,w/2-.18]) {
      for (const side of [-.22,.22]) structures.box(x+offset,.03,z+side,.12,.46,.12,"#654a32");
      structures.box(x+offset,.45,z+.28,.10,.65,.10,"#654a32");
    }
    for (const height of [.72,.94]) structures.box(x,height,z+.28,w,.15,.08,"#956d43");
    block(x,z,w,.72,false,1.1);
  }
  const scene = new Mesh();
  for (const mesh of [ground,distant,structures]) {
    for (const value of mesh.data) scene.data.push(value);
  }
  return { ...map, id:mapId, scene, casters:structures, walls, lots, cloth, markets, haybales, benches:[...benches,...smallBenches], fountains };
}

function blocked(city,x,z,r=.30,height=0) {
  const {x0,x1,z0,z1}=city.limits ?? LIMITS;
  if (x < x0+r || x > x1-r || z < z0+r || z > z1-r) return true;
  return city.walls.some(w => w.height >= height && x > w.x0-r && x < w.x1+r && z > w.z0-r && z < w.z1+r);
}

function districtAt(city,x,z) {
  if (city.id==="betrahold") {
    const court=city.courts.find(rect=>within(x,z,rect));
    if (court) return court.name;
    if (z < -25) return "North Wall Walk";
    if (z >= 27) return "South Wall Walk";
    if (z < -13 && x >= -21 && x <= 16) return "Guild Row";
    if (x < -23) return "West Lane";
    if (x > 22) return "East Lane";
    return "Bell Hall";
  }
  if (within(x,z,CHAPEL)) return "Chapel Court";
  if (within(x,z,MARKET)) return "Market Court";
  if (z < -37) return "Bell Tower Lane";
  return z < -9 ? "Lantern Alley" : "Tanners’ Row";
}
