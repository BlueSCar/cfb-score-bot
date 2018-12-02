module.exports = (cfb, db, bot) => {
    const channels = require('../channels');

    const getActiveGames = async () => {
        return await db.any(`
            SELECT id, quarter, clock, home_score as homeScore, away_score as awayScore, videos
            FROM game
            WHERE completed = false
        `);
    }

    const broadcastStatus = async (status) => {
        for (let channel of channels){
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

    return {
        broadcastUpdates: async () => {
            let games = await getActiveGames();
            let scoreboard = await cfb.scoreboard.getScoreboard({
                groups: 80
            });

            for (let game of games) {
                let gameUpdate = scoreboard.events.find(e => e.id == game.id);
                if (!gameUpdate || gameUpdate.status.type.description == 'Scheduled') {
                    continue;
                }

                let pbp = await cfb.games.getPlayByPlay(game.id);

                if (!pbp) {
                    continue;
                }

                let videos = pbp.videos ? pbp.videos.length : 0;
                let quarter = gameUpdate.status.period;
                let clock = gameUpdate.status.displayClock;
                let homeScore = gameUpdate.competitions[0].competitors[0].score;
                let awayScore = gameUpdate.competitions[0].competitors[1].score;
                let homeName = gameUpdate.competitions[0].competitors[0].team.location;
                let awayName = gameUpdate.competitions[0].competitors[1].team.location;

                if (videos > game.videos) {
                    await broadcastVideos(pbp.videos, game.videos);
                }

                if (gameUpdate.status.type.completed) {
                    broadcastStatus(`**Game completed: ${awayName} ${awayScore} - ${homeName} ${homeScore}**`)
                } else {
                    if (game.quarter != quarter) {
                        if (game.quarter == 0) {
                            broadcastStatus(`Game started: ${gameUpdate.name}`);
                        } else {
                            let quarterDisplay = quarter < 5 ? `quarter ${quarter}` : `OT${quarter - 4}`;

                            broadcastStatus(`Start of ${quarterDisplay}: ${awayName} ${awayScore} - ${homeName} ${homeScore}`);
                        }
                    } else if (homeScore != game.homescore || awayScore != game.awayscore) {
                        broadcastStatus(`Score update: ${awayName} ${awayScore} - ${homeName} ${homeScore}`);
                    }
                }

                await db.none(`
                    UPDATE game
                    SET completed = $1,
                        quarter = $2,
                        clock = $3,
                        home_score = $4,
                        away_score = $5,
                        videos = $6
                    WHERE id = $7
                `, [gameUpdate.status.type.completed, quarter, clock, homeScore, awayScore, videos, game.id]);
            }
        }
    }
}
