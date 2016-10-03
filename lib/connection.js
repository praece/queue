const Knex = require('knex');
const env = process.env.NODE_ENV;

module.exports = {
  connect(config) {
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