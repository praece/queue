'use strict';

exports.up = function(knex, Promise) {
  return knex.schema.createTable('queue', function(table) {
    table.increments('id');
    table.text('queue');
    table.text('status');
    table.integer('priority');
    table.integer('maxAttempts');
    table.integer('attempt');
    table.datetime('updatedAt');
    table.datetime('timeout');
    table.jsonb('meta');
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('queue');
};
