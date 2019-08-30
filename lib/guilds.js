module.exports = (db, discord) => {
    const broadcastStatus = async (channels, status) => {
        for (let channel of channels) {
            try {
                await discord.sendMessage(channel, status);
            } catch (err) {
                console.error(err);
            }
        }
    }

    const displayScore = (content) => {
        return `${content.awayTeam.location} ${content.awayTeam.score} - ${content.homeTeam.location} ${content.homeTeam.score}`;
    }

    const getClock = (content) => {
        let displayQuarter = '';
        switch(content.status.period) {
            case 1:
                displayQuarter = '1st';
                break;
            case 2:
                displayQuarter = '2nd';
                break;
            case 3:
                displayQuarter = '3rd';
                break;
            case 4:
                displayQuarter = '4th';
                break;
            default:
                displayQuarter = `OT${5 - content.status.period}`;
                break;
        }

        return `${content.status.displayClock} ${displayQuarter}`;
    }

    const getBroadcastChannels = async (content) => {
        return (await db.any(`
            SELECT gc.channel_id
            FROM guild_game AS gg
                INNER JOIN guild_channel AS gc ON gg.guild_id = gc.guild_id
            WHERE gg.game_id = $1
        `, [content.id])).map(r => r.channel_id);
    }

    return {
        onGameStarted: async (content) => {
            let channels = await getBroadcastChannels(content);
            if (channels.length) {
                broadcastStatus(channels, `Game started: ${content.name}`);
            }
        },
        onGameCompleted: async (content) => {
            let channels = await getBroadcastChannels(content);
            if (channels.length) {
                broadcastStatus(channels, `**Game completed: ${displayScore(content)}**`);
            }
        },
        onQuarterStarted: async (content) => {
            let channels = await getBroadcastChannels(content);
            if (channels.length) {
                let quarter = content.status.period * 1.0;
                if (quarter != 1) {
                    let quarterDisplay = quarter < 5 ? `quarter ${quarter}` : `OT${quarter - 4}`;

                    broadcastStatus(channels, `Start of ${quarterDisplay}: ${displayScore(content)}`);
                }
            }
        },
        onHalftimeStarted: async (content) => {
            let channels = await getBroadcastChannels(content);
            if (channels.length) {
                broadcastStatus(channels, `Halftime: ${displayScore(content)}`);
            }
        },
        onScoreChanged: async (content) => {
            let channels = await getBroadcastChannels(content);
            if (channels.length) {
                broadcastStatus(channels, `Score update: ${displayScore(content)} (${getClock(content)})`);
            }
        }
    }
}