module.exports = async (channel, guilds) => {
    const createQueue = async (exchangeName, action) => {
        channel.assertExchange(exchangeName, 'fanout');

        const q = await channel.assertQueue('', {
            exclusive: true
        });

        channel.bindQueue(q.queue, exchangeName, '');

        channel.consume(q.queue, (message) => {
            if (message.content) {
                action(JSON.parse(message.content.toString()));
            }
        }, {
            noAck: true
        });
    };

    await createQueue('game_started', guilds.onGameStarted);
    await createQueue('game_completed', guilds.onGameCompleted);
    await createQueue('quarter_started', guilds.onQuarterStarted);
    await createQueue('halftime_started', guilds.onHalftimeStarted);
    await createQueue('score_changed', guilds.onScoreChanged);
};
