# 运维说明

生产目录 `/data/workspace/birth`，Compose 项目 `birth`，公开入口由 Instabox 的 8086 端口发布提供。不要修改同机其他项目。

## 日常检查

```sh
cd /data/workspace/birth
docker compose -p birth ps
curl -fsS http://127.0.0.1:8086/api/health
curl -fsS http://127.0.0.1:8086/version.json
docker compose -p birth logs --tail 50 api
```

API 使用 Node.js 24 内置 `node:sqlite`，数据库启用 WAL、外键和忙等待。公开摘要、烛光与留言位于 `birth_birth-data` 卷；完整存档只在用户浏览器，不在该卷。

## 一致性备份

在服务运行时使用 SQLite `VACUUM INTO`，避免单独复制活动数据库而遗漏 WAL：

```sh
cd /data/workspace/birth
mkdir -p /data/backups/birth
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose -p birth exec -T api node /app/scripts/backup.mjs "/tmp/birth-$stamp.sqlite"
docker compose -p birth cp "api:/tmp/birth-$stamp.sqlite" "/data/backups/birth/birth-$stamp.sqlite"
docker compose -p birth exec -T api rm "/tmp/birth-$stamp.sqlite"
```

备份含公开内容，保存在项目外，按需要保留并复制到独立存储。本仓库提供手动备份命令，不默认设置定时任务。发布者管理凭证只有浏览器持有，服务器存哈希；备份无法恢复丢失的凭证。

## 从备份恢复

先确认备份路径和目标环境，并保留当前一致性备份。恢复会将公共纪念馆回到备份时刻。

```sh
docker compose -p birth stop web api
docker run --rm --user 0 -v birth_birth-data:/restore -v /data/backups/birth:/backups:ro node:24-alpine sh -c 'cp /backups/REPLACE_WITH_BACKUP.sqlite /restore/birth.sqlite && rm -f /restore/birth.sqlite-wal /restore/birth.sqlite-shm && chown 1000:1000 /restore/birth.sqlite'
docker compose -p birth up -d --wait
curl -fsS http://127.0.0.1:8086/api/health
```

执行前将占位文件名替换为实际备份。不要删卷，也不要对运行中的数据库直接覆盖。

## 更新与回退

升级前记录 `git rev-parse HEAD`，备份数据库及 `dist/`，确认工作区干净。然后 `git pull --ff-only && sh scripts/deploy-instabox.sh`。失败时检查日志，恢复到保留的已知正常代码和静态资源；如涉及数据库结构变更，还需对应的备份。v2 初次增加独立 SQLite 卷，不迁移或上传任何 v1 私人存档。

## 公开接口边界

没有账户。发布返回随机撤回凭证，数据库仅存其哈希；访问者标识 Cookie 为 HttpOnly、SameSite，按 UTC 每天每段纪念限一盏烛光。写接口校验来源、大小、字段和频率，文本经转义显示。应用不保存访客 IP 到数据库，内存中按 IP 哈希限流；平台或 Nginx 可能有普通访问日志。

如果出现不合适的公开内容，管理员可在备份后，通过 SQLite 按已核实的纪念 ID 删除该记录，关联烛光和留言由外键级联删除。当前没有账户审核或举报队列。
