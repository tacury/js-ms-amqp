const amqplib = require('amqplib');
const crypto = require('crypto');
const queue = 'tasks';


/* Main m2 */
(async () => {
  const connection = await amqplib.connect('amqp://rabbitmq');
  const channel = await connection.createChannel();

  await channel.assertQueue(queue, { durable: false });

  await channel.consume(queue, (message) => {
    const time = new Date().toISOString().replace(/\d{4}-\d{2}-\d{2}T|Z/g, '');
    const hash = crypto.createHash('md5').update(`${+new Date()}`).digest("hex");

    console.log(`[${time}] Received: ${message.content.toString()}`); // TODO DEBUG

    channel.sendToQueue(message.properties.replyTo, Buffer.from(hash), { correlationId: message.properties.correlationId });
    channel.ack(message);
  });

  console.log(`Waiting requests...`);  // TODO DEBUG
})();
