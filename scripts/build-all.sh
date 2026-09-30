#!/usr/bin/env bash
# 一次 build 整個網站:根目錄的停車練習場 → dist/,其他每款遊戲 build 完放到 dist/<資料夾>/。
# Cloudflare Pages 和 GitHub Actions 都用這支(build 指令 = bash scripts/build-all.sh、輸出資料夾 = dist)。
# 新增一款遊戲 → 加進下面的 GAMES。本機已經裝好套件時可以 SKIP_INSTALL=1 跳過 npm ci。
set -euo pipefail
cd "$(dirname "$0")/.."

GAMES=(star-bees sky-aces monkey-king three-kingdoms temple-fair yokai-night night-market animal-brawl sengoku
  cartoon-1930 comic-hero ink-wuxia yarn-land stained-glass steam-sky pharaoh)

install() { if [ -z "${SKIP_INSTALL:-}" ]; then npm ci --no-audit --no-fund; fi; }

install
npm run build
for g in "${GAMES[@]}"; do
  echo "== $g"
  (cd "$g" && install && npm run build)
  rm -rf "dist/$g"
  cp -r "$g/dist" "dist/$g"
done
echo "全部 build 完成 → dist/"
