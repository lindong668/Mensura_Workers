# 6号 · Mensura — saoo.me（根域）· Cloudflare Workers 版 · K7

> **一眼识别卡**
> | 项 | 值 |
> |---|---|
> | 站名 | **Mensura**（精密测量与计算工具） |
> | 域名 | **https://saoo.me**（根域；注意是 `saoo` 两个 o） |
> | Worker 名 | `mensura-workers` |
> | 形态 | **Cloudflare Workers + Assets**（非 Pages / 非 GitHub Pages） |
> | 本包版本 | **K7** = K6 + 联系邮箱统一为 yokok8@outlook.com（并补 mailto 链接） |
> | 生成日期 | 2026-10-27 |
> | 页面数 | 31 页（20 工具 + 4 分类 + 6 静态页 + 首页） |

---

> 生成日期：2026-10-26
> 部署形态：**Cloudflare Workers + Assets**（不是 GitHub Pages，不是 CF Pages）
> ★ 用途：作为 **saoo.me 根域**提交 AdSense 审核的载体

---

## 0. ★ 为什么换成 Workers 版

之前走 GitHub Pages 遇到两件事：

```
① Custom domain 填 saoo.me → 报「已被占用」
   真实原因：同一个仓库的 Pages 上还挂着旧域 596.us.ci，
            GitHub 认为域名仍被占用 → 必须先删掉 596 的 DNS 才能绑新的
② GitHub Pages 需要：域名验证 + 4 条 A 记录（灰云）+ 等证书签发
   环节多、等待久
```

**Workers 版直接绕开这些**：saoo.me 已经托管在 CF，用 routes 绑定即可，
不需要 GitHub 域名验证、不需要 A 记录、不需要等 GitHub 签证书。

```
★ I3（CF Pages 版）作废，改用本包 K1。
```

---

## 1. 站点信息

| 项 | 值 |
|---|---|
| 域名 | https://saoo.me（**根域**） |
| Worker 名称 | `mensura-saoo` |
| 部署形态 | Cloudflare Workers + Assets |
| 静态文件 | 43 个（20 工具 + 4 分类 + 6 静态页 + 404） |
| sitemap | 31 条 URL，已内联进 Worker（lastmod 2026-10-26） |
| 域名残留 | bbroot 0 / 596.us.ci 0 / saoo.me 265 处 ✅ |

---

## 2. 部署步骤

### 方式一：网页上传（推荐，你一直在用）

```
CF 控制台 → Workers 和 Pages → 创建 → Workers → 上传资产
→ 上传 public/ + src/ + wrangler.toml
→ Worker 名填：mensura-saoo
→ 部署
```

routes 已写在 `wrangler.toml` 里（`saoo.me/*`），部署后自动绑定，
**不需要手动去「域和路由」添加**。

若 CF 提示「域名缺少 DNS 记录」，按它的提示**自动添加**即可
（通常是 AAAA `100::` 代理记录），这是 routes 模式的正常要求。

### 方式二：命令行

```
npx wrangler deploy
```

---

## 3. ★ 部署前置

```
① saoo.me 已托管到 Cloudflare（NS 已改）        ✅ 已完成
② SSL/TLS → 边缘证书 → Universal SSL 状态「有效」
   新接入域名等几分钟到几小时，证书没生效就部署会报 SSL 错误
```

⚠️ **如果之前为 GitHub Pages 加过 A 记录（185.199.x.x）**
   —— 去 CF DNS 里删掉它们，会和 Workers 路由冲突。

---

## 3.5 ★ 关于「每天 10 万请求」额度

Workers 免费版确实有「每天 10 万请求」上限（UTC 0 点重置，超限返回 Error 1027）。
**但本站基本不会碰到**，因为计费规则是这样的：

```
请求能匹配到静态文件（HTML / CSS / JS / 图片）
  → 直接由静态资源返回，不 invoke Worker
  → 免费、不限量、不计入 10 万额度 ✅

请求匹配不到静态文件（404、无扩展名路径、三个 SEO 文件）
  → 才 invoke Worker
  → 计入 10 万额度
```

本站 99% 以上的流量都是页面和静态资源，走的是第一条，**不占额度**。
只有 ads.txt / robots.txt / sitemap.xml 这三个因为配了 `run_worker_first`
让 Worker 接管，会占额度 —— 但那是 Google / AdSense 偶尔抓一次，
一天几十次顶天，相对 10 万可以忽略。

**结论**：就算这站每天几千人访问，也用不到额度的零头。
真到流量起来了，$5/月的 Workers Paid 就没有请求数上限了。

---

## 4. ★★★ Worker 里已硬编码的三个 SEO 文件

这是本方案最大的好处：**不依赖静态上传、不受边缘缓存影响、Content-Type 钉死**。

```
/ads.txt      → text/plain    含 pub-8915931557404979
/robots.txt   → text/plain    含 Mediapartners-Google 放行
/sitemap.xml  → application/xml   31 条 URL 内联
```

