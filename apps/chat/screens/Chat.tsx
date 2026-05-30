import { Box, Text } from "ink";
import React, { useState, useMemo } from "react";

import { AppShell } from "../components/ui/app-shell";
import { Tabs } from "../components/ui/tabs";
import { ChatMessage } from "../components/ui/chat-message";
import { ChatThread } from "../components/ui/chat-thread";
import { StatusMessage } from "../components/ui/status-message";
import { ThemeProvider } from "../components/ui/theme-provider";
import { useInput } from "../hooks/use-input";
import type { SlickState, Message } from "../hooks/useSlick";

type Mode = "nav" | "input";

interface ChannelMessagesProps {
  messages: Message[];
}

const ChannelMessages = ({ messages }: ChannelMessagesProps) => (
  <ChatThread>
    {messages.map((msg) =>
      msg.system ? (
        <StatusMessage key={msg.id} variant="info">
          {msg.text}
        </StatusMessage>
      ) : (
        <ChatMessage
          key={msg.id}
          sender="user"
          name={msg.username}
          timestamp={new Date(msg.createdAt)}
        >
          {msg.text}
        </ChatMessage>
      )
    )}
  </ChatThread>
);

interface ChatProps extends SlickState {}

export function Chat({
  channels,
  activeChannelId,
  setActiveChannelId,
  messages,
  sendMessage,
  wsStatus,
}: ChatProps) {
  const [mode, setMode] = useState<Mode>("nav");
  const [inputText, setInputText] = useState("");

  const wsIndicator =
    wsStatus === "open"
      ? "● connected"
      : wsStatus === "connecting"
      ? "○ connecting…"
      : "✗ disconnected";

  useInput(
    (input, key) => {
      if (mode === "nav") {
        if (input === "i") {
          setMode("input");
        } else if (input === "q" || (key.ctrl && input === "c")) {
          process.exit(0);
        }
      } else {
        // input mode
        if (key.escape) {
          setInputText("");
          setMode("nav");
        } else if (key.return) {
          if (inputText.trim()) {
            sendMessage(inputText.trim());
          }
          setInputText("");
          setMode("nav");
        } else if (key.backspace || key.delete) {
          setInputText((t) => t.slice(0, -1));
        } else if (
          input &&
          !key.ctrl &&
          !key.meta &&
          !key.upArrow &&
          !key.downArrow &&
          !key.leftArrow &&
          !key.rightArrow &&
          !key.tab
        ) {
          setInputText((t) => t + input);
        }
      }
    },
    { isActive: true }
  );

  const tabs = useMemo(
    () => channels.map((ch) => ({
      key: ch.id,
      label: "#" + ch.name,
      content: <ChannelMessages messages={messages.get(ch.id) ?? []} />,
    })),
    [channels, messages]
  );

  return (
    <ThemeProvider>
      <AppShell>
        <AppShell.Header>
          <Box justifyContent="space-between" paddingX={1}>
            <Text bold>Slick</Text>
            <Text dimColor>{wsIndicator}</Text>
          </Box>
        </AppShell.Header>
        <AppShell.Content>
          <Tabs
            tabs={tabs}
            activeTab={activeChannelId}
            onTabChange={setActiveChannelId}
            isActive={mode === "nav"}
          />
        </AppShell.Content>
        <Box
          borderStyle="single"
          borderColor={mode === "input" ? "cyan" : "gray"}
          paddingX={1}
        >
          {mode === "nav" ? (
            <Text dimColor>
              Press i to type  ·  ← → switch channel  ·  q quit
            </Text>
          ) : (
            <Box>
              <Text color="cyan">{"> "}</Text>
              <Text>{inputText}</Text>
              <Text color="cyan">{"█"}</Text>
            </Box>
          )}
        </Box>
      </AppShell>
    </ThemeProvider>
  );
}
