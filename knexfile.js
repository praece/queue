// Update with your config settings.
var fs = require('fs');

// if (fs.existsSync('./config/local.js')) {
//   var local = require('./config/local.js').connections.postgresql;
//   var test = require('./config/local.js').testConnection;
// } else {
//   var local = {};
// }

console.log(`----------happening!--------\n`);

module.exports = {

  production: {
    client: 'postgresql',
    connection: '',
    migrations: {
      tableName: 'db_migrations',
      directory: 'db/migrations'
    }
  }

};
