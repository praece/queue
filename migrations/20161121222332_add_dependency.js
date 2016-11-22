exports.up = function(knex, Promise) {
  return knex.schema.table('queue', function(table) {
    table.integer('dependsOn');
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('queue', function(table) {
    table.dropColumn('dependsOn');
  });
};