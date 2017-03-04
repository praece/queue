const Knex = require('knex');
const env = process.env.NODE_ENV || 'development';

module.exports = {
  connect(config) {
    if (this.knex && !config) return this.knex;

    let options;

    if (!config) {
      const knexfile = require('../knexfile');
      options = knexfile[env];
    } else {
      options = config;
    }

    this.knex = Knex(options);

    return this.knex;
  }
};