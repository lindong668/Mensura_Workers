/**
 * 6号 Mensura（saoo.me 根域）—— Cloudflare Workers + Assets
 *
 * ★ 为什么用 Workers 而不是纯静态 / GitHub Pages：
 *   1) ads.txt / robots.txt / sitemap.xml 三个关键 SEO 文件由 Worker 层
 *      直接返回，Content-Type 钉死，不受静态资源 MIME 猜测与中间层干扰，
 *      杜绝 GSC「无法抓取 / 类型未知」与 AdSense「ads.txt 找不到」。
 *   2) 域名已在 Cloudflare，routes 方式直接绑定，
 *      不需要 GitHub Pages 的域名验证 / A 记录 / 证书签发那一套。
 *
 * ★ 与 5 号房贷站 D19 同构，已验证机制可靠。
 */

/* ── ads.txt 硬编码 ──
 * AdSense 抓取器对 Content-Type 极严格，必须是 text/plain。
 * 一旦被猜成 text/html 就判定「ads.txt 无效」，审核直接卡住。 */
const ADS_TXT = "google.com, pub-8915931557404979, DIRECT, f08c47fec0942fa0\n";

/* ── robots.txt 硬编码 ──
 * 含 Mediapartners-Google（AdSense 专用爬虫）显式放行。 */
const ROBOTS_TXT = "User-agent: *\nAllow: /\n\n# Google's AdSense crawler — ensure it can reach ad-bearing pages\nUser-agent: Mediapartners-Google\nAllow: /\n\n# Explicitly welcome major crawlers\nUser-agent: Googlebot\nAllow: /\n\nUser-agent: Bingbot\nAllow: /\n\nSitemap: https://saoo.me/sitemap.xml\n";

/* ── sitemap.xml 硬编码 ──
 * 不读 ASSETS、不依赖静态上传、不受边缘缓存影响。
 * 静态文件若未真正部署（404），src.text() 会拿到 404 错误页的 HTML，
 * 再贴 application/xml 吐给 Google = 标着 XML 的 HTML = 解析失败。 */
const SITEMAP_XML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n  <url>\n    <loc>https://saoo.me/</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/category/date-time.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/category/developer.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/category/math.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/category/unit-converters.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/age-calculator.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/area-converter.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/average-calculator.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/base64-tool.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/cooking-converter.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/data-storage-converter.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/date-duration-calculator.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/fraction-calculator.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/fuel-economy-converter.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/gcd-lcm-calculator.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/length-converter.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/percentage-calculator.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/shoe-size-converter.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/speed-converter.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/temperature-converter.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/unix-timestamp-converter.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/url-encoder.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/volume-converter.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/weight-converter.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/tools/word-counter.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/pages/about.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/pages/contact.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/pages/disclaimer.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/pages/methodology.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/pages/privacy.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>\n  <url>\n    <loc>https://saoo.me/pages/terms.html</loc>\n    <lastmod>2026-10-26</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>\n</urlset>\n";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const pathname = url.pathname;

    /* ★★ K4 新增：www → apex 全路径 301（与 1 号 V25 同构）
     * 放在所有拦截【之前】，www 的任意路径一律 301，无例外。
     */
    if (url.hostname === 'www.saoo.me') {
      return Response.redirect('https://saoo.me' + url.pathname + url.search, 301);
    }

    if (pathname === '/ads.txt') {
      return new Response(ADS_TXT, {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=3600',
        },
      });
    }

    if (pathname === '/robots.txt') {
      return new Response(ROBOTS_TXT, {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=3600',
        },
      });
    }

    if (pathname === '/sitemap.xml') {
      return new Response(SITEMAP_XML, {
        status: 200,
        headers: {
          'content-type': 'application/xml; charset=utf-8',
          'cache-control': 'public, max-age=3600',
        },
      });
    }

    /* 无扩展名路径补 .html（如 /about → /pages/about.html）
     *
     * ⚠️ 只对 GET/HEAD 做：new Request(url, request) 会复用原请求 body 流，
     *    之后再 env.ASSETS.fetch(request) 会抛
     *    "Cannot reconstruct a Request with a used body." */
    const isNav = request.method === 'GET' || request.method === 'HEAD';
    const noExt = !/\.[a-zA-Z0-9]+$/.test(pathname);

    if (isNav && noExt && pathname !== '/' && !pathname.endsWith('/')) {
      // 依次探测：根目录 → pages/ 目录
      for (const candidate of [pathname + '.html', '/pages' + pathname + '.html']) {
        const probe = await env.ASSETS.fetch(
          new Request(url.origin + candidate, request.clone())
        );
        if (probe.status === 200) {
          return Response.redirect(url.origin + candidate + url.search, 301);
        }
      }
    }

    const res = await env.ASSETS.fetch(request);

    // 404 兜底
    if (res.status === 404) {
      return new Response(
        '<!doctype html><meta charset="utf-8"><title>页面不存在</title>' +
          '<div style="font-family:system-ui;max-width:560px;margin:15vh auto;text-align:center">' +
          '<h1 style="font-size:22px">页面不存在</h1>' +
          '<p style="color:#64748b">你访问的页面已移动或从未存在。</p>' +
          '<a href="/" style="color:#2563eb">返回首页</a></div>',
        { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }

    return res;
  },
};
