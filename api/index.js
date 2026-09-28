export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  let targetUrl = url.searchParams.get('url');

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
          input { width: 360px; padding: 12px; font-size: 16px; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: white; }
          button { padding: 12px 24px; font-size: 16px; border-radius: 6px; background: #3b82f6; color: white; border: none; cursor: pointer; }
          p { color: #94a3b8; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Web Proxy Project</h1>
        <form action="/" method="GET">
          <input type="text" name="url" placeholder="https://www.bing.com" required />
          <button type="submit">Go</button>
        </form>
        <p>Recommended starting sites: <b>https://www.bing.com</b> or <b>https://en.m.wikipedia.org</b></p>
      </body>
      </html>
    `);
  }

  try {
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const targetObj = new URL(targetUrl);

    // Forward any extra query parameters (like search terms) back to the target
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== 'url') {
        targetObj.searchParams.set(key, value);
      }
    }

    // Fetch page while masking as a standard desktop browser
    const response = await fetch(targetObj.href, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0'
      }
    });

    const contentType = response.headers.get('content-type') || '';

    // Rewrite HTML links and search forms
    if (contentType.includes('text/html')) {
      let html = await response.text();
      const proxyBase = `https://${req.headers.host}/`;

      // Rewrite search form actions so searches pass back through the proxy
      html = html.replace(/action=["']([^"']+)["']/g, (match, p1) => {
        try {
          const abs = new URL(p1, targetObj.origin).href;
          return `action="${proxyBase}"`;
        } catch (e) { return match; }
      });

      // Rewrite links
      html = html.replace(/href=["']([^"']+)["']/g, (match, p1) => {
        if (p1.startsWith('#') || p1.startsWith('javascript:')) return match;
        try {
          const abs = new URL(p1, targetObj.origin).href;
          return `href="${proxyBase}?url=${encodeURIComponent(abs)}"`;
        } catch (e) { return match; }
      });

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // Serve non-HTML assets (CSS, images, JS)
    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    return res.status(response.status).send(Buffer.from(buffer));

  } catch (err) {
    return res.status(500).send('Proxy Error: ' + err.message);
  }
}
