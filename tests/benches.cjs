// Run with: node tests/benches.cjs
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const source=['engine.js','city.js','game.js'].map(file=>
  fs.readFileSync(path.join(root,'dist',file),'utf8').split('try { boot(); }')[0]).join('\n');
const checks=String.raw`
function check(ok,message) { if (!ok) throw new Error(message); }
const city=buildCity();
check(city.benches.some(b=>b.seats.length===2),'missing two-seat benches');
check(city.benches.some(b=>b.seats.length===4),'missing four-seat benches');
const betrahold=buildCity('betrahold');
for (const map of [city,betrahold]) {
  const smallBenches=map.benches.filter(bench=>bench.id.startsWith('small-bench-'));
  check(smallBenches.length===7 && smallBenches.every(bench=>bench.seats.length===2),'missing small bench seats');
  for (const bench of map.benches) for (const seat of bench.seats) {
    const exit={x:seat.x-Math.sin(seat.angle)*.99,z:seat.z-Math.cos(seat.angle)*.99};
    check(!blocked(map,exit.x,exit.z,.32),'blocked bench exit '+bench.id);
    check(clearSight(map,exit,seat),'bench blocks combat sight '+bench.id);
    check(nearestHidingPlace(map,exit,[])?.id===bench.id,'bench unavailable from its approach '+bench.id);
  }
}
const player={x:29.9,z:21.6};
const bench=betrahold.benches.find(bench=>bench.id==='bench-6');
check(!blocked(betrahold,player.x,player.z,.32),'bench interaction position is blocked');
check(nearestHidingPlace(betrahold,player,[])?.id===bench.id,'closer bench lost to hay');
const reserved=[{bench_goal:[bench.id,3]}];
check(nearestHidingPlace(betrahold,player,reserved)?.id==='hay-9','reserved seat won over hay');
check(nearestHidingPlace(betrahold,{x:30.3,z:21.6},[])?.id==='hay-9','closer hay lost to bench');
const output=new Mesh();
for (const outfit of ROSTER) {
 const figure=makeFigure(outfit);
 const actor={x:0,z:0,angle:0,scale:1,bench:'bench-0'};
 output.data.length=0;
 drawFigure(output,figure,actor,0);
 check(output.data.length>0 && output.data.every(Number.isFinite),'invalid sitting pose');
 const height=Math.max(...output.data.filter((v,i)=>i%9===1));
 check(height<1.8 && height>1.3,'sitting head height');
 check(Math.min(...output.data.filter((v,i)=>i%9===1))>=0,'seated outfit clips into ground');
 for (const kind of ['bench-sit','bench-rise','bench-fall','bench-stagger','bench-attack-kill','bench-attack-stun','bench-target-kill','bench-target-stun']) {
  for (const age of [0,.15,.35,.7,1.2]) {
   output.data.length=0;
   drawFigure(output,figure,{...actor,bench:null,animation:{kind,age,duration:.7,x:0,z:.8,angle:0}},0);
   check(output.data.length>0 && output.data.every(Number.isFinite),'invalid animation '+kind);
  }
 }
}
'Bench placement, interactions, and seated animation checks passed';
`;
console.log(vm.runInNewContext(source+'\n'+checks,{performance:{now:()=>0}}));
