# 深度清理 release/win-unpacked：先逐个删除文件，再自底向上删除空目录。
# 沙箱会把删除改成移入回收站，一次性整树删除可能被中断，因此逐个处理并容忍个别失败。
import os
import stat

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TARGET = os.path.join(REPO_ROOT, "release", "win-unpacked")


def force_remove(func, path, _exc_info):
    os.chmod(path, stat.S_IWRITE)
    func(path)


def main():
    if not os.path.isdir(TARGET):
        print("win-unpacked 不存在，无需清理")
        return
    # 收集所有文件和目录，文件在前
    files = []
    dirs = []
    for root, dir_names, file_names in os.walk(TARGET):
        for file_name in file_names:
            files.append(os.path.join(root, file_name))
        for dir_name in dir_names:
            dirs.append(os.path.join(root, dir_name))
    # 自底向上删除目录
    dirs.sort(key=len, reverse=True)

    failed_files = 0
    for file_path in files:
        try:
            os.chmod(file_path, stat.S_IWRITE)
            os.remove(file_path)
        except OSError as error:
            failed_files += 1
            print(f"文件删除失败: {file_path} -> {error}")

    failed_dirs = 0
    for dir_path in dirs:
        try:
            os.rmdir(dir_path)
        except OSError as error:
            failed_dirs += 1
            print(f"目录删除失败: {dir_path} -> {error}")

    try:
        os.rmdir(TARGET)
        print("win-unpacked 已完全删除")
    except OSError as error:
        print(f"顶层目录删除失败: {error}")

    print(f"文件总数 {len(files)}，失败 {failed_files}；目录总数 {len(dirs)}，失败 {failed_dirs}")


if __name__ == "__main__":
    main()
