"use strict";

// All local players, remote players, and citizens use the same life-size scale.
const CHARACTER_SCALE = 1;
const MELEE_RANGE = 2.2;
const FOCUS_HOLD_MS = 1000;
const PLAY_SHIFT_X = .06;

const ROSTER = [
  { name:"Wayfarer", description:"A road-worn traveler in a saffron mantle.", coat:"#b9853c", detail:"#e5ba69", shirt:"#743f36", trousers:"#575447", boot:"#4c382b", skin:"#c38c67", hair:"#5f4132", style:"hood" },
  { name:"Mercer", description:"A cloth merchant with a fine burgundy coat.", coat:"#994d48", detail:"#c28b66", shirt:"#ad805a", trousers:"#554039", boot:"#4f332b", skin:"#9a654b", hair:"#39302a", style:"cap" },
  { name:"Herbalist", description:"A gatherer in a moss-green overdress, with a woven scarf and a herb satchel.",
    coat:"#71824d", detail:"#c5bb76", shirt:"#c1b995", trousers:"#62634b", boot:"#584232", skin:"#bc8e64", hair:"#533629",
    female:true, cut:"overdress", style:"kerchief", shoulder:.228, waist:.182, hip:.266 },
  { name:"Scribe", description:"A quiet scholar in ink-blue wool.", coat:"#526873", detail:"#9eac9c", shirt:"#757c6b", trousers:"#4a5451", boot:"#423e32", skin:"#d29c77", hair:"#70513b", style:"hair" },
  { name:"Mason", description:"A stoneworker with a leather apron and rolled sleeves.", coat:"#96734e", detail:"#c9a46f", shirt:"#a69c81", trousers:"#665647", boot:"#594334", skin:"#ad7454", hair:"#4e372b", style:"beard" },
  { name:"Pilgrim", description:"A pilgrim in a pale cowl and a blue-grey cloak.", coat:"#576f82", detail:"#d9c7a4", cowl:"#bdb69f", shirt:"#647a7d", trousers:"#5b6158", boot:"#504236", skin:"#9d7258", hair:"#533c2c", style:"hood" },
  { name:"Dyer", description:"An artisan in a heather-violet dress with gathered sleeves, a tied apron, and a ribbon around her curls.",
    coat:"#94688c", detail:"#d5a9bc", shirt:"#bc99aa", apron:"#574762", trousers:"#63505b", boot:"#533d38", skin:"#bd825f", hair:"#412b2c",
    female:true, cut:"dress", hem:.36, style:"wrap", shoulder:.228, waist:.183, hip:.279 },
  { name:"Baker", description:"A baker in a russet bodice, with rolled linen sleeves and a flour-dusted apron.",
    coat:"#a16447", detail:"#d1a16c", shirt:"#d2bfa3", apron:"#dfcbaa", trousers:"#735942", boot:"#594434", skin:"#ce9974", hair:"#704630",
    female:true, cut:"dress", hem:.30, style:"headband", shoulder:.243, waist:.196, hip:.278 },
  { name:"Weaver", description:"A weaver in a pleated ochre gown with embroidered cuffs and a braided bun pinned with amber beads.",
    coat:"#ba8747", detail:"#e6c582", shirt:"#b39872", trousers:"#695a48", boot:"#503d30", skin:"#a97455", hair:"#392b28",
    female:true, cut:"gown", hem:.24, style:"bun", shoulder:.220, waist:.167, hip:.266 },
  { name:"Apothecary", description:"A palace herbalist in jade and faded rose, with looped braids and a medicine case.",
    coat:"#508167", detail:"#cfa66b", shirt:"#c68789", trousers:"#566458", boot:"#543c37", skin:"#d1a27e", hair:"#263b35",
    female:true, cut:"overdress", style:"apothecary", shoulder:.231, waist:.174, hip:.258 },
  { name:"Courier", description:"A rider in a rust-red split coat, with high leather boots and a long braid.",
    coat:"#a95542", detail:"#d9aa68", shirt:"#bea17a", trousers:"#665744", boot:"#50372d", skin:"#8d5d45", hair:"#2e2624",
    female:true, cut:"riding", style:"braid", shoulder:.238, waist:.177, hip:.245 },
  { name:"Minstrel", description:"A minstrel in a plum doublet with scalloped tails, puffed sleeves, and a ribbon-tied half ponytail.",
    coat:"#78537c", detail:"#d5aa81", shirt:"#a180a3", trousers:"#575064", boot:"#48362f", skin:"#d1a07c", hair:"#8a5435",
    female:true, cut:"doublet", style:"ponytail", shoulder:.225, waist:.171, hip:.247 },
  { name:"Soldier", description:"A guard in full mail and a riveted helmet, with a sheathed sword across his back.",
    coat:"#68737b", detail:"#c0c9cb", shirt:"#788189", trousers:"#58626b", boot:"#463c35", skin:"#ad7e60", hair:"#49352d", style:"mail" },
  { name:"Hero", description:"A woodland adventurer in a pine-green tunic, with a rust scarf and an embroidered sash.",
    coat:"#376352", detail:"#bf9b62", shirt:"#bfb89a", trousers:"#413e3a", boot:"#5d4437", skin:"#ae795b", hair:"#382923", style:"ranger" },
  { name:"King", description:"A crowned king in a crimson mantle with an ivory fur collar.",
    coat:"#863f45", detail:"#d5ac56", shirt:"#595269", trousers:"#513f45", boot:"#41302b", skin:"#b98466", hair:"#786358", style:"king" },
  { name:"Queen", description:"A crowned queen in a lapis gown with brocade sleeves, sapphire drops, and a ceremonial sash.",
    coat:"#435887", detail:"#d9b369", shirt:"#7274a0", trousers:"#45435a", boot:"#45343e", skin:"#9c6a55", hair:"#322833",
    female:true, cut:"gown", hem:.24, style:"queen", shoulder:.226, waist:.177, hip:.280, lip:"#794247" },
  { name:"Princess", description:"A princess in a rose silk gown with ivory sleeves, a pearl tiara, and cascading waves.",
    coat:"#b96983", detail:"#efcb8c", shirt:"#f1d3bb", trousers:"#734e62", boot:"#684054", skin:"#ca9576", hair:"#764736",
    female:true, cut:"gown", hem:.25, style:"princess", shoulder:.219, waist:.164, hip:.279, lip:"#974e59" },
  { name:"Prince", description:"A prince in a midnight-teal doublet with silver fastenings, a half cape, and a sapphire circlet.",
    coat:"#305b69", detail:"#c0c7c9", shirt:"#d6c4a2", trousers:"#404b5d", boot:"#4c3732", skin:"#ad795a", hair:"#593b2d", style:"prince" },
];

function makeFigure(outfit) {
  if (outfit.female) return makeTailoredFigure(outfit);
  const body = new Mesh();
  const { coat, detail, shirt, trousers, boot, skin, hair, style } = outfit;
  const mail=style==="mail", royal=style==="king", prince=style==="prince", ranger=style==="ranger", mason=style==="beard";
  const cut = (mesh,x,y,z,w,h,d,tint,rings,sides=6) => mesh.gem(x,y,z,w,h,d,tint,sides,Math.PI/6,.06,rings);
  const middle = [[0,.87],[.42,.90],[.94,1],[1,.75]];
  const lower=[[0,1],[.72,.74],[1,.73]];
  const collar=outfit.cowl ?? (style==="hood" ? detail : ranger ? "#9b5240" : color(coat,1.1));
  cut(body,0,.73,0,.30,.42,.183,coat,lower);
  cut(body,0,1.04,0,.32,.53,.187,coat,middle);
  cut(body,0,1.44,.008,.28,.155,.18,collar,[[0,1],[.50,.94],[1,.55]]);
  cut(body,0,1.00,0,.256,.095,.190,boot,[[0,1],[1,1]]);
  body.box(.016,1.025,-.181,.10,.055,.032,detail);
  body.box(.016,1.040,-.201,.052,.022,.014,boot);
  if (!mail && !royal && !prince) {
    body.box(.153,1.05,.128,.14,.17,.10,color(boot,1.3),-.16);
    body.box(.153,1.17,.127,.151,.043,.118,color(boot,1.48),-.16);
  }

  if (style === "hood") {
    for (const sign of [-1,1]) {
      body.quad([sign*.07,1.48,.183],[sign*.245,1.43,.150],[sign*.29,.79,.148],[sign*.07,.68,.224],color(coat,sign===1 ? .90 : 1.02),[sign*.27,.04,.96]);
      const lining=outfit.cowl ? color(coat,1.17) : detail;
      body.quad([0,1.49,.194],[sign*.07,1.48,.183],[sign*.07,.68,.224],[0,.76,.248],color(lining,sign===1 ? .82 : .91),[sign*.22,.06,.97]);
      body.beam([sign*.075,.72,.230],[sign*.07,1.38,.196],.021,color(lining,.97));
    }
    body.beam([-.198,1.51,-.107],[.21,1.04,-.196],.082,color(boot,1.14),.029);
  } else if (mason) {
    const apron = color(boot,1.16);
    body.quad([-.13,1.38,-.182],[-.22,.74,-.168],[.22,.74,-.168],[.13,1.38,-.182],color(apron,.94),[0,0,-1]);
    body.beam([-.10,1.48,-.114],[.12,1.12,-.196],.047,color(apron,.89),.028);
  } else if (style==="cap") {
    for (const sign of [-1,1]) {
      body.beam([sign*.129,1.48,-.112],[sign*.067,1.24,-.176],.032,detail,.018);
      body.beam([sign*.067,1.24,-.176],[sign*.054,.78,-.166],.023,detail,.018);
    }
    for (let y=1.13;y<1.42;y+=.083) body.box(0,y,-.182,.045,.024,.023,detail);
  } else if (mail) {
    addSoldierGear(body,coat,detail,boot,lower,middle);
  } else if (royal) {
    const fur="#ddd1b3", velvet="#72363e";
    cut(body,0,1.38,0,.35,.20,.218,fur,[[0,.97],[.28,1],[.78,.80],[1,.40]],9);
    for (const sign of [-1,1]) {
      body.quad([0,1.42,.210],[sign*.31,1.39,.115],[sign*.38,.77,.176],[0,.69,.264],color(velvet,sign===1 ? .93 : 1.08),[sign*.26,.13,1]);
      body.beam([sign*.38,.77,.181],[0,.69,.269],.033,detail,.017);
      body.beam([sign*.315,1.38,.124],[sign*.38,.77,.182],.026,detail,.018);
      body.beam([sign*.21,1.43,-.173],[0,1.30,-.202],.029,detail,.018);
      for (let i=0;i<3;i++) body.box(sign*(.07+i*.053),1.435+(i%2)*.036,-.196+i*.009,.018,.031,.013,"#786653");
    }
    body.gem(0,1.27,-.199,.049,.074,.033,detail,6);
  } else if (prince) {
    // A short mantle leaves the other shoulder and the doublet's fastenings visible.
    garment(body,[[.87,.339,.239],[.91,.334,.237],[1.25,.298,.218],[1.44,.317,.164],[1.54,.113,.121]],
      (row,side)=>side<2 || side>8 ? null : row===0 ? detail : "#576da0",.08);
    body.beam([-.224,1.46,.058],[-.135,1.37,-.159],.116,"#576da0",.046);
    body.gem(-.129,1.342,-.169,.051,.072,.032,detail,7);
    body.gem(-.129,1.357,-.202,.025,.040,.014,"#538fa9",6);
    for (const y of [1.145,1.218,1.291,1.364]) {
      body.beam([-.060,y,-.176],[.060,y+.009,-.176],.022,detail,.024);
    }
  } else if (ranger) {
    cut(body,0,1.452,0,.238,.116,.191,"#a85844",[[0,1],[.50,.78],[1,.60]],8);
    body.quad([-.092,1.477,-.177],[.064,1.466,-.188],[.006,1.281,-.199],[-.060,1.362,-.198],"#b76a50",[0,0,-1]);
    body.quad([-.089,1.50,.168],[.020,1.482,.179],[.145,1.225,.206],[.081,1.254,.211],"#9b5240",[0,0,1]);
    body.beam([-.204,1.374,-.134],[.211,1.03,-.177],.086,"#858566",.033);
    for (let i=0;i<4;i++) body.beam([-.125+i*.073,1.339-i*.061,-.176],[-.073+i*.073,1.320-i*.061,-.185],.013,detail);
  } else {
    body.beam([-.19,1.51,-.134],[.213,1.03,-.177],.081,detail,.04);
  }

  body.slabs(0,1.48,-.01,.073,.16,.08,skin,6,Math.PI/6);
  const head = new Mesh();
  cut(head,0,0,-.021,.153,.333,.139,skin,[[0,.65],[.24,.86],[.70,1],[.91,.95],[1,.61]],8);
  const headDark = color(skin,.79);
  head.gem(0,.081,-.126,.034,.106,.071,color(skin,1.05),5,.22,.06,[[0,.50],[.23,1],[1,.32]]);
  for (const sign of [-1,1]) {
    head.box(sign*.058,.146,-.144,.037,.017,.014,color(hair,.65));
    head.box(sign*.058,.177,-.144,.046,.013,.013,hair);
  }
  head.box(0,.063,-.138,.058,.008,.008,headDark);
  const wraps = [[0,.68],[.24,1],[.72,.95],[1,.62]];
  if (style === "hood") {
    const hood = color(outfit.cowl ?? coat,.93);
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
  } else if (mail) {
    const helmet="#7a858c", edge="#b8c1be";
    cut(head,0,.198,-.006,.176,.176,.157,helmet,[[0,1],[.48,.93],[.83,.67],[1,.21]],8);
    cut(head,0,.181,-.006,.182,.043,.163,edge,[[0,1],[1,.98]],8);
    cut(head,0,.018,.050,.163,.194,.123,coat,[[0,.86],[.25,1],[1,1]],8);
    for (const sign of [-1,1]) {
      head.beam([sign*.147,.219,-.089],[sign*.156,.048,-.065],.048,helmet,.045);
      head.box(sign*.095,.195,-.150,.021,.023,.018,helmet);
    }
    head.beam([0,.228,-.158],[0,.093,-.174],.036,edge,.03);
  } else if (style === "cap") {
    cut(head,0,.236,-.013,.186,.099,.159,detail,[[0,.87],[.33,1],[1,.73]],8);
    head.slabs(0,.234,-.046,.190,.035,.18,color(coat,.90),8,.09,.163);
  } else {
    cut(head,0,.218,-.019,.170,.126,.163,hair,[[0,1],[.53,.96],[1,.71]],8);
    if (mason || royal) head.gem(0,royal ? -.064 : -.029,-.081,.120,royal ? .190 : .157,.084,hair,7,.03,.09,[[0,.67],[.44,1],[1,.92]]);
    else head.gem(0,.101,.068,.148,.167,.104,hair,7,.23,.07);
    if (royal) addCrown(head,detail,"#a74449",.082,.36);
    if (prince) {
      head.gem(0,.245,-.011,.175,.049,.168,detail,8,Math.PI/8,.05,[[0,1],[.45,1],[1,.95]]);
      head.gem(0,.244,-.170,.042,.075,.030,detail,6);
      head.gem(0,.258,-.197,.028,.044,.013,"#538fa9",6);
    }
    if (ranger) head.beam([-.102,.222,-.139],[.082,.271,-.140],.064,color(hair,1.34),.049);
  }
  const arms = [], legs = [];
  for (const side of [-1,1]) {
    const arm = new Mesh(), leg = new Mesh();
    cut(arm,side*.032,-.397,.002,.094,.413,.102,mason ? skin : shirt,[[0,.61],[.55,.87],[.88,1],[1,.81]]);
    cut(arm,0,mason ? -.249 : -.205,0,.108,mason ? .282 : .238,.118,mason ? shirt : coat,[[0,.83],[.63,1],[1,.79]]);
    if (mason || mail) {
      cut(arm,0,mason ? -.268 : -.378,0,mason ? .106 : .083,.058,mason ? .112 : .086,mason ? color(shirt,1.29) : detail,[[0,1],[1,.98]]);
    }
    if (mail) {
      cut(arm,0,-.145,0,.118,.17,.127,detail,[[0,.76],[.38,1],[.8,.96],[1,.70]]);
      cut(leg,0,-.46,0,.112,.112,.126,color(detail,.91),[[0,.63],[.43,1],[1,.85]]);
    }
    if (ranger) {
      cut(arm,side*.026,-.403,-.006,.079,.113,.085,color(boot,1.27),[[0,.86],[.82,1],[1,.91]]);
      arm.box(side*.026,-.331,-.090,.037,.020,.014,detail);
    }
    if (prince) {
      cut(arm,side*.026,-.398,-.008,.078,.098,.085,coat,[[0,1],[1,1]]);
      cut(arm,side*.026,-.399,-.008,.079,.024,.086,detail,[[0,1],[1,1]]);
    }
    cut(arm,side*.034,-.455,-.006,.062,.097,.059,skin,[[0,.73],[.40,1],[1,.86]]);
    cut(leg,0,-.67,0,.105,.67,.106,trousers,[[0,.62],[.42,.79],[1,1]]);
    cut(leg,0,-.796,-.006,.091,.333,.103,boot,[[0,.89],[.53,.82],[1,1]]);
    leg.box(0,-.813,-.054,.176,.105,.286,color(boot,.92));
    leg.box(0,-.818,-.058,.181,.032,.289,color(boot,.73));
    arms.push(arm); legs.push(leg);
  }
  return { body, head, arms, legs, shoulder:.301, hip:.139, legSwing:1 };
}

