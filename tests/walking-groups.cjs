// Run with: node tests/walking-groups.cjs
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const source=['engine.js','city.js','game.js'].map(file=>
  fs.readFileSync(path.join(root,'dist',file),'utf8').split('try { boot(); }')[0]).join('\n');
const checks=String.raw`
function check(ok,message) { if (!ok) throw new Error(message); }
const city={walls:[],solids:[]};
const group={x:0,z:0,angle:0,actors:[{},{}]};
const actor={x:0,z:2.7,angle:0,stride:0,phase:0};
const blend={};
const dt=1/60;
let maxGap=0,stops=0;
for (let i=0;i<1200;i++) {
  // Walk straight, turn a corner, stop, then resume.
  if (i<300 || i>=900) group.z-=dt;
  else if (i<600) { group.x+=dt; group.angle=-Math.PI/2; }
  const gap=followWalkingSeat(city,actor,walkingSeat(group,0),blend,[],dt);
  if (i>240 && i<590) {
    maxGap=Math.max(maxGap,gap);
    if (actor.stride<.3) stops++;
  }
  check(Math.hypot(actor.x-group.x,actor.z-group.z)<3,'lost group');
  if (i===895) check(actor.stride<.02,'feet keep moving after group stops');
}
check(maxGap<.3,'cannot settle into moving formation');
check(stops===0,'following movement stutters');
check(actor.stride>.7,'does not resume walking');
for (const step of [1/30,.085]) {
  const follower={x:0,z:1.8,angle:0,stride:0,phase:0},state={};
  for (let t=0;t<8;t+=step) {
    followWalkingSeat(city,follower,{x:0,z:-t},state,[],step);
  }
  check(Math.abs(follower.z+8)<.2,'following depends on frame rate');
}
// A citizen in the entry path must be steered around rather than crossed.
const entrant={x:0,z:2.6,angle:0,stride:0,phase:0},join={};
const citizen={x:0,z:1.2};
for (let i=0;i<360;i++) {
  followWalkingSeat(city,entrant,{x:0,z:0},join,[citizen],dt);
  check(Math.hypot(entrant.x-citizen.x,entrant.z-citizen.z)>=.56,'crossed a citizen');
}
check(Math.hypot(entrant.x,entrant.z)<.1,'cannot join around a citizen');
const wallCity={walls:[{x0:-.5,x1:.5,z0:.5,z1:1.5,height:2}]};
const blockedEntrant={x:0,z:2,angle:0,stride:0,phase:0},blockedJoin={};
for (let i=0;i<240;i++) {
  followWalkingSeat(wallCity,blockedEntrant,{x:0,z:0},blockedJoin,[],dt);
  check(!blocked(wallCity,blockedEntrant.x,blockedEntrant.z,.32),'walked into a wall');
}
const mesh=new Mesh();
makeZoneGlow([group],mesh,true);
check(mesh.data.length>0,'walking group has no blue zone');
const first=mesh.data[0];
group.x+=3;
makeZoneGlow([group],mesh,true);
check(Math.abs(mesh.data[0]-first-3)<.001,'zone does not follow group');
group.members=[{}];
makeZoneGlow([group],mesh,true);
check(mesh.data.length===0,'lone citizen has a blend zone');
'Walking-group movement and glow checks passed';
`;
console.log(vm.runInNewContext(source+'\n'+checks));
