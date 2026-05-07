# AI Disclosure

SAWA is an AI-assisted productivity agent. It reads local markdown state, computes heuristics, and can call external model and integration APIs when configured.

## Important limits
- Recommendations are only as good as the vault data and external API availability.
- Messaging, calendar, GitHub, and Anthropic features require valid credentials.
- Recovery suggestions are operational guidance, not medical, legal, or therapeutic advice.

## Transparency
- Each heartbeat writes a decision artifact so operator-visible reasoning survives restarts.
- When Anthropic credentials are missing or fail, SAWA falls back to a local deterministic decision path.
