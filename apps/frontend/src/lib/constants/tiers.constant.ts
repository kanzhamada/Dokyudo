export interface TierLimit {
	maxFileSizeBytes: number;
	maxUploadsPerMonth: number;
	maxStorageBytes: number;
	maxQnaPerMonth: number;
	maxSearchesPerMonth: number;
}

export const TIER_LIMITS: Record<
	'FREE' | 'SIMULATE' | 'OIL_INVESTOR' | 'PRO',
	TierLimit
> = {
	FREE: {
		maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB
		maxUploadsPerMonth: 10,
		maxStorageBytes: 100 * 1024 * 1024, // 100 MB
		maxQnaPerMonth: 50,
		maxSearchesPerMonth: 100
	},

	SIMULATE: {
		maxFileSizeBytes: 15 * 1024 * 1024, // 15 MB
		maxUploadsPerMonth: 25,
		maxStorageBytes: 250 * 1024 * 1024, // 250 MB
		maxQnaPerMonth: 100,
		maxSearchesPerMonth: 250
	},

	OIL_INVESTOR: {
		maxFileSizeBytes: 15 * 1024 * 1024,
		maxUploadsPerMonth: 25,
		maxStorageBytes: 250 * 1024 * 1024,
		maxQnaPerMonth: 100,
		maxSearchesPerMonth: 250
	},
	PRO: {
		maxFileSizeBytes: 15 * 1024 * 1024,
		maxUploadsPerMonth: 25,
		maxStorageBytes: 250 * 1024 * 1024,
		maxQnaPerMonth: 100,
		maxSearchesPerMonth: 250
	}
} as const;

export type TierType = keyof typeof TIER_LIMITS;
