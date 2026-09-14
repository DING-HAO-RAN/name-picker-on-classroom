# 用 Windows Restart Manager API 查出锁定指定文件的进程。
import ctypes
import ctypes.wintypes as wt

FILE_PATH = r"D:\桌面\项目‘\抽取器\release\win-unpacked\resources\app.asar"

kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
rstrtmgr = ctypes.WinDLL("rstrtmgr", use_last_error=True)

# 会话句柄
CCH_SESSION_KEY = 32
handle = wt.DWORD(0)
session_key = ctypes.create_unicode_buffer(CCH_SESSION_KEY + 1)

result = rstrtmgr.RmStartSession(
    ctypes.byref(handle), 0, session_key
)
if result != 0:
    raise SystemExit(f"RmStartSession 失败: {result}")

try:
    # rgsFileNames 是 LPCWSTR 数组：传入字符串指针数组
    file_path_ptr = ctypes.c_wchar_p(FILE_PATH)
    rg_file_names = (ctypes.c_wchar_p * 1)(file_path_ptr)
    n_files = wt.DWORD(1)

    result = rstrtmgr.RmRegisterResources(
        handle,
        n_files,
        ctypes.pointer(rg_file_names),
        0, None, 0, None,
    )
    if result != 0:
        raise SystemExit(f"RmRegisterResources 失败: {result}")

    class RM_PROCESS_INFO(ctypes.Structure):
        _fields_ = [
            ("Process", wt.DWORD),
            ("ProcessName", wt.WCHAR * 256),
            ("ApplicationType", wt.INT),
            ("AppStatus", wt.DWORD),
            ("TSSessionId", wt.DWORD),
            ("bRestartable", wt.BOOL),
        ]

    PROCESS_INFO_SIZE = 128
    process_info_size = wt.DWORD(PROCESS_INFO_SIZE)
    buffer = (RM_PROCESS_INFO * PROCESS_INFO_SIZE)()
    needed = wt.DWORD(0)
    reboot_reasons = wt.DWORD(0)

    result = rstrtmgr.RmGetList(
        handle,
        ctypes.byref(needed),
        ctypes.byref(process_info_size),
        buffer,
        ctypes.byref(reboot_reasons),
    )
    if result != 0:
        raise SystemExit(f"RmGetList 失败: {result}")

    count = process_info_size.value
    if count == 0:
        print("没有进程锁定该文件（可能是内核/过滤驱动层面的短暂占用）")
    for i in range(count):
        info = buffer[i]
        # 打开进程拿可执行文件路径
        pid = info.Process
        name = info.ProcessName
        print(f"锁定进程: PID={pid} Name={name}")
finally:
    rstrtmgr.RmEndSession(handle)
