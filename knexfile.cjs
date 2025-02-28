module.exports = {
  client: 'sqlite3',
  connection: {
    filename: './vip.db'
  },
  useNullAsDefault: true,
  migrations: {
    directory: './migrations'
  }
};