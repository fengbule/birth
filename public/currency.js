// WDI PA.NUS.PPP, China, 2023: CNY per international dollar.
// https://data.worldbank.org/indicator/PA.NUS.PPP?locations=CN
export const CNY_PPP_2023 = 3.64373827497296;
export function formatMoney(value,life) {
  const chinese=life?.flowVersion===2;
  const amount=Math.round(Math.abs(value)*(chinese?CNY_PPP_2023:1)).toLocaleString('zh-CN');
  return `${value<0?'−':''}${chinese?'':'$'}${amount}${chinese?'元':''}`;
}
