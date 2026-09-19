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

export type Health = {
  ok: boolean;
  hasKey: boolean;
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

export const DEFAULT_STATE =
  "My card was charged twice. Please help ASAP.";

export const DEFAULT_QUESTIONS: Record<string, JevQuestion> = {
  department: {
    type: "choice",
    instructions: "Which team should handle this?",
    criteria: {
      billing: "Payments, invoicing, refunds",
      technical: "Bugs, outages, integrations",
      sales: "Pricing, upgrades, new accounts",
    },
  },
  urgent: {
    type: "noul",
    instructions: "Does this message need urgent attention?",
    criteria: {
      true: "Explicitly time-sensitive",
      false: "No urgency expressed",
    },
  },
  frustration: {
    type: "score",
    instructions: "How frustrated is the customer?",
    criteria: ["Calm", "Frustrated", "Very angry"],
  },
};
