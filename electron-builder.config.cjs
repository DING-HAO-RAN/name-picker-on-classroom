const packageJson = require('./package.json');

module.exports = {
  ...packageJson.build,
  // 输出目录默认 release/；可用 NAME_PICKER_OUTPUT_DIR 覆盖（如旧输出目录被占用时）
  directories: {
    output: process.env.NAME_PICKER_OUTPUT_DIR || packageJson.build.directories.output,
  },
  win: {
    ...packageJson.build.win,
    signAndEditExecutable: process.env.NAME_PICKER_SKIP_RESOURCE_EDIT !== '1',
  },
};