**为什么这么做**（5 号站 D19 已验证的血泪教训）：

```
纯静态时，静态文件若未真正部署（404），
src.text() 会拿到 404 错误页的 HTML，
再贴上 application/xml 吐给 Google
= 标着 XML 的 HTML = 解析失败 = GSC「无法抓取」

ads.txt 同理：Content-Type 一旦被猜成 text/html
→ AdSense 判定「ads.txt 无效 / 找不到」→ 审核卡住
```

内联后这三个文件**永远正确**，直接绕开整类问题。

---

## 5. ★★★ 部署后必做的两条 CF 配置

### 5.1 ads.txt 不要开「缓存所有内容」

```
❌ 不要配：页面规则 / Cache Rules → ads.txt → Cache Everything
```

**原因**：Cache Everything 会把 **404 也缓存住**。
某次抖动返回一次 404 被缓存，Google 来抓拿到 404 →
AdSense 从「已授权」变「未找到」，而自己浏览器访问却是正常的。

⚠️ 本包 ads.txt 已由 Worker 硬编码返回，
**但仍不要在 CF 层给它配 Cache Everything**，避免缓存层叠加干扰。

```
建议：Caching → Cache Rules → URI Path equals /ads.txt → Bypass cache
```

### 5.2 放行 Google 爬虫（防 WAF / Bot Fight 误拦）

```
Security → Security Rules → 创建规则
  名称：Allow Google verification
  条件（Or 连接）：
    URI Path equals /ads.txt
    Or URI Path equals /robots.txt
    Or User Agent contains Mediapartners-Google
    Or User Agent contains AdsBot-Google
    Or User Agent contains Googlebot
  动作：Skip
  勾选：☑ All managed rules
        ☑ All Super Bot Fight Mode Rules
        ☑ All rate limiting rules
```

再确认全局安全级别：
```
Security → Settings → Security Level → 必须是 Medium 或 Low
（High / "I'm under attack" 会弹 JS 挑战，Googlebot 直接跪）
```

---

## 6. 验收清单

部署完成后逐条验（手机浏览器无痕模式）：

```
https://saoo.me/                        首页正常显示工具目录
https://saoo.me/robots.txt              含 Mediapartners-Google Allow: /
https://saoo.me/ads.txt                 google.com, pub-8915931557404979, DIRECT, ...
https://saoo.me/sitemap.xml             31 条 URL，全为 saoo.me
https://saoo.me/google6474e28bb6098302.html   显示验证串（GSC 前缀验证用）
https://saoo.me/tools/length-converter.html   工具页能实际计算 ★
https://www.saoo.me/                    301 跳到 https://saoo.me/
```

★ **工具页必须能真的算** —— 这是 AdSense 审核最加分的一点。
务必抽查 2~3 个（length-converter / percentage-calculator / age-calculator）。

---

## 7. 关于 www.saoo.me 跳转（★ K2 已改：不再写在 Worker 里）

### K2 变更：Worker 里的 www 301 已删除

```
K1：src/index.js 里写了 www.saoo.me → saoo.me 的 301
K2：已删除 ❌
```

**为什么删**：Workers + Assets 默认是「静态资源优先」。
访问 `https://www.saoo.me/` 时，路径 `/` 匹配到静态 `index.html`，
**Worker 根本不会执行** → 跳转是死代码，页面直接 200 返回内容。

更糟的是：如果只加 DNS 让 www 能访问而不跳转，
`saoo.me` 和 `www.saoo.me` 会同时打开相同内容 →
Google 视为两个站、两份重复内容 → 双份索引、权重分散。

### ★ 现在要 www 跳转，请用 CF Redirect Rules（不走 Worker，不占额度）

```
CF → 域名 saoo.me → Rules → Redirect Rules → 创建规则

名称：www to apex
自定义过滤表达式：
    http.host eq "www.saoo.me"
Then：
    类型：动态
    表达式：wildcard("https://www.saoo.me/*")
    目标 URL：https://saoo.me/${1}
    状态码：301
保留查询字符串：开
→ 部署
```

**生效前提（两条都要）**：

```
① DNS 有 www 记录
   CF → DNS → CNAME，名称 www，目标 saoo.me，代理状态【橙云】
② Workers → mensura-saoo → 域和路由 → 添加路由 www.saoo.me/*
```

### 不做也完全可以（推荐）

```
DNS 里不放 www 记录 → www.saoo.me 解析不了
→ 全网只有 saoo.me 一个入口，无重复内容风险
→ 什么都不用做，最干净
```

---

## 8. 旧域 596.us.ci 的处理

现状：你已把 596.us.ci 的 DNS 删掉 → 该域目前**完全悬空、打不开**。

