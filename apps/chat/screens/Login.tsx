import { Box, Text } from "ink";
import React, { useEffect, useRef, useState } from "react";

import { ThemeProvider, useTheme } from "../components/ui/theme-provider";
import { BigText } from "../components/ui/big-text";
import { LoginFlow } from "../components/ui/login-flow";
import { Spinner } from "../components/ui/spinner";
import { StatusMessage } from "../components/ui/status-message";
import { useInput } from "../hooks/use-input";
import * as api from "../lib/api";

type AuthMode = "login" | "register";
type Step = "mode" | "username" | "password" | "loading" | "error";

export interface LoginProps {
  onAuth: (token: string, username: string) => void;
}

function LoginInner({ onAuth }: LoginProps) {
  const theme = useTheme();
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<AuthMode>("login");
  const [value, setValue] = useState("");
  const [username, setUsername] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  useInput(
    (input, key) => {
      if (step === "loading") return;

      if (step === "error") {
        setErrorMsg("");
        setValue("");
        setStep("username");
        return;
      }

      if (step === "mode") {
        if (key.upArrow || key.downArrow) {
          setMode((current) => (current === "login" ? "register" : "login"));
          return;
        }

        if (input === "1" || input === "2") {
          setMode(input === "1" ? "login" : "register");
          setStep("username");
          return;
        }

        if (key.return) {
          setStep("username");
        }
        return;
      }

      if (key.escape) {
        if (step === "password") {
          setValue("");
          setStep("username");
        } else {
          setValue("");
          setUsername("");
          setStep("mode");
        }
        return;
      }

      if (key.backspace || key.delete) {
        setValue((v) => v.slice(0, -1));
        return;
      }

      if (key.return) {
        if (value.trim() === "") return;

        if (step === "username") {
          setUsername(value.trim());
          setValue("");
          setStep("password");
        } else if (step === "password") {
          const pass = value;
          const user = username;
          setValue("");
          setStep("loading");

          (async () => {
            try {
              const res =
                mode === "register"
                  ? await api.register(user, pass)
                  : await api.login(user, pass);
              if (!mountedRef.current) return;
              onAuth(res.token, user);
            } catch (err) {
              if (!mountedRef.current) return;
              const msg = err instanceof Error ? err.message : String(err);
              setErrorMsg(msg);
              setStep("error");
            }
          })();
        }
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        setValue((v) => v + input);
      }
    },
    { isActive: step !== "loading" },
  );

  const maskedValue = "*".repeat(value.length);
  const actionLabel = mode === "register" ? "Create account" : "Log in";
  const hintColor = theme.colors.mutedForeground;

  const inputLine = value.length > 0 ? value : "type here";
  const passwordLine = value.length > 0 ? maskedValue : "type password";

  return (
    <LoginFlow padding={4}>
      <Box
        borderStyle="round"
        borderColor={
          step === "error" ? theme.colors.error : theme.colors.border
        }
        flexDirection="column"
        paddingX={2}
        paddingY={1}
        width={48}
      >
        <Box flexDirection="column" marginBottom={1} alignItems="center">
          <BigText color={"#0073E5"} font="block">
            Slick
          </BigText>
          <Text dimColor>{actionLabel}</Text>
        </Box>

        {step === "mode" && (
          <>
            <LoginFlow.Description dim>
              Choose how you want to enter Slick.
            </LoginFlow.Description>
            <LoginFlow.Select
              options={["Log in", "Create account"]}
              activeIndex={mode === "login" ? 0 : 1}
              keyboardNav={false}
            />
            <Box marginTop={1}>
              <Text color={hintColor}>Use arrows, 1/2, then Enter.</Text>
            </Box>
          </>
        )}

        {step === "username" && (
          <Box flexDirection="column">
            <Text color={hintColor}>{actionLabel}</Text>
            <Box marginTop={1}>
              <Text bold>Username</Text>
            </Box>
            <Text dimColor={value.length === 0}>
              {inputLine}
              <Text color={theme.colors.primary}>_</Text>
            </Text>
            <Box marginTop={1}>
              <Text color={hintColor}>Enter to continue. Esc to go back.</Text>
            </Box>
          </Box>
        )}

        {step === "password" && (
          <Box flexDirection="column">
            <Text color={hintColor}>Username: {username}</Text>
            <Box marginTop={1}>
              <Text bold>Password</Text>
            </Box>
            <Text dimColor={value.length === 0}>
              {passwordLine}
              <Text color={theme.colors.primary}>_</Text>
            </Text>
            <Box marginTop={1}>
              <Text color={hintColor}>
                Enter to {mode === "register" ? "create" : "log in"}. Esc to
                edit username.
              </Text>
            </Box>
          </Box>
        )}

        {step === "loading" && (
          <Spinner
            label={
              mode === "register" ? "Creating account..." : "Signing in..."
            }
          />
        )}

        {step === "error" && (
          <Box flexDirection="column">
            <StatusMessage variant="error">{errorMsg}</StatusMessage>
            <Box marginTop={1}>
              <Text color={hintColor}>Press any key to edit username.</Text>
            </Box>
          </Box>
        )}
      </Box>
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
