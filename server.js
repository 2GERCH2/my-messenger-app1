import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

console.log('✅ Websocket сервер запущен на порту 8080');

wss.on('connection', ws => {

  console.log('✅ Пользователь подключился, всего онлайн:', wss.clients.size);

  ws.on('message', data => {
    // Любое пришедшее сообщение мгновенно пересылается абсолютно всем подключенным
    wss.clients.forEach(client => {
      if (client.readyState === 1) client.send(data);
    });
  });

  ws.on('close', () => {
    console.log('❌ Пользователь отключился, всего онлайн:', wss.clients.size);
  });

});