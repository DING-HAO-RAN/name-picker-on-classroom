# 检查 GITHUB_TOKEN 是否存在于环境（只打印是否存在与长度，不打印内容）
import os

token = os.environ.get('GITHUB_TOKEN', '')
out = r'D:\桌面\项目‘\抽取器\.workbuddy\token-check.txt'
with open(out, 'w', encoding='utf-8') as handle:
    handle.write(f'GITHUB_TOKEN present: {bool(token)} (length={len(token)})')
print('done')
