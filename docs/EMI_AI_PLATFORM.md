# Emi AI Intelligence Platform — ES-012

Reusable AI platform for Choosify. All AI capabilities should eventually consume Emi through provider abstraction, prompt registry, skill registry, context builders, and safety controls.

## Architecture

```
API Request (/api/ai/*)
  -> aiService (executeSkill, chat, recommend, ...)
  -> skillRegistry + promptRegistry
  -> contextBuilder (buyer, seller, product, analytics, trust, discovery, communication, search)
  -> safetyLayer (validation, injection checks, retries, timeouts)
  -> AIProvider (Gemini live; OpenAI/Claude/Local stubs)
  -> conversationManager (in-memory sessions)
  -> eventHooks (ES-006 audit metadata, ES-008 analytics)
```

| Layer | Path | Responsibility |
|-------|------|----------------|
| Core | `server/ai/aiService.ts` | Skill execution, chat, recommend, summarize, compare, classify, moderate, explain |
| Providers | `server/ai/providers/` | Provider abstraction; Gemini implemented |
| Prompts | `server/ai/promptRegistry.ts` | Versioned prompts (never in business services) |
| Skills | `server/ai/skills/skillRegistry.ts` | Skill definitions, context needs, safety rules |
| Context | `server/ai/context/contextBuilder.ts` | Dynamic context from ES-007/008/009/010/011 |
| Conversation | `server/ai/conversation/conversationManager.ts` | In-memory sessions, history, memory window |
| Safety | `server/ai/safety/safetyLayer.ts` | Input/output validation, injection detection, retries |
| Config | `server/ai/config.ts` | Environment-driven settings |
| API | `server/ai/aiRouter.ts` | `/api/ai/*` endpoints |
| Hooks | `server/ai/eventHooks.ts` | Audit + analytics (no prompt/response logging) |

## Provider Layer

Application code depends only on `AIProvider`:

```typescript
interface AIProvider {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  generate(request: AiProviderRequest): Promise<AiProviderResponse>;
}
```

| Provider | Status |
|----------|--------|
| Gemini | **Implemented** (`GEMINI_API_KEY`) |
| OpenAI | Interface stub |
| Claude | Interface stub |
| Local | Interface stub |

Switch providers via `AI_PROVIDER` without changing business services.

## Prompt Registry

Every prompt includes: `id`, `version`, `category`, `description`, `variables`, `systemPrompt`, `temperature`, `maxTokens`.

Prompts live only in `promptRegistry.ts` — never inside business services.

## Skill Registry

Representative skills:

- `recommend_products`
- `summarize_product`
- `compare_products`
- `seller_assistant`
- `buyer_assistant`
- `analytics_explainer`
- `search_explainer`
- `review_summary`
- `trust_explanation`
- `moderation_assistant`

Each skill defines prompt reference, context sources, safety rules, and output schema.

## Context Flow

Context sources are combined dynamically:

| Source | Data |
|--------|------|
| Buyer | Review samples |
| Seller | Reputation, orders |
| Product | Catalog products |
| Analytics | ES-008 `summarize()` |
| Trust | ES-009 trust/reputation + moderation summary |
| Discovery | ES-010 discovery collections |
| Communication | ES-011 communication summary |
| Search | ES-010 ranked search results |

## Safety

- Prompt input validation (length, injection patterns)
- Output validation (length, non-empty)
- Token/character limits via config
- Timeout via `AI_TIMEOUT_MS`
- Retry policy via `AI_RETRIES`
- Rate limiting via `RATE_LIMIT_AI_MAX` (ES-005)
- Audit logs record skill IDs and timing only — **never prompts or responses**

## Explainability

Optional response metadata:

- Provider, model, prompt ID/version
- Execution time
- Safety check results
- Context sources used
- Conversation ID
- Confidence (future)

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/ai/status` | Platform status, skills, prompts, providers |
| `POST /api/ai/chat` | Multi-turn chat with in-memory conversation |
| `POST /api/ai/recommend` | Product recommendations |
| `POST /api/ai/summarize` | Product summarization |
| `POST /api/ai/compare` | Product comparison |
| `POST /api/ai/explain` | Trust/analytics/search explanations |

All endpoints require authentication. Responses are provider-independent.

## Configuration

Environment variables (see `.env.example`):

- `AI_ENABLED`, `AI_PROVIDER`, `AI_MODEL`
- `AI_TEMPERATURE`, `AI_MAX_TOKENS`, `AI_TIMEOUT_MS`, `AI_RETRIES`
- `AI_MAX_INPUT_CHARS`
- `AI_FEATURE_*` feature flags
- `RATE_LIMIT_AI_MAX`
- `GEMINI_API_KEY` (Gemini adapter)

## Future AI Roadmap

1. **Provider expansion** — OpenAI, Claude, local model adapters
2. **Embeddings** — Product/search embeddings service
3. **RAG** — Vector retrieval over catalog, docs, reviews
4. **Fine-tuning** — Domain-specific models for moderation and seller assist
5. **Memory** — Opt-in persistent memory (not Firestore conversations per ES-012 constraint)
6. **Agent orchestration** — Multi-skill workflows with human approval gates

---

## Migration Strategy

### Provider Switching

Set `AI_PROVIDER` and provider API keys. Business services continue calling `aiService` only.

### Fine-tuning Strategy

1. Collect labeled outcomes from moderation and search click analytics
2. Train domain adapters per skill category
3. Register fine-tuned model IDs in config per skill override (future)

### Embeddings

1. Add `embeddingService` behind provider abstraction
2. Generate embeddings for products, brands, queries
3. Store in vector index (not Firestore conversations)

### RAG Readiness

Context builder already composes structured JSON blocks per source. Next step: retrieve top-k chunks from vector index before prompt assembly.

### Vector Database Readiness

Architecture supports plugging Pinecone/pgvector/Vertex Vector Search without changing API routes.

### Memory Roadmap

- **Now:** In-memory conversation sessions (lost on restart)
- **Next:** Redis session store with TTL
- **Future:** User-controlled long-term memory with explicit consent (not raw chat logs)

### Backward Compatibility

- No changes to messaging hub, inbox, or existing routes
- No Firestore conversation persistence
- No chatbot UI in ES-012
- No hardcoded prompts in business services
