const amqplib = require('amqplib');
const bluebird = require('bluebird');
const dotenv = require('dotenv');
const pgp = require('pg-promise');
const Discord = require('discord.js');

const dbConfig = require('./lib/database');
const rabbitConfig = require('./lib/rabbit');
const consumersConfig = require('./lib/consumers');
const discordConfig = require('./lib/discord');
const guildsConfig = require('./lib/guilds');

(async() => {
    dotenv.config();

    const dbs = dbConfig(bluebird, pgp);
    const rabbit = await rabbitConfig(amqplib);
    const discord = discordConfig(Discord, dbs.db, dbs.cfb);
    const guilds = guildsConfig(dbs.db, discord);

    await consumersConfig(rabbit.channel, guilds);
})().catch(err => {
    console.error(err);
});