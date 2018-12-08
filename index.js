(async () => {
    require('dotenv').config();

    const pg = require('pg-promise');
    const Promise = require('bluebird');
    const db = require('./lib/database')(Promise, pg);

    const discord = require('discord.js');
    const bot = await require('./lib/bot')(discord);

    let scores = await require('./lib/scores')(db, bot);

    await require('./lib/rabbit')(scores);
})()
.catch(err => {
    console.error(err);
});