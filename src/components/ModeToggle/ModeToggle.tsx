// World mode ⇄ Plain mode の切替トグル (右下固定)
// localStorage に状態を永続化、URL ?plain=1 で強制 Plain、prefers-reduced-motion で強制 Plain。
// 詳細: .claude/design/world-design.md

import { useEffect, useState } from "react";

type Mode = "world" | "plain";
const STORAGE_KEY = "skillmap.mode";

function readInitialMode(): Mode {
  if (typeof window === "undefined") return "plain";

  const params = new URLSearchParams(window.location.search);
  if (params.get("plain") === "1") return "plain";

  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return "plain";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "world" ? "world" : "plain";
}

export function ModeToggle() {
  // SSR 整合のため初期 state は plain、useEffect で実値を反映
  const [mode, setMode] = useState<Mode>("plain");

  useEffect(() => {
    // 起動時は inline script で dataset.mode が既に設定されている前提。
    // ここでは現状を読み込んで内部 state と同期するだけ。
    const current = document.documentElement.dataset.mode as Mode | undefined;
    if (current === "plain" || current === "world") {
      setMode(current);
    } else {
      const fallback = readInitialMode();
      setMode(fallback);
      document.documentElement.dataset.mode = fallback;
    }
  }, []);

  const toggle = () => {
    const next: Mode = mode === "world" ? "plain" : "world";
    setMode(next);
    document.documentElement.dataset.mode = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage が使えない環境では諦める
    }

    // world モードに切り替えた直後はターミナル入力へフォーカスを移す。
    // そのままだとボタンがフォーカスを保持し、Enter 押下で停止トグルが誤発火する。
    if (next === "world") {
      requestAnimationFrame(() => {
        document.getElementById("term-input-proxy")?.focus();
      });
    }
  };

  const label = mode === "world" ? "■ 停止" : "▶ 世界観";
  const aria =
    mode === "world" ? "アニメーションを停止する" : "世界観モードに戻す";

  return (
    <button
      id="mode-toggle"
      type="button"
      onClick={toggle}
      aria-label={aria}
      title={aria}
      tabIndex={mode === "world" ? -1 : 0}
      className="fixed right-4 bottom-4 z-50 cursor-pointer rounded-md border border-white/20 bg-black/60 px-3 py-1.5 font-mono text-xs text-white/90 backdrop-blur-md transition-colors hover:bg-black/80"
    >
      {label}
    </button>
  );
}
