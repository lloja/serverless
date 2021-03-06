'use strict';

const os = require('os');
const path = require('path');
const { memoize } = require('lodash');
const BbPromise = require('bluebird');
const childProcess = BbPromise.promisifyAll(require('child_process'));
const fse = require('fs-extra');
const { version } = require('../../../../package');
const getTmpDirPath = require('../../../utils/fs/getTmpDirPath');
const createZipFile = require('../../../utils/fs/createZipFile');
const npmCommandDeferred = require('../../../utils/npm-command-deferred');

const srcDirPath = path.join(__dirname, 'resources');

module.exports = memoize(() => {
  const cachedZipFilePath = path.join(
    os.homedir(),
    '.serverless/cache/custom-resources',
    version,
    'custom-resources.zip'
  );

  return fse
    .lstat(cachedZipFilePath)
    .then(
      stats => {
        if (stats.isFile()) return true;
        return false;
      },
      error => {
        if (error.code === 'ENOENT') return false;
        throw error;
      }
    )
    .then(isCached => {
      if (isCached) return cachedZipFilePath;
      const ensureCachedDirDeferred = fse.ensureDir(path.dirname(cachedZipFilePath));
      const tmpDirPath = getTmpDirPath();
      const tmpInstalledLambdaPath = path.resolve(tmpDirPath, 'resource-lambda');
      const tmpZipFilePath = path.resolve(tmpDirPath, 'resource-lambda.zip');
      return fse
        .copy(srcDirPath, tmpInstalledLambdaPath)
        .then(() => npmCommandDeferred)
        .then(npmCommand =>
          childProcess.execAsync(`${npmCommand} install`, { cwd: tmpInstalledLambdaPath })
        )
        .then(() => ensureCachedDirDeferred)
        .then(() => createZipFile(tmpInstalledLambdaPath, tmpZipFilePath))
        .then(() => fse.move(tmpZipFilePath, cachedZipFilePath))
        .then(() => cachedZipFilePath);
    });
});
