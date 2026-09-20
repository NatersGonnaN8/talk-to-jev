---
source: https://docs.typesafe.ai/sdk/javascript/api/type-aliases/JsonValue.md
fetched_at: 2026-09-20T10:35:52.063Z
---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.typesafe.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Type Alias: JsonValue

```ts theme={null}
type JsonValue = 
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
[key: string]: JsonValue;
};
```

A JSON-compatible value.
