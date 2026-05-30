import React, { useState } from 'react';
import { render, Box, Text } from 'ink';

import { Login } from './screens/Login';
import { Chat } from './screens/Chat';
import { ThemeProvider } from './components/ui/theme-provider';
import { Spinner } from './components/ui/spinner';
import { useSlick } from './hooks/useSlick';

type AppState = 'login' | 'chat';

interface AuthInfo {
  token: string;
  username: string;
}

function ChatApp({ auth }: { auth: AuthInfo }) {
  const slick = useSlick({ token: auth.token, username: auth.username });

  if ((slick.wsStatus === 'error' || slick.wsStatus === 'closed') && slick.channels.length === 0) {
    return (
      <ThemeProvider>
        <Box paddingX={2} paddingY={1}>
          <Text color="red">Connection failed. Restart the server and try again.</Text>
        </Box>
      </ThemeProvider>
    );
  }

  if (slick.wsStatus === 'connecting' && slick.channels.length === 0) {
    return (
      <ThemeProvider>
        <Box paddingX={2} paddingY={1}>
          <Spinner label=" Setting up workspace and connecting…" />
        </Box>
      </ThemeProvider>
    );
  }

  return <Chat {...slick} />;
}

function App() {
  const [appState, setAppState] = useState<AppState>('login');
  const [auth, setAuth] = useState<AuthInfo | null>(null);

  return (
    <>
      {appState === 'login' && (
        <Login
          onAuth={(token, username) => {
            setAuth({ token, username });
            setAppState('chat');
          }}
        />
      )}
      {appState === 'chat' && auth && <ChatApp auth={auth} />}
    </>
  );
}

render(<App />);
