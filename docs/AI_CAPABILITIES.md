# Emi AI Capability Matrix — ES-012

| Capability | Current Status | Future Status | Dependencies |
|------------|----------------|---------------|--------------|
| Product Recommendations | Available (`recommend_products`) | Personalization + embeddings | ES-010 discovery, ES-008 analytics |
| Product Summarization | Available (`summarize_product`) | RAG-enriched summaries | Catalog, reviews |
| Product Comparison | Available (`compare_products`) | Structured compare tables | Catalog, discovery |
| Seller Assistant | Available (`seller_assistant`) | Proactive seller coaching | ES-007 seller intelligence |
| Buyer Assistant | Available (`buyer_assistant`) | Session personalization | ES-010 search/discovery |
| Analytics Explainer | Available (`analytics_explainer`) | Trend anomaly detection | ES-008 analytics |
| Search Explainer | Available (`search_explainer`) | Learning-to-rank explanations | ES-010 search |
| Review Summary | Available (`review_summary`) | Sentiment + topic clustering | Operations reviews |
| Trust Explanation | Available (`trust_explanation`) | Policy-aware trust coaching | ES-009 trust platform |
| Moderation Assistant | Available (`moderation_assistant`) | AI-assisted triage (human-in-loop) | ES-009 moderation |
| Multi-turn Chat | Available (`/api/ai/chat`) | Persistent memory (opt-in) | Conversation manager |
| Provider Switching | Gemini live, others stubbed | OpenAI/Claude/local adapters | Provider abstraction |
| Embeddings | Not started | Vector search + RAG | Vector DB |
| Fine-tuning | Not started | Domain-tuned models | Training pipeline |
| Chatbot UI | Not in scope (ES-012) | Future frontend modules | Emi APIs |
