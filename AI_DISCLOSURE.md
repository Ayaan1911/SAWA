# AI Disclosure

SAWA is an AI-assisted productivity agent. It reads local markdown state, computes heuristics, and can call external model and integration APIs when configured.

## Important limits
- Recommendations are only as good as the vault data and external API availability.
- Messaging, calendar, GitHub, and Groq features require valid credentials.
- Recovery suggestions are operational guidance, not medical, legal, or therapeutic advice.

## Transparency
- Each heartbeat writes a decision artifact so operator-visible reasoning survives restarts.
- When Groq credentials are missing or fail, SAWA falls back to a local deterministic decision path.

## LLM Backend
- Provider: [Groq](https://groq.com/)
- Model: Llama 3.3 70B Versatile (`llama-3.3-70b-versatile`)
- API calls are made only during the heartbeat cycle when `GROQ_API_KEY` is configured.