function addSoldierGear(body, mail, steel, leather, lower, middle) {
  // Follow the facets of the hauberk so the links stay flush to the fabric.
  const surface=(x,y,facing,offset=0)=>{
    const torso=y>=1.04, rings=torso ? middle : lower;
    const rise=(y-(torso ? 1.04 : .73))/(torso ? .53 : .42);
    const ring=rings.findIndex(([height])=>height>=rise);
    const [bottom,narrow]=rings[ring-1], [top,wide]=rings[ring];
    const size=mix(narrow,wide,(rise-bottom)/(top-bottom));
    const depth=(torso ? .187 : .183)*(size-Math.abs(x)/(Math.sqrt(3)*(torso ? .32 : .30)));
    return [x,y,facing*(depth+.004+offset)];
  };
  for (const facing of [-1,1]) {
    for (let row=0;row<12;row++) {
      const y=row<4 ? .79+row*.054 : 1.108+(row-4)*.044;
      for (let column=-3;column<=3;column++) {
        const x=(column+(row%2)*.5)*.051;
        const left=surface(x-.025,y,facing), right=surface(x+.025,y,facing);
        const top=surface(x,y+.021,facing), bottom=surface(x,y-.018,facing);
        body.quad(left,top,right,bottom,
          color(mail,(row+column)%3===0 ? 1.37 : .75),[0,0,facing]);
        body.triangle(left,surface(x,y+.017,facing,.002),surface(x+.009,y,facing,.002),steel,[0,0,facing]);
      }
    }
  }
  body.beam([.229,1.50,-.129],[-.235,1.03,-.171],.083,leather,.027);
  body.beam([-.222,.84,.242],[.223,1.64,.242],.107,"#52433b",.081);
  body.beam([-.221,.858,.287],[.219,1.641,.287],.018,steel,.014);
  body.beam([.151,1.686,.247],[.306,1.596,.247],.042,steel,.056);
  body.beam([.222,1.641,.247],[.337,1.846,.247],.053,"#6a4d3e",.057);
  for (let i=0;i<4;i++) {
    const x=.245+i*.024, y=1.682+i*.043;
    body.beam([x-.021,y+.012,.277],[x+.021,y-.012,.277],.015,steel,.016);
  }
  body.gem(.343,1.824,.247,.046,.076,.041,steel,6);
}

function addCrown(head, gold, jewel, pointHeight, angle) {
  const sides=10, base=.287, rim=.338, z=.008;
  const ring=(t,y,r)=>[Math.cos(t)*r,y,z+Math.sin(t)*r*.91];
  head.gem(0,base,z,.158,rim-base,.144,gold,sides,angle,.06,[[0,.95],[.28,1],[.79,1],[1,1.04]]);
  for (let i=0;i<sides;i++) {
    const a=angle+i*TAU/sides, b=a+TAU/sides, mid=(a+b)/2;
    const tip=ring(mid,rim+pointHeight*(i%2 ? 1 : .58),.160);
    // Both faces remain visible when the wearer turns away.
    const left=ring(a,rim-.004,.163), right=ring(b,rim-.004,.163);
    head.triangle(left,tip,right,color(gold,1.13));
    head.triangle(right,tip,left,color(gold,.73));
  }
  head.gem(0,.302,-.144,.032,.049,.022,jewel,6);
}

// Each row defines height, half-width and depth. Panel boundaries run through the
// ring vertices so seams, inset fabric, and trim share the shape of the garment.
function garment(mesh, rows, tintAt, pleats=0) {
  const sides=12;
  const point=(row,side)=>{
    const [y,width,depth]=rows[row], angle=side*TAU/sides-Math.PI/2;
    const fold=side%2 ? 1-pleats*(1-row/(rows.length-1)) : 1;
    return [Math.cos(angle)*width*fold,y,Math.sin(angle)*depth*fold];
  };
  for (let row=0;row<rows.length-1;row++) {
    for (let side=0;side<sides;side++) {
      const tint=tintAt(row,side);
      if (tint) mesh.quad(point(row,side),point(row+1,side),point(row+1,side+1),point(row,side+1),tint);
    }
  }
}

function makeTailoredFigure(outfit) {
  const {coat,detail,shirt,trousers,boot,skin,cut,shoulder,waist,hip}=outfit;
  const body=new Mesh(), arms=[], legs=[];
  const isOverdress=cut==="overdress", isRiding=cut==="riding", isDoublet=cut==="doublet";
  const {style}=outfit;
  const apothecary=style==="apothecary", queen=style==="queen", princess=style==="princess";
  const baker=style==="headband", dyer=style==="wrap", weaver=style==="bun";
  const hem=outfit.hem ?? (isOverdress ? .39 : 0);
  const leather=color(boot,1.28), darkCloth=color(coat,.78), piping=color(detail,.91);
  const frontPanel=side=>side===0 || side===11;
  const top=[
    [1.043,waist,.141],[1.16,waist*1.06,.159],
    [1.30,shoulder*.94,.185],[1.43,shoulder,.161],[1.49,shoulder*.89,.131],[1.55,.092,.099],
  ];
  garment(body,top,(row,side)=>row>=2 && frontPanel(side) && !princess ? shirt : coat);
  body.slabs(0,1.46,-.015,.065,.15,.072,skin,8,Math.PI/8,.073);

  // Bind the bodice opening and add lacing or coat clasps along the seam.
  for (const sign of [-1,1]) {
    body.beam([sign*.112,1.477,-.114],[sign*.108,1.30,-.164],.028,piping,.018);
    body.beam([sign*.108,1.30,-.164],[sign*.043,1.20,-.168],.023,piping,.018);
  }
  if (apothecary) {
    for (const sign of [-1,1]) {
      body.beam([sign*.093,1.51,-.106],[-sign*.091,1.268,-.184],.041,shirt,.019);
    }
    body.gem(0,1.06,-.012,waist*1.13,.072,.16,"#8c5a65",10,Math.PI/10,.03,[[0,1],[1,1]]);
  }
  if (queen) {
    body.beam([-.182,1.475,-.108],[.071,1.282,-.195],.069,"#b87e56",.036);
    body.beam([.071,1.282,-.195],[.179,1.064,-.126],.068,"#b87e56",.036);
    body.gem(-.150,1.409,-.157,.044,.060,.029,detail,6);
    body.gem(-.151,1.422,-.183,.024,.035,.014,"#a34f57",6);
  }
  if (princess) {
    const pearl="#f4e1c5";
    for (const sign of [-1,1]) {
      body.beam([sign*.158,1.474,-.100],[sign*.091,1.429,-.145],.024,pearl,.024);
      body.beam([sign*.091,1.429,-.145],[0,1.410,-.167],.024,pearl,.019);
    }
    body.gem(0,1.374,-.174,.029,.054,.021,detail,6);
    body.gem(0,1.385,-.193,.014,.032,.014,pearl,6);
  }
  if (cut==="gown" || isDoublet) {
    for (let i=0;i<3;i++) {
      const sign=i%2 ? 1 : -1, y=1.158+i*.044, z=-.166-i*.009;
      body.beam([sign*.044,y,z],[-sign*.044,y+.032,z-.008],.014,piping);
    }
  } else {
    for (let i=0;i<3;i++) body.box(-.019,1.15+i*.053,-.174-i*.01,.038,.018,.013,detail);
  }
  garment(body,[[1.009,waist*1.13,.160],[1.035,waist*1.11,.157],[1.077,waist*1.09,.154]],
    row=>princess ? row===0 ? piping : color(coat,1.35) : row===0 ? leather : boot);
  body.box(-.035,1.027,-.164,.070,.038,.022,detail);
  body.box(-.021,1.036,-.170,.042,.021,.018,boot);
  if (dyer) {
    for (const sign of [-1,1]) {
      body.quad([0,1.04,.174],[sign*.117,1.095,.195],[sign*.128,1.008,.194],[0,1.015,.185],detail,[0,0,1]);
      body.quad([sign*.021,1.04,.189],[sign*.064,1.035,.196],[sign*.094,.853,.214],[sign*.049,.874,.217],color(detail,.86),[0,0,1]);
    }
    body.box(0,1.009,.195,.054,.065,.041,color(detail,.93));
  }

  if (hem) {
    const flare=princess ? .477 : cut==="gown" ? .444 : isOverdress ? .384 : .403;
    const skirt=[
      [hem,flare,.306],[hem+.036,flare*.985,.301],
      [hem+.18,flare*.88,.261],[.82,hip*1.05,.189],[1.055,waist*1.04,.147],
    ];
    const apron=outfit.apron;
    garment(body,skirt,(row,side)=>{
      if (apron && frontPanel(side) && row>1) return baker && row===2 ? color(apron,1.10) : apron;
      if (row===0) return cut==="gown" ? detail : darkCloth;
      if (princess && frontPanel(side)) return "#cf92a6";
      if (weaver && row>=1 && side%2===0) return color(coat,1.13);
      if (cut==="gown" && frontPanel(side)) return color(coat,1.13);
      return coat;
    },weaver ? .15 : .07);
    if (princess) {
      garment(body,[[.49,.450,.302],[.53,.447,.297],[.80,.319,.216],[1.055,waist*1.06,.152]],
        (row,side)=>frontPanel(side) ? null : row===0 ? detail : color(coat,.86),.09);
    }
    if (isOverdress) {
      garment(body,[[.54,flare*.95,.282],[.58,flare*.94,.275],[.79,hip*1.13,.212],[1.055,waist*1.04,.151]],
        (row,side)=>frontPanel(side) ? null : row===0 ? piping : darkCloth,.05);
    }
  } else if (isDoublet) {
    garment(body,[[.73,hip*1.23,.200],[.76,hip*1.22,.198],[.94,hip,.174],[1.055,waist*1.04,.147]],
      (row,side)=>row===0 ? detail : frontPanel(side) ? darkCloth : coat,.04);
    for (const sign of [-1,1]) {
      body.triangle([sign*.056,.736,-.202],[sign*.197,.736,-.157],[sign*.127,.674,-.191],piping,[0,0,-1]);
    }
  } else {
    garment(body,[[.86,hip*1.04,.173],[.94,hip*1.02,.171],[1.055,waist*1.04,.147]],
      (row,side)=>frontPanel(side) ? darkCloth : coat);
  }

  if (isOverdress || isRiding) {
    const strap=[[-.15,1.48,.112],[-.037,1.30,.188],[.091,1.12,.149],[.204,1.02,.174]];
    for (let i=0;i<strap.length-1;i++) body.beam(strap[i],strap[i+1],.061,leather,.026);
    body.box(.14,.90,.143,.19,.19,.116,leather,-.16);
    body.box(.14,1.028,.146,.194,.059,.121,color(boot,1.55),-.16);
    body.box(.205,.976,.252,.036,.042,.024,detail);
    if (apothecary) {
      body.box(.163,.86,-.138,.125,.149,.098,"#745044",-.18);
      body.box(.163,.972,-.144,.136,.042,.109,detail,-.18);
      body.gem(.098,.889,-.206,.028,.104,.027,"#91b1a4",6);
      body.box(.098,.985,-.205,.032,.028,.032,"#7f6747");
    } else if (outfit.style==="kerchief") {
      for (const side of [-1,0,1]) {
        const x=.14+side*.045;
        body.beam([x,1.01,.18],[x+side*.037,1.14,.227],.014,"#667545");
        body.gem(x+side*.027,1.093,.226,.026,.049,.019,"#9e9d61",5);
      }
      body.beam([-.122,1.463,-.101],[.084,1.301,-.184],.066,"#ab9f67",.022);
      for (let i=0;i<4;i++) body.box(-.096+i*.041,1.43-i*.029,-.142-i*.012,.026,.012,.016,detail);
    }
  } else {
    body.beam([-.085,1.50,.113],[0,1.079,.153],.022,piping,.014);
    body.beam([.085,1.50,.113],[0,1.079,.153],.022,piping,.014);
  }

  for (const side of [-1,1]) {
    const arm=new Mesh(), leg=new Mesh();
    const dressSleeve=princess || queen || isDoublet || dyer;
    const sleeveWidth=dressSleeve ? .106 : baker ? .092 : .076;
    arm.gem(side*.017,-.405,0,.073,.389,.077,baker ? skin : shirt,7,.23,.05,[[0,.63],[.40,.82],[1,1]]);
    arm.gem(0,-.226,0,sleeveWidth,.25,dressSleeve ? .116 : .095,baker || princess ? shirt : coat,
      7,.23,.06,[[0,.76],[.54,1],[.83,.97],[1,.69]]);
    arm.gem(side*.017,baker ? -.248 : -.403,0,baker ? .081 : .056,.052,baker ? .087 : .063,baker ? color(shirt,1.17) : piping,7,.23,.04,[[0,.97],[1,1]]);
    if (dressSleeve) {
      arm.gem(0,-.228,0,.085,.043,.098,detail,7,.23,.04,[[0,.97],[1,1]]);
      if (queen || princess) {
        for (const x of [-.043,0,.043]) {
          arm.gem(x,-.139,-.105,.016,.043,.012,detail,5);
        }
      }
    }
    if (weaver) {
      arm.gem(side*.017,-.370,0,.066,.060,.073,darkCloth,7,.23,.05,[[0,.85],[1,1]]);
      for (const x of [-.035,0,.035]) {
        arm.gem(side*.017+x,-.355,-.067,.011,.027,.009,detail,5);
      }
    }
    arm.gem(side*.018,-.477,-.007,.052,.091,.049,skin,7,.23,.05,[[0,.69],[.45,1],[1,.84]]);

    leg.gem(0,-.68,0,.091,.68,.091,trousers,7,.24,.04,[[0,.60],[.46,.83],[1,1]]);
    const bootHeight=isRiding ? .46 : .30;
    leg.gem(0,-.80,-.004,.075,bootHeight,.088,boot,7,.24,.04,[[0,.94],[.40,.86],[1,1]]);
    leg.gem(0,-.82,-.061,.078,.13,.152,color(boot,1.08),8,Math.PI/8,.045,[[0,.93],[.30,1],[1,.61]]);
    leg.gem(0,-.823,-.071,.080,.030,.153,color(boot,.73),8,Math.PI/8,.02,[[0,1],[1,1]]);
    leg.gem(0,-.81+bootHeight,-.004,.079,.037,.092,leather,7,.24,.03,[[0,1],[1,.97]]);
    if (isRiding) {
      // Each half of the coat follows its leg, leaving a vent down the middle.
      const outer=side*.127, inner=-side*.111;
      leg.quad([inner,.105,.13],[outer,.105,.147],[outer*1.24,-.32,.159],[inner,-.28,.147],coat,[side*.20,0,1]);
      leg.quad([outer,.105,.147],[outer,.105,-.024],[outer*1.24,-.32,-.044],[outer*1.24,-.32,.159],darkCloth,[side,0,0]);
      leg.beam([inner,-.279,.148],[outer*1.24,-.319,.160],.026,piping,.013);
    }
    arms.push(arm);
    legs.push(leg);
  }
  return {body,head:makeTailoredHead(outfit),arms,legs,shoulder:shoulder+.013,hip:hip*.47,legSwing:hem ? .39 : 1};
}

