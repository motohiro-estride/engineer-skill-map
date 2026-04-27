// ターミナル UI のランナー: タイプライター + コマンド逐次実行 + 自動再生 + ユーザー入力モード。
// DOM 操作は本ファイルに集約。コマンド出力の生成は commands.ts、データ取得は data-source.ts。

import type { TerminalData } from "./data-source";
import { runCommand, getCompletions, type CommandLine } from "./commands";

export interface TerminalElements {
  root: HTMLElement;
  output: HTMLElement;
  promptLine: HTMLElement;
  promptCwd: HTMLElement;
  inputDisplay: HTMLElement;
  cursor: HTMLElement;
  rootScroll: HTMLElement;
  /** モバイルで IME を呼び出すための不可視 input。デスクトップでも常駐 focus する。 */
  inputProxy: HTMLInputElement;
}

interface Options {
  data: TerminalData;
  elements: TerminalElements;
  /** 自動再生で実行するコマンド一覧 */
  autoplay: string[];
  /** タイプライター速度 (ms/文字) */
  typeSpeed?: number;
  /** 出力行間の遅延 (ms/行) */
  lineDelay?: number;
  /** コマンド間の pause (ms) */
  commandPause?: number;
}

export class TerminalRunner {
  private data: TerminalData;
  private el: TerminalElements;
  private autoplay: string[];
  private typeSpeed: number;
  private lineDelay: number;
  private commandPause: number;
  private autoplayActive = false;
  private autoplayCancelled = false;
  private inputBuffer = "";
  private history: string[] = [];
  private historyIndex = -1;
  private inputEnabled = false;
  private cwd = "~";

  constructor(opts: Options) {
    this.data = opts.data;
    this.el = opts.elements;
    this.autoplay = opts.autoplay;
    this.typeSpeed = opts.typeSpeed ?? 60;
    this.lineDelay = opts.lineDelay ?? 12;
    this.commandPause = opts.commandPause ?? 700;
  }

  async start(): Promise<void> {
    this.attachListeners();
    this.hidePrompt();
    this.updatePromptCwd();
    await this.runAutoplay();
    this.enableUserInput();
  }

  private async runAutoplay(): Promise<void> {
    this.autoplayActive = true;
    for (const cmd of this.autoplay) {
      if (this.autoplayCancelled) break;
      await this.runCommandWithTyping(cmd);
      if (this.autoplayCancelled) break;
      await this.wait(this.commandPause);
    }
    this.autoplayActive = false;
  }

  private async runCommandWithTyping(cmd: string): Promise<void> {
    // プロンプト行を表示し、コマンドを1文字ずつ追加
    const promptEl = document.createElement("div");
    promptEl.className = "term-line term-prompt-input";
    promptEl.innerHTML = `<span class="term-prompt-cwd">${escapeHtml(this.cwd)}</span> <span class="term-prompt-symbol">❯</span> <span class="term-typed"></span>`;
    this.el.output.appendChild(promptEl);
    const typedEl = promptEl.querySelector(".term-typed") as HTMLElement;

    for (const ch of cmd) {
      if (this.autoplayCancelled) {
        typedEl.textContent = cmd;
        break;
      }
      typedEl.textContent = (typedEl.textContent ?? "") + ch;
      this.scrollToBottom();
      await this.wait(this.typeSpeed);
    }

    if (!this.autoplayCancelled) {
      await this.wait(300 + Math.random() * 300);
    }

    // コマンド実行 → 出力
    const result = runCommand(cmd, this.data, { cwd: this.cwd });
    if (result.newCwd) {
      this.cwd = result.newCwd;
      this.updatePromptCwd();
    }
    for (const line of result.lines) {
      if (this.autoplayCancelled) break;
      this.appendLine(line);
      await this.wait(this.lineDelay);
    }
  }

