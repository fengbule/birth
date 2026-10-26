// A year is a sequence of moments on one continuous clock. Decisions interrupt it.
// Persist the fraction, rather than wall-clock time, so pause/resume and speed changes
// preserve the same position in the year and a reload cannot reveal future entries.
export function scheduleYear(s, records = []) {
  const moments = records.map((e, i) => {
    const at=e.type==='birth'?0:s.age===0?.24:records.length===1?.24:.02+i*.78/Math.max(1,records.length-1);
    e.phase=at;
    return {id:e.id,at};
  });
  s.clock = {age:s.age, fraction:0, moments, decisionAt:.4, ready:false};
  return s.clock;
}
export function clockFor(s) {
  if (!s.clock || s.clock.age !== s.age) {
    // Old archives contain only events that have already happened.
    s.clock = {age:s.age,fraction:0,moments:[],decisionAt:0,ready:!!s.pending};
  }
  return s.clock;
}
export function visibleRecords(s) {
  const clock = s.clock;
  if (!clock || clock.age !== s.age) return s.events;
  const hidden = new Set(clock.moments.filter(m=>m.at>clock.fraction).map(m=>m.id));
  return s.events.filter(e=>!hidden.has(e.id));
}
export function advanceClock(s, fraction) {
  const clock = clockFor(s), before = visibleRecords(s).length;
  clock.fraction = Math.min(1, clock.fraction + Math.max(0, fraction));
  const ready = !!s.pending && clock.fraction >= clock.decisionAt;
  const changed = before !== visibleRecords(s).length || ready !== clock.ready;
  clock.ready = ready;
  return changed;
}
export const newestFirst = records=>[...records].sort((a,b)=>b.age-a.age||(b.phase??1)-(a.phase??1)||b.id-a.id);
export function decisionReady(s) {
  return !!s.pending && clockFor(s).ready;
}
export function validClock(clock, s) {
  if (clock === undefined) return true;
  return clock && clock.age===s.age && Number.isFinite(clock.fraction)
    && clock.fraction>=0 && clock.fraction<=1 && typeof clock.ready==='boolean'
    && Number.isFinite(clock.decisionAt) && clock.decisionAt>=0 && clock.decisionAt<=1
    && Array.isArray(clock.moments) && clock.moments.length<=100
    && clock.moments.every(m=>m && Number.isInteger(m.id) && s.events.some(e=>e.id===m.id)
      && Number.isFinite(m.at) && m.at>=0 && m.at<=1);
}
