import { useState } from "react";
import type { ReactNode } from "react";
import { copyText } from "../lib/clipboard";

interface MethodBadgeProps {
  method: string;
}

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-green-400/10 text-green-200 border-green-400/50",
  POST: "bg-blue-400/10 text-blue-200 border-blue-400/50",
  PUT: "bg-amber-400/10 text-amber-200 border-amber-400/50",
  PATCH: "bg-purple-400/10 text-purple-200 border-purple-400/50",
  DELETE: "bg-red-400/10 text-red-200 border-red-400/50",
  HEAD: "bg-cyan-400/10 text-cyan-200 border-cyan-400/50",
  OPTIONS: "bg-teal-400/10 text-teal-200 border-teal-400/50",
};

const DEFAULT_METHOD_STYLE = "bg-slate-400/10 text-slate-200 border-slate-400/50";

export function MethodBadge({ method }: MethodBadgeProps): JSX.Element {
  const style = METHOD_STYLES[method.toUpperCase()] ?? DEFAULT_METHOD_STYLE;
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${style}`}>
      {method.toUpperCase()}
    </span>
  );
}

interface StatusBadgeProps {
  status: number;
  detail?: string;
}

function statusStyle(status: number): string {
  if (status === 0) {
    return "bg-red-400/10 text-red-200 border-red-400/50";
  }
  if (status >= 200 && status < 300) {
    return "bg-green-400/10 text-green-200 border-green-400/50";
  }
  if (status >= 300 && status < 400) {
    return "bg-blue-400/10 text-blue-200 border-blue-400/50";
  }
  if (status >= 400 && status < 500) {
    return "bg-amber-400/10 text-amber-200 border-amber-400/50";
  }
  if (status >= 500) {
    return "bg-red-400/10 text-red-200 border-red-400/50";
  }
  return "bg-slate-400/10 text-slate-200 border-slate-400/50";
}

function statusLabel(status: number, detail?: string): string {
  if (detail !== undefined) {
    return status === 0 ? detail : `${status} ${detail}`;
  }
  return status === 0 ? "ERROR" : String(status);
}

export function StatusBadge({ status, detail }: StatusBadgeProps): JSX.Element {
  const label = statusLabel(status, detail);
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs ${statusStyle(status)}`}>
      {label}
    </span>
  );
}

interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label }: CopyButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } else {
      console.warn("[copy failed]");
    }
  }

  return (
    <button
      className="max-w-full truncate rounded-full border border-cyan-400/50 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-200 transition-colors hover:bg-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
      onClick={() => void handleCopy()}
      title="Copiar al portapapeles"
      type="button"
    >
      {copied ? "¡Copiado!" : (label ?? text)}
    </button>
  );
}

interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
}

export function EmptyState({ message, icon }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-dashed border-slate-700 px-4 py-6 text-center">
      {icon !== undefined && <span aria-hidden="true">{icon}</span>}
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

interface PanelProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function Panel({ title, children, actions }: PanelProps): JSX.Element {
  return (
    <section className="w-full rounded-xl border border-slate-700 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type ExtensionState = "checking" | "connected" | "unavailable" | "local";

interface ExtensionIndicatorProps {
  state: ExtensionState;
  installHref?: string;
}

const EXTENSION_CONFIG: Record<ExtensionState, { pill: string; dot: string; text: string }> = {
  checking: {
    pill: "border-amber-400/50 bg-amber-400/10 text-amber-200",
    dot: "bg-amber-400 animate-pulse",
    text: "Verificando…",
  },
  connected: {
    pill: "border-green-400/50 bg-green-400/10 text-green-200",
    dot: "bg-green-400",
    text: "Extensión conectada",
  },
  unavailable: {
    pill: "border-slate-600 bg-slate-800 text-slate-300",
    dot: "bg-slate-400",
    text: "Extensión no disponible",
  },
  local: {
    pill: "border-cyan-400/50 bg-cyan-400/10 text-cyan-200",
    dot: "bg-cyan-400",
    text: "Modo local",
  },
};

export function ExtensionIndicator({ state, installHref }: ExtensionIndicatorProps): JSX.Element {
  const config = EXTENSION_CONFIG[state];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${config.pill}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${config.dot}`} aria-hidden="true" />
      {config.text}
      {state === "unavailable" && installHref !== undefined && (
        <a
          href={installHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 underline-offset-2 transition-colors hover:text-cyan-300 hover:underline"
        >
          instalar extensión
        </a>
      )}
    </span>
  );
}

interface LogLevelTagProps {
  level: string;
}

const LOG_LEVEL_STYLES: Record<string, string> = {
  DEBUG: "bg-slate-700 text-slate-200",
  INFO: "bg-blue-500/20 text-blue-300",
  WARN: "bg-amber-500/20 text-amber-300",
  ERROR: "bg-red-500/20 text-red-300",
};

const DEFAULT_LOG_LEVEL_STYLE = "bg-slate-700 text-slate-300";

export function LogLevelTag({ level }: LogLevelTagProps): JSX.Element {
  const style = LOG_LEVEL_STYLES[level.toUpperCase()] ?? DEFAULT_LOG_LEVEL_STYLE;
  return (
    <span className={`rounded px-2 py-0.5 text-xs uppercase ${style}`}>
      {level}
    </span>
  );
}
