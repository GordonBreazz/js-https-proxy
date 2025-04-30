const http = require('http');
const net = require('net');
const url = require('url');

const PORT = process.env.PORT || 8080;

const server = http.createServer();

// Обработка обычных HTTP-запросов (GET/POST)
server.on('request', (req, res) => {
  const parsedUrl = url.parse(req.url);
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 80,
    path: parsedUrl.path,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('HTTP proxy error:', err.message);
    res.writeHead(500);
    res.end('HTTP Proxy Error');
  });

  req.pipe(proxyReq);
});

// Обработка HTTPS CONNECT-запросов (туннелирование)
server.on('connect', (req, clientSocket, head) => {
  const [host, port] = req.url.split(':');

  console.log(`🔌 CONNECT ${host}:${port}`);

  const serverSocket = net.connect(port || 443, host, () => {
    clientSocket.write(
      'HTTP/1.1 200 Connection Established\r\n' +
      'Proxy-agent: Node.js-Proxy\r\n' +
      '\r\n'
    );
    if (head && head.length) {
      serverSocket.write(head);
    }
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  // 🔒 Защита от сбоев
  serverSocket.on('error', (err) => {
    console.error('❌ Server socket error:', err.message);
    clientSocket.end();
  });

  clientSocket.on('error', (err) => {
    console.error('❌ Client socket error:', err.message);
    serverSocket.end();
  });

  // ⏱ Ограничение по времени (например, 2 минуты)
  clientSocket.setTimeout(2 * 60 * 1000);
  serverSocket.setTimeout(2 * 60 * 1000);

  clientSocket.on('timeout', () => {
    console.warn('⚠️ Client socket timeout');
    clientSocket.destroy();
  });

  serverSocket.on('timeout', () => {
    console.warn('⚠️ Server socket timeout');
    serverSocket.destroy();
  });
});

// Запуск сервера
server.listen(PORT, () => {
  console.log(`🚀 HTTPS Proxy server is running on port ${PORT}`);
});
