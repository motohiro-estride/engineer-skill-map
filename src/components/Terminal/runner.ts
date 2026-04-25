// ターミナル UI のランナー: タイプライター + コマンド逐次実行 + 自動再生 + ユーザー入力モード。
// DOM 操作は本ファイルに集約。コマンド出力の生成は commands.ts、データ取得は data-source.ts。

import type { TerminalData } from "./data-source";
import { runCommand, type CommandLine } from "./commands";

export interface TerminalElements {
  output: HTMLElement;
  promptLine: HTMLElement;
  prompt: HTMLElement;
  inputDisplay: HTMLElement;
  cursor: HTMLElement;
  rootScroll: HTMLElement;
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

  constructor(opts: Options) {
    this.data = opts.data;
    this.el = opts.elements;
    this.autoplay = opts.autoplay;
    this.typeSpeed = opts.typeSpeed ?? 60;
    this.lineDelay = opts.lineDelay ?? 12;
    this.commandPause = opts.commandPause ?? 700;
  }

  async start(): Promise<void> {
    this.attachKeyListener();
    this.hidePrompt();
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
    promptEl.innerHTML = `<span class="term-prompt-symbol">❯</span> <span class="term-typed"></span>`;
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
    const result = runCommand(cmd, this.data);
    for (const line of result.lines) {
      if (this.autoplayCancelled) break;
      this.appendLine(line);
      await this.wait(this.lineDelay);
    }
  }

  private appendLine(line: CommandLine): void {
    const el = document.createElement("div");
    el.className = `term-line term-line-${line.kind ?? "default"}`;
    el.textContent = line.text || " "; // 空行を高さ持たせる
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

  private enableUserInput(): void {
    this.inputEnabled = true;
    this.showPrompt();
  }

  private attachKeyListener(): void {
    document.addEventListener("keydown", (e) => this.handleKey(e));
  }

  private handleKey(e: KeyboardEvent): void {
    // モード判定: Plain mode のときは無効
    if (document.documentElement.dataset.mode === "plain") return;

    // 自動再生中は任意キーでスキップ
    if (this.autoplayActive) {
      this.autoplayCancelled = true;
      return;
    }

    if (!this.inputEnabled) return;

    // 入力フォーカス系の要素にフォーカスがあるなら無視
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;

    if (e.key === "Enter") {
      this.submitInput();
      e.preventDefault();
    } else if (e.key === "Backspace") {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
      this.el.inputDisplay.textContent = this.inputBuffer;
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      this.recallHistory(-1);
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      this.recallHistory(1);
      e.preventDefault();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.inputBuffer += e.key;
      this.el.inputDisplay.textContent = this.inputBuffer;
    }
  }

  private recallHistory(direction: number): void {
    if (this.history.length === 0) return;
    if (this.historyIndex === -1 && direction > 0) return;
    if (this.historyIndex === -1) this.historyIndex = this.history.length;
    this.historyIndex += direction;
    if (this.historyIndex < 0) this.historyIndex = 0;
    if (this.historyIndex >= this.history.length) {
      this.historyIndex = -1;
      this.inputBuffer = "";
    } else {
      this.inputBuffer = this.history[this.historyIndex];
    }
    this.el.inputDisplay.textContent = this.inputBuffer;
  }

  private submitInput(): void {
    const cmd = this.inputBuffer;
    this.inputBuffer = "";
    this.el.inputDisplay.textContent = "";
    this.historyIndex = -1;

    if (!cmd.trim()) {
      // 空 Enter は新しいプロンプト行だけ
      const empty = document.createElement("div");
      empty.className = "term-line term-prompt-input";
      empty.innerHTML = `<span class="term-prompt-symbol">❯</span>`;
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
      this.hidePrompt();
      this.autoplayCancelled = false;
      this.runAutoplay().then(() => this.enableUserInput());
      return;
    }

    // 通常コマンド: 入力エコー + 実行 + 出力
    const echo = document.createElement("div");
    echo.className = "term-line term-prompt-input";
    echo.innerHTML = `<span class="term-prompt-symbol">❯</span> <span class="term-typed">${escapeHtml(cmd)}</span>`;
    this.el.output.appendChild(echo);

    const result = runCommand(cmd, this.data);
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
