export interface TierLimit {
    maxFileSizeBytes: number;
    maxUploadsPerMonth: number;
    maxStorageBytes: number;
    maxQnaPerMonth: number;
    maxSearchesPerMonth: number;
}

export const TIER_LIMITS: Record<"FREE" | "SIMULATE" | "OIL_INVESTOR" | "PRO", TierLimit> = {
    FREE: {
        maxFileSizeBytes: 100 * 1024 * 1024, // 10 MB (Aman untuk 30K TPM)
        maxUploadsPerMonth: 100,
        maxStorageBytes: 1000 * 1024 * 1024, // 100 MB
        maxQnaPerMonth: 500,
        maxSearchesPerMonth: 1000,
    },
    // SIMULATE: "Hackathon / Intensive Day" Mode.
    // Karena usia SIMULATE hanya 1 hari & dibatasi klaim 1x sebulan,
    // kita bisa memberikan batas yang sangat tinggi khusus untuk hari itu.
    SIMULATE: {
        maxFileSizeBytes: 15 * 1024 * 1024, // 15 MB
        maxUploadsPerMonth: 25,
        maxStorageBytes: 250 * 1024 * 1024, // 250 MB
        maxQnaPerMonth: 100,
        maxSearchesPerMonth: 250,
    },
    // PRO & OIL_INVESTOR dinonaktifkan di Frontend.
    // Diberi nilai persis sama dengan SIMULATE hanya agar TypeScript valid.
    OIL_INVESTOR: {
        maxFileSizeBytes: 15 * 1024 * 1024,
        maxUploadsPerMonth: 25,
        maxStorageBytes: 250 * 1024 * 1024,
        maxQnaPerMonth: 100,
        maxSearchesPerMonth: 250,
    },
    PRO: {
        maxFileSizeBytes: 15 * 1024 * 1024,
        maxUploadsPerMonth: 25,
        maxStorageBytes: 250 * 1024 * 1024,
        maxQnaPerMonth: 100,
        maxSearchesPerMonth: 250,
    },
} as const;

export type TierType = keyof typeof TIER_LIMITS;
