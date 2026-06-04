import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../lib/api';
import type { Channel } from '../lib/api';

export type Message = {
  id: string;
  channelId: string;
  username: string;
  text: string;
  createdAt: number;
  system?: boolean;
};

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error';

export type SlickState = {
  channels: Channel[];
  activeChannelId: string;
  setActiveChannelId: (id: string) => void;
  messages: Map<string, Message[]>;
  sendMessage: (text: string) => void;
  wsStatus: WsStatus;
  typingUsers: Map<string, string[]>;
  onlineUsers: { userId: string; username: string }[];
  sendTyping: () => void;
};

type Options = { token: string; username: string };

export function useSlick({ token }: Options): SlickState {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState('');
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [typingUsers, setTypingUsers] = useState<Map<string, string[]>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<{ userId: string; username: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const appendMessage = useCallback((msg: Message) => {
    setMessages(prev => {
      const next = new Map(prev);
      const existing = next.get(msg.channelId) ?? [];
      next.set(msg.channelId, [...existing, msg]);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      let workspaces = await api.listWorkspaces(token);
      let workspace = workspaces[0];
      if (!workspace) {
        workspace = await api.createWorkspace(token, 'slick-hq');
      }

      let chs = await api.listChannels(token, workspace.id);
      if (chs.length === 0) {
        const ch = await api.createChannel(token, workspace.id, 'general');
        chs = [ch];
      }

      if (cancelled) return;

      setChannels(chs);
      setActiveChannelId(chs[0]!.id);
      setMessages(new Map(chs.map(ch => [ch.id, []])));

      const ws = new WebSocket(
        `ws://localhost:${process.env.PORT ?? 3000}/ws?token=${token}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setWsStatus('open');
        for (const ch of chs) {
          ws.send(JSON.stringify({ type: 'join', channelId: ch.id }));
        }
      };

      ws.onmessage = (e) => {
        if (cancelled) return;
        const msg = JSON.parse(e.data as string);
        if (msg.type === 'message') {
          appendMessage({
            id: crypto.randomUUID(),
            channelId: msg.channelId,
            username: msg.username,
            text: msg.text,
            createdAt: msg.createdAt,
          });
        } else if (msg.type === 'joined') {
          appendMessage({
            id: crypto.randomUUID(),
            channelId: msg.channelId,
            username: msg.username,
            text: `${msg.username} joined`,
            createdAt: Date.now(),
            system: true,
          });
          setOnlineUsers(prev =>
            prev.some((u) => u.userId === msg.userId)
              ? prev
              : [...prev, { userId: msg.userId, username: msg.username }]
          );
        } else if (msg.type === 'left') {
          appendMessage({
            id: crypto.randomUUID(),
            channelId: msg.channelId,
            username: msg.username,
            text: `${msg.username} left`,
            createdAt: Date.now(),
            system: true,
          });
        } else if (msg.type === 'typing') {
          setTypingUsers(prev => {
            const next = new Map(prev);
            const current = next.get(msg.channelId) ?? [];
            if (!current.includes(msg.username)) {
              next.set(msg.channelId, [...current, msg.username]);
            }
            return next;
          });
        } else if (msg.type === 'stopped_typing') {
          setTypingUsers(prev => {
            const next = new Map(prev);
            const current = next.get(msg.channelId) ?? [];
            next.set(msg.channelId, current.filter((u: string) => u !== msg.username));
            return next;
          });
        } else if (msg.type === 'presence') {
          if (msg.status === 'online') {
            setOnlineUsers(prev =>
              prev.some((u) => u.userId === msg.userId)
                ? prev
                : [...prev, { userId: msg.userId, username: msg.username }]
            );
          } else if (msg.status === 'offline') {
            setOnlineUsers(prev => prev.filter((u) => u.userId !== msg.userId));
          }
        }
      };

      ws.onclose = () => { if (!cancelled) setWsStatus('closed'); };
      ws.onerror = () => { if (!cancelled) setWsStatus('error'); };
    }

    setup().catch(() => { if (!cancelled) setWsStatus('error'); });

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [token]);

  const sendTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        channelId: activeChannelId,
      }));
    }
  }, [activeChannelId]);

  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        channelId: activeChannelId,
        text,
      }));
    }
  }, [activeChannelId]);

  return { channels, activeChannelId, setActiveChannelId, messages, sendMessage, sendTyping, wsStatus, typingUsers, onlineUsers };
}
