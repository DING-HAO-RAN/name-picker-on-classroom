"""一次性脚本：撤销 app-shell__body 包裹层引入的缩进，并删除该包裹层。

之所以回退：改用固定定位的标题栏后不需要额外包裹层，
保留大范围仅空白变更会让 diff 噪声远大于实际改动。
保留此文件作为修改痕迹，不属于应用运行时产物。
"""

from pathlib import Path

TARGET = Path(r"D:\桌面\项目‘\抽取器\src\renderer\App.tsx")
START_MARKER = '      <div className="app-shell__body">'
END_MARKER = "    </main>"
CLOSE_MARKER = "      </div>"

lines = TARGET.read_text(encoding="utf-8").splitlines(keepends=True)

start = next(index for index in enumerate(lines) if index[1].rstrip("\r\n") == START_MARKER)[0]
end = next(
    index
    for index in range(len(lines) - 1, start, -1)
    if lines[index].rstrip("\r\n") == END_MARKER
)

# 找到包裹层自身的结束标签（紧邻 </main> 之前）
close_index = end - 1
if lines[close_index].rstrip("\r\n") != CLOSE_MARKER:
    raise SystemExit(f"未找到包裹层结束标签，实际内容：{lines[close_index]!r}")

changed = 0
for index in range(start + 1, close_index):
    if lines[index].startswith("  "):
        lines[index] = lines[index][2:]
        changed += 1

# 先删结束标签，再删起始标签，避免索引位移
del lines[close_index]
del lines[start]

TARGET.write_text("".join(lines), encoding="utf-8")
print(f"de-indented {changed} lines; removed wrapper at lines {start + 1} and {close_index + 1}")
