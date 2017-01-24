const moment = require('moment');
const _ = require('lodash');
const knex = require('./connection').knex;
const Promise = require('bluebird');

module.exports = function checkTimeout(Queue) {
  return knex.transaction(transaction => {
    const parents = knex('queue')
      .transacting(transaction)
      .select('id')
      .where({ status: 'Canceled' })
      .as('parent');

    const child = knex('queue')
      .transacting(transaction)
      .select('queue.id')
      .innerJoin(parents, 'queue.dependsOn', 'parent.id')
      .where({ status: 'Pending' })
      .forUpdate();

    const update = knex('queue')
      .transacting(transaction)
      .update({ status: 'Canceled' })
      .whereIn('id', child)
      .returning(['id', 'queue', 'attempt', 'maxAttempts']);

    return update.then();
  });
};
