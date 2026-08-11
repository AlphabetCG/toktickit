# Lab 1 — AI Use and Reflection

**LLM/agent used:** Claude Code (Claude Sonnet 5, later Claude Opus 5)

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Attached the labsheet, cheat sheet and glossary and asked for a detailed explanation of the lab — explicitly saying not to write code yet. | Used the breakdown to plan the four issues, the branch layout and the Kanban columns before touching the repo. |
| 2 | Asked how a peer partner reviews and approves my code on GitHub. | Learned the Collaborator → Reviewers → Approve flow, and added my partner as a collaborator. |
| 3 | Pointed the agent at my repo and asked what was still missing before my partner could review Issue 1. | It found that `npm test` in `client/` failed because no test file existed, so I fixed that before opening the PR. |
| 4 | Asked whether the flow is "create issue → send to partner for review". | Confirmed the Issue → branch → PR → review → merge order. |
| 5 | Gave the agent the official starter scaffold and asked it to restructure my Issue 1 setup to match. | Replaced my hand-rolled layout with the official one. |
| 6 | Said parts of the code were too verbose to understand and asked it to review and trim what was unnecessary. | Removed the `void x;` no-op lines, a redundant default export and the oversized comment banners. |
| 7 | _TODO (Issue 2 or 3)_ | |
| 8 | _TODO (Issue 4)_ | |

## Reflection

_TODO: two or three sentences in your own words. Points you can draw on:_

- _Prompt 1 was better because it forbade code — I got a plan I understood instead of code I could not explain._
- _Prompt 3 asked the agent to verify state rather than build something, which is how the empty client test suite was caught._
- _Correction I had to make: the first foundation was built from memory instead of the provided scaffold, so the folder layout, module system and test locations all had to be redone._
