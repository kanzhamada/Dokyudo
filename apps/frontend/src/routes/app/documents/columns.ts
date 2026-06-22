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
		enableColumnFilter: false,
		sortingFn: (rowA, rowB, columnId) => {
			const parseSize = (sizeStr: string) => {
				const match = sizeStr.match(/([\d.]+)\s*(KB|MB|GB|B)/i);
				if (!match) return 0;
				const val = parseFloat(match[1]);
				const unit = match[2].toUpperCase();
				if (unit === 'GB') return val * 1024 * 1024 * 1024;
				if (unit === 'MB') return val * 1024 * 1024;
				if (unit === 'KB') return val * 1024;
				return val;
			};
			const sizeA = parseSize(rowA.getValue<string>(columnId));
			const sizeB = parseSize(rowB.getValue<string>(columnId));
			return sizeA > sizeB ? 1 : sizeA < sizeB ? -1 : 0;
		}
	}
];
