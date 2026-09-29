import { config } from './config.js';
const $ = id => document.getElementById(id);
let token = '', revision = '', locked = false;
async function request(path, body, auth = false) {
  const response = await fetch(config.supabaseUrl + path, {method: body ? 'POST' : 'GET', cache:'no-store', headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(auth ? {Authorization:`Bearer ${token}`} : {})}, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(12000)});
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
  revision = state.updated_at; $('target').value = state.target; $('to-go').value = state.remaining; $('completed').value = state.target - state.remaining; preview();
  $('saved-at').textContent = `Last saved: ${new Date(state.updated_at).toLocaleString()}`;
}
async function load() { const rows = await request('/rest/v1/target_pulse_counter?id=eq.1&select=target,remaining,updated_at'); if(!rows[0]) throw new Error('Counter unavailable.'); render(rows[0]); }
$('send-code').addEventListener('submit', e => { e.preventDefault(); action(async()=>{
  await request('/auth/v1/otp', {email:$('email').value.trim(),create_user:true});
  $('status').textContent = 'Check your email and open the one-time sign-in link. It will bring you back here.';
}); });
$('target').addEventListener('input',()=>{ $('to-go').value = Math.max(0,Number($('target').value)-Number($('completed').value)); preview(); });
$('completed').addEventListener('input',()=>{ $('to-go').value = Number($('target').value)-Number($('completed').value); preview(); });
$('to-go').addEventListener('input',()=>{ $('completed').value = Number($('target').value)-Number($('to-go').value); preview(); });
$('settings').addEventListener('submit', e=>{e.preventDefault();action(async()=>{
  const target = Number($('target').value), remaining = Number($('to-go').value);
  if(!Number.isInteger(target)||!Number.isInteger(remaining)||target<1||target>1000000||remaining<0||remaining>target) throw new Error('Enter whole numbers, with contracts to go between zero and the target.');
  const rows = await request('/rest/v1/rpc/target_pulse_admin_set',{p_target:target,p_remaining:remaining,p_expected_updated_at:revision},true);
  render(rows[0]); $('status').textContent='Saved. The live dashboard will update within 2 seconds.';
});});
$('reload').addEventListener('click',()=>action(async()=>{await load();$('status').textContent='Current values loaded.';}));
$('signout').addEventListener('click',()=>{token='';revision='';$('controls').hidden=true;$('login').hidden=false;$('status').textContent='Signed out.';});
const loginResult = new URLSearchParams(location.hash.slice(1));
if (location.hash) history.replaceState(null, '', location.pathname);
if (loginResult.has('access_token')) action(async()=>{
  token = loginResult.get('access_token');
  const user = await request('/auth/v1/user', undefined, true);
  if (user.email?.toLowerCase() !== 'samirsabri51talk@gmail.com') { token=''; throw new Error('This email does not have admin access.'); }
  await load(); $('login').hidden=true; $('controls').hidden=false; $('status').textContent='Signed in. Ready to update the live dashboard.';
});
else if (loginResult.has('error_description')) $('status').textContent = loginResult.get('error_description');
