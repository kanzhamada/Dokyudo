import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent, renderSnippet } from '$lib/components/ui/data-table/index.js';
import * as Tooltip from '$lib/components/ui/tooltip/index.js';

/**
 * Activity log entry shape matching the backend API response.
 */
export interface ActivityLog {
	id: string;
	action: string;
	resourceType: string | null;
	resourceId: string | null;
	metadata: Record<string, unknown> | null;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: string;
}

/**
 * Maps known action strings to human-readable labels and dot-indicator colors.
 */
function getActionConfig(action: string): { label: string; dotColor: string } {
	const map: Record<string, { label: string; dotColor: string }> = {
		'auth.login': { label: 'Login', dotColor: 'bg-emerald-400' },
		'auth.logout': { label: 'Logout', dotColor: 'bg-white/40' },
		'auth.password_reset': { label: 'Password Reset', dotColor: 'bg-amber-400' },
		'tenant.name_updated': { label: 'Tenant Updated', dotColor: 'bg-sky-400' },
		'document.uploaded': { label: 'Document Uploaded', dotColor: 'bg-[#DB8F5E]' },
		'document.deleted': { label: 'Document Deleted', dotColor: 'bg-red-400' },
		'document.failed': { label: 'Document Failed', dotColor: 'bg-red-400' },
		'document.quota_exhausted': { label: 'Quota Exhausted', dotColor: 'bg-amber-400' },
		'billing.payment_completed': { label: 'Payment Completed', dotColor: 'bg-emerald-400' },
		'billing.payment_failed': { label: 'Payment Failed', dotColor: 'bg-red-400' }
	};

	if (map[action]) return map[action];

	// Fallback: capitalize action parts
	const label = action
		.split('.')
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join(' ');
	return { label, dotColor: 'bg-white/30' };
}

/**
 * Formats an ISO date string into a compact relative or absolute display.
 */
function formatTimestamp(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
	});
}

/**
 * Returns a full date-time string for tooltip display.
 */
function formatFullTimestamp(dateString: string): string {
	return new Date(dateString).toLocaleString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

/**
 * Extracts a meaningful description from the metadata object.
 */
function getMetadataDescription(action: string, metadata: Record<string, unknown> | null): string {
	if (!metadata) return '';

	if (metadata.fileName) return String(metadata.fileName);
	if (metadata.provider) return `via ${String(metadata.provider)}`;
	if (metadata.tier) return `${String(metadata.tier)} tier`;
	if (metadata.amount && metadata.currency) {
		return `${String(metadata.currency).toUpperCase()} ${String(metadata.amount)}`;
	}

	return '';
}

/**
 * Truncates a user agent string for display in the table cell.
 */
function truncateUserAgent(ua: string | null): string {
	if (!ua) return '--';

	// Extract browser name from UA string
	if (ua.includes('Firefox/')) {
		const match = ua.match(/Firefox\/([\d.]+)/);
		return match ? `Firefox ${match[1]}` : 'Firefox';
	}
	if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
		const match = ua.match(/Chrome\/([\d.]+)/);
		return match ? `Chrome ${match[1]}` : 'Chrome';
	}
	if (ua.includes('Edg/')) {
		const match = ua.match(/Edg\/([\d.]+)/);
		return match ? `Edge ${match[1]}` : 'Edge';
	}
	if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
		const match = ua.match(/Version\/([\d.]+)/);
		return match ? `Safari ${match[1]}` : 'Safari';
	}
	if (ua.includes('bruno-runtime/')) {
		const match = ua.match(/bruno-runtime\/([\d.]+)/);
		return match ? `Bruno ${match[1]}` : 'Bruno';
	}

	// Fallback: truncate to first 24 chars
	return ua.length > 24 ? ua.slice(0, 24) + '...' : ua;
}

export function getColumns(): ColumnDef<ActivityLog, unknown>[] {
	return [
		{
			accessorKey: 'action',
			header: 'Event',
			cell: ({ row }) => {
				const action = row.getValue('action') as string;
				const config = getActionConfig(action);
				const metadata = row.original.metadata;
				const description = getMetadataDescription(action, metadata);

				// Return structured data for the snippet to consume
				return {
					label: config.label,
					dotColor: config.dotColor,
					description,
					rawAction: action
				};
			}
		},
		{
			accessorKey: 'resourceType',
			header: 'Resource',
			cell: ({ row }) => {
				const resourceType = row.getValue('resourceType') as string | null;
				if (!resourceType) return '--';
				return resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
			}
		},
		{
			accessorKey: 'ipAddress',
			header: 'IP Address',
			cell: ({ row }) => {
				return row.getValue('ipAddress') || '--';
			}
		},
		{
			accessorKey: 'userAgent',
			header: 'Client',
			cell: ({ row }) => {
				const ua = row.getValue('userAgent') as string | null;
				return {
					display: truncateUserAgent(ua),
					full: ua || null
				};
			}
		},
		{
			accessorKey: 'createdAt',
			header: 'Time',
			cell: ({ row }) => {
				const ts = row.getValue('createdAt') as string;
				return {
					relative: formatTimestamp(ts),
					full: formatFullTimestamp(ts)
				};
			}
		}
	];
}
