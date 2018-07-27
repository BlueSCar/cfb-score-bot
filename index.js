(async () => {
    require('dotenv').config();

    const pg = require('pg-promise');
    const Promise = require('bluebird');
    const db = require('./lib/database')(Promise, pg);

    const discord = require('discord.js');
    const bot = await require('./lib/bot')(discord);

    const cfb = require('cfb-data');

    let scores = await require('./lib/scores')(cfb, db, bot);

    let schedule = require('node-schedule');

    let job = schedule.scheduleJob("* * * * *", scores.broadcastUpdates);
})()
.catch(err => {
    console.error(err);
});