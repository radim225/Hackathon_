"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  FunctionComponent,
  useRef,
} from "react";

/** Mirrors Deepgram SOCKET_STATES so existing callers keep compiling. */
export enum SOCKET_STATES {
  connecting = 0,
  open = 1,
  closing = 2,
  closed = 3,
}

interface DeepgramContextType {
  connectToDeepgram: () => Promise<void>;
  disconnectFromDeepgram: () => void;
  connectionState: SOCKET_STATES;
  realtimeTranscript: string;
  error: string | null;
}

const DeepgramContext = createContext<DeepgramContextType | undefined>(undefined);

interface DeepgramContextProviderProps {
  children: ReactNode;
}

const DeepgramContextProvider: FunctionComponent<DeepgramContextProviderProps> = ({ children }) => {
  const [connectionState, setConnectionState] = useState<SOCKET_STATES>(SOCKET_STATES.closed);
  const [realtimeTranscript, setRealtimeTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const disconnectFromDeepgram = () => {
    if (audioRef.current && audioRef.current.state !== "inactive") {
      audioRef.current.stop();
    }
    audioRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRealtimeTranscript("");
    setConnectionState(SOCKET_STATES.closed);
  };

  const connectToDeepgram = async () => {
    try {
      setError(null);
      setRealtimeTranscript("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioRef.current = recorder;

      recorder.addEventListener("dataavailable", async (event) => {
        if (event.data.size === 0) return;
        try {
          const form = new FormData();
          form.append("audio", event.data, "chunk.webm");
          const response = await fetch("/api/deepgram", {
            method: "POST",
            body: form,
          });
          if (!response.ok) {
            setError(
              response.status === 429
                ? "Too many requests. Please wait and try again."
                : "Transcription failed. Please try again."
            );
            return;
          }
          const result = (await response.json()) as { transcript?: string };
          if (result.transcript) {
            setRealtimeTranscript((prev) =>
              prev ? `${prev} ${result.transcript}` : result.transcript!
            );
          }
        } catch {
          setError("Transcription failed. Please try again.");
        }
      });

      recorder.start(2000);
      setConnectionState(SOCKET_STATES.open);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setConnectionState(SOCKET_STATES.closed);
    }
  };

  return (
    <DeepgramContext.Provider
      value={{
        connectToDeepgram,
        disconnectFromDeepgram,
        connectionState,
        realtimeTranscript,
        error,
      }}
    >
      {children}
    </DeepgramContext.Provider>
  );
};

function useDeepgram(): DeepgramContextType {
  const context = useContext(DeepgramContext);
  if (context === undefined) {
    throw new Error("useDeepgram must be used within a DeepgramContextProvider");
  }
  return context;
}

export { DeepgramContextProvider, useDeepgram };
