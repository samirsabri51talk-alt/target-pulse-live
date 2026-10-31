import {config} from './config.js';
import {wheelFrame} from './draw-math.js';
const admin=document.getElementById('draw-controls');
let state=null, anchor=0, serverTime=0, loading=false, pending=false, lastCelebrated=null, error='';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const now=()=>serverTime+performance.now()-anchor;
let overlay,wheel,result,card;
if (!admin) {
  overlay=document.createElement('section'); overlay.className='draw-overlay'; overlay.hidden=true;
  overlay.setAttribute('aria-label','Live lucky draw');
  overlay.innerHTML=`<div class="draw-confetti" aria-hidden="true"></div><div class="draw-card"><p class="draw-kicker">51TALK · ONE TEAM, BIG WINS</p><h2>Lucky Draw</h2><p class="draw-sub">لفّة حظ… وجائزة تستاهلها ✨</p><div class="wheel-wrap" aria-hidden="true"><div class="wheel-pointer"></div><div class="draw-wheel"><div class="wheel-label" style="--a:60deg"><span>50<small>EGP</small></span></div><div class="wheel-label" style="--a:180deg"><span>100<small>EGP</small></span></div><div class="wheel-label" style="--a:300deg"><span>200<small>EGP</small></span></div></div><div class="wheel-hub">★</div></div><div class="draw-result" role="status" aria-live="polite"></div><p class="draw-footer">50 EGP · 100 EGP · 200 EGP &nbsp; / &nbsp; Equal chances</p></div>`;
  document.body.append(overlay); wheel=overlay.querySelector('.draw-wheel'); result=overlay.querySelector('.draw-result'); card=overlay.querySelector('.draw-card');
}
async function rpc(name,body={}) {
  const started=performance.now();
  const response=await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(8000)});
  const data=await response.json();
  if(!response.ok) throw Error(data.message||'Wheel connection failed');
  if(!data || !Number.isInteger(data.revision) || !Number.isFinite(Date.parse(data.server_now))) throw Error('Wheel state unavailable');
  if(!state || data.revision>=state.revision) {
    state=data; serverTime=Date.parse(data.server_now)+(performance.now()-started)/2; anchor=performance.now();
  }
  error=''; render();
}
async function poll() {
  if(loading||pending||document.hidden) return;
  loading=true;
  try {await rpc('target_pulse_draw_state');}
  catch(e){error='Connection interrupted. Reconnecting…';render();}
  finally{loading=false;render();}
}
function celebrate() {
  const box=overlay.querySelector('.draw-confetti'); box.replaceChildren();
  if(reduced.matches)return;
  for(let i=0;i<65;i++) {const p=document.createElement('i');p.style.cssText=`--x:${Math.random()*100}%;--c:${['#ffed4b','#fff','#7bdcff'][i%3]};--delay:${Math.random()*.5}s`;box.append(p);}
}
function render() {
  const frame=wheelFrame(state,now());
  const active=state?.spin_id && now()<Date.parse(state.ends_at);
  const text=frame.phase==='ready'?'Ready for your lucky moment':frame.phase==='waiting'?'Get ready…':frame.phase==='spinning'?'Good luck! حظ سعيد':`🎉 ${state.prize} EGP — مبروك!`;
  if(admin) {
    const label=admin.querySelector('[data-draw-status]');
    const message=error||(!state?'Connecting…':!state.visible?'Wheel hidden from audience':text);
    if(label.textContent!==message)label.textContent=message;
    for(const b of admin.querySelectorAll('button[data-draw-action]')) {
      const a=b.dataset.drawAction;
      b.disabled=pending||loading||!state||Boolean(error)||(a==='spin'&&(!state.visible||active))||(a==='show'&&active)||(a==='hide'&&!state.visible);
    }
    return;
  }
  overlay.hidden=!state?.visible;
  if(overlay.hidden) return;
  wheel.style.transform=`rotate(${reduced.matches&&active?0:frame.angle}deg)`;
  if(result.textContent!==text)result.textContent=text;
  card.classList.toggle('is-winner',frame.phase==='result');
  if(frame.phase==='result' && state.spin_id!==lastCelebrated) {
    lastCelebrated=state.spin_id;
    if(now()-Date.parse(state.ends_at)<4000)celebrate();
  }
}
if(admin) for(const button of admin.querySelectorAll('[data-draw-action]')) button.addEventListener('click',async()=>{
  if(pending||!state)return;
  pending=true;error='';render();
  try {await rpc('target_pulse_draw_control',{p_action:button.dataset.drawAction,p_revision:state.revision});}
  catch(e){error=e.message;}
  finally {pending=false;render();await poll();}
});
function frame(){if(!document.hidden)render();requestAnimationFrame(frame);}
poll();setInterval(poll,2000);requestAnimationFrame(frame);
addEventListener('online',poll);document.addEventListener('visibilitychange',poll);
