import { useEffect, useState, useCallback } from "react";
import { useAgentStore } from "@/store/agents";
import { useGitStore, type GitFileStatus } from "@/store/git";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n";

const STATUS_COLOR: Record<string, string> = {
  M: "text-amber",
  A: "text-moss",
  D: "text-vermilion",
  R: "text-amber",
  "?": "text-faint",
};

export function GitPanelContent() {
  const t = useT();
  const thread = useAgentStore((s) =>
    s.activeThreadId ? s.threads[s.activeThreadId] : null
  );
  const cwd = thread?.cwd ?? null;

  const {
    status,
    statusLoading,
    statusError,
    selectedFile,
    diffContent,
    diffLoading,
    commitMessage,
    ghAuthenticated,
    prFormOpen,
    prTitle,
    prBody,
    prBase,
    lastCommit,
    lastPr,
    loadStatus,
    loadDiff,
    stageFiles,
    commit,
    push,
    createPr,
    checkGhAuth,
    generateCommitMessage,
    setSelectedFile,
    setCommitMessage,
    setPrField,
    setPrFormOpen,
    clearLastResults,
  } = useGitStore();

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    detail?: string;
    action: () => Promise<void>;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (cwd) {
      loadStatus(cwd);
      checkGhAuth();
    }
  }, [cwd, loadStatus, checkGhAuth]);

  useEffect(() => {
    if (cwd && selectedFile) {
      const file = status?.files.find((f) => f.path === selectedFile);
      loadDiff(cwd, file?.staged ?? false, [selectedFile]);
    }
  }, [cwd, selectedFile, status?.files, loadDiff]);

  const handleRefresh = useCallback(() => {
    if (cwd) {
      loadStatus(cwd);
      clearLastResults();
      setActionError(null);
    }
  }, [cwd, loadStatus, clearLastResults]);

  const handleStageAll = useCallback(
    (unstage: boolean) => {
      if (!cwd || !status) return;
      const paths = status.files
        .filter((f) => (unstage ? f.staged : !f.staged))
        .map((f) => f.path);
      if (paths.length === 0) return;
      stageFiles(cwd, paths, unstage).catch((e) => setActionError(String(e)));
    },
    [cwd, status, stageFiles]
  );

  const handleToggleStage = useCallback(
    (file: GitFileStatus) => {
      if (!cwd) return;
      stageFiles(cwd, [file.path], file.staged).catch((e) =>
        setActionError(String(e))
      );
    },
    [cwd, stageFiles]
  );

  const handleCommit = useCallback(() => {
    if (!cwd || !commitMessage.trim()) return;
    setConfirmAction({
      title: t("git.confirmCommit"),
      description: t("git.confirmCommitDesc"),
      detail: commitMessage.split("\n")[0],
      action: async () => {
        try {
          await commit(cwd, commitMessage);
          setActionError(null);
        } catch (e) {
          setActionError(String(e));
        }
      },
    });
  }, [cwd, commitMessage, commit, t]);

  const handleCommitAndPush = useCallback(() => {
    if (!cwd || !commitMessage.trim()) return;
    setConfirmAction({
      title: t("git.confirmCommit"),
      description: t("git.confirmPushDesc"),
      detail: commitMessage.split("\n")[0],
      action: async () => {
        try {
          await commit(cwd, commitMessage);
          const upstream = status?.upstream ? undefined : status?.branch;
          await push(cwd, upstream);
          setActionError(null);
        } catch (e) {
          setActionError(String(e));
        }
      },
    });
  }, [cwd, commitMessage, commit, push, status, t]);

  const handlePush = useCallback(() => {
    if (!cwd) return;
    setConfirmAction({
      title: t("git.confirmPush"),
      description: t("git.confirmPushDesc"),
      action: async () => {
        try {
          const upstream = status?.upstream ? undefined : status?.branch;
          await push(cwd, upstream);
          setActionError(null);
        } catch (e) {
          setActionError(String(e));
        }
      },
    });
  }, [cwd, push, status, t]);

  const handleCreatePr = useCallback(() => {
    if (!cwd || !prTitle.trim()) return;
    setConfirmAction({
      title: t("git.confirmPr"),
      description: t("git.confirmPrDesc"),
      detail: prTitle,
      action: async () => {
        try {
          await createPr(cwd, prTitle, prBody, prBase || undefined);
          setActionError(null);
        } catch (e) {
          setActionError(String(e));
        }
      },
    });
  }, [cwd, prTitle, prBody, prBase, createPr, t]);

  const handleGenerate = useCallback(() => {
    if (!thread) return;
    generateCommitMessage(thread.messages, status?.files ?? []);
  }, [thread, status, generateCommitMessage]);

  if (!cwd) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono text-2xs text-faint">{t("git.noThread")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber font-mono text-xs">◆</span>
            <span className="font-serif text-sm text-ink">{t("git.title")}</span>
            {status && (
              <span className="font-mono text-2xs text-muted">{status.branch}</span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} title={t("git.refresh")}>
            ↻
          </Button>
        </div>
        {status?.upstream && (
          <div className="font-mono text-2xs text-faint mt-0.5">
            {status.upstream}
            {(status.ahead > 0 || status.behind > 0) && (
              <span className="ml-2">
                {status.ahead > 0 && <span className="text-moss">+{status.ahead}</span>}
                {status.ahead > 0 && status.behind > 0 && " "}
                {status.behind > 0 && <span className="text-vermilion">-{status.behind}</span>}
              </span>
            )}
          </div>
        )}
        {!status?.upstream && status && (
          <div className="font-mono text-2xs text-faint mt-0.5">{t("git.noUpstream")}</div>
        )}
      </div>

      {/* Loading / Error */}
      {statusLoading && (
        <div className="px-3 py-4 text-center font-mono text-2xs text-faint">
          {t("git.loading")}
        </div>
      )}
      {statusError && (
        <div className="px-3 py-2 font-mono text-2xs text-vermilion">{statusError}</div>
      )}
      {actionError && (
        <div className="px-3 py-1.5 bg-vermilion/5 border-b border-vermilion/20 font-mono text-2xs text-vermilion">
          {actionError}
        </div>
      )}

      {/* Success messages */}
      {lastCommit && (
        <div className="px-3 py-1.5 bg-moss/5 border-b border-moss/20 font-mono text-2xs text-moss">
          {t("git.commitSuccess")}: {lastCommit.hash}
        </div>
      )}
      {lastPr && (
        <div className="px-3 py-1.5 bg-moss/5 border-b border-moss/20 font-mono text-2xs text-moss">
          PR #{lastPr.number}: {lastPr.url}
        </div>
      )}

      {/* Clean state */}
      {status?.isClean && !statusLoading && (
        <div className="px-3 py-4 text-center font-mono text-2xs text-faint">
          {t("git.clean")}
        </div>
      )}

      {/* File list + Diff + Commit (scrollable region) */}
      {status && !status.isClean && (
        <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
          {/* Changed Files */}
          <div className="px-3 py-2 border-b border-border/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-2xs text-muted uppercase tracking-wider">
                {t("git.files")} ({status.files.length})
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleStageAll(false)}>
                  {t("git.stageAll")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleStageAll(true)}>
                  {t("git.unstageAll")}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-px max-h-[200px] overflow-y-auto">
              {status.files.map((file) => (
                <button
                  key={`${file.path}-${file.staged}`}
                  onClick={() => setSelectedFile(file.path)}
                  className={`flex items-center gap-1.5 px-1.5 py-0.5 font-mono text-2xs text-left transition-colors ${
                    selectedFile === file.path
                      ? "bg-border/60 text-ink"
                      : "text-muted hover:bg-border/30"
                  }`}
                >
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStage(file);
                    }}
                    className="shrink-0 cursor-pointer select-none w-4 text-center"
                    title={file.staged ? t("git.unstageSelected") : t("git.stageSelected")}
                  >
                    {file.staged ? "☑" : "☐"}
                  </span>
                  <span className={`shrink-0 w-3 ${STATUS_COLOR[file.status] ?? "text-muted"}`}>
                    {file.status}
                  </span>
                  <span className="truncate">{file.path}</span>
                  {file.staged && (
                    <span className="ml-auto shrink-0 text-moss/60 text-2xs">staged</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Diff preview */}
          <div className="px-3 py-2 border-b border-border/30 min-h-[80px] max-h-[240px] overflow-y-auto">
            <span className="font-mono text-2xs text-muted uppercase tracking-wider block mb-1">
              {t("git.diff")}
            </span>
            {!selectedFile && (
              <p className="font-mono text-2xs text-faint">{t("git.noDiff")}</p>
            )}
            {diffLoading && (
              <p className="font-mono text-2xs text-faint">...</p>
            )}
            {diffContent && !diffLoading && (
              <pre className="font-mono text-2xs whitespace-pre-wrap break-all leading-relaxed">
                {diffContent.split("\n").map((line, i) => {
                  let cls = "text-muted";
                  if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-moss bg-moss/5";
                  else if (line.startsWith("-") && !line.startsWith("---")) cls = "text-vermilion bg-vermilion/5";
                  else if (line.startsWith("@@")) cls = "text-amber/60";
                  return (
                    <div key={i} className={cls}>
                      {line}
                    </div>
                  );
                })}
              </pre>
            )}
          </div>

          {/* Commit / PR section */}
          <div className="px-3 py-2 shrink-0">
            {!prFormOpen ? (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-2xs text-muted uppercase tracking-wider">
                    {t("git.commitMessage")}
                  </span>
                  <Button variant="ghost" size="sm" className="text-amber hover:text-amber/80" onClick={handleGenerate}>
                    ◎ {t("git.autoGenerate")}
                  </Button>
                </div>
                <Textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder={t("git.commitPlaceholder")}
                  rows={3}
                  className="text-2xs min-h-0 resize-none"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button size="sm" onClick={handleCommit} disabled={!commitMessage.trim() || !status.hasStaged}>
                    {t("git.commit")}
                  </Button>
                  <Button variant="outline" size="sm" className="border-amber text-amber hover:bg-amber/10" onClick={handleCommitAndPush} disabled={!commitMessage.trim() || !status.hasStaged}>
                    {t("git.commitAndPush")}
                  </Button>
                  {status.ahead > 0 && (
                    <Button variant="outline" size="sm" onClick={handlePush}>
                      {t("git.push")}
                    </Button>
                  )}
                  {ghAuthenticated && (
                    <Button variant="outline" size="sm" onClick={() => setPrFormOpen(true)}>
                      {t("git.createPr")}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <span className="font-mono text-2xs text-muted uppercase tracking-wider block mb-1.5">
                  {t("git.createPr")}
                </span>
                <Input
                  value={prTitle}
                  onChange={(e) => setPrField("title", e.target.value)}
                  placeholder={t("git.prTitle")}
                  className="text-2xs mb-1.5"
                />
                <Textarea
                  value={prBody}
                  onChange={(e) => setPrField("body", e.target.value)}
                  placeholder={t("git.prBody")}
                  rows={4}
                  className="text-2xs min-h-0 resize-none mb-1.5"
                />
                <Input
                  value={prBase}
                  onChange={(e) => setPrField("base", e.target.value)}
                  placeholder={t("git.prBase")}
                  className="text-2xs mb-2"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreatePr} disabled={!prTitle.trim()}>
                    {t("git.prSubmit")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPrFormOpen(false)}>
                    {t("git.prCancel")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border/50 shrink-0">
        <span className="font-mono text-2xs text-faint truncate block">{cwd}</span>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.title ?? ""}
        description={confirmAction?.description ?? ""}
        detail={confirmAction?.detail}
        onConfirm={async () => {
          const action = confirmAction?.action;
          setConfirmAction(null);
          if (action) await action();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
