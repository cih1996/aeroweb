const { rmSync } = require('fs');
const { join } = require('path');

const releaseDir = join(__dirname, '../release');

try {
  console.log('清理 release 目录...');
  rmSync(releaseDir, { recursive: true, force: true });
  console.log('清理完成！');
} catch (error) {
  // 如果目录不存在或已被删除，忽略错误
  if (error.code !== 'ENOENT') {
    console.warn('清理 release 目录时出现警告:', error.message);
  }
}

