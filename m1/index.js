const http = require('http');
const amqplib = require('amqplib');
const crypto = require('crypto');
const queue = 'tasks';


/* Logger */
const log = (client) => {
  const time = new Date().toISOString().replace(/\d{4}-\d{2}-\d{2}T|Z/g, '');
  console.log(`[${time}] ${client.ip} ${client.method} ${client.url} (${client.userAgent})`);
}


/* Http Server */
http.createServer(async (req, res) => {
  // Client info
  const client = {
    url: req.url,
    method: req.method,
    ip: req.headers['x-real-ip'] ? req.headers['x-real-ip'] : req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] ? req.headers['user-agent'] : ''
  };

  // Logger
  log(client); // TODO DEBUG

  // JSON Response
  res.setHeader('Content-Type', 'application/json');

  // GET /
  if (client.url === '/') {
    try {
      const connection = await amqplib.connect('amqp://rabbitmq');
      const channel = await connection.createChannel();
      const date = +new Date();
      const correlationId = crypto.createHash('md5').update(`${date}`).digest("hex");

      const request = new Promise(async (resolve) => {
        const { queue: replyTo } = await channel.assertQueue('', { exclusive: true });

        await channel.consume(replyTo, (message) => {
          if (!message) console.warn(' [x] Consumer cancelled');
          else if (message.properties.correlationId === correlationId) {
            resolve(message.content.toString());
          }
        }, { noAck: true });

        await channel.assertQueue(queue, { durable: false });
        console.log(`Sent: ${date}`); // TODO DEBUG

        channel.sendToQueue(queue, Buffer.from(date.toString()), { correlationId, replyTo });
      });

      const resGet = await request;
      console.log(`Received: ${resGet}`); // TODO DEBUG

      return res.end(JSON.stringify({
        sent: date,
        receive: resGet,
        correlationId: correlationId,
      }));
    } catch(err) {
      console.warn(err);
      return res.end(JSON.stringify(err));
    }

    return;
  }

  // 404
  console.log(`${client.method} ${client.url} 404`);
  return res.writeHead(404).end(`{"error":"404 page not found"}`);
}).listen(9001, () => console.log(`Server started http://127.0.0.1:9001`));
