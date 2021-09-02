module.exports = (Discord, db, cfb) => {
    const discordToken = process.env.DISCORD_TOKEN;
    const commands = require('./commands')(db, cfb);
    const commandList = Object.keys(commands);
    const inputPattern = /!([A-Za-z]+)( .+)?/;

    const client = new Discord.Client({
        apiRequestMethod: 'burst'
    });

    console.log('about to connect');
    client.login(discordToken)
        .then(() => {
            console.log('Connected to Discord!');
        })
        .catch(err => console.error(err));

    client.on('message', async msg => {
        if (!msg.author.bot && inputPattern.test(msg.content.trim())) {
            const match = inputPattern.exec(msg.content.trim());
            const command = match[1].toLowerCase();
            const params = match.length > 2 && match[2] ? match[2].toLowerCase() : null;

            if (commandList.includes(command)) {
                await commands[command](msg, params);
            }
        }
    });

    return {
        sendMessage: async (channelId, message) => {
            let channel = client.channels.get(channelId);
            if (channel) {
                await channel.send(message);
            } else {
                console.error(`Channel id ${channelId} not found.`)
            }
        }
    }
}