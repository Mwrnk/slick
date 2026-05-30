import { Box, Text } from 'ink';
import React, { useState, useEffect, useRef } from 'react';

import { ThemeProvider } from '../components/ui/theme-provider';
import { LoginFlow } from '../components/ui/login-flow';
import { Spinner } from '../components/ui/spinner';
import { useInput } from '../hooks/use-input';
import * as api from '../lib/api';

type Step = 'username' | 'password' | 'loading' | 'error';

export interface LoginProps {
  onAuth: (token: string, username: string) => void;
}

function LoginInner({ onAuth }: LoginProps) {
  const [step, setStep] = useState<Step>('username');
  const [value, setValue] = useState('');
  const [username, setUsername] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  useInput(
    (input, key) => {
      if (step === 'loading') return;

      if (key.escape && step === 'error') {
        setStep('username');
        setValue('');
        return;
      }

      if (step === 'error') return;

      if (key.backspace || key.delete) {
        setValue(v => v.slice(0, -1));
        return;
      }

      if (key.return) {
        if (value.trim() === '') return;

        if (step === 'username') {
          setUsername(value.trim());
          setValue('');
          setStep('password');
        } else if (step === 'password') {
          const pass = value;
          const user = username;
          setValue('');
          setStep('loading');

          (async () => {
            try {
              let token: string;
              try {
                const res = await api.register(user, pass);
                token = res.token;
              } catch {
                const res = await api.login(user, pass);
                token = res.token;
              }
              if (!mountedRef.current) return;
              onAuth(token, user);
            } catch (err) {
              if (!mountedRef.current) return;
              const msg = err instanceof Error ? err.message : String(err);
              setErrorMsg(msg);
              setStep('error');
            }
          })();
        }
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        setValue(v => v + input);
      }
    },
    { isActive: step !== 'loading' }
  );

  useEffect(() => {
    if (step === 'error') {
      const t = setTimeout(() => {
        setUsername('');
        setValue('');
        setErrorMsg('');
        setStep('username');
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [step]);

  const maskedValue = '*'.repeat(value.length);

  return (
    <LoginFlow title="Slick">
      {step === 'username' && (
        <Box flexDirection="column">
          <Text bold>Username</Text>
          <Text>
            {value}
            <Text>█</Text>
          </Text>
        </Box>
      )}

      {step === 'password' && (
        <Box flexDirection="column">
          <Text bold dimColor>Username: {username}</Text>
          <Text bold>Password</Text>
          <Text>
            {maskedValue}
            <Text>█</Text>
          </Text>
        </Box>
      )}

      {step === 'loading' && (
        <Box flexDirection="row" gap={1}>
          <Spinner label="Authenticating…" />
        </Box>
      )}

      {step === 'error' && (
        <Box flexDirection="column">
          <Text color="red">✗ {errorMsg}</Text>
          <Text dimColor>Resetting…</Text>
        </Box>
      )}
    </LoginFlow>
  );
}

export function Login({ onAuth }: LoginProps) {
  return (
    <ThemeProvider>
      <LoginInner onAuth={onAuth} />
    </ThemeProvider>
  );
}
