const abbreviations = require('../abbrv.json');

module.exports = (db, cfb) => {
    const getTeam = (team) => {
        let key = Object.keys(abbreviations).find(k => abbreviations[k].includes(team));
        return key ? key : team;
    };

    const getGuildGames = async (msg) => {
        let games = await db.any(`
                SELECT gg.game_id
                FROM guild_game AS gg
                WHERE gg.guild_id = $1
            `, [msg.guild.id]);

        if (games && games.length) {
            let scoreboard = await cfb.any(`
                    WITH this_week AS (
                        SELECT DISTINCT g.season, g.season_type, g.week
                        FROM game AS g
                            INNER JOIN game_team AS gt ON g.id = gt.game_id
                             INNER JOIN current_conferences AS cc ON gt.team_id = cc.team_id AND cc.classification = 'fbs'
                        WHERE g.start_date > (now() - interval '2d')
                        ORDER BY g.season, g.season_type DESC, g.week
                        LIMIT 1
                    )
                    SELECT g.id, g.start_date AT TIME ZONE 'UTC' AS start_date, g.neutral_site, t.display_name AS home_team, t2.display_name AS away_team
                    FROM game AS g
                        INNER JOIN this_week AS tw ON g.season = tw.season AND g.week = tw.week AND g.season_type = tw.season_type
                        INNER JOIN game_team AS gt ON g.id = gt.game_id AND gt.home_away = 'home'
                        INNER JOIN team AS t ON gt.team_id = t.id
                        INNER JOIN game_team AS gt2 ON g.id = gt2.game_id AND gt.id <> gt2.id
                        INNER JOIN team AS t2 ON gt2.team_id = t2.id
                    WHERE g.status = 'scheduled' OR g.status = 'in_progress'
                    ORDER BY g.start_date
                `);

            let guildGames = scoreboard.filter(e => games.find(g => e.id == g.game_id)).map(g => `${g.away_team} ${g.neutral_site == true ? 'vs' : 'at'} ${g.home_team}  _${getDisplayDate(g.start_date)}_`);

            msg.channel.send("**Games scheduled for this server**\r\n" + guildGames.join('\r\n'), {
                split: true
            });
        } else {
            msg.channel.send('No games selected for this guild.');
        }
    };

    const getTeamScore = async (msg, team) => {
        if (!team) {
            return;
        }

        let t = getTeam(team);

        let score = await cfb.oneOrNone(`
        WITH this_week AS (
            SELECT DISTINCT g.season, g.season_type, g.week
            FROM game AS g
                INNER JOIN game_team AS gt ON g.id = gt.game_id
                 INNER JOIN current_conferences AS cc ON gt.team_id = cc.team_id AND cc.classification = 'fbs'
            WHERE g.start_date > (now() - interval '2d')
            ORDER BY g.season, g.season_type DESC, g.week
            LIMIT 1
        )
        SELECT g.id,
            g.start_date AT TIME ZONE 'UTC' AS start_date,
            g.status,
            g.neutral_site,
            t.display_name AS home_team,
            CASE WHEN g.status = 'completed' THEN gt.points ELSE g.current_home_score END AS home_points,
            t2.display_name AS away_team,
            CASE WHEN g.status = 'completed' THEN gt2.points ELSE g.current_away_score END AS away_points,
            g.current_period,
            CAST(g.current_clock AS CHARACTER VARYING) AS current_clock,
            COALESCE(gm.name, gm2.name) AS tv_channel
        FROM game AS g
            INNER JOIN this_week AS tw ON g.season = tw.season AND g.week = tw.week AND g.season_type = tw.season_type
            INNER JOIN game_team AS gt ON g.id = gt.game_id AND gt.home_away = 'home'
            INNER JOIN team AS t ON gt.team_id = t.id
            INNER JOIN game_team AS gt2 ON g.id = gt2.game_id AND gt.id <> gt2.id
            INNER JOIN team AS t2 ON gt2.team_id = t2.id
            LEFT JOIN game_media AS gm ON g.id = gm.game_id AND gm.media_type = 'tv'
            LEFT JOIN game_media AS gm2 ON g.id = gm2.game_id AND gm2.media_type = 'web'
        WHERE g.start_date > (now() - interval '5d') AND ($1 = LOWER(t.school) OR $1 = LOWER(t2.school))
        ORDER BY g.start_date
        LIMIT 1
        `, [t]);

        if (score) {
            let message;
            if (score.status == 'completed') {
                message = `${score.away_team} ${score.away_points} - ${score.home_team} ${score.home_points} (FINAL)`;
            } else if (score.status == 'in_progress') {
                message = `${score.away_team} ${score.away_points} - ${score.home_team} ${score.home_points} (${score.current_clock.replace('00:', '')} ${getDisplayPeriod(score.current_period)})${score.tv_channel ? ' [' + score.tv_channel + ']' : ''}`;
            } else {
                message = `${score.away_team} ${score.neutral_site == true ? 'vs' : 'at'} ${score.home_team} (${getDisplayDate(score.start_date)})${score.tv_channel ? ' [' + score.tv_channel + ']' : ''}`;
            }

            msg.channel.send(message);
        } else {
            msg.channel.send('No games found for that team.');
        }
    };

    const getTeamsList = async (msg) => {
        let teams = await cfb.any(`
            SELECT t.school
            FROM team AS t
                INNER JOIN conference_team AS ct ON t.id = ct.team_id AND ct.start_year <= 2022 AND ct.end_year IS NULL
                INNER JOIN conference AS c ON ct.conference_id = c.id AND c.division = 'fbs'
            ORDER BY t.school
        `);

        msg.channel.send(teams.map(t => t.school).join('\r\n'), {
            split: true
        });
    };

    const getLines = async (msg, team) => {
        if (!team) {
            return;
        }

        let t = getTeam(team);

        let gameInfo = await cfb.oneOrNone(`
        WITH this_week AS (
            SELECT DISTINCT g.season, g.season_type, g.week
            FROM game AS g
                INNER JOIN game_team AS gt ON g.id = gt.game_id
                 INNER JOIN current_conferences AS cc ON gt.team_id = cc.team_id AND cc.classification = 'fbs'
            WHERE g.start_date > (now() - interval '2d')
            ORDER BY g.season, g.season_type DESC, g.week
            LIMIT 1
        )
        SELECT g.id,
               g.start_date AT TIME ZONE 'UTC' AS start_date,
               g.status,
               g.neutral_site,
               t.school AS home,
               t.display_name AS home_team,
               CASE WHEN g.status = 'completed' THEN gt.points ELSE g.current_home_score END AS home_points,
               t2.school AS away,
               t2.display_name AS away_team,
               CASE WHEN g.status = 'completed' THEN gt2.points ELSE g.current_away_score END AS away_points,
               g.current_period,
               g.current_clock,
               COALESCE(gl.spread, gl2.spread) AS spread,
               COALESCE(gl.over_under, gl2.over_under) AS over_under,
               COALESCE(gl.moneyline_home, gl2.moneyline_home) AS moneyline_home,
               COALESCE(gl.moneyline_away, gl2.moneyline_away) AS moneyline_away,
               COALESCE(gm.name, gm2.name) AS tv
        FROM game AS g
            INNER JOIN this_week AS tw ON g.season = tw.season AND g.week = tw.week AND g.season_type = tw.season_type
            INNER JOIN game_team AS gt ON g.id = gt.game_id AND gt.home_away = 'home'
            INNER JOIN team AS t ON gt.team_id = t.id
            INNER JOIN game_team AS gt2 ON g.id = gt2.game_id AND gt.id <> gt2.id
            INNER JOIN team AS t2 ON gt2.team_id = t2.id
            LEFT JOIN game_lines AS gl ON g.id = gl.game_id AND gl.lines_provider_id = 999999
            LEFT JOIN game_lines AS gl2 ON g.id = gl2.game_id AND gl2.lines_provider_id = 888888
            LEFT JOIN game_media AS gm ON g.id = gm.game_id AND gm.media_type = 'tv'
            LEFT JOIN game_media AS gm2 ON g.id = gm2.game_id AND gm2.media_type = 'web'
        WHERE g.start_date > (now() - interval '3d') AND ($1 = LOWER(t.school) OR $1 = LOWER(t2.school)) AND (gl.id IS NOT NULL OR gl2.id IS NOT NULL)
        ORDER BY g.start_date
        LIMIT 1        
        `, [t]).catch(err => {
            console.error(err);
        });

        if (gameInfo) {
            const embed = {
                color: 0x03bafc,
                title: `${gameInfo.away_team} ${gameInfo.neutral_site == true ? 'vs' : 'at'} ${gameInfo.home_team}`,
                description: `${getDisplayDate(gameInfo.start_date)} ET${gameInfo.tv ? ` [${gameInfo.tv}]` : ''}`,
                fields: [{
                        name: 'Spread',
                        value: `${gameInfo.spread > 0 ? gameInfo.away_team : gameInfo.spread < 0 ? gameInfo.home_team : 'PUSH'} ${gameInfo.spread == 0 ? '' : -Math.abs(gameInfo.spread)}`,
                        inline: false
                    },
                    {
                        name: 'Over Under',
                        value: `${gameInfo.over_under}`,
                        inline: false,
                    },
                    {
                        name: '\u200b',
                        value: '**Moneylines**',
                        inline: false,
                    },
                    {
                        name: gameInfo.away,
                        value: `${gameInfo.moneyline_away > 0 ? '+' + gameInfo.moneyline_away : gameInfo.moneyline_away}`,
                        inline: true,
                    },
                    {
                        name: gameInfo.home,
                        value: `${gameInfo.moneyline_home > 0 ? '+' + gameInfo.moneyline_home : gameInfo.moneyline_home}`,
                        inline: true,
                    },
                    {
                        name: '\u200b',
                        value: `[/r/CFB Book](https://book.redditcfb.com)`,
                        inline: false,
                    }
                ],
                footer: {
                    text: 'Lines stop updating at kickoff'
                }
            };

            await msg.channel.send({
                embeds: [embed]
            });
        } else {
            msg.channel.send('No game lines found for that team.');
        }
    };

    const getCommandList = async (msg) => {
        msg.channel.send(`
**CFBD Score Bot Commands**

**!lines** *team* - Returns game line information for the current week for the specified team
**!schedule** - Returns games scheduled for broadcast in the current server for the current week
**!score** *team* - Returns game information for the current week for the specified team
**!teams** - Returns a list of valid team names

_To add CFBD Score Bot to your server, visit https://scorebot.collegefootballdata.com._
        `);
    };

    const getDisplayPeriod = (period) => {
        let displayQuarter = '';
        switch (period) {
            case 1:
                displayQuarter = '1st';
            case 2:
                displayQuarter = `2nd`;
                break;
            case 3:
                displayQuarter = `3rd`;
                break;
            case 4:
                displayQuarter = `4th`;
                break;
            default:
                displayQuarter = `OT${content.status.period - 4}`;
                break;
        }

        return displayQuarter;
    };

    const getDisplayDate = (date) => {
        return new Date(date).toLocaleString('en-US', {
            timeZone: 'America/New_York'
        }).replace(':00 ', ' ');
    };

    return {
        'schedule': getGuildGames,
        'score': getTeamScore,
        'teams': getTeamsList,
        'commands': getCommandList,
        'lines': getLines
    };
};