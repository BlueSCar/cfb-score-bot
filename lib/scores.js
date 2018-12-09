module.exports = (db, bot) => {
    const channels = require('../channels');

    const broadcastStatus = async (status) => {
        for (let channel of channels) {
            await bot.sendMessage(channel, status);
        }
    }

    const broadcastVideos = async (videos, count) => {
        for (let i = count; i < videos.length; i++) {
            if (videos[i].links && videos[i].links.source && videos[i].links.source.HD && videos[i].links.source.HD.href) {
                await broadcastStatus(videos[i].links.source.HD.href);

                if (videos[i].description && videos[i].description.length) {
                    await broadcastStatus(videos[i].description);
                }
            }
        }
    }

    const displayScore = (content) => {
        return `${content.awayTeam.location} ${content.awayTeam.score} - ${content.homeTeam.location} ${content.homeTeam.score}`;
    }

    const shouldBroadcast = async (content) => {
        return (await db.any(`SELECT 1 FROM game WHERE id = $1`, [content.id])).length > 0;
    }

    return {
        onGameStarted: async (content) => {
            let broadcast = await shouldBroadcast(content);
            if (broadcast) {
                broadcastStatus(`Game started: ${content.name}`);
            }
        },
        onGameCompleted: async (content) => {
            let broadcast = await shouldBroadcast(content);
            if (broadcast) {
                broadcastStatus(`**Game completed: ${displayScore(content)}**`);
            }
        },
        onQuarterStarted: async (content) => {
            let broadcast = await shouldBroadcast(content);
            if (broadcast) {
                let quarter = content.status.period * 1.0;
                if (quarter != 1) {
                    let quarterDisplay = quarter < 5 ? `quarter ${quarter}` : `OT${quarter - 4}`;

                    broadcastStatus(`Start of ${quarterDisplay}: ${displayScore(content)}`);
                }
            }
        },
        onHalftimeStarted: async (content) => {
            let broadcast = await shouldBroadcast(content);
            if (broadcast) {
                broadcastStatus(`Halftime: ${displayScore(content)}`);
            }
        },
        onScoreChanged: async (content) => {
            let broadcast = await shouldBroadcast(content);
            if (broadcast) {
                broadcastStatus(`Score update: ${displayScore(content)}`);
            }
        }
    }
}