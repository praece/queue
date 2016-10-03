const schedule = require('node-schedule');
const moment = require('moment');
const _ = require('lodash');
const createError = require('create-error');
const Timeout = createError('QueueItemTimeout');
const knex = require('./connection').knex;
const config = require('./config');

schedule.scheduleJob('checkTimeout', '0 * * * * *', () => {
  // Only run if we have something to call
  if (config.onTimeout) {
    knex('queue').select(['id', 'meta'])
      .where({ status: 'Processing' })
      .where('timeout', '<', moment().toDate())
      .orderBy('id')
      .tap(items => {
        if (items && items.length) {
          _.forEach(items, item => {
            config.onTimeout(new Timeout(`Queue item ${item.id} timed out`), item.meta);
          });
        }
      });
  }
});
