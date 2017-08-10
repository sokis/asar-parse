const AsarParse = require('../bin/asar-parse.js');
var parse = new AsarParse(__dirname + '/model.asar')
parse.patch(); // begin
require('./src/b') // entry
parse.unpatch(); // after