```
A：不管它
   → Google 陆续抓 404，几周后索引清掉
   → 旧收录作废

B：抢救（推荐）
   → 部署 301跳转项目_596.us.ci到saoo.me_CFPages专用.zip
   → CF Pages 自定义域填 596.us.ci，按提示加 DNS
   → 旧收录的访客直接进新站，权重转移
```

顺序（不可颠倒）：
```
① saoo.me 部署本包并验收全绿
② 再部署 596 的 301 跳转
③ 再 AdSense 提交 saoo.me（撤掉 596 的申请）
```

---

## 9. 提交 AdSense 审核

```
AdSense → 网站 → 添加网站 → 填：saoo.me（裸域，不带 www）
→ 等待审核（全新根域 2~4 周）
```

⚠️ 提交后**不要再改 ads.txt** —— 每改一次重抓等待周期重置。

**根域通过后**：home.saoo.me（房贷站 D19）及后续 pic / oil / unit 子域
**自动获得投放资格，永久免审**。

---

## 10. 文件结构

```
wrangler.toml      部署配置（name = mensura-saoo, routes = saoo.me/*）
src/index.js       Worker 入口（www 跳转 + 三个 SEO 文件硬编码 + 404 兜底）
package.json
public/            静态资源（43 个文件）
  ├ index.html            首页（工具目录）
  ├ 404.html
  ├ google6474e28bb6098302.html   Google 站点验证文件
  ├ robots.txt / sitemap.xml / ads.txt   （Worker 会硬拦截，静态层为双保险）
  ├ _headers              静态层 MIME 兜底
  ├ category/             4 个分类页
  ├ tools/                20 个工具页
  ├ pages/                about / contact / privacy / terms / disclaimer / methodology
  └ assets/               css + js + img
```

---

## 11. 与其他包的关系

```
本包 K1     saoo.me 根域 Mensura（Workers）   ← ★ 现役，提交审核用
D19         home.saoo.me 房贷站（Workers）     ← 已部署，等根域过审后沾光
【作废】I3  saoo.me 根域 CF Pages 版          ← 已弃用，勿用
【作废】C18 saoo.me 根域导航站                 ← 已弃用，勿用
（待做）    pic.saoo.me / oil.saoo.me / unit.saoo.me
```

---

## 12. 补充（2026-10-26 14:45）：部署目录层级已验证正确

### 实测结论（用户确认）
```
✅ https://saoo.me/ads.txt        能打开
✅ https://saoo.me/robots.txt     能打开
✅ https://saoo.me/sitemap.xml    能打开
✅ https://saoo.me/               能打开

❌ https://saoo.me/public/ads.txt  打不开（符合预期）
   → 说明部署时上传的是 public/ 【里面】的内容，层级正确
   → 资产根目录 = index.html / ads.txt / robots.txt / sitemap.xml 平铺
```

**不要再怀疑目录层级问题，这一项已排除。**

### ★ 下一步验证重点：Content-Type

「能打开」还不够，AdSense 审核看的是 **Content-Type 必须正确**：

```
/ads.txt     必须是 text/plain
/robots.txt  必须是 text/plain
/sitemap.xml 必须是 application/xml（或 text/xml）
```

如果 Content-Type 被返回成 text/html 或 application/json，
AdSense / GSC 会判定「ads.txt 无效 / 无法抓取」，审核照样卡住。

**验证方法（推荐用 GSC，看的是 Google 视角的真实结果）：**
```
GSC → 网址检查 → 输入 https://saoo.me/ads.txt
→ 查看「被测试的网页」→ 响应标头 → Content-Type
```

**或本地浏览器：**
```
Chrome DevTools → Network → 访问 /ads.txt → 点该请求
→ Response Headers → Content-Type
```

### ★ 若 Content-Type 不对

说明 run_worker_first 没生效（Worker 没接管、走了静态层），
按顺序查：

```
① wrangler.toml 里 run_worker_first 是否在 [assets] 段内
   （放在 [observability] 后面就无效）
② 部署时是否上传了 wrangler.toml
   （网页上传方式可能只用界面配置，不读 toml）
③ 若网页上传不读 toml，手动在 CF 控制台确认：
   Workers → mensura-saoo → 设置 → 确认 Assets 配置
```

兜底方案：静态层 _headers 已配了这三个文件的 MIME，
即使 Worker 不接管，静态层也能给出正确 Content-Type。
（所以本方案是双保险，两层都配了）

---

## 13. 版本变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| K1 | 2026-10-26 | 首个 Workers 版（由 CF Pages 版 I3 改） |
| K2 | 2026-10-26 | ① 32 个页面加防主题闪烁脚本<br>② 删除 Worker 里的 www 301（改由 CF Redirect Rules 处理） |
| **K3** | **2026-10-26** | **① 修复立方英尺系数差 1000 倍的 bug<br>② CSS 加 @media 兜底，彻底解决首屏闪黑<br>③ 全部换算系数与国际定义逐项比对 |

**★ 当前最新版：K3**
