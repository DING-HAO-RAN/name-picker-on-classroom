"""清理 release/ 内部条目（保留目录本身，沙箱会拦截对该目录的删除）。

打包前必须执行：上一轮残留的 win-unpacked 会被占用，electron-builder 覆盖时无限重试。
"""

import os
import shutil
import stat
import sys

# .workbuddy/scripts/clean-release-dir.py → 上溯三级得到项目根目录
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# 支持通过命令行参数指定输出目录（默认 release/），例如：python clean-release-dir.py release13
release_dir = os.path.normpath(os.path.join(project_root, sys.argv[1] if len(sys.argv) > 1 else 'release'))


def force_writable(func, path, _exc_info):
    os.chmod(path, stat.S_IWRITE)
    func(path)


def main():
    if not os.path.isdir(release_dir):
        print('release 目录不存在，跳过')
        return 0
    entries = os.listdir(release_dir)
    removed = []
    failed = []
    for name in entries:
        target = os.path.join(release_dir, name)
        try:
            if os.path.isdir(target) and not os.path.islink(target):
                shutil.rmtree(target, onerror=force_writable)
            else:
                os.chmod(target, stat.S_IWRITE)
                os.remove(target)
            removed.append(name)
        except Exception as error:  # noqa: BLE001 - 只做记录，继续处理其余条目
            failed.append(f'{name}: {error}')
    print(f'已删除 {len(removed)} 项：')
    for name in removed:
        print('  -', name)
    if failed:
        print('删除失败：')
        for line in failed:
            print('  !', line)
        return 1
    print('剩余条目数：', len(os.listdir(release_dir)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
