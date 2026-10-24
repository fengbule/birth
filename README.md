# 八十亿分之一 · BIRTH

如果人生，再来一次。一个可以自行部署的中文人生模拟游戏，灵感来自 [1 in 8 Billion](https://1in8b.life/en/)，以独立代码实现。

**在线体验：[打开八十亿分之一](https://8086-agqv47q5at4mzg6nr336pvg33u.instabox.tech)**

按全球出生人数或现有人口抽取出生地，在另一个家庭开始，从童年走到暮年。以公开统计作为起点，用选择续写虚构的人生。

## 已实现

- 217 个国家和地区，世界银行 WDI 2023 年人口、粗出生率、寿命、PPP 数据；人口与出生人数两种抽样。
- 家庭、身份、同秒出生的四位同行者；教育、职业、住房、伴侣、孩子、退休与晚年选择。
- 健康、快乐、知识、关系、收入与积蓄；每年可调整专注方向。
- 5 / 15 / 30 分钟节奏，暂停，1× / 4× / 16×，下一年、下个选择和自动模式。
- 本地自动存档，最多 50 段人生，未完人生可恢复；JSON 导入导出、收藏瞬间、纪念留言、PNG 人生卡片、出生种子分享。
- 响应式界面、浅深色模式、可选 Web Audio 环境和弦，浏览器减少动态效果偏好。
- 所有静态数据随站点提供，访客无需登录，不上传进度、不使用第三方分析。

不是原站的完整镜像：无公共纪念馆、付款、账户、多人共享后台、历史未来世界或原站的全部事件系统。寿命与经济模型是简化游戏规则，不是个人命运或当地工资预测。详见 [DATA-SOURCES.md](DATA-SOURCES.md)。

## 本地运行

需要 Node.js 22+，无 npm 依赖。

```sh
npm run dev
# http://127.0.0.1:4173
npm test
npm run build
```

构建将 `public/` 复制到 `dist/`，附带 `version.json` 内容摘要。可部署到任意静态 HTTP 服务的根路径。生产环境使用 HTTPS 以获得完整分享与剪贴板能力。

## Instabox 部署

需要 Node.js、Docker Compose、curl、`instabox-port`。在 Instabox 上运行：

```sh
cd /data/workspace
git clone https://github.com/fengbule/birth.git
cd birth
sh scripts/deploy-instabox.sh
```

服务独立使用 Compose 项目名 `birth`，容器只读，绑定 `127.0.0.1:8086`；平台提供 HTTPS 公网入口。也可使用 `BIRTH_PORT=8087 sh scripts/deploy-instabox.sh` 指定空闲端口。脚本会构建、检查配置、等待健康，再发布端口。更新前保留旧提交以便回退：

```sh
git pull --ff-only
sh scripts/deploy-instabox.sh
docker compose -p birth ps
curl -f http://127.0.0.1:8086/healthz
```

服务端不存放玩家档案，更新静态文件不会改变同一域名下的浏览器进度。换域名或清理站点数据前，请在「我的人生」导出 JSON。为避免新旧规则混用，更新后刷新页面。

## 数据更新与验证

```sh
node scripts/refresh-data.mjs 2023
npm test
npm run build
```

更新脚本只写公开统计与地图。改变覆盖地区会影响种子到身份的映射，发布前应检查数据差异、同步署名文档。固定数据与规则下，分享种子可复现相同起点，后续选择由各自决定。

Node 测试覆盖抽样分布、确定性出生、选择暂停、教育与住房经济影响、导入校验、全部选项，以及 1,000 段完整人生的状态与结束条件。浏览器验收记录见 [docs/VERIFICATION.md](docs/VERIFICATION.md)。

可选浏览器验收（另开终端运行 `npm run dev`）：

```sh
python -m pip install playwright
python -m playwright install chromium
python tests/browser_smoke.py
```

通过 `BIRTH_TEST_URL` 测试已部署站点，`CHROMIUM_PATH` 指定已有 Chromium，`BIRTH_TEST_OUTPUT` 指定输出目录（默认 `test-results/`，已忽略）。测试使用独立浏览器上下文，产生的虚构人生不会写入服务器。

代码采用 MIT 许可；外部数据分别适用其原始许可。服务器令牌、SSH 密钥、玩家存档与部署凭据不属于代码仓库。
