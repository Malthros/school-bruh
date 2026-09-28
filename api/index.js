export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  let targetUrl = url.searchParams.get('url');

  // If the input is plain text (not a URL), automatically treat it as a Bing search query
  if (targetUrl && !targetUrl.includes('.') && !targetUrl.startsWith('http')) {
    targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(targetUrl)}`;
  }

  // Serve Homepage if no URL parameter is provided
  if (!targetUrl) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cloud Web Proxy</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; margin-top: 80px; background: #0f172a; color: white; }
          input { width: 380px; padding: 12px; font-size: 16px; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: white; }
          button { padding: 12px 24px; font-size: 16px; border-radius: 6px; background: #3b82f6; color: white; border: none; cursor: pointer; }
          p { color: #94a3b8; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Web Proxy Project</h1>
        <form action="/" method="GET">
          <input type="text" name="url" placeholder="Type a search query or website URL..." required />
          <button type="submit">Go</button>
        </form>
        <p>Type search words directly (e.g. <b>games</b>) or enter a URL (e.g. <b>wikipedia.org</b>).</p>
      </body>
      </html>
    `);
  }

  try {
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const targetObj = new URL(targetUrl);

    // Forward extra parameters
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== 'url') {
        targetObj.searchParams.set(key, value);
      }
    }

    const response = await fetch(targetObj.href, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
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
          const abs = new URL(p1, targetObj.origin).href;
          return `href="${proxyBase}?url=${encodeURIComponent(abs)}"`;
        } catch (e) { return match; }
      });

      // Inject a Top Navigation Bar into every web page
      const navBarHtml = `
        <div id="proxy-top-bar" style="position:fixed;top:0;left:0;width:100%;height:45px;background:#0f172a;color:white;z-index:2147483647;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.5);font-family:sans-serif;margin:0;padding:0;">
          <form action="${proxyBase}" method="GET" style="display:flex;gap:8px;width:90%;max-width:800px;margin:0;padding:0;">
            <input type="text" name="url" value="${targetObj.href}" placeholder="Type search query or URL..." style="flex:1;padding:6px 12px;border-radius:4px;border:1px solid #334155;background:#1e293b;color:white;font-size:13px;" required />
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
    return res.status(500).send('Proxy Error: ' + err.message);
  }
}
