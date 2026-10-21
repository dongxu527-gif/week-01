# 中安安防 · 校园安全工具站

## 线上地址

- 首页：https://week-01-steel.vercel.app/
- 报价：https://week-01-steel.vercel.app/quote.html
- 方案：https://week-01-steel.vercel.app/proposal.html
- 台账：https://week-01-steel.vercel.app/inspection.html
- 知识库：https://week-01-steel.vercel.app/knowledge.html
- 后台：https://week-01-steel.vercel.app/admin.html
- 运行手册：https://week-01-steel.vercel.app/runbook.html
- 结业证书：https://week-01-steel.vercel.app/graduation.html

## 技术结构

- 前端：原生 HTML / CSS / JavaScript，部署在 Vercel
- 数据库：Supabase Postgres + Auth + RLS
- AI：DeepSeek API，通过 Vercel Serverless Function 调用
- 版本管理：GitHub `dongxu527-gif/week-01`

## 环境变量

Vercel → Settings → Environment Variables：

| Key | 用途 |
|---|---|
| `DEEPSEEK_API_KEY` | 方案生成、知识库问答 |

Supabase 的 publishable key 在前端 `supabase-config.js` 里，这是公开 key，不是 service_role key。

## 数据表

| 表 | 用途 |
|---|---|
| `inspection_records` | 巡检台账 |
| `knowledge_documents` | 知识库文档 |
| `profiles` | 用户角色（admin / inspector） |
| `schools` | 学校 / 项目列表 |

所有表都开启了 RLS。`schools` 和 `profiles` 的写操作只允许 admin。

## 部署

```bash
git add .
git commit -m "描述这次改了什么"
git push
```

Vercel 会自动重新部署。部署状态可以在 GitHub commit 右侧或 Vercel Deployments 里看。

## 备份

- 台账页：导出 CSV、备份 JSON
- 知识库页：导出全部（JSON）
- 重要资料每两周在本地留一份，不要只依赖平台

## 本地预览

```bash
cd ~/Desktop/ai-learning/week-01
python3 -m http.server 8765
```

打开 http://127.0.0.1:8765/

## 安全

- 不把 `service_role` key 写进前端
- 不把学生个人信息、家长电话放进知识库
- 生成内容必须人工审核后再发给客户
- 成员离职后，在 Supabase Authentication 里禁用账号
