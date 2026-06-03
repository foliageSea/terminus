#!/usr/bin/env sh

set -eu

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

die() {
  echo "错误：$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令：$1"
}

confirm() {
  message="$1"
  printf '%s [y/N] ' "$message"
  read -r answer
  case "$answer" in
    y | Y | yes | YES) return 0 ;;
    *) return 1 ;;
  esac
}

is_semver() {
  node -e "process.exit(/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(process.argv[1]) ? 0 : 1)" "$1"
}

require_cmd git
require_cmd node
require_cmd pnpm
require_cmd gh

remote="${RELEASE_REMOTE:-origin}"
current_branch="$(git branch --show-current)"
[ -n "$current_branch" ] || die "当前处于 detached HEAD，无法发版"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "当前目录不是 Git 仓库"
git remote get-url "$remote" >/dev/null 2>&1 || die "找不到 Git remote：$remote"

if ! git diff --quiet || ! git diff --cached --quiet; then
  die "工作区不干净，请先提交或暂存现有改动后再发版"
fi

gh auth status >/dev/null 2>&1 || die "GitHub CLI 未登录，请先执行：gh auth login"

echo "正在同步远端 tag..."
git fetch --tags "$remote"

current_version="$(node -p "require('./package.json').version")"
echo "当前版本：$current_version"

version=""
while [ -z "$version" ]; do
  printf '请输入新版本号（例如 1.0.7）：'
  read -r input_version
  input_version="${input_version#v}"

  if ! is_semver "$input_version"; then
    echo "版本号格式不正确，请使用 SemVer，例如 1.0.7 或 1.0.7-beta.1"
    continue
  fi

  if [ "$input_version" = "$current_version" ]; then
    echo "新版本号不能和当前版本相同"
    continue
  fi

  tag="v$input_version"
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    echo "本地 tag 已存在：$tag"
    continue
  fi

  if git ls-remote --exit-code --tags "$remote" "refs/tags/$tag" >/dev/null 2>&1; then
    echo "远端 tag 已存在：$tag"
    continue
  fi

  if gh release view "$tag" >/dev/null 2>&1; then
    echo "GitHub Release 已存在：$tag"
    continue
  fi

  version="$input_version"
done

tag="v$version"

echo
echo "即将执行发版："
echo "  分支：$current_branch"
echo "  版本：$current_version -> $version"
echo "  Tag：$tag"
echo "  Remote：$remote"
echo
echo "注意：当前 GitHub Actions 仅通过 push.tags 触发发版构建；创建 Release 不会再次触发构建。"
confirm "确认继续？" || die "已取消"

echo "更新 package.json 版本..."
pnpm version "$version" --no-git-tag-version

echo "校验依赖锁文件..."
pnpm install --frozen-lockfile

echo "执行类型检查..."
pnpm typecheck

if confirm "是否执行 lint？"; then
  pnpm lint
fi

git add package.json pnpm-lock.yaml

if git diff --cached --quiet; then
  die "没有检测到可提交的版本变更"
fi

commit_message="chore(release): 发布 $tag"
echo "创建提交：$commit_message"
git commit -m "$commit_message"

echo "创建 tag：$tag"
git tag -a "$tag" -m "$tag"

echo "推送分支：$current_branch"
git push "$remote" "$current_branch"

echo "推送 tag：$tag"
git push "$remote" "$tag"

echo "创建 GitHub Release：$tag"
gh release create "$tag" --title "$tag" --generate-notes --verify-tag

echo "发版完成：$tag"
