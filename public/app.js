import { config } from './config.js';
let TARGET = 165;
const $ = id => document.getElementById(id);
const cloud = Boolean(config.supabaseUrl && config.publishableKey);
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
let busy = false, reading = false, remaining = null, newest = 0, toastTimer, requestId;
const formatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });

async function api(write = false) {
  const path = write ? '/rest/v1/rpc/target_pulse_record_win' : '/rest/v1/target_pulse_counter?id=eq.1&select=*';
  const url = cloud ? config.supabaseUrl + path : write ? '/api/orders/decrement' : '/api/state';
  const headers = cloud ? { apikey: config.publishableKey } : {};
  const options = { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) };
  if (write) {
    options.method = 'POST'; headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify({ p_request_id: requestId });
  }
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(write ? 'Could not record the win. Tap again to retry safely.' : 'Connection interrupted. Reconnecting automatically…');
  const payload = await response.json();
  const state = cloud ? payload[0] : payload;
  const timestamp = Date.parse(state?.updated_at || state?.updatedAt);
  const target = state?.target ?? 165;
  if (!state || !Number.isInteger(target) || target < 1 || !Number.isInteger(state.remaining) || state.remaining < 0 || state.remaining > target || !Number.isFinite(timestamp)) throw new Error('The live service returned invalid data.');
  if (timestamp >= newest) {
    const celebrateRemote = !write && remaining !== null && target === TARGET && state.remaining < remaining;
    newest = timestamp; remaining = state.remaining; TARGET = target;
    const completed = TARGET - remaining;
    $('remaining').textContent = remaining;
    $('orders-ar').textContent = remaining;
    $('progress-fill').style.width = `${completed / TARGET * 100}%`;
    document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(completed));
    document.querySelector('[role="progressbar"]').setAttribute('aria-valuemax', String(TARGET));
    $('progress-copy').textContent = remaining === 0 ? 'Target reached — incredible work, team!' : `${completed} of ${TARGET} contracts · ${Math.round(completed / TARGET * 100)}% complete`;
    $('updated-time').textContent = `Updated ${formatter.format(timestamp)}`;
    if (celebrateRemote) celebrate();
  }
  $('sync-label').textContent = 'LIVE · synced';
  document.querySelector('.live-dot').style.background = 'var(--cyan)';
  $('win-button').disabled = busy || remaining === 0;
}
async function sync() {
  if (reading || busy || (!cloud && !local)) return;
  reading = true;
  try { await api(); if (!requestId) $('request-status').textContent = ''; }
  catch (error) {
    $('sync-label').textContent = 'OFFLINE · retrying';
    document.querySelector('.live-dot').style.background = 'var(--coral)';
    $('request-status').textContent = error.message;
    $('win-button').disabled = true;
  } finally { reading = false; }
}
$('win-button').addEventListener('click', async () => {
  if (busy || remaining === 0) return;
  busy = true; $('win-button').disabled = true;
  requestId ||= crypto.randomUUID();
  try {
    await api(true); requestId = undefined;
    $('request-status').textContent = '';
    celebrate();
  } catch (error) { $('request-status').textContent = error.message; }
  finally { busy = false; $('win-button').disabled = remaining === 0; }
});
function clock() {
  const now = new Date(), midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
  const seconds = Math.max(0, Math.floor((midnight - now) / 1000));
  [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].forEach((v, i) => {
    $(['hours', 'minutes', 'seconds'][i]).textContent = String(v).padStart(2, '0');
  });
}
if (!cloud && !local) {
  $('sync-label').textContent = 'SETUP PENDING';
  $('updated-time').textContent = 'Not connected';
  $('progress-copy').textContent = 'Waiting for the shared counter connection.';
  $('request-status').textContent = 'The live backend is being connected. No live total is available yet.';
  document.querySelector('.live-dot').style.background = 'var(--coral)';
}
sync(); clock();
setInterval(sync, 2000); setInterval(clock, 1000);
window.addEventListener('online', sync);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { sync(); clock(); } });

// Keep the original quick keyboard controls, with local-only adjustment until a cloud counter is configured.
document.addEventListener('keydown', event => {
  if (event.repeat || event.target.closest?.('input,textarea,select,button,a,[contenteditable="true"]')) return;
  if (!cloud && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault();
    if (remaining === null) return;
    remaining = Math.max(0, remaining + (event.key === 'ArrowUp' ? 1 : -1));
    $('remaining').textContent = remaining; $('orders-ar').textContent = remaining;
  }
  if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (!busy) $('win-button').click(); }
});

const canvas = $('fx'), context = canvas.getContext('2d'); let particles = [], rockets = [];
function resizeCanvas() { canvas.width = innerWidth; canvas.height = innerHeight; }
function launchFireworks() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let burst = 0; burst < 5; burst++) setTimeout(() => rockets.push({ x: canvas.width * (.18 + Math.random() * .64), y: canvas.height + 10, target: canvas.height * (.13 + Math.random() * .34), speed: 8 + Math.random() * 2, color: ['#ffd84d','#fff','#67e5df','#ffef9a','#ff9481'][burst] }), burst * 220);
}
function celebrate() {
  $('celebration').classList.add('show'); clearTimeout(toastTimer);
  document.querySelector('.mascot')?.classList.add('celebrate');
  toastTimer = setTimeout(() => { $('celebration').classList.remove('show'); document.querySelector('.mascot')?.classList.remove('celebrate'); }, 3600);
  launchFireworks();
}
$('preview-fireworks')?.addEventListener('click', () => { launchFireworks(); document.querySelector('.mascot')?.classList.add('celebrate'); setTimeout(()=>document.querySelector('.mascot')?.classList.remove('celebrate'),3600); });
function explode(rocket) { for (let i = 0; i < 95; i++) { const angle = Math.PI * 2 * i / 95 + Math.random() * .1; const speed = 1.5 + Math.random() * 5.8; particles.push({ x: rocket.x, y: rocket.y, px: rocket.x, py: rocket.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: 55 + Math.random() * 38, color: rocket.color, size: 1 + Math.random() * 2.4 }); } }
function animate() { context.clearRect(0, 0, canvas.width, canvas.height); context.globalCompositeOperation = 'lighter'; for (const rocket of rockets) { rocket.y -= rocket.speed; rocket.speed = Math.max(4, rocket.speed * .985); context.fillStyle = rocket.color; context.globalAlpha = .9; context.beginPath(); context.arc(rocket.x, rocket.y, 2.5, 0, Math.PI * 2); context.fill(); if (Math.random() < .7) particles.push({ x: rocket.x, y: rocket.y, px: rocket.x, py: rocket.y + 8, vx: 0, vy: 1, age: 0, life: 18, color: rocket.color, size: 1.3 }); if (rocket.y <= rocket.target) { explode(rocket); rockets = rockets.filter(item => item !== rocket); } } particles = particles.filter(p => p.age++ < p.life); for (const p of particles) { p.px = p.x; p.py = p.y; p.x += p.vx; p.y += p.vy; p.vy += .055; p.vx *= .988; context.globalAlpha = Math.max(0, 1 - p.age / p.life); context.strokeStyle = p.color; context.lineWidth = p.size; context.beginPath(); context.moveTo(p.px, p.py); context.lineTo(p.x, p.y); context.stroke(); } context.globalAlpha = 1; context.globalCompositeOperation = 'source-over'; requestAnimationFrame(animate); }
resizeCanvas(); addEventListener('resize', resizeCanvas); animate();
