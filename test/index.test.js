import fs from 'fs';
import path from 'path';
import test from 'ava';

import AsarParse from '../bin/asar-parse';

const parse = new AsarParse(path.join(__dirname, 'model.asar'));

test.before(() => {
    parse.patch();
});

test.after(() => {
    parse.unpatch();
});

test('construction', (t) => {
    t.is(typeof parse, 'object');
});

test('require 文件模块', (t) => {
    const colors = require('./colors/lib/index.js');

    t.is(typeof colors, 'object');
    t.is(typeof colors.red, 'function');
});

test('require 目录模块', (t) => {

    const colors = require('./colors');

    t.is(typeof colors, 'object');
    t.is(typeof colors.red, 'function');

});


test('require node_modules 模块 失败', (t) => {
    try {
        const colors = require('colors');
    } catch (error) {
        // 找不到 colors 模块
        t.is(error.code, 'MODULE_NOT_FOUND');
    }
});