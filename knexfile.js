// Update with your config settings.
var fs = require('fs');
var path = require('path');

// if (fs.existsSync('./config/local.js')) {
//   var local = require('./config/local.js').connections.postgresql;
//   var test = require('./config/local.js').testConnection;
// } else {
//   var local = {};
// }

console.log(`----------happening!--------\n`, __dirname);
console.log(`----------happening!--------\n`, path.resolve(__dirname));
console.log(`----------happening!--------\n`, path.resolve('../'));

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
