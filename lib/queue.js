const Promise = require('bluebird');
const knex = require('./connection').knex;
const _ = require('lodash');
const moment = require('moment');
const config = require('./config');

class Queue {
  constructor(queue, options) {
    const defaultOptions = {
      limit: 1,
      timeout: 5 * 60 * 1000,
      error: console.error
    };

    this.queue = queue;
    this.options = _.assign({}, defaultOptions, options);
    this.defaults = { queue, status: 'Pending', updatedAt: moment().toDate() };
  }

  add(meta) {
    const insert = _.assign({}, this.defaults, { meta });

    return knex('queue').insert(insert);
  }

  get(localOptions) {
    const options = _.defaults({}, localOptions, this.options);
    const timeout = moment().add(this.options.timeout / 1000, 'seconds').toDate();

    return knex.transaction(transaction => {
      const select = knex('queue')
        .transacting(transaction)
        .select('id')
        .where({ status: 'Pending', queue: this.queue })
        .limit(options.limit)
        .forUpdate();

      const update = knex('queue')
        .transacting(transaction)
        .update({ status: 'Processing', updatedAt: moment().toDate(), timeout })
        .whereIn('id', select)
        .returning(['id', 'meta']);

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

  error(item) {
    return this._update({ status: 'Error' }, [item.id])
      .then(item => {
        if (config.onError) config.onError(item);
      });
  }

  _update(data, ids) {
    return knex('queue')
      .update(_.assign({ updatedAt: moment().toDate() }, data))
      .where('id', 'in', ids);
  }
}

module.exports = Queue;
