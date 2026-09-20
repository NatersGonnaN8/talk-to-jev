import { FlipTip } from "./FlipTip";
import {
  LLM_MODEL_TIP,
  listLlmChatModels,
  useLlmModel,
} from "./llmModel";

export function LlmModelPicker({
  disabled,
  extraId,
  className,
  tip,
}: {
  disabled?: boolean;
  extraId?: string;
  className?: string;
  tip?: string;
}) {
  const [model, setModel] = useLlmModel();
  const options = listLlmChatModels([model, extraId]);
  return (
    <FlipTip text={tip ?? LLM_MODEL_TIP}>
      <select
        className={className ?? "llm-model-pick"}
        aria-label="LLM model"
        title={model}
        disabled={disabled}
        value={model}
        onChange={(e) => setModel(e.target.value)}
      >
        {options.map((row) => (
          <option key={row.id} value={row.id}>
            {row.label}
          </option>
        ))}
      </select>
    </FlipTip>
  );
}
