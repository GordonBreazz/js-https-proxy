const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');

const PORT = process.env.PORT || 8080;

// Создаем HTTP сервер
const server = http.createServer();

// Добавляем простую страницу для проверки, что сервер работает
server.on('request', (req, res) => {
  const parsedUrl = url.parse(req.url);
  
  // Если это запрос к корню сайта, отправляем информационную страницу
  if (parsedUrl.pathname === '/' && !parsedUrl.hostname) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head>
          <title>HTTPS Proxy Server</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            code { background-color: #f0f0f0; padding: 2px 4px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>HTTPS Proxy Server</h1>
          <p>Этот сервер работает как HTTP и HTTPS прокси.</p>
          <h2>Как настроить:</h2>
          <p><strong>Хост:</strong> ${req.headers.host}</p>
          <p><strong>Порт:</strong> 80 (для HTTP) или 443 (для HTTPS)</p>
          <p>Сервер успешно запущен и готов принимать прокси-запросы.</p>
        </body>
      </html>
    `);
    return;
  }

  // Если это прокси-запрос
  if (parsedUrl.hostname) {
    const isHttps = req.url.startsWith('https://');
    const httpLib = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || defaultPort,
      path: parsedUrl.path,
      method: req.method,
      headers: {...req.headers}
    };
    
    // Удаляем заголовки, которые могут вызвать проблемы
    delete options.headers.host;
    
    console.log(`Proxy request to: ${req.method} ${req.url}`);
    
    const proxyReq = httpLib.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err.message);
      res.writeHead(500);
      res.end(`Proxy Error: ${err.message}`);
    });
    
    req.pipe(proxyReq);
  } else {
    // Если запрос не распознан как прокси-запрос и не к корню
    res.writeHead(400);
    res.end('Bad Request: Not a valid proxy request');
  }
});

// Обработка HTTPS CONNECT-запросов (туннелирование)
server.on('connect', (req, clientSocket, head) => {
  const [host, port] = req.url.split(':');
  const targetPort = parseInt(port) || 443;
  
  console.log(`🔌 CONNECT ${host}:${targetPort}`);
  
  const serverSocket = net.connect(targetPort, host, () => {
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
  
  serverSocket.on('error', (err) => {
    console.error(`❌ Server socket error (${host}:${targetPort}): ${err.message}`);
    clientSocket.end();
  });
  
  clientSocket.on('error', (err) => {
    console.error(`❌ Client socket error (${host}:${targetPort}): ${err.message}`);
    serverSocket.end();
  });
  
  clientSocket.setTimeout(2 * 60 * 1000);
  serverSocket.setTimeout(2 * 60 * 1000);
  
  clientSocket.on('timeout', () => {
    console.warn(`⚠️ Client socket timeout (${host}:${targetPort})`);
    clientSocket.destroy();
  });
  
  serverSocket.on('timeout', () => {
    console.warn(`⚠️ Server socket timeout (${host}:${targetPort})`);
    serverSocket.destroy();
  });
});

// Запуск сервера
server.listen(PORT, () => {
  console.log(`🚀 HTTPS Proxy server is running on port ${PORT}`);
  console.log(`Check your Railway dashboard for the public URL`);
});