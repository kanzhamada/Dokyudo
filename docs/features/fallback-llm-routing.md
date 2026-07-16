# Smart Multi-Provider LLM Fallback (Free Tier RAG)

**Completion Timestamp**: 2026-07-16T21:30:00+07:00 (WIB)

## Core Logic
Sistem RAG Dokyudo melayani *tenant* pada *Free Tier* (System Mode) dengan mengandalkan puluhan model LLM gratis dari berbagai penyedia (Gemini, Groq, Mistral, SambaNova, Cohere). Untuk memastikan reliabilitas tinggi tanpa mengeluarkan biaya API, dibuatlah **FallbackLlmService**.

Service ini secara pintar me-rotasi permintaan ke LLM cadangan apabila LLM utama gagal, *timeout*, atau terkena *rate-limit*. LLM diklasifikasikan ke dalam 3 tier kapasitas token (`LIGHT_POOL`, `MEDIUM_POOL`, `HEAVY_POOL`) secara dinamis, sehingga pertanyaan pendek tidak menghabiskan kuota model besar.

## Flow Diagram

```mermaid
sequenceDiagram
    actor Client
    participant Controller as RAG Controller
    participant Service as RagService
    participant Fallback as FallbackLlmService
    participant Redis as Redis (Quota & Circuit Breaker)
    participant Providers as External APIs (Groq/Gemini/etc)

    Client->>Controller: POST /api/rag/chat
    Controller->>Service: Call streamChat()
    Service->>Fallback: generateStream(augmentedPrompt)
    
    rect rgb(30, 41, 59)
    note right of Fallback: Tier Selection & Rotation
    Fallback->>Fallback: Count tokens -> Select HEAVY_POOL
    loop Over Pool Models
        Fallback->>Redis: Check Quota (RPM/RPD) & Circuit Breaker
        alt Quota Exceeded or CB Open
            Fallback->>Fallback: Skip Model
            continue
        end
        
        Fallback->>Providers: fetch(stream: true) (Timeout 15s)
        
        alt Success
            Providers-->>Fallback: Stream chunks
            Fallback->>Redis: Record Success (Close CB)
            Fallback-->>Service: Return Stream
            break
        else Error / Timeout
            Providers-->>Fallback: 503 / 429 / Timeout
            Fallback->>Redis: Record Failure (Trip CB if >= 5 errors)
            Fallback->>Fallback: Try Next Model
        end
    end
    end
    
    Service-->>Client: Stream SSE Tokens
```

## File Mapping

| File | Change / Purpose |
|---|---|
| `apps/backend/src/shared/constants/free_providers.constant.ts` | Konfigurasi metadata setiap model gratis (RPM, RPD, TPM, max context window) beserta spesifikasi ID dari tiap *provider*. |
| `apps/backend/src/shared/constants/free_model_pool.constant.ts` | Matriks rotasi LLM yang dibagi menjadi tier 1 (Light), tier 2 (Medium), tier 3 (Heavy) untuk optimalisasi kuota berdasarkan panjang prompt. |
| `apps/backend/src/modules/rag/fallback_llm.service.ts` | Mesin inti (core engine) rotasi *fallback*. Menangani eksekusi *fetch* ke semua provider secara _native_ (termasuk *parsing* tag `<think>` dari Qwen), menerapkan *15s Time-To-First-Token* timeout, mengecek Circuit Breaker, serta melakukan *parsing* *NDJSON* dan *SSE streaming*. |
| `apps/backend/src/modules/rag/rag.service.ts` | Integrasi `FallbackLlmService` untuk mengeksekusi LLM pada mode `!useByok` (*System Mode*). |
| `apps/backend/src/shared/constants/redis_keys.constant.ts` | Penambahan kunci Redis (Redis Keys) standar untuk pencatatan Quota RPM, RPD, dan Circuit Breaker (*Fallback*). |

## Architectural Decisions

1. **Token-Based Tier Selection:** LLM gratis memiliki keterbatasan ukuran *context window*. Service akan mengukur *prompt* dengan pendekatan heuristik (length / 4.5), dan apabila panjangnya melebihi batas model ringan (LIGHT), service akan langsung menggunakan kolam cadangan berat (HEAVY_POOL) agar terhindar dari error *context window exceeded*.
2. **Stateless Fallback + Redis Quota Tracking:** Mengingat arsitektur dijalankan secara *serverless/edge*, status penggunaan LLM per menit (RPM) dan per hari (RPD) disimpan secara persisten di Redis (`INCR`).
3. **Persisten Circuit Breaker:** Ketika sebuah API *down* (seperti `gemini-3.5-flash`), gagalnya koneksi tidak boleh dirasakan oleh semua pelanggan. `FallbackLlmService` akan merekam 5 kegagalan beruntun dalam 10 detik, lalu membuka *Circuit Breaker* selama 30 detik untuk me-rutekan panggilan ke LLM lain secara instan tanpa mengorbankan 15 detik waktu *timeout*.
4. **Native Fetch vs SDKs:** Untuk meminimalisir masalah dependensi pada lingkungan Deno dan mengelola proses pembersihan SSE Stream (seperti tag `<think>`), koneksi ke Groq, SambaNova, dan Cohere (v2) dilakukan via `fetch()` standar web.
5. **Tag Stripping for Reasoning Models:** Model *reasoning* (seperti `qwen3-32b` dan Cohere `command-r-plus`) mengirimkan *chain of thought* mereka ke *stream*. `FallbackLlmService` dilengkapi dengan *parser* khusus (seperti pengabaian tag `<think>` dan `message.content.thinking`) untuk mencegah hal ini mengotori tampilan antar muka *chat*.
6. **Graceful NDJSON Support:** Cohere v2 tidak mengembalikan protokol SSE bawaan melainkan *JSON-lines* ketika header `text/event-stream` absen. Parser `parseCohereSSe` dibuat resisten menghadapi format ganda (NDJSON dan regular SSE).
