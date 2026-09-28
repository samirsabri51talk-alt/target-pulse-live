import { config } from './config.js';
const TARGET = 165;
const $ = id => document.getElementById(id);
const cloud = Boolean(config.supabaseUrl && config.publishableKey);
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
let busy = false, reading = false, remaining = null, newest = 0, toastTimer, requestId;
const formatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });

async function api(write = false) {
  const path = write ? '/rest/v1/rpc/target_pulse_record_win' : '/rest/v1/target_pulse_counter?id=eq.1&select=remaining,updated_at';
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
  if (!state || !Number.isInteger(state.remaining) || state.remaining < 0 || state.remaining > TARGET || !Number.isFinite(timestamp)) throw new Error('The live service returned invalid data.');
  if (timestamp >= newest) {
    newest = timestamp; remaining = state.remaining;
    const completed = TARGET - remaining;
    $('remaining').textContent = remaining;
    $('progress-fill').style.width = `${completed / TARGET * 100}%`;
    document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(completed));
    $('progress-copy').textContent = remaining === 0 ? 'Target reached — incredible work, team!' : `${completed} of ${TARGET} contracts · ${Math.round(completed / TARGET * 100)}% complete`;
    $('updated-time').textContent = `Updated ${formatter.format(timestamp)}`;
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
    $('celebration').classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('celebration').classList.remove('show'), 3500);
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
