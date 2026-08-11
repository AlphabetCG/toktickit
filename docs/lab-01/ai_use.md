# Lab 1 — AI Use and Reflection  (fill this in)

**LLM/agent used:** Claude Code (Claude Sonnet 5, later switched to Claude Opus 5)

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Attached the Lab 1 labsheet, cheat sheet and glossary and asked for a detailed explanation of what I had to do — explicitly telling the agent not to write any code yet. | Used the breakdown to plan the four issues, the branch layout and the Kanban columns before touching the repo. |
| 2 | Asked how a peer partner reviews and approves my code on GitHub. | Learned the Collaborator → Reviewers → Approve flow, and that evidence must exist in both directions. Added my partner as a collaborator. |
| 3 | Pointed the agent at my repo and asked what was still missing before my partner could review Issue 1. | It found that `npm test` in `client/` failed because no test file existed at all, so I fixed that before opening the PR. |
| 4 | Asked whether the flow is "create issue → send to partner for review", and for a summary of the prompts I had used. | Confirmed the Issue → branch → PR → review → merge order, and that I had built the scaffold before filing the issue. |
| 5 | Gave the agent the official `Lab1_Starter_Scaffold` and asked it to restructure my Issue 1 setup to match. | Replaced my hand-rolled layout with the official one (tests under `tests/lab-01/`, `src/api.ts`, `src/prisma.ts`, `prisma/seed.ts`, ESM + tsx server). |
| 6 | _TODO (Issue 2): record your prompt here._ | |
| 7 | _TODO (Issue 3): record your prompt here._ | |
| 8 | _TODO (Issue 4): record your prompt here._ | |

## Reflection
Two or three sentences: what made your prompts better, and one place you had to
correct or reject what the agent produced.

_TODO: write your own reflection. Points you can draw on:_
- _Prompt 1 was better because it forbade code — I got a plan I understood instead of code I could not explain._
- _Prompt 3 was better because it asked the agent to verify state rather than to build something; that is how the empty client test suite was caught._
- _Correction: my first foundation was built from memory rather than from the provided scaffold, so the folder layout, module system and test locations all had to be redone once the official scaffold arrived._
