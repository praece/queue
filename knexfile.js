// Update with your config settings.
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var appKnexPath = path.resolve(__dirname, '../../knexfile.js');

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
