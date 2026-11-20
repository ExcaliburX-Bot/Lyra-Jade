#!/usr/bin/env bash
# 确保远端有 data 分支（机器写的数据都放在这里，主分支只放代码和文章）。第一次运行时建一个空分支。
set -euo pipefail
BR="${WG_DATA_BRANCH:-data}"
if git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; then exit 0; fi
git config user.name  >/dev/null || git config user.name  "weiguang-bot"
git config user.email >/dev/null || git config user.email "weiguang-bot@users.noreply.github.com"
tree=$(git hash-object -w -t tree /dev/null)
commit=$(git commit-tree "$tree" -m "init: 机器数据分支（素材库、候选、原文存档、审核报告）")
git push origin "$commit:refs/heads/$BR"
echo "已创建 $BR 分支"
