module.exports = (promise, pgp) => {
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const port = process.env.DB_PORT;
    const name = process.env.DB_NAME;
    const host = process.env.DB_HOST;

    const cfbUser = process.env.DB_USER_CFB;
    const cfbPassword = process.env.DB_PASSWORD_CFB;
    const cfbName = process.env.DB_NAME_CFB;

    const connectionString = `postgres://${user}:${password}@${host}:${port}/${name}`;
    const cfbConnectionString = `postgres://${cfbUser}:${cfbPassword}@${host}:${port}/${cfbName}`;
    const dbCreator = pgp({
        promiseLib: promise
    });

    return {
        db: dbCreator(connectionString),
        cfb: dbCreator(cfbConnectionString)
    };
};
