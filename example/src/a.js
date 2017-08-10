var colors = require('../colors')
process.stdout.write(
    process.platform === 'win32' ? '\x1Bc' : '\x1B[2J\x1B[3J\x1B[H'
)
console.log(colors.red("\n=======================================\n"))
console.log(colors.random("require colors.."))
console.log(colors.red("\n======================================="))