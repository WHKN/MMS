exports.up = function(knex) {
  return knex.schema.createTable('members', function(table) {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('phone').unique().notNullable();
    table.decimal('balance', 10, 2).notNullable().defaultTo(0);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('members');
};