  private appendLine(line: CommandLine): void {
    const el = document.createElement("div");
    el.className = `term-line term-line-${line.kind ?? "default"}`;
    el.textContent = line.text || " "; // 空行を高さ持たせる
    this.el.output.appendChild(el);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    this.el.rootScroll.scrollTop = this.el.rootScroll.scrollHeight;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // --- ユーザー入力モード ---

  private hidePrompt(): void {
    this.el.promptLine.style.visibility = "hidden";
  }

  private showPrompt(): void {
    this.el.promptLine.style.visibility = "visible";
    this.el.inputDisplay.textContent = this.inputBuffer;
    this.scrollToBottom();
  }

  private updatePromptCwd(): void {
    this.el.promptCwd.textContent = this.cwd;
  }

  private enableUserInput(): void {
    this.inputEnabled = true;
    this.showPrompt();
    // デスクトップでは自動 focus でそのまま打てる。モバイルは focus() だけでは IME が出ないが、
    // ユーザーがタップすれば click ハンドラ経由で focus される。
    this.el.inputProxy.focus({ preventScroll: true });
  }

  private syncDisplayFromProxy(): void {
    this.inputBuffer = this.el.inputProxy.value;
    this.el.inputDisplay.textContent = this.inputBuffer;
    this.scrollToBottom();
  }

  /** inputBuffer をプログラム的に書き換えた後、表示と proxy を同期する。 */
  private setInputBuffer(value: string): void {
    this.inputBuffer = value;
    this.el.inputProxy.value = value;
    this.el.inputDisplay.textContent = value;
  }

  private attachListeners(): void {
    // 自動再生中の任意キーでのスキップ用 (input にフォーカスが無くても効くように document に置く)
    document.addEventListener("keydown", () => {
      if (document.documentElement.dataset.mode === "plain") return;
      if (this.autoplayActive) this.autoplayCancelled = true;
    });

    // ターミナル領域タップで input proxy に focus → モバイルで IME を呼び出す。
    // 自動再生中は同時にスキップ。
    this.el.root.addEventListener("click", () => {
      if (document.documentElement.dataset.mode === "plain") return;
      if (this.autoplayActive) this.autoplayCancelled = true;
      this.el.inputProxy.focus({ preventScroll: true });
    });

    // 文字入力 (英数, IME 確定, モバイルキーボードからの入力すべて) は input イベントで拾う。
    this.el.inputProxy.addEventListener("input", () => {
      if (document.documentElement.dataset.mode === "plain") return;
      if (!this.inputEnabled) {
        // 入力受付前は proxy に流れた文字を捨てる
        this.el.inputProxy.value = "";
        return;
      }
      this.syncDisplayFromProxy();
    });

    // Enter / Tab / 矢印キーは keydown で拾う (input イベントには来ないため)
    this.el.inputProxy.addEventListener("keydown", (e) => this.handleProxyKey(e));
  }

  private handleProxyKey(e: KeyboardEvent): void {
    if (document.documentElement.dataset.mode === "plain") return;
    if (this.autoplayActive) {
      this.autoplayCancelled = true;
      return;
    }
    if (!this.inputEnabled) return;

    if (e.key === "Enter") {
      e.preventDefault();
      this.submitInput();
    } else if (e.key === "Tab") {
      e.preventDefault();
      this.handleTab();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.recallHistory(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      this.recallHistory(1);
    }
    // 通常キー / Backspace は input 要素本来の挙動に任せ、input イベントで同期する
  }

  // --- Tab 補完 ---

  private handleTab(): void {
    const buf = this.inputBuffer;
    const candidates = getCompletions(buf, this.data, { cwd: this.cwd });
    if (candidates.length === 0) return;

    const trailingSpace = /\s$/.test(buf);
    const trimmed = buf.trim();
    const tokens = trimmed === "" ? [] : trimmed.split(/\s+/);
    const lastToken = trailingSpace ? "" : tokens[tokens.length - 1] ?? "";

    if (candidates.length === 1) {
      this.replaceLastToken(lastToken, candidates[0]!);
      return;
    }

    const lcp = longestCommonPrefix(candidates);
    if (lcp.length > lastToken.length) {
      this.replaceLastToken(lastToken, lcp);
      return;
    }

    // LCP で進展なし → 候補一覧を表示
    this.showCompletionCandidates(candidates);
  }

  private replaceLastToken(lastToken: string, replacement: string): void {
    const buf = this.inputBuffer;
    this.setInputBuffer(buf.slice(0, buf.length - lastToken.length) + replacement);
  }

  private showCompletionCandidates(candidates: string[]): void {
    // 現在のプロンプト + 入力中バッファを echo
    const echo = document.createElement("div");
    echo.className = "term-line term-prompt-input";
    echo.innerHTML = `<span class="term-prompt-cwd">${escapeHtml(this.cwd)}</span> <span class="term-prompt-symbol">❯</span> <span class="term-typed">${escapeHtml(this.inputBuffer)}</span>`;
    this.el.output.appendChild(echo);

    // 候補一覧 (空白区切り)
    const list = document.createElement("div");
    list.className = "term-line term-line-muted";
    list.textContent = candidates.join("  ");
    this.el.output.appendChild(list);
    this.scrollToBottom();
  }

  private recallHistory(direction: number): void {
    if (this.history.length === 0) return;
    if (this.historyIndex === -1 && direction > 0) return;
    if (this.historyIndex === -1) this.historyIndex = this.history.length;
    this.historyIndex += direction;
    if (this.historyIndex < 0) this.historyIndex = 0;
    if (this.historyIndex >= this.history.length) {
      this.historyIndex = -1;
      this.setInputBuffer("");
    } else {
      this.setInputBuffer(this.history[this.historyIndex]!);
    }
  }

  private submitInput(): void {
    const cmd = this.inputBuffer;
    this.setInputBuffer("");
    this.historyIndex = -1;

    if (!cmd.trim()) {
      // 空 Enter は新しいプロンプト行だけ
      const empty = document.createElement("div");
      empty.className = "term-line term-prompt-input";
      empty.innerHTML = `<span class="term-prompt-cwd">${escapeHtml(this.cwd)}</span> <span class="term-prompt-symbol">❯</span>`;
      this.el.output.appendChild(empty);
      this.scrollToBottom();
      return;
    }

    this.history.push(cmd);

    // clear / replay は特殊処理
    if (cmd.trim() === "clear") {
      this.el.output.innerHTML = "";
      return;
    }
    if (cmd.trim() === "replay") {
      this.el.output.innerHTML = "";
      this.inputEnabled = false;
      this.cwd = "~";
      this.updatePromptCwd();
      this.hidePrompt();
      this.autoplayCancelled = false;
      this.runAutoplay().then(() => this.enableUserInput());
      return;
    }

    // 通常コマンド: 入力エコー + 実行 + 出力
    const echo = document.createElement("div");
    echo.className = "term-line term-prompt-input";
    echo.innerHTML = `<span class="term-prompt-cwd">${escapeHtml(this.cwd)}</span> <span class="term-prompt-symbol">❯</span> <span class="term-typed">${escapeHtml(cmd)}</span>`;
    this.el.output.appendChild(echo);

    const result = runCommand(cmd, this.data, { cwd: this.cwd });
    if (result.newCwd) {
      this.cwd = result.newCwd;
      this.updatePromptCwd();
    }
    for (const line of result.lines) {
      this.appendLine(line);
    }
    this.scrollToBottom();
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function longestCommonPrefix(strs: string[]): string {
  if (strs.length === 0) return "";
  let prefix = strs[0]!;
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i]!.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix === "") return "";
    }
  }
  return prefix;
}
