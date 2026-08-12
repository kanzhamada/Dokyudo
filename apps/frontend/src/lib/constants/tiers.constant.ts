export interface TierLimit {
	maxFileSizeBytes: number;
	maxUploadsPerMonth: number;
	maxStorageBytes: number;
	maxQnaPerMonth: number;
	maxSearchesPerMonth: number;
}

export const TIER_LIMITS: Record<'FREE' | 'SIMULATE' | 'OIL_INVESTOR' | 'PRO', TierLimit> = {
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

export interface TierPlan {
	name: string;
	price: string;
	cadence: string;
	description: string;
	features: readonly string[];
	locked: boolean;
}

/** Pricing copy and benefits shared by billing surfaces. Quotas stay in TIER_LIMITS. */
export const TIER_PLANS: Record<TierType, TierPlan> = {
	FREE: {
		name: 'Free',
		price: 'Rp 0',
		cadence: 'forever',
		description: 'The default tier for every new tenant.',
		features: [
			'Hybrid search + RAG included',
			'OAuth via Google and GitHub',
			'Automatic 7-day teardown'
		],
		locked: false
	},
	SIMULATE: {
		name: 'Sandbox & Evaluation',
		price: 'Rp 11,100',
		cadence: 'trial 1 day',
		description: 'A guided evaluation with no card and no real charges.',
		features: ['Dummy credentials only', 'Counters reset monthly', 'Self-destruct on expiry'],
		locked: false
	},
	OIL_INVESTOR: {
		name: 'Pro Investor',
		price: 'Rp 19,000,000',
		cadence: 'one-time',
		description: 'The portfolio showcase that unlocks the full platform.',
		features: [
			'One-time sandbox invoice',
			'3 activation vouchers',
			'Unlocks PRO REAL platform-wide'
		],
		locked: true
	},
	PRO: {
		name: 'Pro Real',
		price: 'Rp 58,000',
		cadence: 'per month',
		description: 'The commercial B2B tier for recurring operations.',
		features: [
			'Tokenized recurring billing',
			'Multi-seat license provisioning',
			'Recurring webhook lifecycle'
		],
		locked: true
	}
} as const;
