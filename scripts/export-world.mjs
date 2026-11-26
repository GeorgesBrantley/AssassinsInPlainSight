// Rebuild the server's collision/crowd data after changing the city scene.
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const source=read('dist/engine.js').split('class Mesh')[0]+
  'class Mesh { constructor(){this.data=[];return new Proxy(this,{get:(o,k)=>k in o?o[k]:(()=>{})});} }\n'+
  read('dist/city.js')+read('dist/game.js').split('function boot()')[0]+`
  Object.entries(CITY_MAPS).map(([id])=>{
    const city=buildCity(id),crowd=makeCrowd(city,ROSTER);
    const {limits,walls,haybales,benches,landmarks,playerSpawns,rivalSpawn}=city;
    let index=0;
    const npcs=crowd.groups.flatMap(g=>g.actors);
    const groups=crowd.groups.map(g=>({...g,actors:g.actors.map(()=> 'npc-'+index++)}));
    return [id,{limits,playerSpawns,rivalSpawn,walls,haybales,benches,npcs,landmarks,groups}];
  });`;
for (const [id, world] of vm.runInNewContext(source)) {
  const file=id==='testa' ? 'world.json' : `world-${id}.json`;
  fs.writeFileSync(new URL(file,root),JSON.stringify(world)+'\n');
  console.log(`Updated ${file}`);
}
