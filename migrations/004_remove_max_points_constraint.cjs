exports.up = function(knex) {
  return knex.schema
    .alterTable('point_levels', function(table) {
      table.integer('max_points').nullable().alter();
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('point_levels', function(table) {
      table.integer('max_points').notNullable().alter();
    });
};