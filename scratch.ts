import { RagService } from "./apps/backend/src/modules/rag/rag.service.ts";

const tenantId = "b9090b4d-1bf9-450a-9dcc-1bf171fb2fc5"; // Assuming valid UUID for tenant
const req = {
    tenantId,
    question: "Summarize the error handling standard",
};

RagService.streamChat(req).then(async (stream) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.log(decoder.decode(value));
    }
    // wait a bit for async db save
    setTimeout(() => {
        console.log("done waiting");
        Deno.exit(0);
    }, 2000);
});
