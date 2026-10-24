# 数据与署名

本项目为独立实现，玩法灵感来自 [1 in 8 Billion](https://1in8b.life/en/)。不包含原站的代码、文案、美术、音乐、玩家记录或接口集成。原站的内容不适用本项目 MIT 许可。

## 人口与经济数据

`public/data/countries.json`：World Bank, World Development Indicators，2023 年冻结截面，提取于 2026-10-25。217 个国家和地区具有完整的人口、粗出生率、出生时预期寿命数据。排除世界、地区和收入组等汇总值。

| 字段       | 指标                                       | 官方链接                                                           |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------ |
| population | SP.POP.TOTL 总人口                         | [世界银行](https://data.worldbank.org/indicator/SP.POP.TOTL)       |
| birthRate  | SP.DYN.CBRT.IN 粗出生率，每千人            | [世界银行](https://data.worldbank.org/indicator/SP.DYN.CBRT.IN)    |
| life       | SP.DYN.LE00.IN 出生时预期寿命，男女合计    | [世界银行](https://data.worldbank.org/indicator/SP.DYN.LE00.IN)    |
| gdp        | NY.GDP.PCAP.PP.CD 人均 GDP，PPP 现价国际元 | [世界银行](https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.CD) |

数据按 [World Bank Dataset Terms of Use](https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets) 和 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 使用。原始来源可通过相应指标页面追溯。中文地区名来自 JavaScript `Intl.DisplayNames`；分组、坐标、首都来自世界银行 Country API。此页面展示的名称不代表作者对地位、边界的立场。

出生权重 = `population × birthRate / 1000`，人口权重 = `population`，在覆盖地区归一化。二者均从零岁开始。未来模拟年份始终使用该固定截面，不提供历史或未来统计预测。

20 个地区缺少 PPP 数据。游戏收入基数采用收入组估计：HIC 50,000、UMC 18,000、LMC 6,000、LIC 2,000，未知 8,000（PPP 国际元）。这些是游戏参数，不是统计填补估计。相关地区的游戏页面另有提示。

## 地图

`public/data/land.json`：由 [Natural Earth 1:110m Admin 0 Countries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson) 提取几何轮廓，坐标四舍五入到两位小数，不展示边界。Natural Earth 数据为[公共领域](https://www.naturalearthdata.com/about/terms-of-use/)。

## 模拟假设

寿命采用围绕当地预期寿命的正态抽样（标准差 11 年，初始截断 30–108 岁）；体检可延长 2 年，模拟上限 110 岁，健康归零也会结束。不模拟婴幼儿死亡，不是真实生命表。图线是以预期寿命为中心的 logistic 示意。性别按固定抽签概率生成，没有地区性别统计输入。家庭、居住类型、姓名、关系、职业、教育、收入、开销与故事都是游戏规则，不应当作真实个体或当地生活的预测。页面“告别”计数为约每秒 2 人的演示值。

音乐由 Web Audio 合成，无外部音频素材。所有人生数据仅存于浏览器本地，不调用原站服务。
