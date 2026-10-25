// Keep a long-running save bounded without losing decisions or starred moments.
export function appendRecord(s, title, text, type = "life") {
  const record = {
    id: (s.events.at(-1)?.id ?? -1) + 1,
    age: s.age,
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
    s.events.splice(disposable < 0 ? 0 : disposable, 1);
  }
  return record;
}