function makeTailoredHead({skin,hair,detail,style,shoulder,lip}) {
  const head=new Mesh(), darkHair=color(hair,.72), lightHair=color(hair,1.24);
  const mouth=lip ?? color(skin,.59), shade=color(skin,.84), eyeWhite=color(skin,1.28);
  const faceWidth=.141+(shoulder-.225)*.36;
  const cut=(x,y,z,w,h,d,tint,rings)=>head.gem(x,y,z,w,h,d,tint,8,Math.PI/8,.055,rings);
  cut(0,0,-.023,faceWidth,.318,.142,skin,[[0,.52],[.18,.78],[.45,.96],[.72,1],[.92,.92],[1,.56]]);
  cut(0,.079,-.133,.029,.099,.044,color(skin,1.04),[[0,.48],[.28,1],[1,.27]]);
  head.beam([-.025,.067,-.131],[0,.062,-.139],.009,mouth,.009);
  head.beam([0,.062,-.139],[.025,.067,-.131],.009,mouth,.009);
  for (const sign of [-1,1]) {
    const x=sign*faceWidth*.37;
    head.beam([x-sign*.019,.150,-.151],[x+sign*.020,.153,-.149],.017,shade,.018);
    head.beam([x-sign*.015,.151,-.160],[x+sign*.016,.154,-.154],.011,eyeWhite,.009);
    head.beam([x-sign*.019,.159,-.158],[x+sign*.019,.162,-.153],.008,darkHair,.009);
    head.box(x-.006,.146,-.166,.012,.013,.008,darkHair);
    head.beam([x-sign*.025,.184,-.150],[x+sign*.021,.190,-.146],.012,hair,.013);
    cut(sign*.126,.086,.000,.025,.078,.036,skin);
    if (style==="bun" || style==="ponytail" || style==="wrap") {
      cut(sign*.139,.070,-.008,.014,.030,.014,detail);
    }
  }

  cut(0,.085,.076,.147,.203,.115,darkHair,[[0,.70],[.37,.98],[.78,1],[1,.71]]);
  cut(0,.203,-.014,.155,.134,.153,hair,[[0,.98],[.54,1],[1,.64]]);
  head.beam([-.041,.292,-.114],[-.104,.202,-.119],.061,hair,.042);
  head.beam([-.029,.294,-.112],[.106,.218,-.111],.069,lightHair,.038);
  for (const sign of [-1,1]) {
    cut(sign*.124,.112,-.075,.029,.154,.040,hair,[[0,.46],[.40,.95],[1,.80]]);
  }

  if (style==="kerchief") {
    cut(0,.231,-.012,.172,.121,.167,detail,[[0,1],[.50,.97],[1,.67]]);
    cut(0,.225,-.012,.173,.030,.172,color(detail,.87),[[0,.98],[1,1]]);
    head.beam([.084,.166,.165],[.142,-.010,.127],.070,detail,.037);
    cut(.081,.116,.176,.049,.060,.053,color(detail,.89));
  } else if (style==="princess") {
    for (const sign of [-1,1]) {
      cut(sign*.106,-.169,.117,.081,.384,.091,darkHair,[[0,.48],[.36,.92],[.64,1],[1,.69]]);
      const wave=[[sign*.121,.244,-.053],[sign*.163,.135,-.068],[sign*.123,.007,-.111],[sign*.165,-.111,-.120]];
      for (let i=0;i<wave.length-1;i++) {
        head.beam(wave[i],wave[i+1],.066-i*.011,i%2 ? hair : lightHair,.061-i*.009);
      }
      cut(sign*.130,.036,-.062,.019,.047,.020,"#f2dcbd");
    }
    const tiara=[[-.138,.277,-.069],[-.082,.311,-.123],[0,.352,-.137],[.082,.311,-.123],[.138,.277,-.069]];
    for (let i=0;i<tiara.length-1;i++) head.beam(tiara[i],tiara[i+1],.019,detail,.023);
    for (const [x,y,z] of tiara.slice(1,-1)) cut(x,y-.005,z-.011,.020,.033,.019,"#f5e5ce");
  } else if (style==="apothecary" || style==="queen") {
    for (const sign of [-1,1]) {
      cut(sign*.103,.031,.08,.061,.204,.102,darkHair);
      if (style==="apothecary") {
        for (let i=0;i<5;i++) {
          const angle=(i+1)*Math.PI/6;
          cut(sign*(.126+.053*Math.sin(angle)),.117+.077*Math.cos(angle),.052+i*.013,.039,.064,.043,i%2 ? lightHair : hair);
        }
        cut(sign*.159,.160,.061,.028,.031,.036,detail);
      } else {
        cut(sign*.101,-.075,.079,.051,.209,.085,hair);
        cut(sign*.138,.062,-.032,.019,.025,.021,detail);
        cut(sign*.141,.023,-.042,.020,.045,.023,"#86b0ca");
      }
    }
    if (style==="queen") addCrown(head,detail,"#7ea2c6",.113,.407);
  } else if (style==="wrap" || style==="headband") {
    const band=style==="headband" ? detail : "#ac7b9a";
    cut(0,.242,-.010,.161,.057,.154,band,[[0,.99],[.55,1],[1,.95]]);
    for (let i=0;i<5;i++) {
      const angle=i*Math.PI/4;
      cut(Math.cos(angle)*.114,.19+Math.sin(angle)*.060,.135,.046,.106,.064,i%2 ? lightHair : hair);
    }
    if (style==="wrap") {
      cut(.143,.210,.008,.036,.057,.047,detail);
      head.beam([.153,.236,.019],[.184,.146,.039],.035,detail,.020);
      head.beam([.158,.232,.034],[.154,.165,.085],.033,band,.018);
    }
  } else if (style==="bun") {
    cut(0,.156,.183,.106,.148,.094,hair);
    cut(0,.193,.223,.077,.081,.077,lightHair,[[0,.78],[.39,1],[1,.67]]);
    for (let i=0;i<5;i++) {
      const angle=i*Math.PI/4;
      cut(Math.cos(angle)*.085,.186+Math.sin(angle)*.078,.223,.022,.036,.039,i%2 ? darkHair : hair);
    }
    head.beam([-.111,.188,.204],[.111,.248,.214],.014,detail,.014);
    cut(.111,.240,.214,.021,.042,.022,"#e7ac68");
  } else if (style==="braid") {
    for (let i=0;i<7;i++) {
      const x=.035+i*.008, y=.159-i*.057, width=.051-i*.003;
      cut(x-.012,y,.166+i*.009,width,.084,.051,darkHair);
      cut(x+.012,y+.016,.184+i*.009,width,.064,.045,hair);
    }
    cut(.087,-.209,.237,.027,.028,.028,detail);
  } else {
    cut(0,.169,.180,.046,.06,.060,detail);
    head.beam([0,.192,.193],[.081,.012,.214],.101,hair,.089);
    head.beam([.081,.012,.214],[.045,-.111,.190],.071,lightHair,.063);
    head.beam([0,.199,.226],[-.089,.071,.240],.042,detail,.021);
    head.beam([.011,.195,.235],[.043,.082,.269],.039,detail,.020);
  }
  return head;
}

function animationPose(actor) {
  const animation=actor.animation;
  if (!animation) return null;
  const age=animation.age+(performance.now()-(animation.receivedAt ?? performance.now()))/1000;
  const progress=clamp(age/animation.duration,0,1);
  return {...animation,progress};
}

