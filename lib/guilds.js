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

    const broadcastCloseGame = async (content) => {
        const channels = (await db.any(`
                            SELECT gc.channel_id
                            FROM guild_channel AS gc
                                LEFT JOIN guild_game AS gg ON gg.guild_id = gc.guild_id AND gg.game_id = $1
                            WHERE gg.id IS NULL AND gc.close_game_alerts = $2
                        `, [content.id, true])).map(r => r.channel_id);

        broadcastStatus(channels, `:boom:CLOSE GAME ALERT: ${displayScore(content)} (${getClock(content)}) (${getClock(content)}) ${content.broadcast ? ` [${content.broadcast}]` : ''}:boom:`)
    }

    const broadcastUpsetAlert = async (content) => {
        const channels = (await db.any(`
                            SELECT gc.channel_id
                            FROM guild_channel AS gc
                                LEFT JOIN guild_game AS gg ON gg.guild_id = gc.guild_id AND gg.game_id = $1
                            WHERE gg.id IS NULL AND gc.close_game_alerts = $2
                        `, [content.id, true])).map(r => r.channel_id);

        broadcastStatus(channels, `:rotating_light::rotating_light:UPSET ALERT: ${displayScore(content)} (${getClock(content)}) (${getClock(content)}) ${content.broadcast ? ` [${content.broadcast}]` : ''}:rotating_light::rotating_light:`)
    }

    const displayScore = (content) => {
        return `${content.awayTeam.location} ${content.awayTeam.score} - ${content.homeTeam.location} ${content.homeTeam.score}`;
    }

    const getClock = (content) => {
        let displayQuarter = '';
        switch (content.status.period) {
            case 1:
                displayQuarter = `${content.status.displayClock} 1st`;
                break;
            case 2:
                displayQuarter = `${content.status.displayClock} 2nd`;
                break;
            case 3:
                displayQuarter = `${content.status.displayClock} 3rd`;
                break;
            case 4:
                displayQuarter = `${content.status.displayClock} 4th`;
                break;
            default:
                displayQuarter = `OT${content.status.period - 4}`;
                break;
        }

        return displayQuarter;
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
                broadcastStatus(channels, `Game started: ${content.name}${content.broadcast ? ` [${content.broadcast}]` : ''}`);
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
                await broadcastStatus(channels, `Score update: ${displayScore(content)} (${getClock(content)})`);
            }

            if ((
                    content.status.period >= 4
                ) && (
                    (content.awayTeam.score >= content.homeTeam.score && content.awayTeam.curatedRank > content.homeTeam.curatedRank) ||
                    (content.homeTeam.score >= content.awayTeam.score && content.homeTeam.curatedRank > content.awayTeam.curatedRank))) {
                await broadcastUpsetAlert(content);
            } else if (
                ((content.status.period == 4 && content.status.clock < 300) ||
                    content.status.period > 4
                ) &&
                (Math.abs(content.awayTeam.score - content.homeTeam.score) <= 8)) {
                await broadcastCloseGame(content);
            }
        }
    }
}