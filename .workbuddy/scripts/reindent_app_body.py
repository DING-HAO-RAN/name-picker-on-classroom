"""一次性脚本：把 app-shell__body 包裹层内的 JSX 统一缩进两个空格。

任务完成后保留此文件作为修改痕迹（不属于应用运行时产物）。
"""

from pathlib import Path

TARGET = Path(r"D:\桌面\项目‘\抽取器\src\renderer\App.tsx")
START_MARKER = '      <div className="app-shell__body">'
END_MARKER = "    </main>"

lines = TARGET.read_text(encoding="utf-8").splitlines(keepends=True)

start = next(index for index, line in enumerate(lines) if line.rstrip("\r\n") == START_MARKER)
end = next(
    index
    for index in range(len(lines) - 1, start, -1)
    if lines[index].rstrip("\r\n") == END_MARKER
)

changed = 0
for index in range(start + 1, end):
    if lines[index].strip():
        lines[index] = "  " + lines[index]
        changed += 1

TARGET.write_text("".join(lines), encoding="utf-8")
print(f"re-indented {changed} lines between {start + 2} and {end}")
