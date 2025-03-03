exports.up = function(knex) {
  return knex.schema
    // 创建会员类型表
    .createTable('member_types', function(table) {
      table.increments('id').primary();
      table.string('name').notNullable().unique();
      table.string('type').notNullable(); // 'stored', 'year', 'season', 'month', 'times', 'custom'
      table.integer('duration_days').nullable(); // 有效期天数，仅适用于年卡、季卡、月卡
      table.integer('total_times').nullable(); // 总次数，仅适用于次卡
      table.decimal('price', 10, 2).nullable(); // 价格
      table.text('description').nullable();
      table.timestamps(true, true);
    })
    // 创建会员-类型关联表
    .createTable('member_type_relations', function(table) {
      table.increments('id').primary();
      table.integer('member_id').notNullable();
      table.integer('type_id').notNullable();
      table.date('start_date').nullable();
      table.date('end_date').nullable();
      table.integer('remaining_times').nullable(); // 剩余次数
      table.timestamps(true, true);
      table.foreign('member_id').references('members.id').onDelete('CASCADE');
      table.foreign('type_id').references('member_types.id').onDelete('CASCADE');
    })
    // 创建积分等级表
    .createTable('point_levels', function(table) {
      table.increments('id').primary();
      table.string('name').notNullable(); // 等级名称
      table.integer('min_points').notNullable(); // 最小积分
      table.integer('max_points').notNullable(); // 最大积分
      table.decimal('discount', 4, 2).notNullable(); // 折扣率
      table.timestamps(true, true);
    })
    // 在会员表中添加积分字段
    .alterTable('members', function(table) {
      table.integer('points').notNullable().defaultTo(0);
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('members', function(table) {
      table.dropColumn('points');
    })
    .dropTable('point_levels')
    .dropTable('member_type_relations')
    .dropTable('member_types');
};