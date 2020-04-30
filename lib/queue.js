const Promise = require('bluebird');
const knex = require('./connection').connect();
const _ = require('lodash');
const moment = require('moment');
const checkTimeout = require('./checkTimeout');
const checkDependents = require('./checkDependents');
const purgeQueue = require('./purgeQueue');
const cron = require('cron');
const createError = require('create-error');
const QueueError = createError('QueueError');

class Queue {
  static checkTimeout() {
    return checkTimeout(Queue);
  }

  static checkDependents() {
    return checkDependents(Queue);
  }

  static purgeQueue() {
    return purgeQueue(Queue);
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

    return knex('queue').insert(insert).returning('id').then();
  }

  get(localOptions) {
    const options = _.defaults({}, localOptions, this.options);
    const timeout = moment().add(options.timeout / 1000, 'seconds').toDate();

    return knex.transaction(transaction => {
      const complete = knex('queue').select('id').where('status', 'Complete');

      const select = knex('queue')
        .transacting(transaction)
        .select('queue.id')
        .where({ 'queue.status': 'Pending', queue: this.queue })
        .where(function () {
          this.where('dependsOn', null).orWhereIn('dependsOn', complete);
        })
        .limit(options.limit)
        .orderBy('priority')
        .orderBy('queue.id')
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

  find(localOptions) {
    const options = _.defaults({}, localOptions, this.options);
    const select = knex('queue')
      .select(['id', 'meta', 'attempt', 'maxAttempts', 'status'])
      .where({ queue: this.queue })
      .limit(options.limit)
      .orderBy('priority')
      .orderBy('id');

    if (options.where) select.where(options.where);

    return select
      .then(items => {
        if (items.length === 1) return items[0];

        return items;
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
    return knex('queue')
      .update({ updatedAt: moment().toDate(), status: 'Canceled' })
      .where('id', item.id)
      .orWhere('dependsOn', item.id)
      .then();
  }

  error(item) {
    return this._update({ status: 'Error' }, [item.id]);
  }

  retry(item, meta) {
    if (item.attempt >= item.maxAttempts) {
      const message = 'Too many retry attempts'
      const error = new QueueError(message);
      const onError = Queue.config.onError || Queue.onError;
      error.item = item;
      onError(message, error);

      return this._update({ status: 'Error' }, [item.id]);
    }

    const update = { status: 'Pending', attempt: item.attempt + 1 };
    if (meta) update.meta = meta;

    return this._update(update, [item.id]);
  }

  _update(data, ids) {
    return knex('queue')
      .update(_.assign({ updatedAt: moment().toDate() }, data))
      .where('id', 'in', ids)
      .then();
  }
}

setTimeout(() => {
  if (!Queue.config.cronEnabled) return;

  if (Queue.config.checkTimeout) {
    const checkTimeoutCron = new cron.CronJob({
      cronTime: '0 * * * * *',
      onTick: Queue.checkTimeout,
      start: true
    });
  }

  const checkDependentsCron = new cron.CronJob({
    cronTime: '0 * * * * *',
    onTick: Queue.checkDependents,
    start: true
  });

  const purgeQueueCron = new cron.CronJob({
    cronTime: '0 0 8 * * *',
    onTick: Queue.purgeQueue,
    start: true
  });
}, 1000);

Queue.config = {
  checkTimeout: true,
  cronEnabled: true,
  onError: false,
  purgeInterval: 14
};

module.exports = Queue;
