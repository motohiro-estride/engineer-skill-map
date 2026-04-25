[ -f "$HOME/.zshrc" ] && ZDOTDIR="$HOME" source "$HOME/.zshrc"

prompt off 2>/dev/null

# プロンプトの色設定（256色番号 https://jonasjacek.github.io/colors/ ）
PROMPT_COLOR_PATH=39     # ディレクトリ名: ドジャーブルー
PROMPT_COLOR_BRANCH=42   # gitブランチ: 濃いめのグリーン
PROMPT_COLOR_ARROW=magenta  # ❯ 記号: マゼンタ

autoload -Uz vcs_info add-zsh-hook
zstyle ':vcs_info:*' enable git
zstyle ':vcs_info:git:*' check-for-changes true
zstyle ':vcs_info:git:*' formats " %F{${PROMPT_COLOR_BRANCH}}%b%u%c%f"
zstyle ':vcs_info:git:*' actionformats " %F{${PROMPT_COLOR_BRANCH}}%b|%a%u%c%f"
zstyle ':vcs_info:git:*' unstagedstr '*'
zstyle ':vcs_info:git:*' stagedstr '+'
add-zsh-hook precmd vcs_info

setopt PROMPT_SUBST
PROMPT="%F{${PROMPT_COLOR_PATH}}%1~%f"'${vcs_info_msg_0_}'"
%F{${PROMPT_COLOR_ARROW}}❯%f "
RPROMPT=''

gitd() {
  git checkout -q main && git pull -q --prune

  local local_merged
  local_merged=$(git branch --merged main | grep -vE '^\*|^\s*main$|^\s*master$')
  if [ -n "$local_merged" ]; then
    echo "$local_merged" | xargs -n 1 git branch -d
  fi

  local remote_merged
  remote_merged=$(git branch -r --merged origin/main | grep -vE 'origin/(main|master|HEAD)' | sed 's|origin/||')
  if [ -n "$remote_merged" ]; then
    echo "$remote_merged" | xargs -n 1 git push origin --delete
  fi
}