function drawFigure(mesh, figure, actor, time) {
  let pose=animationPose(actor);
  if (pose?.kind.startsWith("bench-")) {
    const p=pose.progress,t=p*p*(3-2*p),kind=pose.kind;
    if (kind==="bench-sit" || kind==="bench-rise") {
      drawStandingFigure(mesh,figure,{...actor,x:mix(pose.x,actor.x,t),z:mix(pose.z,actor.z,t)},time,
        {...pose,sitting:kind==="bench-sit" ? t : 1-t});
      return;
    }
    if (kind==="bench-fall") {
      const body=eliminationMesh;
      body.data.length=0;
      drawStandingFigure(body,figure,{...actor,x:0,z:0,angle:0,bench:null},time,
        {...pose,sitting:1-clamp(p/.45,0,1)});
      const pitch=-t*Math.PI/2;
      let floor=0;
      for (let i=0;i<body.data.length;i+=9) floor=Math.min(floor,body.data[i+1]*Math.cos(pitch)-body.data[i+2]*Math.sin(pitch));
      mesh.append(body,mix(pose.x,actor.x,t),.015-floor,mix(pose.z,actor.z,t),pose.angle,actor.scale || 1,pitch);
      return;
    }
    const seatedAttack=kind.startsWith("bench-attack-");
    const seatedVictim=kind==="bench-stagger";
    if (seatedAttack || seatedVictim) actor={...actor,x:mix(pose.x,actor.x,clamp(p/.4,0,1)),z:mix(pose.z,actor.z,clamp(p/.4,0,1))};
    pose={...pose,kind:seatedVictim ? "stagger" : "stun-strike",
      sitting:seatedAttack || seatedVictim ? 1-clamp(p/.4,0,1) : 0};
  }
  if (pose?.kind.startsWith("hay-") && ["hay-enter","hay-exit","hay-shove"].includes(pose.kind)) {
    const entering=pose.kind==="hay-enter", p=pose.progress, t=p*p*(3-2*p);
    const body=eliminationMesh;
    body.data.length=0;
    drawStandingFigure(body,figure,{...actor,x:0,z:0,angle:0,stride:.6,phase:p*8},time);
    const x=mix(pose.x,actor.x,t),z=mix(pose.z,actor.z,t);
    const sink=entering ? t : 1-t;
    mesh.append(body,x,-1.9*sink+Math.sin(p*Math.PI)*.35,z,actor.angle,actor.scale || 1,-.35*Math.sin(p*Math.PI));
    return;
  }
  if (actor.haybale) return;
  if (pose?.kind.startsWith("hay-ambush-") || pose?.kind.startsWith("hay-search-")) {
    drawElimination(mesh,figure,actor,time,pose);
    return;
  }
  if (pose && (pose.kind==="fall" || pose.kind==="eliminate" || pose.kind==="shoot")) {
    drawElimination(mesh,figure,actor,time,pose);
    return;
  }
  drawStandingFigure(mesh,figure,actor,time,pose);
  if (pose?.kind==="stagger" && pose.progress<1) {
    const size=.075*clamp((1-pose.progress)*8,0,1), scale=actor.scale || 1;
    for (let i=0;i<3;i++) {
      const angle=time*6+i*TAU/3;
      mesh.gem(actor.x+Math.cos(angle)*.37*scale,(2.05+Math.sin(angle*2)*.08)*scale,
        actor.z+Math.sin(angle)*.37*scale,size*scale,size*1.6*scale,size*scale,"#9fe1ff",4,angle);
    }
  }
  if (actor.boosted && actor.stride>.2) {
    const sin=Math.sin(actor.angle), cos=Math.cos(actor.angle);
    for (let i=0;i<4;i++) {
      const offset=i%2 ? .26 : -.26, trail=.24+(i+((time*11)%1))*.24;
      const x=actor.x+sin*trail+cos*offset, z=actor.z+cos*trail-sin*offset;
      const y=.09+i*.11;
      mesh.beam([x,y,z],[x+sin*.23,y+.035,z+cos*.23],.034,"#a2efe3");
    }
  }
}

function drawStandingFigure(mesh, figure, actor, time, pose=null) {
  const { x, z, stride=0, phase=0, activity, scale=1, seed=1.7 } = actor;
  const sitting=pose?.sitting ?? (actor.bench ? 1 : 0);
  const strike=pose?.kind==="stun-strike" && pose.progress<1 ? Math.sin(Math.PI*pose.progress)**2 : 0;
  const stagger=pose?.kind==="stagger" ? pose.progress : 1;
  const recoil=stagger<1/7 ? Math.sin(Math.PI*stagger*7) : 0;
  const sway=Math.sin(time*8)*clamp((1-stagger)*8,0,1);
  const angle=strike ? turnTo(actor.angle,pose.angle,clamp(strike*2,0,1)) : actor.angle;
  const lift = Math.abs(Math.sin(phase))*.036*stride + Math.sin(time*2.1+seed)*.009;
  const talking=activity==="conversation" && !pose;
  const atMarket=activity==="market" && !pose;
  const speaking=talking ? Math.max(0,Math.sin(time*.9+seed))**2 : 0;
  const inspecting=atMarket ? .45+.44*Math.sin(time*1.55+seed) : 0;
  const bargaining=atMarket ? Math.max(0,Math.sin(time*1.1+seed+1.8))**2 : 0;
  const local = (part, u, y, v, rotation=0, twist=0) => {
    mesh.append(part, x+(Math.cos(angle)*u+Math.sin(angle)*v)*scale, (y+lift-.30*sitting)*scale,
      z+(-Math.sin(angle)*u+Math.cos(angle)*v)*scale, angle+twist, scale, rotation);
  };
  let torso=figure.body;
  if (sitting>0) {
    // Fold coat tails and skirts over the lap as the hips lower.
    torso=new Mesh(); torso.data=figure.body.data.slice();
    for (let n=0;n<torso.data.length;n+=9) {
      const y=torso.data[n+1];
      if (y<.82) {
        torso.data[n+1]=mix(y,Math.max(y,.48),sitting);
        torso.data[n+2]-=(.82-y)*.8*sitting;
      }
    }
  }
  local(torso,0,0,0,.12*recoil-.09*inspecting+.07*sitting);
  local(figure.head,0,1.58-.035*recoil-.025*inspecting,.19*recoil-.14*inspecting,
    (talking ? Math.sin(time*2+seed)*.08 : 0)-.26*recoil+.08*sway-.33*inspecting,
    (talking ? Math.sin(time*.8+seed)*.11 : 0)+.19*sway+.15*bargaining*Math.sin(time*1.8+seed));
  for (let i=0;i<2;i++) {
    const sign=2*i-1, gait=Math.sin(phase)*sign*stride;
    const gestures=i===1 ? (Math.sin(time*3.3+seed)*.17+.4)*speaking : 0;
    const marketGesture=i===0 ? 1.28*inspecting : (.83+.18*Math.sin(time*5+seed))*bargaining;
    const armPitch=.55*sitting-gait*.41+gestures+marketGesture+(i===1 ? 1.7 : .35)*strike+.78*recoil+.10*sway*sign;
    local(figure.arms[i],sign*figure.shoulder,1.445,.168*recoil-.006-.13*inspecting,armPitch);
    let leg=figure.legs[i];
    if (sitting>0) {
      const bent=new Mesh(), pitch=sitting*Math.PI/2;
      bent.data=leg.data.slice();
      for (let n=0;n<bent.data.length;n+=9) {
        const y=leg.data[n+1],z=leg.data[n+2],upper=Math.max(y,-.4),lower=Math.min(0,y+.4);
        bent.data[n+1]=upper*Math.cos(pitch)-z*Math.sin(pitch)+lower;
        bent.data[n+2]=upper*Math.sin(pitch)+z*Math.cos(pitch);
        if (y>-.4) {
          bent.data[n+4]=leg.data[n+4]*Math.cos(pitch)-leg.data[n+5]*Math.sin(pitch);
          bent.data[n+5]=leg.data[n+4]*Math.sin(pitch)+leg.data[n+5]*Math.cos(pitch);
        }
      }
      leg=bent;
    }
    local(leg,sign*figure.hip,.821,0,gait*.51*figure.legSwing*(1-sitting));
  }
}

// Pose parts in character space, then rotate the complete figure around its feet.
const eliminationMesh=new Mesh();
function drawElimination(mesh, figure, actor, time, pose) {
  const p=pose.progress, falling=pose.kind==="fall", shooting=pose.kind==="shoot";
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  // Wind up, strike, then recover; the victim recoils and settles on the ground.
  const strike=shooting ? smooth(p/.14)*(1-smooth((p-.24)/.65)) : smooth(p/.28)*(1-smooth((p-.48)/.52));
  const fall=smooth((p-.12)/.80);
  const rootPitch=falling ? -fall*Math.PI/2 : (shooting ? .12 : -.15)*strike;
  let rootY=falling ? .24*fall : 0;
  const lunge=falling || shooting ? 0 : -.24*strike;
  const body=eliminationMesh;
  body.data.length=0;
  const part=(source,x,y,z,pitch=0,yaw=0)=>body.append(source,x,y,z,yaw,1,pitch);
  part(figure.body,0,0,0,falling ? -.08*Math.sin(p*Math.PI) : 0);
  part(figure.head,0,1.58,0,falling ? -.18*fall : .12*strike);
  for (let i=0;i<2;i++) {
    const side=i*2-1;
    const arm=falling ? -.55*Math.sin(fall*Math.PI)-.15*fall :
      shooting ? (i===1 ? 1.72 : 1.08)*strike : i===1 ? 1.65*strike : .48*strike;
    const leg=falling ? .22*Math.sin(fall*Math.PI)*side : .18*strike*side;
    part(figure.arms[i],side*figure.shoulder,1.445,-.006,arm,i===1 && !falling ? -.24*strike : 0);
    part(figure.legs[i],side*figure.hip,.821,0,leg*figure.legSwing);
  }
  if (shooting && strike>.35) {
    body.box(figure.shoulder,1.41,-.61*strike,.11,.13,.24,"#544140");
  }
  // Keep boots, sleeves, and head above the paving throughout the collapse.
  let lowest=0;
  for (let i=0;i<body.data.length;i+=9) {
    lowest=Math.min(lowest,body.data[i+1]*Math.cos(rootPitch)-body.data[i+2]*Math.sin(rootPitch));
  }
  rootY=Math.max(rootY,.015-lowest);
  const scale=actor.scale || 1, angle=pose.angle;
  mesh.append(body,pose.x+Math.sin(angle)*lunge*scale,rootY*scale,
    pose.z+Math.cos(angle)*lunge*scale,angle,scale,rootPitch);
}

function addFootprint(mesh, x, z, scale = 1) {
  for (let i=0;i<12;i++) {
    const a=i*TAU/12,b=(i+1)*TAU/12;
    const p=angle=>[x+.09+Math.cos(angle)*.31*scale,.02,z-.03+Math.sin(angle)*.31*.67*scale];
    mesh.triangle([x+.09,.019,z-.03],p(b),p(a),"#847663",[0,1,0]);
  }
}

