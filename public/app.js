import { config } from './config.js';
let TARGET = 165;
const $ = id => document.getElementById(id);
const cloud = Boolean(config.supabaseUrl && config.publishableKey);
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
let busy = false, reading = false, remaining = null, newest = 0, toastTimer, requestId;
let achieved = false, finaleElapsed = 0;
const previewAchieved = local && new URLSearchParams(location.search).get('preview') === 'achieved';
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
    setAchieved(remaining === 0 || state.force_achieved === true);
    $('remaining').textContent = achieved ? '100%' : remaining;
    $('orders-ar').textContent = remaining;
    $('progress-fill').style.width = `${achieved ? 100 : completed / TARGET * 100}%`;
    document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(achieved ? TARGET : completed));
    document.querySelector('[role="progressbar"]').setAttribute('aria-valuemax', String(TARGET));
    $('progress-copy').textContent = achieved ? 'Together, we made it happen.' : `${completed} of ${TARGET} contracts · ${Math.round(completed / TARGET * 100)}% complete`;
    $('updated-time').textContent = `Updated ${formatter.format(timestamp)}`;
    if (celebrateRemote && !achieved) celebrate();
  }
  $('sync-label').textContent = 'LIVE · synced';
  document.querySelector('.live-dot').style.background = 'var(--cyan)';
}
async function sync() {
  if (previewAchieved) return;
  if (reading || busy || (!cloud && !local)) return;
  reading = true;
  try { await api(); if (!requestId) $('request-status').textContent = ''; }
  catch (error) {
    $('sync-label').textContent = 'OFFLINE · retrying';
    document.querySelector('.live-dot').style.background = 'var(--coral)';
    $('request-status').textContent = error.message;
  } finally { reading = false; }
}
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

// This display is read-only: contract changes arrive from the shared counter.
function setAchieved(value) {
  if (achieved === value) return;
  achieved = value;
  document.body.classList.toggle('target-achieved', value);
  $('title').innerHTML = value ? 'Target Achieved' : 'Every win moves<br><em>the team forward.</em>';
  document.querySelector('.hero-label').textContent = value ? 'ONE TEAM · ONE INCREDIBLE ACHIEVEMENT' : "TODAY'S TARGET · 100%";
  $('remaining').textContent = value ? '100%' : remaining;
  document.querySelector('.number-caption').textContent = value ? 'Thanks for your hardwork' : 'CONTRACTS TO GO';
  clearTimeout(toastTimer); $('celebration').classList.remove('show');
  document.querySelector('.mascot')?.classList.remove('celebrate');
  if (!value) { rockets = []; particles = []; }
  finaleElapsed = 100;
}

// Real recordings bundled locally; audio begins only after user interaction.
let audioContext, audioMaster, soundEnabled = false, lastSound = -Infinity, nextCheer = 0;
let fireworksBuffer, cheeringBuffer;
const soundButton = $('sound-toggle');
soundButton?.addEventListener('click', async () => {
  soundButton.disabled = true;
  try {
    if (!audioContext) {
      const AudioEngine = window.AudioContext || window.webkitAudioContext;
      if (!AudioEngine) throw new Error('Audio unavailable');
      audioContext = new AudioEngine();
      audioMaster = audioContext.createGain(); audioMaster.gain.value = 0;
      audioMaster.connect(audioContext.destination);
    }
    await audioContext.resume();
    if (!fireworksBuffer || !cheeringBuffer) {
      $('sound-status').textContent = 'Loading celebration sounds…';
      const load = async file => {
        const response = await fetch(file, {signal: AbortSignal.timeout(15000)});
        if (!response.ok) throw new Error('Audio download failed');
        return audioContext.decodeAudioData(await response.arrayBuffer());
      };
      [fireworksBuffer, cheeringBuffer] = await Promise.all([load('./audio/fireworks.wav'), load('./audio/cheering.wav')]);
    }
    soundEnabled = !soundEnabled;
    audioMaster.gain.cancelScheduledValues(audioContext.currentTime);
    audioMaster.gain.setTargetAtTime(soundEnabled && !document.hidden ? .5 : 0, audioContext.currentTime, .08);
    soundButton.textContent = soundEnabled ? '🔊 Mute sound' : '🔇 Enable sound';
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    $('sound-status').textContent = '';
    if (soundEnabled) playFireworkSound(.5);
  } catch {
    soundEnabled = false;
    if (audioMaster) audioMaster.gain.value = 0;
    soundButton.textContent = '🔇 Enable sound';
    soundButton.setAttribute('aria-pressed', 'false');
    $('sound-status').textContent = 'Sound could not load. Please try again.';
  } finally { soundButton.disabled = false; }
});
document.addEventListener('visibilitychange', () => {
  if (!audioContext || !audioMaster) return;
  audioMaster.gain.cancelScheduledValues(audioContext.currentTime);
  audioMaster.gain.setTargetAtTime(soundEnabled && !document.hidden ? .5 : 0, audioContext.currentTime, .04);
});
function playRecording(buffer, volume, position) {
  const now = audioContext.currentTime;
  const source = audioContext.createBufferSource(); source.buffer = buffer;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + .12);
  gain.gain.setValueAtTime(volume, now + Math.max(.12, buffer.duration - .8));
  gain.gain.linearRampToValueAtTime(0, now + buffer.duration);
  const pan = audioContext.createStereoPanner();
  pan.pan.value = Math.max(-.45, Math.min(.45, (position - .5) * .9));
  source.connect(gain); gain.connect(pan); pan.connect(audioMaster);
  source.onended = () => { source.disconnect(); gain.disconnect(); pan.disconnect(); };
  source.start(now); source.stop(now + buffer.duration);
}
function playFireworkSound(position) {
  if (!soundEnabled || document.hidden || audioContext?.state !== 'running' || !fireworksBuffer || !cheeringBuffer) return;
  const now = audioContext.currentTime;
  if (now - lastSound >= fireworksBuffer.duration + .4) {
    lastSound = now;
    playRecording(fireworksBuffer, .5, position);
  }
  if (now >= nextCheer) {
    nextCheer = now + cheeringBuffer.duration + 7;
    playRecording(cheeringBuffer, .22, .5);
  }
}

