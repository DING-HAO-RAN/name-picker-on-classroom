# 名字抽取器发布说明

## 打包方式

在仓库根目录执行。本机账户缺少创建符号链接的特权，完整资源编辑打包必然失败（`winCodeSign` 解包报「客户端没有所需的特权」），必须使用受限模式：

```powershell
$env:NAME_PICKER_SKIP_RESOURCE_EDIT = '1'
npm run package:win
Remove-Item Env:NAME_PICKER_SKIP_RESOURCE_EDIT
```

打包前先清理输出目录内部条目（保留目录本身，逐个删除其中的文件与子目录），否则上一轮失败残留的 `win-unpacked` 会导致 electron-builder 在 `packaging` 阶段无限重试。如果旧输出目录因文件被其他进程占用而无法清理，可以设置 `NAME_PICKER_OUTPUT_DIR`（如 `release2`）换一个全新的输出目录打包。

命令会先构建再产出两个 x64 产物，输出到 `release/`（或 `NAME_PICKER_OUTPUT_DIR` 指定的目录）：

| 类型 | 产物 |
|---|---|
| NSIS 安装包 | `NamePicker Setup-1.0.0.exe` |
| portable 便携包 | `NamePicker-1.0.0.exe` |

不做产物哈希校验：产物以 `release/` 目录内实际生成的文件为准，安装包能否使用以实际安装或直接运行的结果为准。对外发布时（GitHub Release）会把哈希附在页面上供下载者校验，那属于发布信息，不代替本节的验收结论。

## 发布前必须知晓的限制

1. `NAME_PICKER_SKIP_RESOURCE_EDIT=1` 只绕过本机资源编辑限制，受限包不等同于完整资源发布验证；生产发布应在具备符号链接权限的环境中不设置该变量重新打包。
2. 仓库未配置代码签名证书，两个产物的签名状态始终为 `NotSigned`，不要在发布说明中声称已签名。
3. 目标平台声明为 Windows 10/11 x64，实际仅在当前开发机（Windows 11）验证过。
4. `release/` 产物由 `.gitignore` 保护，不提交二进制。

## GitHub Release 发布记录（v1.0.0）

- 页面地址：https://github.com/DING-HAO-RAN/name-picker-on-classroom/releases/tag/v1.0.0
- 指向附注标签 `v1.0.0`（对应提交 `885f488`），发布方式为 REST API：创建 Release 后逐个上传附件
- 产物由提交 `885f488` 的源码重新打包得到（输出目录 `release3`，受限模式），渲染器产物为 `index-CgcK8kvd.js` / `index-DCarEvdx.css`

| 附件名 | 本地构建产物 | 字节数 | SHA-256 |
|---|---|---:|---|
| `NamePicker-Setup-1.0.0.exe` | `NamePicker Setup-1.0.0.exe` | 88,831,929 | `6f34a811caa913c4b0b16c1fe63974174747f172b845afd0c0f909b99fd884e3` |
| `NamePicker-1.0.0.exe` | `NamePicker-1.0.0.exe` | 88,626,185 | `723b5d6c615c63ae1f72b446ee5069338d29ccac2f4ca39df603c548458f3da4` |

GitHub 会把附件名里的空格替换为点，上传后安装包的文件名会变成 `NamePicker.Setup-1.0.0.exe`；本次已改名为 `NamePicker-Setup-1.0.0.exe`，方便命令行下载与上手的命令行安装脚本。

发布前的证据：

- 解包版 `release3/win-unpacked/NamePicker.exe` 通过 7 项启动检查——窗口标题、仍然是无边框窗口、预加载未暴露 Node 对象（`apiKeys` 只含业务方法）、标题栏三个按钮均可用、抽屉让开标题栏（`titlebarBottom=52, panelTop=52, titleWidth=66`）、停留时长默认值为 3000 毫秒
- `app.asar` 21,453,360 字节，解包目录 73 个文件共 323,759,648 字节

本节之外的限制在页面上如实写明：未做代码签名（SmartScreen 会拦截一次）、便携包只有构建与哈希校验而没有包内运行证据、只验证过 Windows 11 x64、打包走的是受限模式。
