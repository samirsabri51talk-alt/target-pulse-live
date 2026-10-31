import assert from 'node:assert/strict';
import {wheelFrame,PRIZES} from '../public/draw-math.js';
const start=Date.parse('2026-10-31T12:00:00Z');
for(const [index,prize] of PRIZES.entries()) {
 const s={spin_id:'test',prize,starts_at:new Date(start).toISOString(),ends_at:new Date(start+8000).toISOString()};
 assert.equal(wheelFrame(s,start-1000).phase,'waiting');
 assert.equal(wheelFrame(s,start+4000).phase,'spinning');
 const final=wheelFrame(s,start+8000);
 assert.equal(final.phase,'result');
 assert.equal((index*120+60+final.angle)%360,0,'Pointer aligns with winning sector');
 assert.equal(wheelFrame(s,start+60000).angle,final.angle,'Late clients see same result');
 assert(wheelFrame(s,start+1000).angle<wheelFrame(s,start+2000).angle);
}
assert.equal(wheelFrame(null,start).phase,'ready');
console.log('PASS: all prizes align, scheduled starts, shared timeline, late arrival and persistent results');
