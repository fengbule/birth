# 八十亿分之一 · BIRTH

如果人生，再来一次。可自行部署的中文人生模拟游戏，玩法灵感来自 [1 in 8 Billion](https://1in8b.life/en/)，以独立代码实现。

**[在线体验](https://8086-agqv47q5at4mzg6nr336pvg33u.instabox.tech)** · [深入玩法](docs/GAMEPLAY.md) · [数据与署名](DATA-SOURCES.md) · [验收记录](docs/VERIFICATION.md) · [原站差异审计](docs/PARITY-AUDIT.md)

v5.1 补齐抉择卡浮入与选项渐显，保留时间线节点，避免年份更新时整页闪换。正常动画与减少动态分别测试，详见 [过渡实测](docs/MOTION-COMPARISON.md)。

v5.0 恢复原站公开页面的连续时间线：同一岁内的事件分次出现，最新记录排在上面，抉择暂时中断时间，选择后继续。桌面为身份、经历、家庭三栏，手机依次显示场景、简要状态、记录、重心及个人资料。撤下 v4 小镇活动与逐段「继续」流程。

本轮实测参考站 v0.8.40。当前已修正可见的时间流程和主要布局，但事件库、随机概率、生命表与美术仍有差异，**尚未通过 1:1 等价验收**。测试通过只表示本项目的受测行为正确，详细观察与差异见 [本轮对照](docs/TIMELINE-COMPARISON.md)。

## 玩法

- 今日起点覆盖原站公开国家表的 172 个国家和地区；使用公开页面显示的人口、出生占比、男女预期寿命及经济社会指标，保留其四舍五入精度与来源。历史 1970 / 1990 / 2010 和 2050 游戏情景仍使用原有独立数据模型。
- 两岁四项气质选择、七岁从三个具体兴趣中选择；十二岁继续学业，之后的高中、大学、专业、工作、关系与家庭依年龄及本局经历展开。同年可以接连遇到多个抉择。
- 一年内的事件按时间逐次揭示，刷新、暂停、倍速切换会保留年内进度；记录最新在前，点选可加星。初生时只显示出生记录。
- 30 / 60 / 90 分钟、六档倍速、快转到下个抉择和自动模式。自动代选先预览约三秒，可手动接管；收起未决卡片会停在当下。默认开启 5 / 15 / 30 / 50 / 70 岁私人停顿。
- 六岁起安排年度重心、使用零花钱；成年后消费、培训、职业、投资与迁居。金额以中国大陆物价换算成人民币；消费面板打开时冻结年份，购买后继续留在面板。
- 出生登记、家乡比较、原创像素生活场景、四位同行者、家人资料、年格与存活曲线；分幕结尾、双击确认跳过、死亡纪录、重播和浏览器档案。
- 公共纪念馆使用独立 SQLite：结束后预览并自愿公开虚构摘要，可点灯、留言及凭本机管理凭证撤回。不与原站账户、支付或服务互通。

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

换端口可设 `BIRTH_PORT=8087`。升级前备份数据库和旧提交；不要执行 `docker compose down -v`，它会删除公共纪念馆数据。操作与恢复见 [运维说明](docs/OPERATIONS.md)。刷新后新开一局使用 v5 事件流程；同域名旧存档保留进度和原有规则。

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
python tests/browser_presentation.py
python tests/browser_compare.py
python tests/browser_timeline_compare.py
python tests/browser_feel.py
python tests/browser_motion.py
python tests/browser_bulk.py
```

`BIRTH_TEST_URL` 指定站点，`CHROMIUM_PATH` 指定浏览器，`BIRTH_TEST_OUTPUT` 指定截图目录。上列时间线脚本只写独立浏览器上下文。旧版深度 API 脚本会短暂发布测试摘要并撤回。请使用测试环境或自行拥有的部署。

代码采用 MIT 许可，外部数据适用其原始许可。凭据、私人档案和 SQLite 数据不进入仓库。
