const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8').replace("import { config } from './config.js';",'const config = {};');
const noop=()=>{}, els=new Map(), scheduled=[];
const element=id=>{if(!els.has(id))els.set(id,{textContent:'',innerHTML:'',style:{},classList:{add:noop,remove:noop},setAttribute:noop,addEventListener:noop,getContext:()=>({clearRect:noop})});return els.get(id)};
const sandbox={document:{body:{classList:{toggle:noop}},getElementById:element,querySelector:element,addEventListener:noop},location:{hostname:'example.com'},window:{addEventListener:noop},innerWidth:1280,innerHeight:720,Intl,Date,Math,AbortSignal,matchMedia:()=>({matches:false}),setTimeout:fn=>{scheduled.push(fn);return 1},clearTimeout:noop,setInterval:noop,addEventListener:noop,requestAnimationFrame:noop};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
let version=0;
async function apply(remaining,force=false){sandbox.fetch=async()=>({ok:true,json:async()=>({target:165,remaining,force_achieved:force,updated_at:new Date(++version*1000).toISOString()})});await vm.runInContext('api()',sandbox)}
(async()=>{
  await apply(10);assert.equal(vm.runInContext('achieved',sandbox),false);assert.equal(scheduled.length,0,'Initial state does not celebrate');
  await apply(9);assert(scheduled.length>=36,'Remote contract triggers dense fireworks');
  await apply(0);assert.equal(vm.runInContext('achieved',sandbox),true);assert.equal(element('remaining').textContent,'100%');
  await apply(0);assert.equal(element('remaining').textContent,'100%','Polling preserves achievement text');
  await apply(9);assert.equal(vm.runInContext('achieved',sandbox),false);assert.equal(element('remaining').textContent,9);
  await apply(9,true);assert.equal(vm.runInContext('achieved',sandbox),true);assert.equal(vm.runInContext('remaining',sandbox),9,'Override preserves true count');
  await apply(9,true);assert.equal(element('remaining').textContent,'100%');
  await apply(9,false);assert.equal(vm.runInContext('achieved',sandbox),false);
  await apply(0,true);await apply(0,false);assert.equal(vm.runInContext('achieved',sandbox),true,'Automatic achievement remains at zero');
  console.log('PASS: contract sync, automatic achievement, manual override, repeated polling, preserved counts, and automatic return');
})().catch(e=>{console.error(e);process.exitCode=1});
