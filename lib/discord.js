module.exports = (Discord, db, cfb) => {
    const discordToken = process.env.DISCORD_TOKEN;
    const inputPattern = /\[{2}([^\[\]]+)\]{2}/g;

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
        if (msg.content.trim() === '[[games]]') {
            let games = await db.any(`
                SELECT gg.game_id
                FROM guild_game AS gg
                    INNER JOIN guild_channel AS gc ON gg.guild_id = gc.guild_id
                WHERE gc.channel_id = $1
            `, [msg.channel.id]);

            if (games && games.length) {
                let scoreboard = null;

                do {
                    try {
                        scoreboard = await cfb.scoreboard.getScoreboard({ // eslint-disable-line
                            groups: 80
                        });
                    } catch (err) {
                        // do nothing
                    }
                } while (!scoreboard);

                let guildGames = games.map(g => scoreboard.events.find(e => e.id == g.game_id)).filter(g => g).map(g => g.name);

                msg.channel.send(guildGames.join('\r\n'), {
                    split: true
                });
            } else {
                msg.channel.send('No games selected for this guild.');
            }
        }
    });

    return {
        sendMessage: async (channelId, message) => {
            let channel = client.channels.get(channelId);
            await channel.send(message);
        }
    }
}