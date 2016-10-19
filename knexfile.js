// Update with your config settings.
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const env = process.env.NODE_ENV || 'development';
const appKnexPath = path.resolve(__dirname, '../../knexfile.js');

if (env === 'test') {
  return module.exports.test = {
    client: 'postgresql',
    connection: 'postgres://queue:queue@localhost:5432/queue_test',
    migrations: {
      tableName: 'db_queue_migrations',
      directory: 'migrations'
    }
  };
}

if (!fs.existsSync(appKnexPath)) throw new Error('App must include a knex file');

const appConfig = require(appKnexPath);
const config = _.mapValues(appConfig, env => {
  const options = {
    migrations: {
      tableName: 'db_queue_migrations',
      directory: 'migrations'
    }
  };

  return _.assign({}, env, options);
});

module.exports = config;