const canvas = $('fx'), context = canvas.getContext('2d'); let particles = [], rockets = [];
let fireworksUntil = 0;
let shellSequence = 0;
function edgeShell(grand = false) {
  const lane = shellSequence++ % 4;
  return { x: canvas.width * (.04 + (lane + Math.random()) * .23), y: canvas.height + 10,
    target: canvas.height * (.08 + Math.random() * .68), speed: Math.max(10, canvas.height / 55),
    color: ['#ffd84d', '#ffe8aa', '#75cfff', '#c5b7ef'][Math.floor(Math.random() * 4)], ring: Math.random() < .3, grand };
}
function resizeCanvas() { canvas.width = innerWidth; canvas.height = innerHeight; }
function launchFireworks() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || Date.now() < fireworksUntil) return;
  fireworksUntil = Date.now() + 8000;
  // Dense overlapping shells across the full screen for every contract.
  for (let burst = 0; burst < 36; burst++) setTimeout(() => {
    if (achieved || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (rockets.length < 40) rockets.push(edgeShell(true));
  }, burst * 125);
}
function celebrate() {
  $('celebration').classList.add('show'); clearTimeout(toastTimer);
  document.querySelector('.mascot')?.classList.add('celebrate');
  toastTimer = setTimeout(() => { $('celebration').classList.remove('show'); document.querySelector('.mascot')?.classList.remove('celebrate'); }, 3600);
  launchFireworks();
}
$('preview-fireworks')?.addEventListener('click', () => { launchFireworks(); document.querySelector('.mascot')?.classList.add('celebrate'); setTimeout(()=>document.querySelector('.mascot')?.classList.remove('celebrate'),3600); });
function explode(rocket) {
  playFireworkSound(rocket.x / canvas.width);
  const scale = Math.min(1.1, Math.max(.4, canvas.width / 1100)) * (rocket.grand ? 1.25 : 1);
  const count = rocket.grand ? 210 : 150;
  for (let i = 0; i < count && particles.length < 3600; i++) {
    const angle = Math.PI * 2 * i / count;
    const outer = i % 3 !== 0;
    const speed = (outer ? (rocket.ring ? 6.5 : 4 + Math.random() * 3.5) : 1 + Math.random() * 2.5) * scale;
    particles.push({ x: rocket.x, y: rocket.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: 70 + Math.random() * 55, color: outer ? rocket.color : '#fff8df', size: outer ? 1.5 : 2, trail: [] });
  }
}
let previousFrame;
function animate(now) {
  const dt = previousFrame === undefined || !Number.isFinite(now) ? 1 : Math.min(2, (now - previousFrame) / 16.667);
  previousFrame = now;
  if (achieved && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finaleElapsed += dt;
    if (finaleElapsed >= 12) {
      finaleElapsed = 0;
      for (let side = 0; side < 2 && rockets.length < 40; side++) {
        rockets.push(edgeShell(true));
      }
    }
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'lighter';
  for (const rocket of rockets) {
    rocket.y -= rocket.speed * dt;
    rocket.speed = Math.max(5, rocket.speed * Math.pow(.985, dt));
    context.strokeStyle = rocket.color; context.globalAlpha = .8; context.lineWidth = 2;
    context.beginPath(); context.moveTo(rocket.x, rocket.y + 30); context.lineTo(rocket.x, rocket.y); context.stroke();
    context.fillStyle = '#fff8df'; context.beginPath(); context.arc(rocket.x, rocket.y, 2.5, 0, Math.PI * 2); context.fill();
    if (rocket.y <= rocket.target) { explode(rocket); rocket.done = true; }
  }
  rockets = rockets.filter(r => !r.done);
  particles = particles.filter(p => p.age < p.life);
  for (const p of particles) {
    p.age += dt; p.trail.push([p.x, p.y]); if (p.trail.length > 7) p.trail.shift();
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += .045 * dt;
    p.vx *= Math.pow(.985, dt); p.vy *= Math.pow(.995, dt);
    const fade = Math.pow(Math.max(0, 1 - p.age / p.life), 1.3);
    context.strokeStyle = p.color; context.lineWidth = p.size;
    context.globalAlpha = fade * .45; context.beginPath(); context.moveTo(...p.trail[0]);
    for (const point of p.trail) context.lineTo(...point);
    context.lineTo(p.x, p.y); context.stroke();
    context.globalAlpha = fade * .7;
    context.fillStyle = p.color; context.beginPath(); context.arc(p.x, p.y, p.size * 1.4, 0, Math.PI * 2); context.fill();
  }
  context.globalAlpha = 1; context.globalCompositeOperation = 'source-over'; requestAnimationFrame(animate);
}
resizeCanvas(); addEventListener('resize', resizeCanvas); animate();
if (previewAchieved) {
  setAchieved(true);
  $('progress-fill').style.width = '100%';
  document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(TARGET));
  $('progress-copy').textContent = 'Together, we made it happen.';
  $('sync-label').textContent = 'LOCAL PREVIEW · no data changed';
}
