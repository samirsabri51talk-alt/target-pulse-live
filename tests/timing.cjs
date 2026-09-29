const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8').replace("import { config } from './config.js';",'const config={};');
let now=0,id=0,starts=0,strokes=0;const timers=new Map(),elements=new Map(),noop=()=>{};
class Clock extends Date {static now(){return now}}
const param=()=>({setValueAtTime:noop,linearRampToValueAtTime:noop,cancelScheduledValues:noop,setTargetAtTime:noop});
const stopTimes=[];
const node=()=>({gain:param(),pan:{},connect:noop,disconnect:noop,start:()=>starts++,stop:time=>stopTimes.push(time)});
const ctx={clearRect:noop,beginPath:noop,arc:noop,fill:noop,moveTo:noop,lineTo:noop,stroke:()=>strokes++};
function el(id){if(!elements.has(id))elements.set(id,{style:{},classList:{add:noop,remove:noop},setAttribute:noop,addEventListener:(type,fn)=>{el(id)[type]=fn},getContext:()=>ctx});return elements.get(id)}
const s={document:{body:{classList:{toggle:noop}},getElementById:el,querySelector:el,addEventListener:noop},window:{addEventListener:noop},location:{hostname:'example.com'},innerWidth:1280,innerHeight:720,Intl,Date:Clock,Math,AbortSignal,matchMedia:()=>({matches:false}),setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id},clearTimeout:id=>timers.delete(id),setInterval:noop,addEventListener:noop,requestAnimationFrame:noop};
s.testAudio={state:'running',get currentTime(){return now/1000},resume:async()=>{},createBufferSource:node,createGain:node,createStereoPanner:node};s.master=node();
vm.createContext(s);vm.runInContext(source,s);
function run(code){return vm.runInContext(code,s)}
function advance(ms){const end=now+ms;while(now<end){now=Math.min(end,now+16);for(const [key,t]of timers){if(t.at<=now){timers.delete(key);t.fn()}}run(`animate(${now})`)}}
(async()=>{
  run('audioContext=testAudio;audioMaster=master;fireworksBuffer={duration:2};cheeringBuffer={duration:17}');
  await el('sound-toggle').click();assert.equal(starts,0,'Enabling audio stays silent');
  run('launchFireworks()');advance(5000);assert(strokes>1000);assert.equal(starts,0,'Preview stays silent');
  assert.equal(run('rockets.length+particles.length'),0,'Preview ends at five seconds');
  const start=now;run('celebrate()');advance(2500);assert(starts>0,'Real contract plays audio');
  assert(stopTimes.filter(Number.isFinite).every(t=>t<=(start+5000)/1000),'Every recording has a five-second deadline');
  advance(2500);assert.equal(run('rockets.length+particles.length'),0,'Contract fireworks end at five seconds');assert.equal(run('activeSounds.size'),0);assert.equal(run('contractSoundUntil'),0);
  const before=starts;run('setAchieved(true)');advance(10000);assert.equal(starts,before,'Manual achievement and idle fireworks stay silent');
  run('celebrate()');advance(2500);assert(starts>before,'Final contract can play audio');advance(2500);const after=starts;advance(5000);assert.equal(starts,after,'Achievement audio does not loop');assert(run('rockets.length+particles.length')>0,'Achievement visuals remain continuous');
  console.log('PASS: silent enable/preview/manual override, strict five-second effects and audio, continuous silent achievement visuals');
})().catch(e=>{console.error(e);process.exitCode=1});
