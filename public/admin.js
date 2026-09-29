import { config } from './config.js';
const $ = id => document.getElementById(id);
let revision = '', locked = false;
async function request(path, body) {
  const response = await fetch(config.supabaseUrl + path, {method: body ? 'POST' : 'GET', cache:'no-store', headers:{apikey:config.publishableKey,'Content-Type':'application/json'}, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(12000)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.msg || data.message || data.error_description || 'Request failed. Please try again.');
  return data;
}
async function action(fn) {
  if (locked) return; locked = true;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  $('status').textContent = 'Working…';
  try { await fn(); } catch(e) { $('status').textContent = e.message; }
  finally { locked = false; document.querySelectorAll('button').forEach(b => b.disabled = false); }
}
function preview() {
  $('completed').max = $('target').value; $('to-go').max = $('target').value;
  $('preview').textContent = `${$('completed').value} completed · ${$('to-go').value} to go · target ${$('target').value}`;
}
function render(state) {
  revision = state.updated_at; $('target').value = state.target; $('to-go').value = state.remaining; $('completed').value = state.target - state.remaining; $('force-achieved').checked = state.force_achieved === true; preview();
  $('saved-at').textContent = `Last saved: ${new Date(state.updated_at).toLocaleString()}`;
}
async function load() { const rows = await request('/rest/v1/target_pulse_counter?id=eq.1&select=*'); if(!rows[0]) throw new Error('Counter unavailable.'); render(rows[0]); }
$('target').addEventListener('input',()=>{ $('completed').value = Math.min(Number($('completed').value),Math.max(0,Number($('target').value))); $('to-go').value = Number($('target').value)-Number($('completed').value); preview(); });
$('completed').addEventListener('input',()=>{ $('to-go').value = Number($('target').value)-Number($('completed').value); preview(); });
$('to-go').addEventListener('input',()=>{ $('completed').value = Number($('target').value)-Number($('to-go').value); preview(); });
$('settings').addEventListener('submit', e=>{e.preventDefault();action(async()=>{
  const target = Number($('target').value), remaining = Number($('to-go').value);
  if(!Number.isInteger(target)||!Number.isInteger(remaining)||target<1||target>1000000||remaining<0||remaining>target) throw new Error('Enter whole numbers, with contracts to go between zero and the target.');
  const rows = await request('/rest/v1/rpc/target_pulse_admin_save',{p_target:target,p_remaining:remaining,p_force_achieved:$('force-achieved').checked,p_expected_updated_at:revision});
  render(rows[0]); $('status').textContent='Saved. The live dashboard will update within 2 seconds.';
});});
$('reload').addEventListener('click',()=>action(async()=>{await load();$('status').textContent='Current values loaded.';}));
if (location.hash) history.replaceState(null, '', location.pathname);
action(async()=>{
  await load(); $('controls').hidden=false; $('status').textContent='Public editing is enabled. Changes affect the shared dashboard.';
});
