module.exports = async (scores) => {
    const amqp = require('amqplib');

    const url = process.env.RABBIT_URL;
    const user = process.env.RABBIT_USER;
    const password = process.env.RABBIT_PASSWORD;

    const connection = await amqp.connect(`amqp://${user}:${password}@${url}`);
    const channel = await connection.createChannel();

    const createQueue = async (exchangeName, action) => {
        channel.assertExchange(exchangeName, 'fanout');

        let q = await channel.assertQueue('', {
            exclusive: true
        });

        channel.bindQueue(q.queue, exchangeName, '');

        channel.consume(q.queue, (message) => {
            if (message.content) {
                action(message.content);
            }
        }, {
            noAck: true
        });
    }

    await createQueue('health_check', (content) => {
        console.log("Connected and listening!");
    });

    await createQueue('game_started', scores.onGameStarted)
    await createQueue('game_completed', scores.onGameCompleted);
    await createQueue('quarter_started', scores.onQuarterStarted);
    await createQueue('halftime_started', scores.onHalftimeStarted);
    await createQueue('score_changed', scores.onScoreChanged);
}