function makeNavigation(city) {
  const {x0,x1,z0,z1}=city.limits;
  const columns=x1-x0, rows=z1-z0, size=columns*rows;
  const walkable = new Uint8Array(size);
  const coords = index => [index%columns+x0+.5,Math.floor(index/columns)+z0+.5];
  const cell = (x,z) => clamp(Math.floor(z)-z0,0,rows-1)*columns+clamp(Math.floor(x)-x0,0,columns-1);
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

function makeSocialZones(city) {
  const conversations=city.conversations.map(([x,z])=>{
    const seatRadius=1.35;
    const seats=Array.from({length:8},(_,i)=>{
      const angle=(i+.5)*TAU/8;
      return {x:x+Math.sin(angle)*seatRadius,z:z+Math.cos(angle)*seatRadius,angle};
    });
    return {x,z,seats,seatRadius,radius:1.84,depth:1.84,angle:0,type:"conversation"};
  });
  return [...conversations,...city.markets];
}

function turnTo(from,to,amount) { return from + Math.atan2(Math.sin(to-from),Math.cos(to-from))*amount; }
function walkableMove(city,actor,dx,dz,r=.24) {
  if (!blocked(city,actor.x+dx,actor.z,r)) actor.x+=dx;
  if (!blocked(city,actor.x,actor.z+dz,r)) actor.z+=dz;
}
function driftActor(city,actor,tx,tz,pace,dt,radius=.19) {
  const dx=tx-actor.x,dz=tz-actor.z,d=Math.hypot(dx,dz);
  const x=actor.x,z=actor.z;
  if (d>.07) {
    const advance=Math.min(d,pace*dt);
    walkableMove(city,actor,dx*advance/d,dz*advance/d,radius);
  }
  const velocity=Math.hypot(actor.x-x,actor.z-z)/Math.max(dt,.001);
  if (velocity>.12) actor.angle=turnTo(actor.angle,Math.atan2(-dx,-dz),Math.min(1,dt*8));
  actor.stride=mix(actor.stride,clamp(velocity/1.15,0,1),Math.min(1,dt*8));
  actor.phase+=velocity*dt*7.0;
  return d;
}

function walkingSeat(group,slot) {
  // One center place and four surrounding seats are shared with citizens.
  const angle=group.angle+(slot-1)*TAU/4, radius=slot===0 ? 0 : 1.15;
  return {x:group.x+Math.sin(angle)*radius,z:group.z+Math.cos(angle)*radius,angle:group.angle};
}

function followWalkingSeat(city,player,seat,blend,others,dt) {
  const dx=seat.x-player.x,dz=seat.z-player.z,distance=Math.hypot(dx,dz);
  const previous=blend.previousSeat;
  blend.previousSeat={x:seat.x,z:seat.z};
  // Match the moving place's velocity, then gently close the gap. A fixed
  // chase speed repeatedly overshoots slow groups and makes footsteps stutter.
  const vx=previous ? clamp((seat.x-previous.x)/dt,-1.5,1.5) : 0;
  const vz=previous ? clamp((seat.z-previous.z)/dt,-1.5,1.5) : 0;
  let mx=vx+dx*2.5,mz=vz+dz*2.5;
  const speed=Math.hypot(mx,mz), limit=distance>.8 ? 2.1 : 1.65;
  if (speed>limit) { mx*=limit/speed; mz*=limit/speed; }
  if (distance<.04 && Math.hypot(vx,vz)<.08) { mx=0; mz=0; }
  const x=player.x,z=player.z;
  // Try small steering changes before giving up; never walk through a member.
  const side=blend.steerSide ?? 1;
  for (const turn of [0,.55*side,1.1*side,1.65*side,-.55*side,-1.1*side,-1.65*side]) {
    const dx=(mx*Math.cos(turn)-mz*Math.sin(turn))*dt;
    const dz=(mx*Math.sin(turn)+mz*Math.cos(turn))*dt;
    const next={x:x+dx,z:z+dz};
    if (blocked(city,next.x,next.z,.32)) continue;
    if (others.some(actor=>!actor.dead && !actor.invisible &&
      Math.hypot(next.x-actor.x,next.z-actor.z)<.56 &&
      Math.hypot(next.x-actor.x,next.z-actor.z)<=Math.hypot(x-actor.x,z-actor.z))) continue;
    player.x=next.x; player.z=next.z;
    if (turn) blend.steerSide=Math.sign(turn);
    break;
  }
  const velocity=Math.hypot(player.x-x,player.z-z)/dt;
  if (velocity>.12) player.angle=turnTo(player.angle,Math.atan2(x-player.x,z-player.z),1-Math.exp(-dt*8));
  player.stride=mix(player.stride,clamp(velocity/1.15,0,1),1-Math.exp(-dt*8));
  // Use the same cadence as the shared citizens and remote players.
  player.phase+=player.stride*12*dt;
  return distance;
}

function makeCrowd(city, figures) {
  const nav = makeNavigation(city), random=randomStream(70911);
  const groups = [], {landmarks}=city;
  const next = (group, nx, nz) => {
    group.path=nav.route(group.x,group.z,nx,nz);
    group.wait=0;
  };
  const makeGroup = (x,z,count,number,zone=null) => {
    const group={x,z,angle:random()*TAU,pace:.83+random()*.37,wait:0,
      path:[],actors:[],zone,number,nextStop:(number*3+4)%landmarks.length};
    if (zone) zone.npcSlots=zone.type==="market" ? [0,2,4] : [0,2,4,6];
    for (let i=0;i<count;i++) {
      const angle=i*TAU/count+group.angle, radius=.36+count*.11;
      const seat=zone?.seats[zone.npcSlots[i]];
      const tx=seat?.x ?? x+Math.sin(angle)*radius, tz=seat?.z ?? z+Math.cos(angle)*radius;
      const free=!blocked(city,tx,tz,.20);
      group.actors.push({
        x:free ? tx : x,z:free ? tz : z,angle:seat?.angle ?? random()*TAU,
        seed:random()*TAU,stride:0,phase:random()*TAU,scale:CHARACTER_SCALE,
        outfit:(number*5+i*3+1)%figures.length,activity:zone?.type ?? null,
      });
    }
    if (!zone) next(group,...landmarks[group.nextStop]);
    groups.push(group);
  };
  const zones=makeSocialZones(city);
  zones.forEach((zone,i)=>makeGroup(zone.x,zone.z,zone.type==="market" ? 3 : 4,i,zone));
  city.crowdSpawns.forEach(([x,z,n],i)=>makeGroup(x,z,n,i+zones.length));
  // Fill the rest of the population across walkable streets, keeping spawn points apart.
  const candidates=[];
  for (let x=city.limits.x0+1; x<city.limits.x1-1; x+=2)
    for (let z=city.limits.z0+1; z<city.limits.z1-1; z+=2)
      if (!blocked(city,x,z,.8)) candidates.push([x,z]);
  for (let i=candidates.length-1; i>0; i--) {
    const j=Math.floor(random()*(i+1));
    [candidates[i],candidates[j]]=[candidates[j],candidates[i]];
  }
  const occupied=[...groups.flatMap(group=>group.actors),...city.playerSpawns,city.rivalSpawn];
  for (const [x,z] of candidates) {
    if (occupied.length - city.playerSpawns.length - 1 >= 150) break;
    if (occupied.some(actor=>Math.hypot(actor.x-x,actor.z-z)<2.5)) continue;
    makeGroup(x,z,1,groups.length);
    occupied.push(groups[groups.length-1].actors[0]);
  }
  function update(dt) {
    for (const group of groups) {
      if (group.zone) continue;
      if (group.path.length) {
        const [tx,tz]=group.path[0], dx=tx-group.x,dz=tz-group.z,d=Math.hypot(dx,dz);
        const step=group.pace*dt;
        if (d<=step) {
          group.x=tx; group.z=tz;
          group.path.shift();
          if (!group.path.length) group.wait=2+random()*5;
        } else {
          group.x+=dx*step/d;
          group.z+=dz*step/d;
          group.angle=turnTo(group.angle,Math.atan2(-dx,-dz),Math.min(1,dt*4));
        }
      } else {
        group.wait-=dt;
        if (group.wait<=0) {
          const index=(group.nextStop+1+Math.floor(random()*(landmarks.length-1)))%landmarks.length;
          group.nextStop=index;
          next(group,...landmarks[index]);
          if (!group.path.length) group.wait=2;
        }
      }
      const stationary = !group.path.length;
      const roomy = stationary || !blocked(city,group.x,group.z,1.25);
      const count=group.actors.length;
      for (let i=0;i<count;i++) {
        const actor=group.actors[i];
        const angle=i*TAU/count+group.angle;
        const radius=.40+count*.08;
        const lane=(i-(count-1)/2)*.43;
        let tx=group.x+(roomy?Math.sin(angle)*radius:Math.sin(group.angle)*lane);
        let tz=group.z+(roomy?Math.cos(angle)*radius:Math.cos(group.angle)*lane);
        if (blocked(city,tx,tz,.24)) { tx=group.x; tz=group.z; }
        driftActor(city,actor,tx,tz,stationary?1.05:group.pace+.39,dt);
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

function makeZoneGlow(groups,mesh=new Mesh(),walking=false) {
  mesh.data.length=0;
  const rings=[[0,.12],[.70,.12],[.87,.32],[1,0]];
  for (const group of groups) {
    const members=group.members ?? group.actors;
    const zone=walking ? (!group.zone && (members.length>=2 || (group.reserved && members.length)) ?
      {x:group.x,z:group.z,angle:group.angle,radius:2.1,depth:2.1,type:"walking"} : null) : group.zone;
    if (!zone) continue;
    const sin=Math.sin(zone.angle), cos=Math.cos(zone.angle);
    const tint=color("#69caff");
    const vertex=(ring,angle)=>{
      const [radius,strength]=rings[ring];
      // Use the spare normal component to interpolate opacity across the ground decal.
      const edge=value=>zone.type==="market" ? Math.sign(value)*Math.sqrt(Math.abs(value)) : value;
      const u=zone.radius*radius*edge(Math.cos(angle)), v=zone.depth*radius*edge(Math.sin(angle));
      return [zone.x+u*cos+v*sin,.027,zone.z-u*sin+v*cos,strength,1,0,...tint];
    };
    for (let i=0;i<32;i++) {
      const a=i*TAU/32,b=(i+1)*TAU/32;
      for (let r=1;r<rings.length;r++) {
        const inner=vertex(r-1,a), edgeA=vertex(r,a), edgeB=vertex(r,b);
        mesh.data.push(...inner,...edgeB,...edgeA);
        if (r>1) mesh.data.push(...inner,...vertex(r-1,b),...edgeB);
      }
    }
  }
  return mesh;
}

function makeMap(canvas,city) {
  const width=canvas.width,height=canvas.height;
  const base=document.createElement("canvas"); base.width=width; base.height=height;
  const ctx=base.getContext("2d"), output=canvas.getContext("2d");
  const {x0,x1,z0,z1}=city.limits;
  const mx=x=>Math.round(12+(x-x0)/(x1-x0)*(width-24));
  const mz=z=>Math.round(14+(z-z0)/(z1-z0)*(height-28));
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
  rect(city.limits,"#5c5740","#a58f5e");
  city.courts.forEach((court,i)=>rect(court,i%2 ? "#8c7a52" : "#8d7c55","#a59566"));
  for (const lot of city.lots) rect(lot,"#38392c","#5a5541");
  if (city.id==="betrahold") for (const [x,z,scale] of city.fountains) {
    ctx.fillStyle="#82a398";
    ctx.beginPath();
    ctx.ellipse(mx(x),mz(z),2.2*scale*(width-24)/(x1-x0),2.2*scale*(height-28)/(z1-z0),0,0,TAU);
    ctx.fill();
  }
  return (player,yaw) => {
    output.drawImage(base,0,0);
    output.save();
    output.translate(mx(player.x),mz(player.z)); output.rotate(-yaw);
    output.shadowColor="#1b1c12"; output.shadowBlur=7;
    output.fillStyle="#ffe19b"; output.beginPath();
    output.moveTo(0,-10); output.lineTo(7,6); output.lineTo(0,2); output.lineTo(-7,6);
    output.closePath(); output.fill();
    output.restore();
  };
}

function contractBearing(player, target, yaw) {
  const distance=Math.hypot(target.x-player.x,target.z-player.z);
  const fullFillDistance=8;
  const minFillDistance=35*1.7;
  const proximity=1-clamp((distance-fullFillDistance)/(minFillDistance-fullFillDistance),0,1);
  return {width:distance<=fullFillDistance ? 360 : 36+(342-36)*Math.pow(proximity,1.3),
    angle:(yaw-Math.atan2(player.x-target.x,player.z-target.z))*180/Math.PI};
}
function clearSight(city, a, b, radius=.03, height=1.2) {
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.15));
  for (let i=0;i<=steps;i++) if (blocked(city,mix(a.x,b.x,i/steps),mix(a.z,b.z,i/steps),radius,height)) return false;
  return true;
}
function nearestHidingPlace(city, player, actors) {
  let best=null, distance=MELEE_RANGE;
  for (const bench of city.benches) for (const [index,seat] of bench.seats.entries()) {
    const next=Math.hypot(seat.x-player.x,seat.z-player.z);
    if (next>distance || !clearSight(city,player,seat)) continue;
    const occupied=actors.some(actor=>(actor.bench===bench.id && actor.bench_seat===index) ||
      (actor.bench_goal?.[0]===bench.id && actor.bench_goal[1]===index));
    if (!occupied) { best={action:"bench",id:bench.id}; distance=next; }
  }
  for (const bale of city.haybales) {
    const next=Math.hypot(bale.x-player.x,bale.z-player.z);
    if (next>distance || (best && next===distance) || !clearSight(city,player,bale)) continue;
    best={action:"hay",id:bale.id};
    distance=next;
  }
  return best;
}
const diamondRings=[[0,.03],[.5,1],[1,.03]];
function drawInteraction(mesh, actor, focused, time, locked, eye) {
  const tint=locked ? "#78ccff" : focused ? "#ffbe69" : actor.stunned>0 ? "#74c8ec" : "#d2c8a4";
  for (let i=0;i<32;i++) {
    const a=i*TAU/32,b=(i+1)*TAU/32;
    const p=(t,r)=>[actor.x+Math.cos(t)*r,.045,actor.z+Math.sin(t)*r];
    mesh.quad(p(a,.56),p(b,.56),p(b,.50),p(a,.50),tint,[0,1,0]);
  }
  if (focused) {
    const y=2.17+Math.sin(time*4)*.05;
    const scale=clamp(Math.hypot(actor.x-eye[0],actor.z-eye[2])/14,1,2.5);
    mesh.gem(actor.x,y,actor.z,.08*scale,.20*scale,.08*scale,tint,4,0,0,diamondRings);
  }
}

function drawShot(mesh, smoke, effect, age) {
  const {x,z,target_x,target_z}=effect;
  const distance=Math.hypot(target_x-x,target_z) || 1;
  const offset=Math.min(.58/distance,.5);
  const muzzle=[mix(x,target_x,offset),1.42,mix(z,target_z,offset)];
  const flashDuration=.22;
  if (age>=flashDuration) {
    const fade=1-age/effect.duration;
    const size=.16+age*.32;
    smoke.gem(muzzle[0],1.36+age*.62,muzzle[2],size*fade,size,size*fade,"#a5a09b",6);
    return;
  }
  mesh.beam(muzzle,[target_x,1.24,target_z],.059*(1-age/flashDuration),"#ffd48a");
  mesh.gem(muzzle[0],1.30,muzzle[2],.24,.27,.24,"#ffe09a",6,age*12);
  mesh.gem(target_x,1.16,target_z,.16,.25,.16,"#f1b567",5,age*16);
}

function drawPowerEffects(mesh, smoke, effects, now) {
  for (const effect of effects) {
    const {power,x,z,duration}=effect;
    const age=Math.max(0,effect.age+(now-effect.receivedAt)/1000);
    if (age>=duration) continue;
    const progress=age/duration;
    if (power==="gun") {
      drawShot(mesh,smoke,effect,age);
    } else if (power==="hay") {
      for (let i=0;i<32;i++) {
        const angle=i*2.39996, radius=(.3+progress*1.8)*(1+(i%3)*.15);
        const px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;
        const y=.5+Math.sin(progress*Math.PI)*(.5+(i%5)*.18);
        const size=.08*(1-progress);
        mesh.beam([px,y,pz],[px+size*2,y+size,pz+size],size*.45,i%2 ? "#edcf82" : "#ba924a");
      }
    } else if (power==="smoke") {
      const swell=clamp(age*3.5,.08,1), fade=clamp((duration-age)*2,.02,1);
      const volume=swell*fade;
      mesh.gem(x,.04,z,3.7*volume,4.1*volume,3.7*volume,"#8b9094",10,age*.16);
      for (let i=0; i<24; i++) {
        const upper=i>=12;
        const angle=i*TAU/12+(upper ? .28 : 0)+age*.16;
        const spread=(upper ? 2.65 : 3.9)*volume;
        const size=(1.55+(i%4)*.16+progress*.25)*volume;
        const height=upper ? (1.65+(i%3)*.26)*volume : .04;
        mesh.gem(x+Math.cos(angle)*spread,height,z+Math.sin(angle)*spread,
          size,size*1.8,size,i%3===0 ? "#9b9fa0" : "#797e84",8,angle);
      }
    } else if (power==="invisibility") {
      const progress=age/duration, returning=effect.phase==="end";
      const radius=returning ? 1.5*(1-progress)+.15 : .25+progress*1.5;
      const size=.12*Math.sin(Math.PI*progress);
      for (let i=0; i<28; i++) {
        const angle=i*TAU/28+(returning ? -1 : 1)*progress*2;
        const height=.15+(i%7)*.30+(returning ? 1-progress : progress)*.3;
        mesh.gem(x+Math.cos(angle)*radius,height,z+Math.sin(angle)*radius,
          size,size*2.5,size,i%3 ? "#94dace" : "#e4fff7",4,angle);
      }
    } else if (power==="firecrackers") {
      for (let burst=0; burst<3; burst++) {
        const phase=(age*2.6+burst/3)%1, round=Math.floor(age*2.6+burst/3);
        const origin=round*2.39996+burst*2.09;
        const bx=x+Math.cos(origin)*1.5, bz=z+Math.sin(origin)*1.5;
        const size=.085*(1-phase);
        for (let i=0; i<7; i++) {
          const angle=origin+i*TAU/7, radius=phase*(.5+(i%3)*.35);
          mesh.gem(bx+Math.cos(angle)*radius,.12+Math.sin(phase*Math.PI)*(.6+(i%4)*.26),
            bz+Math.sin(angle)*radius,size,size*1.8,size,i%2?"#ffbd4c":"#f9e0a2",4,angle);
        }
      }
    } else {
      const radius=power==="cult" ? 8*progress : .35+progress*1.25;
      const tint={cult:"#e6bc63",disguise:"#a897df",mute:"#bd8ee3",decoy:"#ffbd6b"}[power] || "#94dace";
      const count=power==="cult" ? 40 : 14;
      const size=.09*(1-progress);
      for (let i=0; i<count; i++) {
        const angle=i*TAU/count;
        const height=power==="cult" ? .08 : .25+progress*1.6+(i%3)*.23;
        mesh.gem(x+Math.cos(angle)*radius,height,z+Math.sin(angle)*radius,size,size*2,size,tint,4,angle);
      }
    }
  }
}

function boot() {
  const $=selector=>document.querySelector(selector);
  const bind=(selector,type,handler)=>$(selector).addEventListener(type,handler);
  const game=$("#game"), canvas=$("#world"), roster=$("#roster"), overlay=$("#pause-overlay");
  const reticle=$("#aim-reticle");
  const combatFeedback=$("#combat-feedback");
  reticle.style.left=`${50*(1-PLAY_SHIFT_X)}%`;
  const renderer=new Renderer(canvas);
  const figures=ROSTER.map(outfit=>makeFigure(outfit)), walkingGroups=new Map();
  let city, crowd, sharedZones, drawMap;
  function loadMap(id) {
    city=buildCity(id);
    crowd=makeCrowd(city,figures);
    sharedZones=crowd.groups.filter(g=>g.zone);
    walkingGroups.clear();
    renderer.bake(city.scene,city.casters,makeZoneGlow(crowd.groups));
    city.scene.data.length=0;
    city.casters.data.length=0;
    drawMap=makeMap($("#map"),city);
    $("#map").setAttribute("aria-label",`Map of ${city.name} showing your position`);
    $("#map-name").textContent=city.name;
  }
  const liveGroups=()=>network.id ? [...sharedZones,...walkingGroups.values()] : crowd.groups;
  const player={x:0,z:0,angle:0,stride:0,phase:0,seed:1.7,scale:CHARACTER_SCALE};
  const directionNames=["N","NE","E","SE","S","SW","W","NW"];
  const keys=new Set(), touch={x:0,y:0,running:false};
  const camera={yaw:.22,viewYaw:.22,pitch:.22,range:5.45,usable:null,eye:null,target:null};
  const cameraGoals={pitch:.22,range:5.45};
  const stackedRoster=matchMedia("(max-width: 520px)");
  const compactSidebar=matchMedia("(min-width: 521px) and (max-width: 710px)");
  const mesh=new Mesh(), smoke=new Mesh(), walkingGlow=new Mesh();
  let selected=0, mode="auth", blend=null, blendMessage="", blendMessageTime=0;
  let elapsed=0, previous=performance.now(), lastMap=-1, lastHeading, lastDistrict;
  let lockedTarget=null, focusHold=null, touchDrag=null, touchAim=matchMedia("(pointer: coarse)").matches;
  let mouseCaptured=false, fallbackPointer=null;
  let mouseLookFallback=typeof canvas.requestPointerLock!=="function";
  canvas.classList.toggle("mouse-look-fallback",mouseLookFallback);
  const portraitCanvas=document.createElement("canvas");
  portraitCanvas.width=156; portraitCanvas.height=174;
  let portraitRenderer;
  try { portraitRenderer=new Renderer(portraitCanvas,{portrait:true}); }
  catch (error) { console.warn("Character portrait rendering unavailable",error.message); }
  const renderPortrait=i=>{
    if (!portraitRenderer) return null;
    const portrait=new Mesh();
    drawFigure(portrait,figures[i],{x:0,z:0,angle:0,seed:0},0);
    portraitRenderer.draw(portrait,[.92,1.72,-2.59],[0,1.51,0],{fov:.47});
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
    button.addEventListener("click",()=>{
      if (network.id) { if (network.lobby?.phase==="lobby") network.lobbyAction("character",{outfit:i}); }
      else select(i);
    });
    roster.append(button);
    return button;
  });
  portraitRenderer?.gl.getExtension("WEBGL_lose_context")?.loseContext();

  function select(index) {
    if (selected===index && buttons[index].getAttribute("aria-pressed")==="true") return;
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
    if (touchDrag && canvas.hasPointerCapture(touchDrag.pointerId)) canvas.releasePointerCapture(touchDrag.pointerId);
    fallbackPointer=null;
    lockedTarget=null;
    cancelFocusHold();
    touchDrag=null;
    reticle.classList.remove("locked");
  }
  function setMode(next) {
    mode=next; game.dataset.mode=next;
    overlay.hidden=next!=="pause";
    $(".topbar").inert=next==="pause" || next==="auth";
    $("#selection").inert=next!=="select";
    canvas.tabIndex=next==="play" ? 0 : -1;
    clearInput();
    if (next!=="play" && document.pointerLockElement===canvas) document.exitPointerLock();
    if (next==="play") {
      canvas.focus({preventScroll:true});
    } else if (next==="pause") {
      blend=null;
      Object.assign(player,{activity:null,zone:null,blendGroup:null,crowdGroup:null,crowdSlot:null,sprinting:false});
      $("#crowd-status").hidden=true;
      $("#resume").focus();
    } else if (next==="select") {
      $("#crowd-status").hidden=true;
      buttons[selected].focus({preventScroll:true});
    }
  }
  function reset(spawn=city?.playerSpawns[0] ?? {x:0,z:0,angle:0}) {
    const {x,z,angle}=spawn;
    Object.assign(player,{x,z,angle,stride:0,phase:0,revision:undefined,animation:null,activity:null,zone:null,
      blendGroup:null,crowdGroup:null,crowdSlot:null,sprinting:false,bench:null,haybale:null});
    Object.assign(camera,{yaw:angle+.02,viewYaw:angle+.02,usable:null,eye:null,target:null});
    Object.assign(cameraGoals,{pitch:.22,range:5.45});
    lockedTarget=null;
    cancelFocusHold();
    blend=null; blendMessage=""; lastMap=-1;
  }
  function crowdSeat(group, slot) {
    if (group.zone) return group.zone.seats[slot];
    return walkingSeat(group,slot);
  }
  function canReachCrowdSeat(group, seat) {
    if (!clearSight(city,player,seat,.32,0)) return false;
    const dx=seat.x-player.x, dz=seat.z-player.z, lengthSquared=dx*dx+dz*dz;
    const clear=actor=>{
      if (actor.dead || actor.invisible) return true;
      if (Math.hypot(actor.x-seat.x,actor.z-seat.z)<(group.zone ? .70 : .62)) return false;
      if (!group.zone) return true;
      if (lengthSquared<.01) return true;
      const progress=((actor.x-player.x)*dx+(actor.z-player.z)*dz)/lengthSquared;
      return progress<=0 || progress>=1 ||
        Math.hypot(actor.x-player.x-dx*progress,actor.z-player.z-dz*progress)>.54;
    };
    return (group.members ?? group.actors).every(clear) && [...network.remote.values()].every(clear);
  }
  function chooseCrowdSeat(group) {
    let best=null, distance=Infinity;
    const reserved=group.reserved ?? group.zone?.npcSlots ?? [];
    for (let slot=0;slot<(group.zone?.seats.length ?? 5);slot++) {
      if (reserved.includes(slot)) continue;
      const seat=crowdSeat(group,slot);
      const next=Math.hypot(seat.x-player.x,seat.z-player.z);
      if (next>=distance || !canReachCrowdSeat(group,seat)) continue;
      best={group,slot};
      distance=next;
    }
    return best;
  }
  function nearestCrowd() {
    let closest=null,distance=4.25;
    for (const group of liveGroups()) {
      if (!group.zone && !(group.members ?? group.actors).length) continue;
      const next=Math.hypot(group.x-player.x,group.z-player.z);
      if (next>=Math.min(distance,group.zone ? 3.5 : 4.25)) continue;
      const seat=chooseCrowdSeat(group);
      if (seat) { closest=seat; distance=next; }
    }
    return closest;
  }
  function hidingPlaceAction() {
    if (network.state.bench) return {action:"bench"};
    if (network.state.haybale) return {action:"hay"};
    return nearestHidingPlace(city,player,[...network.npcs.values(),...network.remote.values()]);
  }
  async function toggleBlend() {
    if (!canAct() || network.actionPending) return;
    const place=hidingPlaceAction();
    if (place) {
      blend=null;
      blendMessage="";
      try { await network.act(place.action,place.id); }
      catch (error) { blendMessage=error.message; blendMessageTime=elapsed+2.3; }
      return;
    }
    if (blend) { blend=null; return; }
    blend=nearestCrowd();
    if (!blend) {
      blendMessage="Move closer to a zone or walking group"; blendMessageTime=elapsed+2.3;
      return;
    }
    blendMessage="";
  }
  function updatePlayer(dt, now) {
    player.activity=null;
    player.zone=null;
    player.blendGroup=null;
    player.crowdGroup=null; player.crowdSlot=null;
    player.sprinting=false;
    if (network.state?.invisible) blend=null;
    if (network.state?.dead>0 || network.state?.stunned>0 || network.state?.busy || network.state?.haybale || network.state?.bench) { blend=null; player.stride=0; return; }
    const forward=Number(keys.has("KeyW")||keys.has("ArrowUp"))-Number(keys.has("KeyS")||keys.has("ArrowDown"))-touch.y;
    const strafe=Number(keys.has("KeyD")||keys.has("ArrowRight"))-Number(keys.has("KeyA")||keys.has("ArrowLeft"))+touch.x;
    const magnitude=Math.hypot(forward,strafe);
    const running=keys.has("ShiftLeft")||keys.has("ShiftRight")||touch.running;
    const boost=network.state?.powers.find(power=>power.id==="sprint");
    const speedMultiplier=boost && powerStatus(boost,now).active>0 ? network.lobby.powers.sprint.multiplier : 1;
    const speed=(running?5.1:2.6)*speedMultiplier;
    const x=player.x,z=player.z;
    if (magnitude>.05) {
      blend=null;
      const unit=Math.max(1,magnitude), sin=Math.sin(camera.yaw), cos=Math.cos(camera.yaw);
      const dx=(-sin*forward+cos*strafe)/unit,dz=(-cos*forward-sin*strafe)/unit;
      const steps=Math.ceil(speed*dt/.32);
      for (let step=0;step<steps;step++) {
        walkableMove(city,player,dx*speed*dt/steps,dz*speed*dt/steps,.32);
      }
      player.angle=turnTo(player.angle,Math.atan2(-dx,-dz),Math.min(1,dt*12));
    } else if (blend) {
      const {group,slot}=blend;
      if (!group.zone && !walkingGroups.has(group.number)) { blend=null; return; }
      if (group.reserved?.includes(slot)) {
        blend=chooseCrowdSeat(group);
        return;
      }
      player.crowdGroup=group.number; player.crowdSlot=slot;
      const seat=crowdSeat(group,slot);
      if (Math.hypot(player.x-group.x,player.z-group.z)>5.5) {
        blend=null;
      } else if (!canReachCrowdSeat(group,seat)) {
        // Give a passing citizen time to clear before changing places.
        blend.obstructed=(blend.obstructed ?? 0)+dt;
        if (group.zone || blend.obstructed>.6) blend=chooseCrowdSeat(group);
        if (!group.zone && blend) {
          const distance=followWalkingSeat(city,player,crowdSeat(blend.group,blend.slot),blend,
            [...(group.members ?? group.actors),...network.remote.values()],dt);
          if (distance<.7) player.blendGroup=group.number;
          return;
        }
      } else {
        blend.obstructed=0;
        if (!group.zone) {
          const distance=followWalkingSeat(city,player,seat,blend,
            [...(group.members ?? group.actors),...network.remote.values()],dt);
          if (distance<.7) player.blendGroup=group.number;
          return;
        }
        const distance=driftActor(city,player,seat.x,seat.z,.95,dt,.32);
        if (distance<.18) {
          player.angle=turnTo(player.angle,seat.angle,Math.min(1,dt*6));
          if (group.zone && player.stride<=.3) {
            player.activity=group.zone.type;
            player.zone=group.number;
          }
        }
        return;
      }
    }
    const velocity=Math.hypot(player.x-x,player.z-z)/Math.max(.001,dt);
    player.sprinting=running && velocity>0;
    player.stride=mix(player.stride,clamp(velocity/2.2,0,1.42),Math.min(1,dt*9));
    player.phase+=velocity*dt*(running?4.7:5.2);
  }
  function updateCamera(dt) {
    if (mode==="play" && fallbackPointer) {
      const bounds=canvas.getBoundingClientRect();
      const fromCenter=fallbackPointer.x-bounds.left-bounds.width/2;
      const edge=Math.min(16,bounds.width*.05);
      if (Math.abs(fromCenter)>bounds.width/2-edge) {
        const edgeProgress=(Math.abs(fromCenter)-bounds.width/2+edge)/edge;
        camera.yaw-=Math.sign(fromCenter)*clamp(edgeProgress,0,1)*1.8*dt;
      }
    }
    camera.viewYaw=turnTo(camera.viewYaw,camera.yaw,1-Math.exp(-dt*28))%TAU;
    camera.pitch=mix(camera.pitch,cameraGoals.pitch,1-Math.exp(-dt*16));
    camera.range=mix(camera.range,cameraGoals.range,1-Math.exp(-dt*10));
    const sin=Math.sin(camera.viewYaw),cos=Math.cos(camera.viewYaw);
    const preview=mode==="select", boom=preview ? 5.58 : camera.range;
    const shoulder=preview ? 0 : .9;
    const pivotHeight=preview ? 1.67 : 1.92;
    const lift=.075+Math.sin(camera.pitch)*boom*(preview ? .64 : .56);
    const backX=sin*boom+cos*shoulder, backZ=cos*boom-sin*shoulder;
    let usable=boom;
    const samples=Math.ceil(boom/.25);
    for (let step=1;step<=samples;step++) {
      const ratio=step/samples;
      if (blocked(city,player.x+backX*ratio,player.z+backZ*ratio,.27,pivotHeight+lift*ratio)) {
        usable=boom*(step-1)/samples;
        break;
      }
    }
    camera.usable=Math.min(usable,mix(camera.usable ?? usable,usable,1-Math.exp(-dt*12)));
    const ratio=camera.usable/boom;
    const aimHeight=(preview ? 1.74 : 2.28)-Math.sin(camera.pitch-.22)*3.55;
    camera.eye=[player.x+backX*ratio,pivotHeight+lift*ratio,player.z+backZ*ratio];
    camera.target=[player.x-sin*2.8+cos*shoulder,aimHeight,player.z-cos*2.8-sin*shoulder];
  }
  function syncHUD() {
    const district=districtAt(city,player.x,player.z);
    if (lastDistrict!==district) {
      lastDistrict=district;
      $("#district-name").textContent=district;
    }
    const index=((Math.round(-camera.yaw/(TAU/8))%8)+8)%8;
    if (lastHeading!==index) {
      lastHeading=index;
      $("#bearing-left").textContent=directionNames[(index+7)%8];
      $("#bearing-main").textContent=directionNames[index];
      $("#bearing-right").textContent=directionNames[(index+1)%8];
    }
    const zoneType=blend?.group.zone?.type;
    const gesture=zoneType==="market" ? "Inspecting goods" : "In conversation";
    const place=canAct() && !network.actionPending ? hidingPlaceAction() : null;
    const benchPrompt=touchAim ? "Tap the crowd button to sit" : "Press F to sit";
    const status=mode!=="play" ? "" : blendMessage && elapsed<blendMessageTime ? blendMessage :
      network.state?.bench ? "Sitting · Blending" : network.state?.haybale ? "Hidden in hay · Blending" :
      place?.action==="bench" ? benchPrompt : blend ? (zoneType ? (player.activity ? gesture : "Joining the zone") :
        (player.blendGroup!==null ? "Walking with the group" : "Joining the walking group")) : "";
    const label=$("#crowd-text");
    if (label.textContent!==status) label.textContent=status;
    $("#crowd-status").hidden=!status;
    if (elapsed-lastMap>.080) { drawMap(player,camera.yaw); lastMap=elapsed; }
  }

  let nearby=[], combatMessage="", combatMessageUntil=0, portraitOutfit=-1;
  function actors() { return [...network.npcs.values(),...network.remote.values(),...city.haybales.filter(b=>b.id!==network.state?.haybale)]; }
  function canAct() {
    const state=network.state;
    return mode==="play" && !network.reconnecting && state && !state.dead && !state.stunned && !state.busy && !state.invisible;
  }
  function isVisible(actor) { return actor && !actor.dead && !actor.invisible && !actor.haybale; }
  function withinRange(actor, range) {
    return Math.hypot(actor.x-player.x,actor.z-player.z)<=range;
  }
  function withinReach(actor, range) {
    return withinRange(actor,range) && clearSight(city,player,actor);
  }
  function withinLockRange(actor) {
    return withinRange(actor,network.lobby?.powers.gun.range);
  }
  function lockedActor() {
    if (!lockedTarget) return null;
    const {id}=lockedTarget;
    const actor=network.npcs.get(id) ?? network.remote.get(id) ?? city.haybales.find(b=>b.id===id);
    if (actor!==lockedTarget || !isVisible(actor) || !withinLockRange(actor)) lockedTarget=null;
    return lockedTarget;
  }
  function cancelFocusHold() {
    if (!focusHold) return;
    focusHold=null;
    reticle.style.removeProperty("--focus-progress");
  }
  function updateFocusHold(now, aimed) {
    if (!focusHold) return;
    if (aimed!==focusHold.actor || !canAct() || !withinLockRange(aimed)) {
      cancelFocusHold();
      return;
    }
    const held=now-focusHold.startedAt;
    if (held>=FOCUS_HOLD_MS) {
      lockedTarget=aimed;
      cancelFocusHold();
    } else reticle.style.setProperty("--focus-progress",`${Math.max(0,held)/FOCUS_HOLD_MS}turn`);
  }
  function pickActor() {
    if (!camera.eye) return null;
    const direction=unit(minus(camera.target,camera.eye));
    const horizontal=direction[0]**2+direction[2]**2;
    if (horizontal<.0001) return null;
    let closest=60, target=null;
    for (const actor of actors()) {
      if (!isVisible(actor)) continue;
      const dx=actor.x-camera.eye[0], dz=actor.z-camera.eye[2];
      const depth=(dx*direction[0]+dz*direction[2])/horizontal;
      if (depth<=0 || depth>=closest) continue;
      const height=camera.eye[1]+direction[1]*depth;
      if (height<.08 || height>(actor.kind==="hay" ? 1.3 : actor.bench ? 1.72 : 2.06) || Math.hypot(dx-direction[0]*depth,dz-direction[2]*depth)>(actor.kind==="hay" ? .95 : .38)) continue;
      closest=depth;
      target=actor;
    }
    if (!target) return null;
    for (let depth=.1;depth<closest-(target.kind==="hay" ? 1.2 : 0);depth+=.15) {
      const [x,y,z]=camera.eye.map((value,axis)=>value+direction[axis]*depth);
      if (blocked(city,x,z,0,y)) return null;
    }
    return target;
  }
  const stealthMeter=$("#stealth-meter");
  const stealthTierIcon=$("#stealth-tier-icon");
  const pursuerIcons=$("#pursuer-icons");
  const hiddenProgress=$("#hidden-progress"), hiddenLabel=$("#hidden-bonus-label");
  let lastStealth, lastPursuers;
  function updateCombat(muted) {
    const state=network.state;
    const progress=state?.hidden_progress ?? 0;
    if (hiddenProgress.value!==progress) hiddenProgress.value=progress;
    const bonusLabel=state?.hidden_awarded ? "Hidden +50" : "Hidden";
    if (hiddenLabel.textContent!==bonusLabel) hiddenLabel.textContent=bonusLabel;
    const stealth=state?.stealth ?? 100;
    if (stealth!==lastStealth) {
      lastStealth=stealth;
      stealthMeter.style.setProperty("--stealth-offset",100-Math.min(100,stealth));
      stealthMeter.style.setProperty("--overflow-offset",100-2*Math.max(0,stealth-100));
    }
    const tier=state?.stealth_tier ?? "stealth";
    if (tier!==stealthMeter.dataset.tier) {
      stealthMeter.dataset.tier=tier;
      stealthMeter.setAttribute("aria-label",`Stealth tier: ${tier}`);
      stealthTierIcon.setAttribute("href",`#i-stealth-${tier}`);
    }
    const pursuers=state?.pursuers ?? 0;
    if (pursuers!==lastPursuers) {
      lastPursuers=pursuers;
      pursuerIcons.hidden=pursuers===0;
      pursuerIcons.setAttribute("aria-label",pursuers===3 ? "3 or more pursuers" : `${pursuers} ${pursuers===1 ? "pursuer" : "pursuers"}`);
      Array.from(pursuerIcons.children).forEach((icon,index)=>icon.toggleAttribute("hidden",index>=pursuers));
    }
    nearby=touchAim && canAct() ? actors().filter(actor=>
      isVisible(actor) && !actor.stunned && withinReach(actor,MELEE_RANGE)) : [];
    nearby.sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
    const target=state?.target;
    const targetCompass=$("#target-compass");
    targetCompass.hidden=!target || muted>0;
    if (target) {
      const outfit=ROSTER[target.outfit];
      $("#target-name").textContent=target.username || (target.kind==="bot" ? "Practice rival" : target.kind==="npc" ? "Citizen" : "Player");
      $("#target-detail").textContent="The "+outfit.name;
      if (portraitOutfit!==target.outfit) {
        portraitOutfit=target.outfit;
        const src=buttons[target.outfit].querySelector("img")?.src;
        $("#target-portrait").hidden=!src;
        if (src) $("#target-portrait").src=src;
      }
    } else {
      portraitOutfit=-1;
      $("#target-portrait").hidden=true;
      $("#target-name").textContent=state?.target_wait!=null ? "Assigning new target…" : "Assigning target…";
      $("#target-detail").textContent=state?.target_wait>0 ? `New contract in ${Math.ceil(state.target_wait)}s` : "";
    }
    if (!targetCompass.hidden) {
      const bearing=contractBearing(player,target,camera.yaw);
      $("#target-sector").style.background=`conic-gradient(from ${-bearing.width/2}deg, #e5c27abf 0deg ${bearing.width}deg, transparent ${bearing.width}deg 360deg)`;
      $("#target-sector").style.transform=`rotate(${bearing.angle}deg)`;
      const visible=!target.invisible && !target.haybale && clearSight(city,player,target);
      targetCompass.classList.toggle("in-sight",visible);
      $("#target-signal").textContent=visible ? "LINE OF SIGHT" : "FIND YOUR TARGET";
    }
    $("#score").textContent=state?.score ?? 0;
    const status=state?.dead>0 ? `Eliminated · Respawn in ${Math.ceil(state.dead)}s` : state?.stunned>0 ? `Stunned · ${Math.ceil(state.stunned)}s` : state?.busy ? (state.animation?.kind?.startsWith("bench-") ? "Moving from the bench…" : state.animation?.kind?.startsWith("hay-") ? "Moving through the hay…" : state.animation?.kind==="shoot" ? "Firing…" : "Eliminating…") :
      state?.invisible ? "Invisible · Incognito locked · Actions unavailable" :
      needsMouseCapture() ? "Click the game to enable mouse look" :
      elapsed<combatMessageUntil ? combatMessage : state?.warning ? "Practice rival attacking" : "";
    if (combatFeedback.textContent!==status) combatFeedback.textContent=status;
    combatFeedback.classList.toggle("danger",Boolean(state?.warning || state?.dead));
  }
  async function interact(action) {
    if (!canAct() || network.actionPending) return;
    const target=touchAim ? nearby[0] : lockedActor() ?? pickActor();
    if (!target || target.stunned || !withinReach(target,MELEE_RANGE)) {
      combatMessage=!target && !touchAim ? "Aim at a character to eliminate or stun" : "Move within reach of an active character";
      combatMessageUntil=elapsed+2;
      return;
    }
    blend=null;
    try { const result=await network.act(action,target.id); if (result) combatMessage=result.message; }
    catch (error) { combatMessage=error.message; }
    combatMessageUntil=elapsed+2.5;
  }

  const network=new Multiplayer({
    onAccount:loggedIn=>setMode(loggedIn?"select":"auth"),
    onJoin:spawn=>{ reset(network.state ?? spawn); setMode(network.lobby?.phase==="playing" ? "play" : network.lobby?.phase==="results" ? "results" : "select"); },
    onMap:id=>{
      if (id===city?.id || !Object.hasOwn(CITY_MAPS,id)) return;
      loadMap(id);
      reset();
    },
    onWorldReset:()=>walkingGroups.clear(),
    onRoster:(taken,outfit,owned=[])=>{
      buttons.forEach((button,i)=>{
        const reserved=taken.has(i);
        const locked=!owned.includes(i);
        button.disabled=reserved || locked;
        button.classList.toggle("locked",locked);
        const label=ROSTER[i].name+(locked ? " · Locked" : reserved ? " · Taken" : "");
        button.setAttribute("aria-label",label);
        button.title=label;
      });
      if (outfit!==undefined) select(outfit);
      else if (buttons[selected].disabled) {
        const available=buttons.findIndex(button=>!button.disabled);
        if (available!==-1) select(available);
      }
    },
    onPhase:phase=>{
      reset(phase==="playing" ? network.state ?? undefined : undefined);
      combatMessage=""; combatMessageUntil=0;
      setMode(phase==="playing" ? "play" : phase==="results" ? "results" : "select");
    },
    onDisconnect:()=>setMode("pause"),
  });
  const powerButtons=[$("#use-power-1"),$("#use-power-2")];

  function powerTarget(spec, actor) {
    if (!actor || actor.kind==="hay" || (spec.target==="npc" && (actor.kind!=="npc" || actor.stunned))) return null;
    return withinReach(actor,spec.range) ? actor : null;
  }
  function powerStatus(power, now) {
    const age=Math.max(0,(now-network.state.receivedAt)/1000);
    const active=Math.max(0,power.active-age);
    const cooldown=Math.max(0,power.cooldown-Math.max(0,age-power.active));
    return {active,cooldown};
  }
  function updatePowers(now, selectedActor, locked, muted) {
    const state=network.state;
    let hasTouchTarget=false;
    for (const [slot, button] of powerButtons.entries()) {
      const power=state?.powers[slot], spec=network.lobby?.powers[power?.id];
      const {active,cooldown}=power?.id ? powerStatus(power,now) : {active:0,cooldown:0};
      const pending=network.pendingPowers.has(slot);
      const disabled=!spec || pending || state?.bench || state?.haybale || !canAct() || active>0 || cooldown>0 || muted>0;
      const aiming=Boolean(spec?.target && !disabled);
      const target=aiming && powerTarget(spec,selectedActor);
      hasTouchTarget ||= touchAim && Boolean(target);
      const aimStatus=target ? (locked ? "Target locked" : "Target in range") : selectedActor ? "Target unavailable" :
        "Aim at a "+(spec?.target==="npc" ? "citizen" : "character");
      const status=muted>0 ? "Muted · "+Math.ceil(muted)+"s" : active>0 ? "Active · "+Math.ceil(active)+"s" :
        cooldown>0 ? "Cooldown · "+Math.ceil(cooldown)+"s" : pending ? "Using…" : state?.bench || state?.haybale ? "Stand or leave hay to use" : state?.invisible ? "Unavailable while invisible" : state?.busy ? "Recovering…" : aiming ? aimStatus : "Ready";
      let icon=button.querySelector(".ability-icon");
      if (spec && button.dataset.power!==power.id) {
        icon?.remove(); button.insertAdjacentHTML("afterbegin",abilityIcon(power.id)); button.dataset.power=power.id;
      }
      button.hidden=!spec;
      button.disabled=disabled;
      button.classList.toggle("active",active>0);
      const title=button.querySelector("strong"), detail=button.querySelector("small");
      if (title.textContent!==(spec?.name || "")) title.textContent=spec?.name || "";
      if (detail.textContent!==status) detail.textContent=status;
    }
    reticle.classList.toggle("locked",Boolean(locked));
    return hasTouchTarget;
  }
  async function activatePower(slot) {
    if (!canAct() || powerButtons[slot].disabled) return;
    const id=network.id;
    const spec=network.lobby.powers[network.state.powers[slot].id];
    const selectedActor=spec.target ? lockedActor() ?? pickActor() : null;
    const target=spec.target ? powerTarget(spec,selectedActor) : null;
    if (spec.target && !target) {
      combatMessage="Aim at a "+(spec.target==="npc" ? "citizen" : "character")+" within range";
      combatMessageUntil=elapsed+2.5;
      return;
    }
    blend=null;
    try {
      const result=await network.usePower(slot,target?.id);
      if (result?.message && network.id===id) {
        combatMessage=result.message;
        combatMessageUntil=elapsed+2.5;
      }
    }
    catch (error) {
      if (network.id!==id || network.lobby?.phase!=="playing") return;
      combatMessage=error.message;
      combatMessageUntil=elapsed+2.5;
    }
  }
  for (const [slot,button] of powerButtons.entries()) button.addEventListener("click",()=>activatePower(slot));

  setMode("auth");
  bind("#enter","click",()=>network.join());
  bind("#pause","click",()=>{ if(mode==="play") setMode("pause"); });
  bind("#resume","click",()=>{
    if (!network.id) return;
    setMode("play");
    captureMouse();
  });
  const leaveLobby=()=>{ network.leave(); reset(); setMode("select"); network.population(); };
  bind("#change","click",leaveLobby);
  bind("#leave-lobby","click",leaveLobby);
  bind("#reset-camera","click",()=>{
    camera.yaw=player.angle; cameraGoals.pitch=.22; cameraGoals.range=5.45;
    cancelFocusHold();
    canvas.focus({preventScroll:true});
  });
  const movement=new Set(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowLeft","ArrowDown","ArrowRight","ShiftLeft","ShiftRight"]);
  window.addEventListener("keydown",event=>{
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.code==="Escape" && mode==="play" && !event.repeat) {
      event.preventDefault();
      setMode("pause");
      return;
    }
    if (mode!=="play") return;
    if (["Digit1","Digit2","Numpad1","Numpad2"].includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) activatePower(Number(event.code.slice(-1))-1);
      return;
    }
    if (movement.has(event.code)) { event.preventDefault(); keys.add(event.code); }
    if (!event.repeat && ["KeyE","KeyQ","KeyF"].includes(event.code)) {
      event.preventDefault();
      if (event.code==="KeyF") toggleBlend();
      else interact(event.code==="KeyE" ? "kill" : "stun");
    }
  });
  window.addEventListener("keyup",event=>keys.delete(event.code));
  window.addEventListener("blur",()=>{
    if (mouseCaptured && mode==="play") setMode("pause");
    else clearInput();
  });
  document.addEventListener("visibilitychange",()=>{ if (document.hidden) clearInput(); });
  function needsMouseCapture() {
    return mode==="play" && !touchAim && !mouseLookFallback && document.pointerLockElement!==canvas;
  }
  function enableMouseLookFallback() {
    mouseLookFallback=true;
    canvas.classList.add("mouse-look-fallback");
  }
  function captureMouse() {
    if (!needsMouseCapture()) return;
    try {
      canvas.requestPointerLock()?.catch(enableMouseLookFallback);
    } catch {
      enableMouseLookFallback();
    }
  }
  document.addEventListener("pointerlockerror",enableMouseLookFallback);
  document.addEventListener("pointerlockchange",()=>{
    const wasCaptured=mouseCaptured;
    mouseCaptured=document.pointerLockElement===canvas;
    if (mouseCaptured && mode!=="play") document.exitPointerLock();
    if (wasCaptured && !mouseCaptured && mode==="play") setMode("pause");
  });
  function look(dx,dy,sensitivity) {
    camera.yaw=(camera.yaw-dx*sensitivity)%TAU;
    cameraGoals.pitch=clamp(cameraGoals.pitch+dy*sensitivity,-.10,.77);
  }
  document.addEventListener("mousemove",event=>{
    if (mode==="play" && document.pointerLockElement===canvas) look(event.movementX,event.movementY,.0035);
  });
  window.addEventListener("pointerdown",event=>{
    if (mode!=="play" || event.button!==0 || touchDrag) return;
    if (event.pointerType==="mouse") {
      if (lockedActor()) {
        lockedTarget=null;
        cancelFocusHold();
        reticle.classList.remove("locked");
        return;
      }
      if (event.target!==canvas) return;
      touchAim=false;
      if (needsMouseCapture()) {
        captureMouse();
        return;
      }
      const actor=canAct() ? pickActor() : null;
      cancelFocusHold();
      if (actor && withinLockRange(actor)) focusHold={actor,pointerId:event.pointerId,startedAt:performance.now()};
    } else if (event.target===canvas) {
      touchAim=true;
      lockedTarget=null;
      cancelFocusHold();
      fallbackPointer=null;
      touchDrag={pointerId:event.pointerId,x:event.clientX,y:event.clientY};
      canvas.setPointerCapture(event.pointerId);
    }
  },{capture:true});
  canvas.addEventListener("pointermove",event=>{
    if (mode!=="play") return;
    if (event.pointerType==="mouse" && mouseLookFallback && !touchDrag && document.pointerLockElement!==canvas) {
      touchAim=false;
      if (fallbackPointer) look(event.clientX-fallbackPointer.x,event.clientY-fallbackPointer.y,.0035);
      fallbackPointer={x:event.clientX,y:event.clientY};
    } else if (event.pointerId===touchDrag?.pointerId) {
      look(event.clientX-touchDrag.x,event.clientY-touchDrag.y,.008);
      touchDrag.x=event.clientX; touchDrag.y=event.clientY;
    }
  });
  canvas.addEventListener("pointerleave",event=>{
    if (event.pointerType==="mouse") {
      fallbackPointer=null;
      if (mouseLookFallback && document.pointerLockElement!==canvas) cancelFocusHold();
    }
  });
  function releasePointer(event) {
    if (event.pointerId===focusHold?.pointerId) cancelFocusHold();
    if (event.pointerId===touchDrag?.pointerId) touchDrag=null;
  }
  window.addEventListener("pointerup",releasePointer);
  window.addEventListener("pointercancel",releasePointer);
  window.addEventListener("mouseup",event=>{ if (event.button===0) cancelFocusHold(); });
  canvas.addEventListener("lostpointercapture",releasePointer);
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
  bind("#touch-kill","click",()=>interact("kill"));
  bind("#touch-stun","click",()=>interact("stun"));

  function frame(now) {
    const playing=mode==="play";
    if (!city || mode==="auth" || mode==="select") { previous=now; requestAnimationFrame(frame); return; }
    if (!playing && now-previous<1000/20) {
      requestAnimationFrame(frame);
      return;
    }
    const dt=Math.min(.085,Math.max(.001,(now-previous)/1000));
    previous=now;
    const ratio=Math.min(devicePixelRatio || 1,playing ? 1.55 : 1,
      (playing ? 1720 : 1100)/Math.max(1,canvas.clientWidth));
    const width=Math.max(1,Math.round(canvas.clientWidth*ratio)), height=Math.max(1,Math.round(canvas.clientHeight*ratio));
    if (canvas.width!==width || canvas.height!==height) { canvas.width=width; canvas.height=height; }
    {
      elapsed+=dt;
      if (!network.id) crowd.update(dt);
      else {
        const seen=new Set();
        for (const anchor of network.walkingGroups ?? []) {
          seen.add(anchor.number);
          let group=walkingGroups.get(anchor.number);
          if (!group) {
            group={...anchor,actors:[]};
            walkingGroups.set(anchor.number,group);
          }
          const t=1-Math.exp(-dt*12);
          group.x=mix(group.x,anchor.x,t); group.z=mix(group.z,anchor.z,t);
          group.angle=turnTo(group.angle,anchor.angle,t);
        }
        for (const number of walkingGroups.keys()) if (!seen.has(number)) walkingGroups.delete(number);
        for (const group of liveGroups()) { group.members=[]; group.reserved=[]; }
        for (const actor of [...network.npcs.values(),...network.remote.values()]) {
          const group=walkingGroups.get(actor.crowd_group) ?? sharedZones.find(g=>g.number===actor.crowd_group);
          if (group) {
            group.reserved.push(actor.crowd_slot);
            if (!actor.dead && !actor.stunned && actor.target.stride<=1.1) group.members.push(actor);
          }
        }
      }
      if (playing && !network.reconnecting) updatePlayer(dt,now);
      else player.stride=mix(player.stride,0,Math.min(1,dt*12));
      network.tick(dt,player);
      updateCamera(dt);
      const aspect=width/height, narrowPreview=mode==="select" && stackedRoster.matches;
      const fov=narrowPreview ? 1.46 : aspect<.78 ? 1.12 : .93;
      const currentLock=playing ? lockedActor() : null;
      const aimed=playing && (focusHold || !currentLock) ? pickActor() : null;
      if (playing) updateFocusHold(now,aimed);
      const locked=playing ? lockedTarget : null;
      const focus=locked ?? aimed;
      const state=network.state;
      const age=state ? Math.max(0,(now-state.receivedAt)/1000) : 0;
      const muted=Math.max(0,(state?.muted || 0)-age);
      const touchPowerTarget=updatePowers(now,focus,locked,muted);
      updateCombat(muted);
      mesh.data.length=0;
      drawCloth(mesh,city.cloth,elapsed);
      const span=Math.tan(fov/2)*aspect*(mode==="select" ? 1.46 : 1.09);
      const renderYaw=Math.atan2(camera.eye[0]-camera.target[0],camera.eye[2]-camera.target[2]);
      const sin=Math.sin(renderYaw), cos=Math.cos(renderYaw);
      const drawMarker=actor=>{
        const focused=touchAim ? actor===nearby[0] || (touchPowerTarget && actor===focus) :
          actor===focus || actor===focusHold?.actor;
        if (focused || nearby.includes(actor) || (playing && actor.stunned>0)) {
          drawInteraction(mesh,actor,focused,elapsed,actor===locked,camera.eye);
        }
      };
      if (playing) for (const bale of city.haybales) drawMarker(bale);
      const citizens=network.id ? network.npcs.values() : crowd.groups.flatMap(group=>group.actors);
      for (const actor of citizens) {
        if (actor.invisible || (actor.haybale && actor.animation?.kind!=="hay-enter") || (actor.dead && !actor.animation)) continue;
        const dx=actor.x-camera.eye[0], dz=actor.z-camera.eye[2];
        const depth=-dx*sin-dz*cos, side=dx*cos-dz*sin;
        if (depth<-.7 || depth>61 || Math.abs(side)>1.8+depth*span) continue;
        drawMarker(actor);
        addFootprint(mesh,actor.x,actor.z,actor.scale || 1);
        drawFigure(mesh,crowd.figures[actor.outfit],actor,elapsed);
      }
      for (const actor of network.remote.values()) {
        if (actor.invisible || (actor.haybale && actor.animation?.kind!=="hay-enter") || (actor.dead && !actor.animation)) continue;
        drawMarker(actor);
        addFootprint(mesh,actor.x,actor.z,actor.scale || 1);
        drawFigure(mesh,figures[actor.outfit],actor,elapsed);
      }
      if (mode==="select") {
        const preview={...player,angle:camera.yaw+Math.PI+.24,stride:0};
        addFootprint(mesh,player.x,player.z,player.scale);
        drawStandingFigure(mesh,figures[selected],preview,elapsed);
      } else if (!network.state?.invisible && (!player.haybale || player.animation?.kind==="hay-enter") && (!network.state?.dead || player.animation)) {
        addFootprint(mesh,player.x,player.z,player.scale);
        drawFigure(mesh,figures[network.state?.outfit ?? selected],{...player,boosted:network.state?.boosted},elapsed);
      }
      const rosterShift=stackedRoster.matches ? -.05 : compactSidebar.matches ? -.65 : -.34;
      // The camera's forward ray projects onto the shifted reticle.
      const shiftX=mode==="select" ? rosterShift : PLAY_SHIFT_X;
      const shiftY=narrowPreview ? -.90 : 0;
      smoke.data.length=0;
      drawPowerEffects(mesh,smoke,network.effects,now);
      makeZoneGlow(liveGroups(),walkingGlow,true);
      renderer.draw(mesh,camera.eye,camera.target,{shiftX,shiftY,pitch:camera.pitch,yaw:renderYaw,fov,smoke,walkingGlow});
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
