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
};

type Options = { token: string; username: string };

export function useSlick({ token }: Options): SlickState {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState('');
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
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
        } else if (msg.type === 'left') {
          appendMessage({
            id: crypto.randomUUID(),
            channelId: msg.channelId,
            username: msg.username,
            text: `${msg.username} left`,
            createdAt: Date.now(),
            system: true,
          });
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

  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        channelId: activeChannelId,
        text,
      }));
    }
  }, [activeChannelId]);

  return { channels, activeChannelId, setActiveChannelId, messages, sendMessage, wsStatus };
}
