---
source: https://docs.typesafe.ai/sdk/javascript/api/type-aliases/EntryType.md
fetched_at: 2026-09-20T10:35:52.063Z
---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.typesafe.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Type Alias: EntryType

```ts theme={null}
type EntryType = 
  | string
  | {
[key: string]: JsonValue;
}
  | JsonValue[]
  | null;
```

Text, a JSON object or array, or `null` for state, instructions, and criteria.
