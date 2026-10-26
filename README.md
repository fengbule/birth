# 八十亿分之一 · BIRTH

如果人生，再来一次。可自行部署的中文人生模拟游戏，玩法灵感来自 [1 in 8 Billion](https://1in8b.life/en/)，以独立代码实现。

**[在线体验](https://8086-agqv47q5at4mzg6nr336pvg33u.instabox.tech)** · [深入玩法](docs/GAMEPLAY.md) · [数据与署名](DATA-SOURCES.md) · [验收记录](docs/VERIFICATION.md) · [原站差异审计](docs/PARITY-AUDIT.md)

v4.0 按新的互动方向重做主界面：一边是可点选的原创像素小镇，一边是逐段展开的人生故事。人物先走到地点，再读书、照料菜园、工作或陪伴；活动完成后才结算，结果等你读完再继续。地点随年龄解锁，档案与旧经历默认折叠。此版主动采用小镇玩法，原站对照与差异记录保留在文档中。

按全球出生人数或现有人口抽取出生地，从童年走到暮年。公开统计提供起点，选择续写虚构人生。

## 玩法

- 家、公园、学校、小菜园、湖边、小馆、工作坊、杂货铺、诊所逐步开放。免费日常与原年度活动共用三次额度，消费沿用原有冷却与借款规则。出发、行动、结果可暂停或取消，手动模式逐段阅读；自动与快进保留。
- 217 个国家和地区的今日起点（WDI 2023 固定截面），另有 1970、1990、2010 历史截面和明确标注的 2050 游戏情景；可随机选择世界。
- 两岁四选一气质、四岁成长记录、七岁三选一兴趣；教育、求职、伴侣、孩子、住房、退休与晚年，以及四位同时出生的同行者。
- 父母衰老、朋友、伴侣亲密度、子女成长；每年最多三次主动活动，可学习、陪伴、运动、体检、旅行、求职、志愿服务和迎接孩子。
- 消费按项目冷却、五种课程共用两年冷却、限额借款；求职、介绍对象和国外工作会产生之后的选择，允许同年多个选择逐一处理。另有职业晋升、投资、房产、房贷、健康保障、迁居和年度收支。
- 30 / 60 / 90 分钟节奏、六档倍速、暂停、下个选择、自动模式；默认开启 5 / 15 / 30 / 50 / 70 岁人生停顿，游戏中可切换。
- 全页出生登记、与家乡的寿命和 GDP 比较、原创 SVG 像素小镇、随活动变化的卡通人物、随本局回忆变化的分幕结尾及全页死亡纪录；结尾二次确认跳过，可重播。设置自动记忆。
- 性别与年龄风险结合 WDI 婴儿、五岁以下、成人死亡及预期寿命观测，支持零岁和少年结局；缺失、插值和虚构死因另行说明。
- 浏览器自动存档、最多 50 段人生、旧版档案兼容、JSON 导入导出、收藏瞬间、PNG 卡片和出生种子分享。
- 公共纪念馆：结束后预览并自愿公开摘要，其他访客可阅读、按地区筛选、随机相遇、点烛光和留言；发布者可凭浏览器或私有档案中的管理凭证撤回。
- 响应式布局、浅深色、合成环境音乐；没有账户、支付或第三方分析。

这是独立扩展实现，未复用原站代码、素材、玩家内容或服务，不与原站服务互通。事件、寿命、经济和未来情景均为简化游戏规则，非真实命运预测；原站仍有不同的事件与模型。

## 本地运行

Node.js 24+，无 npm 依赖。内置 SQLite 保存自愿公开的纪念摘要。

```sh
npm run dev
# http://127.0.0.1:4173
npm test
npm run build
```

默认数据库为 `data/birth.sqlite`，可用 `DATA_DIR` 指定目录。`HOST`、`PORT` 控制监听地址。完整人生和私人记录始终在浏览器，公共纪念馆单独存于服务器。`dist/` 是静态前端，包含内容摘要 `version.json`；单独托管它只能使用本地玩法，公共纪念馆需要 `/api/` 后端。

## Instabox 完整部署

需要 Node.js 24+、Docker Compose、curl 和 `instabox-port`：

```sh
cd /data/workspace
git clone https://github.com/fengbule/birth.git
cd birth
sh scripts/deploy-instabox.sh
```

Compose 项目名 `birth`。Nginx 在宿主机 `127.0.0.1:8086` 提供前端并代理内部 Node API；Instabox 提供 HTTPS。API 不直接发布端口。两个容器均以非 root 用户运行、只读根文件系统，SQLite 使用独立持久卷 `birth_birth-data`。更新与检查：

```sh
git pull --ff-only
sh scripts/deploy-instabox.sh
docker compose -p birth ps
curl -f http://127.0.0.1:8086/api/health
```

换端口可设 `BIRTH_PORT=8087`。升级前备份数据库和旧提交；不要执行 `docker compose down -v`，它会删除公共纪念馆数据。操作与恢复见 [运维说明](docs/OPERATIONS.md)。刷新页面后运行新规则；同域名的浏览器旧存档会保留。

## 数据与验证

```sh
node scripts/refresh-data.mjs 2023
node scripts/refresh-eras.mjs
node scripts/refresh-mortality.mjs
npm test
npm run build
```

更新数据会影响种子映射，发布前检查差异与署名。历史模式用今日地区名称展示有覆盖的历史统计，不重建历史国界。

可选浏览器验收，先运行本地服务：

```sh
python -m pip install playwright
python -m playwright install chromium
python tests/browser_town.py
python tests/browser_smoke.py
python tests/browser_deep.py
python tests/browser_edges.py
python tests/browser_presentation.py
python tests/browser_compare.py
python tests/browser_feel.py
python tests/browser_bulk.py
```

`BIRTH_TEST_URL` 指定站点，`CHROMIUM_PATH` 指定浏览器，`BIRTH_TEST_OUTPUT` 指定截图目录。深度测试会短暂发布一段注明测试用途的虚构摘要，成功后撤回；基础测试只写独立浏览器上下文。请使用测试环境或自行拥有的部署。

代码采用 MIT 许可，外部数据适用其原始许可。凭据、私人档案和 SQLite 数据不进入仓库。
