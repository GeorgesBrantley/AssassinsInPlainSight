"use strict";

const LIMITS = { x0: -43, x1: 43, z0: -50, z1: 28 };
const MARKET = { x0: -32, x1: 13, z0: -8, z1: 24 };
const CHAPEL = { x0: 10, x1: 41, z0: -40, z1: -15 };
const within = (x,z,rect) => x >= rect.x0 && x <= rect.x1 && z >= rect.z0 && z <= rect.z1;

function buildCity() {
  const ground = new Mesh(), structures = new Mesh(), distant = new Mesh();
  const walls = [], lots = [], cloth = [];
  const random = randomStream(128309);
  const pick = values => values[Math.floor(random() * values.length)];
  const block = (x,z,w,d,building = false,height = 2.1) => {
    const rect = { x0:x-w/2, x1:x+w/2, z0:z-d/2, z1:z+d/2, height };
    walls.push(rect);
    if (building) lots.push(rect);
  };
  const stone = ["#b9aa91","#c0b19a","#ad9e85","#d1bda0","#b9a489","#a89983","#c5b196"];
  const plaster = ["#d5b98c","#c89471","#d9cdb6","#d3b98f","#b7866e","#d9c4a0","#aeb3a1","#bcb18b"];
  const roofing = ["#a25d46","#8d5947","#87574a","#a96855","#aa7352","#786459","#a45c43"];
  const timbers = ["#573d2a","#694835","#714e35","#513c30"];
  const wood = "#795335";
  const edge = "#9c9078";

  ground.box(0,-.70,-7,230,.66,230,"#a59b7c");
  ground.box(0,-.13,-10,97,.12,90,"#ad9d83");
  for (let row = -54; row < 34; row += .51) {
    for (let col = -46; col < 46; col += .72) {
      const x = col + (Math.round((row + 54)/.51) % 2) * .36, z = row;
      const court = within(x,z,MARKET) || within(x,z,CHAPEL);
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
  border(MARKET);
  border(CHAPEL);

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

  [
    [-37,20,7,9,2,4],[-37,7,7.5,9.3,2,1],[-37,-5,7.7,8.4,3,6],[-37,-17,7.9,9,2,2],[-37,-30,8.4,10,2,3],[-37,-43,8,10,2,0],
    [-25,-14,9,7.6,2,1],[-15,-16,8,8,2,3],[-5,-17,7,7.1,3,2],
    [-25,-28,8.1,10,3,5],[-14,-31,7.6,9.7,2,4],[-4,-31,7,9,2,7],
    [-25,-43,8.5,9,3,6],[-13,-44,9,8.1,3,0],[-4,-44,6.8,7.8,2,1],
    [15,20,8,9,2,1],[24,21,7.2,7.2,2,6],[36,21,12,8.4,2,2],
    [18,9,7.7,9,3,0],[29,10,7,8.7,2,3],[38,8,7.3,7.4,2,5],
    [14,-3,7,8.2,2,2],[24,-3,8,8.2,3,4],[37,-4,10,8.3,2,6],
    [40,-21,4.8,7.5,2,3],[41,-33,4.7,8.6,2,0],[37,-47,8.8,6.5,2,6],
    [-24,28,11,5.4,2,0],[-11,29,10.2,5.0,2,3],[12,30,9,5.5,2,1],[27,30,10,5.3,2,2],
  ].forEach(args => house(...args));

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

  function cityWall(x,z,w,d,h) {
    structures.box(x,0,z,w,h,d,"#a89578");
    structures.box(x,h-.38,z,w+.22,.29,d+.23,"#bcaa88");
    const horizontal=w>d, length=horizontal?w:d;
    for (let i=-length/2+.6;i<length/2;i+=1.24) {
      structures.box(x+(horizontal?i:0),h-.09,z+(horizontal?0:i),horizontal?.74:w+.12,.62,horizontal?d+.12:.74,"#b6a485");
    }
    block(x,z,w,d,true,h+.54);
  }
  cityWall(-44,-10,1.3,83,5.2);
  cityWall(44.6,-10,1.3,83,5.5);
  cityWall(0,-51,88,1.4,5.5);
  cityWall(-25,30,38,1.2,5);
  cityWall(26,30,39.2,1.2,5);

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
  }
  [
    [-21,10,Math.PI*.5,["#b65f49","#e3bc89"]],[-22,4,Math.PI*.5,["#798c77","#d6c295"]],
    [-21,-2,Math.PI*.5,["#c08d50","#ddc7a2"]],[-13,13,0,["#c06b4f","#e4c397"]],
    [-5,13,0,["#798680","#d8c9a9"]],[9,-5,.07,["#bd8a54","#e5cba3"]],
    [33,-21,-Math.PI*.5,["#a9614e","#d2b89b"]],[14,-22,.04,["#7d8372","#d3be95"]],
    [35,-35,-Math.PI*.5,["#89816e","#d5bd93"]],
  ].forEach(args => stall(...args));
  for (const [x,z] of [[-19,8],[-19,1],[-14,14],[-8,14],[10,-3],[15,5],[30,-6],[7,-33],[-12,-11],[-29,-21],[32,-20],[17,-23],[31,16],[11,23]]) {
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
  fountain(-8,-1,1.14);
  fountain(26,-29,.86);

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
  [
    [-30,17,1.24,"#889157"],[-30,-2,.94,"#899657"],[-26,-8,.72,"#93935c"],
    [8,22,1.34,"#929653"],[12,12,.88,"#92965a"],[11,-12,.82,"#889356"],
    [14,-37,1.00,"#7f9060"],[34,-37,1.11,"#7e8d59"],[37,-26,.85,"#88935a"],
    [-31,-38,.85,"#868d55"],[-7,-6,.61,"#979756"],[4,-30,.71,"#878f55"],
  ].forEach(args => tree(...args));

  function bench(x,z,angle) {
    const p=(u,y,v)=>[x+Math.cos(angle)*u+Math.sin(angle)*v,y,z-Math.sin(angle)*u+Math.cos(angle)*v];
    structures.box(...p(0,.42,0),1.61,.10,.42,"#916949",angle);
    for (const u of [-.6,.6]) structures.box(...p(u,0,0),.18,.43,.35,"#8e816a",angle);
    block(x,z,angle ? .54 : 1.58,angle ? 1.58 : .54,false,.53);
  }
  [[-28,17,Math.PI/2],[-27,0,Math.PI/2],[-12,-6,0],[8,22,0],[30,-36,0],[35,-27,Math.PI/2],[15,-28,Math.PI/2]].forEach(args=>bench(...args));

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
  flags([-29,6.2,-7.4],[-4,7.0,-10.3],13,["#b86c54","#dac299","#9b975d","#6d857e"]);
  flags([-2,6.5,-13.5],[14,6.9,-6.8],10,["#b56350","#dbc299","#997951"]);
  flags([12,6.3,-40.1],[36,6.1,-38.7],12,["#bb995c","#7d9390","#e2c495","#a45d4c"]);
  for (const [x,z,sign] of [[16,13,-1],[17,14,1],[-8,-12,1],[4.4,-36,1],[18,-41,1],[24,-41,1],[37,-19,1]]) {
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
  const scene = new Mesh();
  for (const mesh of [ground,distant,structures]) {
    for (const value of mesh.data) scene.data.push(value);
  }
  return { scene, casters: structures, walls, lots, cloth };
}

function blocked(city,x,z,r=.30,height=0) {
  if (x < LIMITS.x0+r || x > LIMITS.x1-r || z < LIMITS.z0+r || z > LIMITS.z1-r) return true;
  return city.walls.some(w => w.height >= height && x > w.x0-r && x < w.x1+r && z > w.z0-r && z < w.z1+r);
}

function districtAt(x,z) {
  if (within(x,z,CHAPEL)) return "Chapel Court";
  if (within(x,z,MARKET)) return "Market Court";
  if (z < -37) return "Bell Tower Lane";
  return z < -9 ? "Lantern Alley" : "Tanners’ Row";
}
