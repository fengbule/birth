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

出生权重 = `population × birthRate / 1000`，人口权重 = `population`，在覆盖地区归一化。二者均从零岁开始，每局沿用开局选定的固定统计环境，不按逐年真实数据更新。

`public/data/eras.json` 包含同组 WDI 指标的 1970、1990、2010 年历史截面，同日提取。仅在当年三项人口与寿命指标完整、且属于基础地区列表的记录中抽样。沿用今日地区名称，不重建历史国界；早期 PPP 缺失较多，收入基数沿用下述游戏参数。可用 `node scripts/refresh-eras.mjs` 刷新。

2050 年情景从 2023 截面按游戏公式生成：人口乘 `exp((birthRate / 1000 - 0.009) × 27 × 0.6)`，出生率乘 0.85 且不低于 5，预期寿命加 3 且不超过 95，非缺失 PPP 乘 `1.015^27`。它不是联合国、世界银行或其他机构的预测。

20 个地区缺少 PPP 数据。游戏收入基数采用收入组估计：HIC 50,000、UMC 18,000、LMC 6,000、LIC 2,000，未知 8,000（PPP 国际元）。这些是游戏参数，不是统计填补估计。相关地区的游戏页面另有提示。

## 地图

`public/data/land.json`：由 [Natural Earth 1:110m Admin 0 Countries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson) 提取几何轮廓，坐标四舍五入到两位小数，不展示边界。Natural Earth 数据为[公共领域](https://www.naturalearthdata.com/about/terms-of-use/)。

## 模拟假设

v3.1 的 `public/data/mortality.json` 保存 WDI 六项指标在 1970、1990、2010、2023 年的原始观测：婴儿死亡率 `SP.DYN.IMRT.IN`、五岁以下死亡率 `SH.DYN.MORT`、男女成人死亡概率 `SP.DYN.AMRT.MA` / `SP.DYN.AMRT.FE`、男女出生时预期寿命 `SP.DYN.LE00.MA.IN` / `SP.DYN.LE00.FE.IN`。字段单位和六个官方来源链接保存在文件中，适用 WDI 的 CC BY 4.0 许可。5,208 个国家年度指标槽中 4,930 个有观测、278 个缺失；缺失保留为 null，同地区同年观测的中位数另列，并由模型明确作为估计使用。刷新命令为 `node scripts/refresh-mortality.mjs`，更新后需重新检查数据、曲线及种子变化。

寿命不再截断到至少 30 岁，允许婴儿、少年和成年结局。独立模型用上述婴儿、五岁以下和 15–60 岁累计死亡概率作为锚点，拟合高龄风险以匹配性别预期寿命；成人指标不是每年死亡率。5–14 岁缺少本数据集观测，使用明确的插值假设。2050 沿用 2023 锚点并应用游戏预期寿命调整。上限 110 岁，健康归零也会结束，主动活动仍可能改变本局寿命。这不等同于原站使用的生命表；死亡原因是按年龄生成的虚构叙事，没有 WHO 死因分布输入。游戏中的存活曲线展示该拟合模型，不等于原站或官方完整生命表。

性别按固定抽签概率生成，没有地区性别统计输入。家庭、居住类型、姓名、关系、职业、教育、收入、开销与故事都是游戏规则，不应当作真实个体或当地生活的预测。童年选择中的遗传率提示引用 [Vukasović 与 Bratko（2015）](https://pubmed.ncbi.nlm.nih.gov/25961374/) 的群体研究，不能解释个人性格或命运。页面“告别”计数为约每秒 2 人的演示值。

投资回报、市场波动、房贷、职业晋升、关系亲密度、父母寿命和迁居资格均为独立游戏参数，不用于实际决策。

音乐由 Web Audio 合成，无外部音频素材。完整人生与私人问答存于浏览器；只有用户预览并确认公开的虚构角色摘要上传本站 SQLite，公开后可以点灯、留言及凭浏览器或私有档案里的管理凭证撤回。不调用原站服务。
