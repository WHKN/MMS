exports.up = function(knex) {
  return knex.schema.table('members', function(table) {
    table.decimal('bonus_balance', 10, 2).notNullable().defaultTo(0);
  });
};

exports.down = function(knex) {
  return knex.schema.table('members', function(table) {
    table.dropColumn('bonus_balance');
  });
};