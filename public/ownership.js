const KEY = "birth.memorialOwners";
export function validOwners(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length <= 10000 &&
    Object.entries(value).every(
      ([id, token]) =>
        /^[a-f0-9]{24}$/.test(id) &&
        typeof token === "string" &&
        /^[a-f0-9]{64}$/.test(token),
    )
  );
}
export function readOwners(storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(KEY) || "{}");
    return validOwners(value) ? value : {};
  } catch {
    return {};
  }
}
export function mergeOwners(incoming, storage = localStorage) {
  if (incoming === undefined) return;
  if (!validOwners(incoming)) throw Error("公开纪念的管理凭证格式无效");
  const merged = { ...incoming, ...readOwners(storage) };
  if (!validOwners(merged)) throw Error("公开纪念的管理凭证数量过多");
  storage.setItem(KEY, JSON.stringify(merged));
}
