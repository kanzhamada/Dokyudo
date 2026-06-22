import type { ColumnDef } from '@tanstack/table-core';
import type { Document } from './data.js';

/**
 * Column definitions for the Document data table.
 *
 * These columns drive TanStack Table's filtering, sorting, and pagination
 * engine. The actual rendering is handled by custom Card markup in +page.svelte
 * rather than standard FlexRender table cells.
 */
export const columns: ColumnDef<Document>[] = [
	{
		accessorKey: 'name',
		header: 'Name',
		enableSorting: true,
		enableColumnFilter: true
	},
	{
		id: 'type',
		accessorFn: (row) => row.name.split('.').pop()?.toLowerCase() || '',
		filterFn: (row, columnId, filterValue: string[]) => {
			if (!filterValue || filterValue.length === 0) return true;
			const ext = row.getValue<string>(columnId);
			return filterValue.includes(ext);
		}
	},
	{
		accessorKey: 'description',
		header: 'Description',
		enableSorting: false,
		enableColumnFilter: false
	},
	{
		accessorKey: 'uploadedAt',
		header: 'Uploaded',
		enableSorting: true,
		enableColumnFilter: false
	},
	{
		accessorKey: 'size',
		header: 'Size',
		enableSorting: true,
		enableColumnFilter: false
	}
];
