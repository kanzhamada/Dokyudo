---
name: rag-context-engineer
description: Advanced pipeline construction for Context Engineering and Agentic RAG, preventing naive top-K context dumping.
---

# Advanced RAG Context Engineering Skill

Use this skill when implementing or optimizing the RAG Service (`POST /api/chat`) defined in section 5.4 of the PRD. This ensures we do not build a stateless, naive chatbot.

## When to use this skill
- Modifying prompt builders or contextual payload tokenizers.
- Optimizing SSE token streaming logic based on user intent.

## How to use it

1. **Reject Naive RAG**: Do not just blindly pull the top 5 raw text chunks and dump them into the system prompt.
2. **Context Enrichment**: You must architect a prompt pipeline that transforms retrieved chunks into a structured context snapshot including:
   - **Document Metadata**: File source name, chunk indexes, and processing timestamps.
   - **User Environment**: Implicit indicators such as the tenant's current tier limits or operational boundaries.
   - **Structural Guardrails**: Explicitly pass formatting instructions (e.g., "be concise, warm, and engineering-focused") based on the current session's vibe properties.
3. **Token Stewardship**: Always calculate the token overhead of your enriched context before making the outbound HTTP call to the AI API Gateway to avoid hitting LLM context window walls.