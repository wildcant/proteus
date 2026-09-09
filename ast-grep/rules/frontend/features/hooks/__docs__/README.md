# Feature hooks

`features/{name}/hooks/` holds the hooks a feature owns that are not its API layer. They compose the
[api hooks](../../api/__docs__/README.md) into something a screen can use; none of them calls the
generated API client directly.

| Document | Use case |
|---|---|
| [Form hooks](./form-hooks.md) | **Turning user input into a write.** Use when a screen collects input and saves it. |
| [Data hooks](./data-hooks.md) | **Assembling everything a page reads.** Use when a page needs more than one resource. |

A page that does both has one of each, and they meet: the data hook gathers, the form hook writes.
