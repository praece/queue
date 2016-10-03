const cleaner = require('knex-cleaner/lib/knex_tables');
const Promise = require('bluebird');
const _ = require('lodash');
const knex = require('../lib/connection').connect({
  client: 'postgresql',
  connection: 'postgres://queue:queue@localhost:5432/queue_test',
  migrations: {
    tableName: 'db_queue_migrations',
    directory: 'migrations'
  }
});

before(beforeTests);

function beforeTests(done) {
  this.timeout(10000);

  cleaner.getTableNames(knex)
    .then(tables => {
      const escapedTables = _.map(tables, table => `"${table}"`);

      return cleaner.getDropTables(knex, escapedTables);
    })
    .then(() => knex.migrate.currentVersion())
    .then((version) => {
      if (version !== 'none') throw new Error('Database is not clean.');

      return knex.migrate.latest();
    })
    .then(() => done())
    .catch(done);
}
