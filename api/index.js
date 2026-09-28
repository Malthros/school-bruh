export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  let targetUrl = url.searchParams.get('url');

  // Direct shortcuts for common search terms
  const shortcuts = {
    'youtube': 'https://www.youtube.com',
    'yt': 'https://www.youtube.com',
    'google': 'https://www.google.com',
    'roblox': 'https://www.roblox.com',
    'reddit': 'https://www.reddit.com',
    'discord': 'https://discord.com',
    'github': 'https://github.com',
    'wikipedia': 'https://en.wikipedia.org',
    'wiki': 'https://en.wikipedia.org',
    'twitter': 'https://twitter.com',
    'x': 'https://x.com',
    'twitch': 'https://www.twitch.tv',
    'tiktok': 'https://www.tiktok.com',
    'instagram': 'https://www.instagram.com',
    'spotify': 'https://open.spotify.com'
  };

  // If input is a search term without a domain
  if (targetUrl && !targetUrl.includes('.') && !targetUrl.startsWith('http')) {
    const cleanQuery = targetUrl.trim().toLowerCase();
    
    if (shortcuts[cleanQuery]) {
      targetUrl = shortcuts[cleanQuery];
    } else {
      targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(targetUrl)}`;
    }
  }

  // Serve homepage if no URL parameter is provided
  if (!targetUrl) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cloud Web Proxy</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; margin: 0; padding: 80px 20px; background: #0f172a; color: white; }
          h1 { font-size: 2.2rem; margin-bottom: 24px; }
          form { display: flex; justify-content: center; gap: 8px; max-width: 500px; margin: 0 auto; }
          input { flex: 1; padding: 14px; font-size: 16px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: white; outline: none; }
          button { padding: 14px 24px; font-size: 16px; border-radius: 8px; background: #3b82f6; color: white; border: none; font-weight: bold; cursor: pointer; }
          button:hover { background: #2563eb; }
          p { color: #94a3b8; font-size: 14px; margin-top: 24px; }
          .tags { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 16px; }
          .tag { background: #1e293b; color: #60a5fa; padding: 8px 14px; border-radius: 20px; text-decoration: none; font-size: 14px; border: 1px solid #334155; }
        </style>
      </head>
      <body>
        <h1>Web Proxy Project</h1>
        <form action="/" method="GET">
          <input type="text" name="url" placeholder="Search or enter URL (e.g. youtube)..." required />
          <button type="submit">Go</button>
        </form>
        <p>Quick Shortcuts:</p>
        <div class="tags">
          <a class="tag" href="/?url=youtube">YouTube</a>
          <a class="tag" href="/?url=wikipedia">Wikipedia</a>
          <a class="tag" href="/?url=github">GitHub</a>
          <a class="tag" href="/?url=reddit">Reddit</a>
        </div>
      </body>
      </html>
    `);
  }

  try {
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const targetObj = new URL(targetUrl);

    const response = await fetch(targetObj.href, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      let html = await response.text();
      const proxyBase = `https://${req.headers.host}/`;

      // Rewrite links
      html = html.replace(/href=["']([^"']+)["']/g, (match, p1) => {
        if (p1.startsWith('#') || p1.startsWith('javascript:')) return match;
        try {
          const abs = new URL(p1, targetObj.href).href;
          return `href="${proxyBase}?url=${encodeURIComponent(abs)}"`;
        } catch (e) { return match; }
      });

      // Rewrite form actions
      html = html.replace(/action=["']([^"']+)["']/g, (match, p1) => {
        try {
          const abs = new URL(p1, targetObj.href).href;
          return `action="${proxyBase}?url=${encodeURIComponent(abs)}"`;
        } catch (e) { return match; }
      });

      // Inject navigation bar on top
      const navBarHtml = `
        <div id="proxy-top-bar" style="position:fixed;top:0;left:0;width:100%;height:45px;background:#0f172a;color:white;z-index:2147483647;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.5);font-family:sans-serif;margin:0;padding:0;">
          <form action="${proxyBase}" method="GET" style="display:flex;gap:8px;width:90%;max-width:800px;margin:0;padding:0 10px;">
            <input type="text" name="url" value="${targetObj.href}" placeholder="Search or type URL..." style="flex:1;padding:6px 12px;border-radius:4px;border:1px solid #334155;background:#1e293b;color:white;font-size:13px;" required />
            <button type="submit" style="padding:6px 14px;border-radius:4px;background:#3b82f6;color:white;border:none;cursor:pointer;font-weight:bold;font-size:13px;">Go</button>
          </form>
        </div>
        <div style="height:45px;width:100%;display:block;"></div>
      `;

      if (html.includes('<body')) {
        html = html.replace(/<body[^>]*>/i, (match) => `${match}${navBarHtml}`);
      } else {
        html = navBarHtml + html;
      }

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    return res.status(response.status).send(Buffer.from(buffer));

  } catch (err) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <div style="font-family:sans-serif;padding:40px;text-align:center;background:#0f172a;color:white;min-height:100vh;">
        <h2>Unable to load site</h2>
        <p style="color:#f87171;">Error: ${err.message}</p>
        <a href="/" style="color:#60a5fa;font-weight:bold;">← Back to Proxy Home</a>
      </div>
    `);
  }
}
