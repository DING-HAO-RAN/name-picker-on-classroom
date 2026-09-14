# 进程级检查：按秒采样目标可执行文件的存活情况。
# 用法：watch-process-launch.ps1 <相对路径> [报告文件名]
# 保留作排查痕迹，不属于运行时产物。
param(
  [Parameter(Mandatory = $true)][string]$Target,
  [string]$Report = 'process-watch.txt'
)

$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$log = @("target=$Target")
$proc = Start-Process -FilePath $Target -PassThru
$log += ("launcher pid={0} startTime={1}" -f $proc.Id, $proc.StartTime.ToString('HH:mm:ss'))

for ($i = 1; $i -le 10; $i++) {
  Start-Sleep -Seconds 3
  $snapshot = @(Get-Process -Name "NamePicker*" -ErrorAction SilentlyContinue)
  $detail = if ($snapshot.Count -eq 0) {
    'none'
  } else {
    (($snapshot | ForEach-Object { "{0}:{1}" -f $_.Id, $_.Responding }) -join ' ')
  }
  $log += ("t={0,2}s alive={1} [{2}]" -f ($i * 3), $snapshot.Count, $detail)
}

$log += '--- 结束采样，清理进程 ---'
Get-Process -Name "NamePicker*" | Stop-Process -Force
$log | Set-Content (Join-Path '.workbuddy' $Report) -Encoding utf8
