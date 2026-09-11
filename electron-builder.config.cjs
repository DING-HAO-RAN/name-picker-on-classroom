const packageJson = require('./package.json');

module.exports = {
  ...packageJson.build,
  win: {
    ...packageJson.build.win,
    signAndEditExecutable: process.env.NAME_PICKER_SKIP_RESOURCE_EDIT !== '1',
  },
};
