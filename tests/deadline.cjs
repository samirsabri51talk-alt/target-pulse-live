const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../public/app.js'), 'utf8');
const values = {};
const end = Date.parse('2026-10-31T21:00:00Z');
let now = end - 90061000;
const context = { Date: { parse: Date.parse, now: () => now }, Math, $: id => values[id] ?? (values[id] = {}) };
vm.createContext(context);
vm.runInContext(source.match(/const COUNTDOWN_END = .*;/)[0] + source.slice(source.indexOf('function clock()'), source.indexOf('if (!cloud && !local)')), context);
function check(expected) {
  vm.runInContext('clock()', context);
  assert.deepEqual(['hours', 'minutes', 'seconds'].map(id => values[id].textContent), expected);
}
check(['25', '01', '01']);
now = end - 1000; check(['00', '00', '01']);
now = end; check(['00', '00', '00']);
now = end + 86400000; check(['00', '00', '00']);
const cairo = new Intl.DateTimeFormat('en-GB', {timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
assert.equal(cairo.format(new Date(end)), '23:00');
console.log('PASS: Egypt deadline, >24 hours, final second, zero at expiry, and no midnight reset');
