# 便携包进程级检查：每 3 秒采样一次，观察进程是否在某个时间点自行退出。
# 保留作排查痕迹，不属于运行时产物。
$ErrorActionPreference = 'SilentlyContinue'
Set-Location (Join-Path $PSScriptRoot '..\..')

$log = @()
$proc = Start-Process -FilePath "release\NamePicker-1.0.0.exe" -PassThru
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
$log | Set-Content ".workbuddy\portable-check.txt" -Encoding utf8
