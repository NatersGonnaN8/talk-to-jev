export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type QuestionType = "choice" | "noul" | "score";

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true?: string; false?: string };
};

export type ScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

export type JevQuestion = ChoiceQuestion | NoulQuestion | ScoreQuestion;

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence?: number;
};

export type NoulAnswer = {
  type: "noul";
  noul: number;
};

export type ScoreAnswer = {
  type: "score";
  score: number;
  legend?: Record<string, string>;
  probabilities?: Record<string, number>;
  confidence?: number;
};

export type JevAnswer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

export type KeyId =
  | "openrouter"
  | "openai"
  | "anthropic"
  | "tavily"
  | "brave";

export type KeyStatus = {
  id: KeyId;
  env: string;
  label: string;
  why: string;
  required: boolean;
  present: boolean;
  last4: string | null;
};

export type SettingsResponse = {
  ok: boolean;
  keys: KeyStatus[];
  message?: string;
};

export type Health = {
  ok: boolean;
  hasKey: boolean;
  keys?: {
    openrouter: boolean;
    openai: boolean;
    anthropic: boolean;
    tavily: boolean;
    brave: boolean;
  };
  jevModel: string;
  llmModel: string;
  docs: { files: number; fetchedAt: string };
};

export type DocListItem = {
  path: string;
  title: string;
  source: string;
  fetchedAt: string;
};
