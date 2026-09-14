# 清理 release/ 目录内部条目（保留 release 目录本身）。
# 注意：本机沙箱对目录本身的删除/改名会被拦截，因此逐个删除内部文件与子目录。
import os
import shutil
import stat

# 仓库根目录：脚本位于 <root>/.workbuddy/scripts/ 下，向上三级
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RELEASE_DIR = os.path.join(REPO_ROOT, "release")


def force_remove(func, path, _exc_info):
    # 只读文件先去掉只读位再删
    os.chmod(path, stat.S_IWRITE)
    func(path)


def main():
    if not os.path.isdir(RELEASE_DIR):
        print(f"release 目录不存在，跳过: {RELEASE_DIR}")
        return
    removed = 0
    for name in os.listdir(RELEASE_DIR):
        path = os.path.join(RELEASE_DIR, name)
        try:
            if os.path.isdir(path):
                shutil.rmtree(path, onerror=force_remove)
            else:
                os.chmod(path, stat.S_IWRITE)
                os.remove(path)
            removed += 1
            print(f"已删除: {name}")
        except OSError as error:
            print(f"删除失败 {name}: {error}")
    print(f"共删除 {removed} 个条目")


if __name__ == "__main__":
    main()
