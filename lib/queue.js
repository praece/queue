const Promise = require('bluebird');
const knex = require('./connection').connect();
const _ = require('lodash');
const moment = require('moment');
const checkTimeout = require('./checkTimeout');
const schedule = require('node-schedule');
const createError = require('create-error');
const QueueError = createError('QueueError');

schedule.scheduleJob('checkTimeout', '0 * * * * *', () => {
  // Only run if we have something to call
  if (Queue.config.checkTimeout) checkTimeout(Queue);
});

class Queue {
  static checkTimeout() {
    return checkTimeout(Queue);
  }

  constructor(queue, options) {
    const defaultOptions = {
      limit: 1,
      timeout: 5 * 60 * 1000,
      maxAttempts: 3
    };

    this.queue = queue;
    this.options = _.assign({}, defaultOptions, options);
    this.defaults = {
      queue,
      status: 'Pending',
      priority: 0,
      attempt: 1,
      maxAttempts: this.options.maxAttempts
    };
  }

  add(meta, options) {
    const insert = _.assign({ updatedAt: moment().toDate() }, this.defaults, options, { meta });

    return knex('queue').insert(insert).returning('id');
  }

  get(localOptions) {
    const options = _.defaults({}, localOptions, this.options);
    const timeout = moment().add(options.timeout / 1000, 'seconds').toDate();

    return knex.transaction(transaction => {
      const select = knex('queue')
        .transacting(transaction)
        .select('id')
        .where({ status: 'Pending', queue: this.queue })
        .limit(options.limit)
        .orderBy('priority')
        .orderBy('id')
        .forUpdate();

      if (options.where) select.where(options.where);

      const update = knex('queue')
        .transacting(transaction)
        .update({ status: 'Processing', updatedAt: moment().toDate(), timeout })
        .whereIn('id', select)
        .returning(['id', 'meta', 'attempt', 'maxAttempts']);

      return update
        .then(items => {
          if (items.length === 1) return items[0];

          return items;
        });
    });
  }

  count(status) {
    return knex('queue').count()
      .where({ queue: this.queue, status: status ? status : 'Processing' })
      .then().get(0).get('count');
  }

  complete(item) {
    return this._update({ status: 'Complete' }, [item.id]);
  }

  cancel(item) {
    return this._update({ status: 'Canceled' }, [item.id]);
  }

  error(item) {
    return this._update({ status: 'Error' }, [item.id]);
  }

  retry(item) {
    if (item.attempt >= item.maxAttempts) {
      const message = 'Too many retry attempts'
      const error = new QueueError(message);
      error.item = item;
      Queue.onError(message, error);

      return this._update({ status: 'Error' }, [item.id]);
    }

    return this._update({ status: 'Pending', attempt: item.attempt + 1 }, [item.id]);
  }

  _update(data, ids) {
    return knex('queue')
      .update(_.assign({ updatedAt: moment().toDate() }, data))
      .where('id', 'in', ids);
  }
}

Queue.config = {
  checkTimeout: true,
  onError: false
};

module.exports = Queue;
