const moment = require('moment');
const _ = require('lodash');
const knex = require('./connection').knex;
const Promise = require('bluebird');

module.exports = function checkTimeout(Queue) {
  const timeout = moment().add(1, 'seconds').toDate();

  return knex.transaction(transaction => {
    const select = knex('queue')
      .transacting(transaction)
      .select('id')
      .where({ status: 'Processing' })
      .where('timeout', '<', moment().toDate())
      .orderBy('id')
      .forUpdate();

    const update = knex('queue')
      .transacting(transaction)
      .update({ timeout })
      .whereIn('id', select)
      .returning(['id', 'queue', 'attempt', 'maxAttempts']);

    return update;
  })
  .map(item => {
    const queue = new Queue(item.queue);

    return queue.retry(item);
  });
};
