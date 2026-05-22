import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTeamStore, type TeamAgentStatus } from "@/store/team";
import { GroupChatView } from "./GroupChatView";
import { TeamComposer } from "./TeamComposer";

type TeamLinePayload = {
  teamId: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  line: string;
};

type TeamExitPayload = {
  teamId: string;
  agentId: string;
  agentName: string;
  code: number | null;
};

const VALID_STATUSES = new Set<string>([
  "idle", "thinking", "tool_use", "awaiting_input", "done", "error",
]);

export function TeamChatContent({ teamId }: { teamId: string }) {
  const team = useTeamStore((s) => s.team);
  const setTeam = useTeamStore((s) => s.setTeam);
  const setAgentStatus = useTeamStore((s) => s.setAgentStatus);
  const appendMessage = useTeamStore((s) => s.appendMessage);
  const updateCost = useTeamStore((s) => s.updateCost);

  useEffect(() => {
    invoke<{
      id: string;
      name: string;
      cwd: string;
      lead: { name: string; role: string; description: string; agent_id: string | null; status: string } | null;
      members: { name: string; role: string; description: string; agent_id: string | null; status: string }[];
    }>("get_team", { teamId }).then((cfg) => {
      setTeam({
        id: cfg.id,
        name: cfg.name,
        cwd: cfg.cwd,
        lead: cfg.lead
          ? {
              name: cfg.lead.name,
              role: "lead",
              description: cfg.lead.description,
              agentId: cfg.lead.agent_id,
              status: (cfg.lead.status as TeamAgentStatus) || "idle",
            }
          : null,
        members: cfg.members.map((m) => ({
          name: m.name,
          role: "member",
          description: m.description,
          agentId: m.agent_id,
          status: (m.status as TeamAgentStatus) || "idle",
        })),
        messages: [],
        totalCost: 0,
      });
    });
  }, [teamId, setTeam]);

  const handleTeamMessage = useCallback(
    (agentName: string, agentRole: string, msg: Record<string, unknown>) => {
      switch (msg.type) {
        case "status": {
          const state = msg.state as string;
          if (VALID_STATUSES.has(state)) {
            setAgentStatus(agentName, state as TeamAgentStatus);
          }
          break;
        }

        case "event": {
          const data = msg.data as Record<string, unknown> | undefined;
          if (data?.type === "assistant") {
            const content = (data.message as Record<string, unknown>)?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if ("text" in block && block.text) {
                  appendMessage({
                    id: crypto.randomUUID(),
                    agentName,
                    agentRole,
                    content: block.text as string,
                    timestamp: Date.now(),
                    raw: block,
                    messageType: "assistant",
                  });
                } else if ("name" in block) {
                  appendMessage({
                    id: crypto.randomUUID(),
                    agentName,
                    agentRole,
                    content: `Tool: ${block.name}`,
                    timestamp: Date.now(),
                    raw: block,
                    messageType: "tool_use",
                  });
                }
              }
            }
          } else if (data?.type === "tool_result") {
            const resultContent = (data as Record<string, unknown>).content;
            let text = "";
            if (typeof resultContent === "string") {
              text = resultContent;
            } else if (Array.isArray(resultContent)) {
              text = resultContent
                .filter((b: Record<string, unknown>) => b.type === "text")
                .map((b: Record<string, unknown>) => b.text)
                .join("\n");
            }
            if (text) {
              appendMessage({
                id: crypto.randomUUID(),
                agentName,
                agentRole,
                content: text,
                timestamp: Date.now(),
                messageType: "tool_result",
              });
            }
          }
          break;
        }

        case "usage":
          updateCost(msg.costUsd as number ?? 0);
          break;

        case "error":
          appendMessage({
            id: crypto.randomUUID(),
            agentName,
            agentRole,
            content: msg.message as string,
            timestamp: Date.now(),
            messageType: "system",
          });
          break;
      }
    },
    [setAgentStatus, appendMessage, updateCost]
  );

  useEffect(() => {
    const unlistenLine = listen<TeamLinePayload>("team:line", (event) => {
      const { teamId: tid, agentName, agentRole, line } = event.payload;
      if (tid !== teamId) return;
      try {
        const parsed = JSON.parse(line);
        handleTeamMessage(agentName, agentRole, parsed);
      } catch (err) {
        console.warn("[team:line] parse failed:", line.slice(0, 120), err);
      }
    });

    const unlistenExit = listen<TeamExitPayload>("team:exit", (event) => {
      const { teamId: tid, agentName, code } = event.payload;
      if (tid !== teamId) return;
      setAgentStatus(agentName, code === 0 ? "done" : "error");
      appendMessage({
        id: crypto.randomUUID(),
        agentName,
        agentRole: null,
        content: `Agent ${agentName} exited (code ${code ?? "unknown"})`,
        timestamp: Date.now(),
        messageType: "system",
      });
    });

    return () => {
      unlistenLine.then((fn) => fn());
      unlistenExit.then((fn) => fn());
    };
  }, [teamId, handleTeamMessage, setAgentStatus, appendMessage]);

  const handleSend = useCallback(
    async (content: string, targetAgent: string | null) => {
      if (!team) return;

      appendMessage({
        id: crypto.randomUUID(),
        agentName: null,
        agentRole: null,
        content,
        timestamp: Date.now(),
        messageType: "user",
      });

      try {
        await invoke("send_to_team", {
          teamId,
          content,
          targetAgent,
        });
      } catch (err) {
        appendMessage({
          id: crypto.randomUUID(),
          agentName: null,
          agentRole: null,
          content: `Send failed: ${err}`,
          timestamp: Date.now(),
          messageType: "system",
        });
      }
    },
    [team, teamId, appendMessage]
  );

  if (!team) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-chat">
        <span className="font-mono text-sm text-muted animate-pulse">
          Loading team...
        </span>
      </div>
    );
  }

  const allAgents = [
    ...(team.lead ? [team.lead] : []),
    ...team.members,
  ];
  const hasWorkingAgent = allAgents.some(
    (a) => a.status === "thinking" || a.status === "tool_use"
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-surface-chat">
      <GroupChatView messages={team.messages} />
      <TeamComposer
        isWorking={hasWorkingAgent}
        agents={allAgents}
        onSend={handleSend}
        onCommandFeedback={(message) => {
          appendMessage({
            id: crypto.randomUUID(),
            agentName: null,
            agentRole: null,
            content: message,
            timestamp: Date.now(),
            messageType: "system",
          });
        }}
      />
    </div>
  );
}
