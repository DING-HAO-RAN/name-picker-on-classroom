# 名字抽取器发布说明

## 打包方式

在仓库根目录执行。本机账户缺少创建符号链接的特权，完整资源编辑打包必然失败（`winCodeSign` 解包报「客户端没有所需的特权」），必须使用受限模式：

```powershell
$env:NAME_PICKER_SKIP_RESOURCE_EDIT = '1'
npm run package:win
Remove-Item Env:NAME_PICKER_SKIP_RESOURCE_EDIT
```

打包前先清理 `release/` 目录内部条目（保留目录本身，逐个删除其中的文件与子目录），否则上一轮失败残留的 `release/win-unpacked` 会导致 electron-builder 在 `packaging` 阶段无限重试。

命令会先构建再产出两个 x64 产物，输出到 `release/`：

| 类型 | 产物 |
|---|---|
| NSIS 安装包 | `release/NamePicker Setup-1.0.0.exe` |
| portable 便携包 | `release/NamePicker-1.0.0.exe` |

不做产物哈希校验：产物以 `release/` 目录内实际生成的文件为准，安装包能否使用以实际安装或直接运行的结果为准。

## 发布前必须知晓的限制

1. `NAME_PICKER_SKIP_RESOURCE_EDIT=1` 只绕过本机资源编辑限制，受限包不等同于完整资源发布验证；生产发布应在具备符号链接权限的环境中不设置该变量重新打包。
2. 仓库未配置代码签名证书，两个产物的签名状态始终为 `NotSigned`，不要在发布说明中声称已签名。
3. 目标平台声明为 Windows 10/11 x64，实际仅在当前开发机（Windows 11）验证过。
4. `release/` 产物由 `.gitignore` 保护，不提交二进制。
