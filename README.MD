# Asar-Parse
直接从`asar`格式文件中载入模块

## 用法

例：
```javascript
  const AsarParse = require('./bin/asar-parse.js');
  var parse = new AsarParse('model.asar')

  parse.patch(); // 挂载钩子函数
  require('./colors') // 从当前目录下载入 colors 模块 
  parse.unpatch(); // 卸载钩子函数  
```

### new AsarParse ( archive )  
实例化 AsarParse 对象，并载入指定的 asar 文件

### patch ()
挂载钩子函数，劫持 module._findModule，fs.readFileSync， fs.readFile。从而`require`可以直接从asar 文件中尝试载入模块

### unpatch ()
卸载钩子劫持

## 相关项目
* [electron - asar]（https://github.com/electron/asar）