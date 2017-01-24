const moment = require('moment');
const _ = require('lodash');
const knex = require('./connection').knex;
const Promise = require('bluebird');

module.exports = function checkTimeout(Queue) {
  const cutoff = moment().subtract(Queue.config.purgeInterval, 'day');

  return knex('queue')
    .where('updatedAt', '<', cutoff)
    .whereIn('status', ['Canceled', 'Complete'])
    .del();
};
