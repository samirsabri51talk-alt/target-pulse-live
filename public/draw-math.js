export const PRIZES = [50,100,200];
export function wheelFrame(state, now) {
  if (!state?.spin_id || !PRIZES.includes(state.prize)) return {angle:0,phase:'ready'};
  const start=Date.parse(state.starts_at), end=Date.parse(state.ends_at);
  const progress=Math.max(0,Math.min(1,(now-start)/(end-start)));
  // Segments start at 12 o'clock; their centres are 60,180,300 degrees.
  const final=2160+360-(PRIZES.indexOf(state.prize)*120+60);
  return {angle:final*(1-Math.pow(1-progress,4)),phase:now<start?'waiting':progress<1?'spinning':'result'};
}
