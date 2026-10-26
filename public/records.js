// Keep a long-running save bounded without losing decisions or starred moments.
export function appendRecord(s, title, text, type = "life") {
  const record = {
    id: (s.events.at(-1)?.id ?? -1) + 1,
    age: s.age,
    phase: s.clock?.age===s.age ? s.clock.fraction : 0,
    title,
    text,
    type,
    star: false,
  };
  s.events.push(record);
  if (s.events.length > 2000) {
    const disposable = s.events.findIndex(
      (e) => !e.star && !["birth", "decision", "end"].includes(e.type),
    );
    const [removed] = s.events.splice(disposable < 0 ? 0 : disposable, 1);
    if (s.clock) s.clock.moments = s.clock.moments.filter(m=>m.id!==removed.id);
  }
  return record;
}
