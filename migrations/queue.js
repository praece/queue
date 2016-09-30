'use strict';

exports.up = function(knex, Promise) {
  return knex.schema.createTable('queue', function(table) {
    table.increments();
    table.text('queue');
    table.text('status');
    table.jsonb('meta');
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('queue');
};
