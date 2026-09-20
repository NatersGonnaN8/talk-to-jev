---
source: https://docs.typesafe.ai/sdk/javascript/api/interfaces/Models.md
fetched_at: 2026-09-19T22:40:24.991Z
---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.typesafe.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Interface: Models

Access to the Models API resource.

## Methods

<a id="sdk-list" />

### list()

```ts theme={null}
list(options?): APIPromise<ModelCard[]>;
```

List the models available to the account.

#### Parameters

##### options?

[`RequestOptions`](/sdk/javascript/api/interfaces/RequestOptions) = `{}`

#### Returns

[`APIPromise`](/sdk/javascript/api/classes/APIPromise)\<[`ModelCard`](/sdk/javascript/api/interfaces/ModelCard)\[]>
