<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import XIcon from '@lucide/svelte/icons/x';
	import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';

	import { apiRequest } from '$lib/api/client.js';
	import { toast } from 'svelte-sonner';

	let {
		open = $bindable(false),
		onSuccess
	}: {
		open?: boolean;
		onSuccess?: () => void;
	} = $props();

	interface UploadItem {
		id: string;
		file: File;
		name: string;
		sizeBytes: number;
		sizeFormatted: string;
		mimeType: 'application/pdf' | 'text/plain';
		status: 'staged' | 'requesting' | 'uploading' | 'confirming' | 'success' | 'failed';
		progress: number;
		errorMessage: string | null;
		documentId: string | null;
		xhr: XMLHttpRequest | null;
	}

	let uploadFiles = $state<UploadItem[]>([]);
	let hasStartedUpload = $state(false);
	let isCleaningUp = $state(false);
	let fileInputEl: HTMLInputElement;
	let isDragOver = $state(false);

	let hasFailedUploads = $derived(uploadFiles.some((i) => i.status === 'failed'));
	let failedCount = $derived(uploadFiles.filter((i) => i.status === 'failed').length);
	let isAnyUploading = $derived(
		uploadFiles.some(
			(i) => i.status === 'uploading' || i.status === 'requesting' || i.status === 'confirming'
		)
	);
	let hasAllSucceeded = $derived(
		uploadFiles.length > 0 && uploadFiles.every((i) => i.status === 'success')
	);
	let hasSuccessfulUploads = $derived(uploadFiles.some((i) => i.status === 'success'));
	let completedCount = $derived(uploadFiles.filter((i) => i.status === 'success').length);

	let totalFileCount = $derived(uploadFiles.length);
	let totalSizeBytes = $derived(uploadFiles.reduce((acc, curr) => acc + curr.sizeBytes, 0));
	let totalSizeFormatted = $derived(formatBytes(totalSizeBytes));

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function getMimeType(filename: string): 'application/pdf' | 'text/plain' {
		const ext = filename.split('.').pop()?.toLowerCase();
		if (ext === 'txt') return 'text/plain';
		return 'application/pdf';
	}

	function handleFilesSelected(files: FileList | File[]) {
		const newItems: UploadItem[] = [];
		const invalidFiles: string[] = [];

		for (const file of Array.from(files)) {
			const ext = file.name.split('.').pop()?.toLowerCase();
			if (ext !== 'pdf' && ext !== 'txt') {
				invalidFiles.push(`${file.name} (only .pdf and .txt allowed)`);
				continue;
			}

			if (file.size > 25 * 1024 * 1024) {
				invalidFiles.push(`${file.name} (exceeds 25MB limit)`);
				continue;
			}

			newItems.push({
				id: crypto.randomUUID(),
				file,
				name: file.name,
				sizeBytes: file.size,
				sizeFormatted: formatBytes(file.size),
				mimeType: getMimeType(file.name),
				status: 'staged',
				progress: 0,
				errorMessage: null,
				documentId: null,
				xhr: null
			});
		}

		if (invalidFiles.length > 0) {
			toast.error('Invalid files skipped', {
				description: invalidFiles.join(', ')
			});
		}

		if (newItems.length > 0) {
			uploadFiles = [...uploadFiles, ...newItems];
		}
	}

	function startBatchUpload() {
		const itemsToUpload = uploadFiles.filter((i) => i.status === 'staged' || i.status === 'failed');
		if (itemsToUpload.length === 0) return;

		hasStartedUpload = true;
		processUploadQueue(itemsToUpload);
	}

	async function processUploadQueue(itemsToUpload: UploadItem[]) {
		if (itemsToUpload.length === 0) return;

		itemsToUpload.forEach((item) => {
			item.status = 'requesting';
			item.errorMessage = null;
			item.progress = 0;
		});

		const payload = {
			files: itemsToUpload.map((item) => ({
				filename: item.name,
				mimeType: item.mimeType,
				sizeBytes: item.sizeBytes
			}))
		};

		console.log('[Upload Presigned URL] Requesting batch presigned URLs:', payload);
		const res = await apiRequest<{
			results: Array<{
				filename: string;
				url: string;
				documentId: string;
				key: string;
				expiresIn: number;
			}>;
		}>('/api/documents/presigned-url/batch', {
			method: 'POST',
			body: payload
		});

		console.log('[Upload Presigned URL] Backend Response:', res);

		if (!res.ok) {
			const errMsg = res.error?.message || 'Failed to get presigned upload URLs';
			itemsToUpload.forEach((item) => {
				item.status = 'failed';
				item.errorMessage = errMsg;
			});
			return;
		}

		res.data.results.forEach((result, idx) => {
			const item = itemsToUpload[idx];
			if (!item) return;

			item.documentId = result.documentId;
			uploadSingleFileToS3(item, result.url);
		});
	}

	function uploadSingleFileToS3(item: UploadItem, presignedUrl: string) {
		item.status = 'uploading';
		item.progress = 0;

		const xhr = new XMLHttpRequest();
		item.xhr = xhr;

		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) {
				item.progress = Math.round((e.loaded / e.total) * 100);
			}
		};

		xhr.onload = async () => {
			item.xhr = null;
			if (xhr.status === 200 || xhr.status === 204) {
				console.log(`[Upload S3] S3 PUT successful for ${item.name}. Confirming upload...`);
				confirmUpload(item);
			} else {
				console.error(`[Upload S3] S3 PUT failed (${xhr.status}) for ${item.name}`);
				item.status = 'failed';
				item.errorMessage = `S3 upload failed (${xhr.status})`;
			}
		};

		xhr.onerror = (e) => {
			item.xhr = null;
			console.error(
				`[Upload S3] Network error uploading ${item.name}. Status: ${xhr.status} ${xhr.statusText}`,
				e
			);
			item.status = 'failed';
			item.errorMessage = 'Network error during upload';
		};

		xhr.onabort = (e) => {
			item.xhr = null;
			console.warn(`[Upload S3] Upload aborted for ${item.name}. Status: ${xhr.status}`, e);
			item.status = 'failed';
			item.errorMessage = 'Upload cancelled';
		};

		xhr.open('PUT', presignedUrl, true);
		xhr.setRequestHeader('Content-Type', item.file.type || item.mimeType);
		console.log(`[Upload S3] Initiating PUT request for ${item.name}...`);
		xhr.send(item.file);
	}

	async function confirmUpload(item: UploadItem) {
		if (!item.documentId) return;
		item.status = 'confirming';

		console.log('[Upload Confirm] Confirming documentId:', item.documentId);
		const res = await apiRequest<{ status: string }>('/api/documents/confirm-upload', {
			method: 'POST',
			body: { documentId: item.documentId }
		});

		console.log('[Upload Confirm] Backend Response:', res);

		if (res.ok) {
			item.status = 'success';
			item.progress = 100;
			toast.success('Document uploaded', { description: item.name });
			onSuccess?.();
		} else {
			item.status = 'failed';
			item.errorMessage = res.error?.message || 'Failed to confirm upload';
		}
	}

	function retryItem(item: UploadItem) {
		hasStartedUpload = true;
		processUploadQueue([item]);
	}

	function retryAllFailed() {
		const failedItems = uploadFiles.filter((i) => i.status === 'failed');
		if (failedItems.length === 0) return;

		hasStartedUpload = true;
		processUploadQueue(failedItems);
	}

	async function removeItem(item: UploadItem) {
		if (item.xhr) {
			item.xhr.abort();
		}

		if (item.documentId) {
			console.log(
				'[Upload Clean] Deleting cancelled/failed document from backend:',
				item.documentId
			);
			await apiRequest('/api/documents/batch-delete', {
				method: 'POST',
				body: { documentIds: [item.documentId] }
			});
		}

		uploadFiles = uploadFiles.filter((i) => i.id !== item.id);
		if (uploadFiles.length === 0) {
			hasStartedUpload = false;
		}
	}

	function discardLocalStagedFiles() {
		uploadFiles = [];
		hasStartedUpload = false;
	}

	async function cancelAllBackendUploads() {
		isCleaningUp = true;
		const docIds = uploadFiles.map((i) => i.documentId).filter((id): id is string => Boolean(id));

		uploadFiles.forEach((i) => {
			if (i.xhr) i.xhr.abort();
		});

		if (docIds.length > 0) {
			console.log('[Upload Clean] Cancelling all backend documents:', docIds);
			await apiRequest('/api/documents/batch-delete', {
				method: 'POST',
				body: { documentIds: docIds }
			});
		}

		uploadFiles = [];
		hasStartedUpload = false;
		isCleaningUp = false;
		toast.info('Uploads cancelled');
	}

	function finishAndClose() {
		open = false;
		if (hasSuccessfulUploads) {
			onSuccess?.();
		}
		uploadFiles = [];
		hasStartedUpload = false;
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		if (e.dataTransfer?.files) {
			handleFilesSelected(e.dataTransfer.files);
		}
	}
</script>

<input
	type="file"
	bind:this={fileInputEl}
	accept=".pdf,.txt"
	multiple
	class="hidden"
	onchange={(e) => e.currentTarget.files && handleFilesSelected(e.currentTarget.files)}
/>

<Dialog.Root bind:open>
	<Dialog.Content
		class="border-[#302F2F] bg-[#191919]/[0.85] p-0 text-white backdrop-blur-[42px] sm:rounded-[22px]"
	>
		<div class="flex flex-col gap-5 p-8 pb-0 md:p-10 md:pb-0">
			<!-- Header Section -->
			<div class="flex flex-col gap-2 text-center">
				<Dialog.Title class="text-3xl font-semibold text-white md:text-4xl">
					Upload Documents
				</Dialog.Title>
				<Dialog.Description class="text-sm font-normal text-[#767676] md:text-base">
					Add important project documents. Supported types: PDF, TXT. (keep files under 25MB)
				</Dialog.Description>
			</div>

			<!-- Browse and Drop Area -->
			<div
				role="region"
				aria-label="File Upload Drop Zone"
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
				ondrop={handleDrop}
				class="flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed px-6 py-10 transition-colors {isDragOver
					? 'border-[#DB8F5E] bg-[#2A2A2A]/80'
					: 'border-white/20 bg-[#2A2A2A]/40 hover:bg-[#2A2A2A]/60'}"
			>
				<!-- Illustrative Composition -->
				<div class="relative mb-6 flex h-24 w-32 items-center justify-center">
					<!-- TXT Icon (Back Right) -->
					<div
						class="absolute top-2 right-2 flex h-16 w-12 rotate-6 transform flex-col items-center justify-center rounded border border-[#302F2F] bg-[#1F1E1D] opacity-80 shadow-lg"
					>
						<span class="text-[10px] font-bold text-[#767676]">TXT</span>
					</div>
					<!-- PDF Icon (Back Left) -->
					<div
						class="absolute top-2 left-2 flex h-16 w-12 -rotate-6 transform flex-col items-center justify-center rounded opacity-80 shadow-lg"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							shape-rendering="geometricPrecision"
							text-rendering="geometricPrecision"
							image-rendering="optimizeQuality"
							fill-rule="evenodd"
							clip-rule="evenodd"
							viewBox="0 0 421 511.605"
						>
							<path
								fill="#2B7CD3"
								d="M95.705.014h199.094L421 136.548v317.555c0 31.54-25.961 57.502-57.502 57.502H95.705c-31.55 0-57.502-25.873-57.502-57.502V57.515C38.203 25.886 64.076.014 95.705.014z"
							/>
							<path
								fill="#185ABD"
								d="M341.028 133.408h-.019L421 188.771v-52.066h-54.357c-9.458-.15-17.998-1.274-25.615-3.297z"
							/>
							<path
								fill="#E2F0FE"
								d="M294.8 0L421 136.533v.172h-54.357c-45.068-.718-69.33-23.397-71.843-61.384V0z"
							/>
							<path
								fill="#103F91"
								fill-rule="nonzero"
								d="M0 431.901V253.404l.028-1.261c.668-16.446 14.333-29.706 30.936-29.706h7.238v50.589h354.304c12.862 0 23.373 10.51 23.373 23.371v135.504c0 12.83-10.543 23.373-23.373 23.373H23.373C10.541 455.274 0 444.75 0 431.901z"
							/>
							<path
								fill="#103F91"
								fill-rule="nonzero"
								d="M143.448 240.364a8.496 8.496 0 01-8.496-8.497 8.496 8.496 0 018.496-8.497h163.176a8.496 8.496 0 018.496 8.497 8.496 8.496 0 01-8.496 8.497H143.448zm0-59.176a8.496 8.496 0 010-16.993h172.304a8.496 8.496 0 110 16.993H143.448z"
							/>
							<path
								fill="#fff"
								fill-rule="nonzero"
								d="M11.329 276.171v154.728c0 7.793 6.38 14.178 14.179 14.178h365.996c7.799 0 14.178-6.379 14.178-14.178V297.405c0-7.798-6.392-14.178-14.178-14.178H37.892c-12.618-.096-19.586-1.638-26.563-7.056z"
							/>
							<path
								fill="#1A1A1A"
								fill-rule="nonzero"
								d="M56.707 401.572v-81.894h36.689c14.764 0 24.896 3.145 30.4 9.435 5.502 6.289 8.255 16.794 8.255 31.512 0 14.72-2.753 25.223-8.255 31.513-5.504 6.29-15.636 9.434-30.4 9.434H56.707zm37.083-60.929H82.913v39.965H93.79c3.582 0 6.179-.416 7.795-1.244 1.616-.831 2.426-2.732 2.426-5.701v-26.075c0-2.969-.81-4.87-2.426-5.699-1.616-.83-4.213-1.246-7.795-1.246zm43.501 20.049c0-14.939 2.796-25.835 8.386-32.692 5.591-6.857 15.681-10.287 30.269-10.287 14.587 0 24.676 3.43 30.266 10.287 5.592 6.857 8.388 17.753 8.388 32.692 0 7.424-.591 13.671-1.771 18.736-1.177 5.067-3.209 9.477-6.092 13.234-2.882 3.758-6.858 6.508-11.923 8.255-5.067 1.747-11.356 2.621-18.868 2.621-7.513 0-13.802-.874-18.87-2.621-5.065-1.747-9.04-4.497-11.924-8.255-2.881-3.757-4.913-8.167-6.092-13.234-1.178-5.065-1.769-11.312-1.769-18.736zm28.171-13.629v34.069h10.877c3.58 0 6.179-.415 7.795-1.246 1.616-.828 2.426-2.729 2.426-5.699v-34.068h-11.008c-3.494 0-6.048.415-7.665 1.245-1.616.829-2.425 2.73-2.425 5.699zm112.687 31.055l1.965 22.014c-5.504 2.271-12.403 3.406-20.703 3.406-8.298 0-14.958-.874-19.983-2.621-5.022-1.747-8.974-4.497-11.857-8.255-2.882-3.757-4.892-8.167-6.027-13.234-1.136-5.065-1.704-11.312-1.704-18.736 0-7.427.568-13.693 1.704-18.803 1.135-5.11 3.145-9.543 6.027-13.301 5.591-7.248 15.854-10.875 30.793-10.875 3.318 0 7.227.328 11.727.983 4.498.655 7.84 1.464 10.023 2.425l-3.93 20.047c-5.68-1.223-10.876-1.835-15.594-1.835-4.716 0-7.991.437-9.826 1.31-1.835.874-2.753 2.62-2.753 5.241v34.33c3.408.7 6.859 1.048 10.353 1.048 7.424 0 14.02-1.048 19.785-3.144zm34.33-58.44l9.041 21.884h1.31l9.04-21.884h28.434l-18.214 39.571 18.214 42.323h-29.089l-9.826-23.585h-1.18l-9.695 23.585h-27.78l17.821-41.535-17.821-40.359h29.745z"
							/>
						</svg>
					</div>
					<div
						class="relative z-10 flex h-20 w-16 flex-col items-center justify-center rounded shadow-xl"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							shape-rendering="geometricPrecision"
							text-rendering="geometricPrecision"
							image-rendering="optimizeQuality"
							fill-rule="evenodd"
							clip-rule="evenodd"
							viewBox="0 0 421 511.605"
						>
							<path
								fill="#E44B4D"
								d="M95.705.014h199.094L421 136.548v317.555c0 31.54-25.961 57.502-57.502 57.502H95.705c-31.55 0-57.502-25.873-57.502-57.502V57.515C38.203 25.886 64.076.014 95.705.014z"
							/>
							<path
								fill="#CD4445"
								d="M341.028 133.408h-.019L421 188.771v-52.066h-54.357c-9.458-.15-17.998-1.274-25.615-3.297z"
							/>
							<path
								fill="#FBCFD0"
								d="M294.8 0L421 136.533v.172h-54.357c-45.068-.718-69.33-23.397-71.843-61.384V0z"
							/>
							<path
								fill="#CD4445"
								fill-rule="nonzero"
								d="M0 431.901V253.404l.028-1.261c.668-16.446 14.333-29.706 30.936-29.706h7.238v50.589h342.975c12.862 0 23.373 10.51 23.373 23.371v135.504c0 12.83-10.543 23.373-23.373 23.373H23.373C10.541 455.274 0 444.75 0 431.901z"
							/>
							<path
								fill="#963232"
								fill-rule="nonzero"
								d="M143.448 240.364a8.496 8.496 0 01-8.496-8.497 8.496 8.496 0 018.496-8.497h163.176a8.496 8.496 0 018.496 8.497 8.496 8.496 0 01-8.496 8.497H143.448zm0-59.176a8.496 8.496 0 010-16.993h172.304a8.496 8.496 0 110 16.993H143.448z"
							/>
							<path
								fill="#fff"
								fill-rule="nonzero"
								d="M11.329 276.171v154.728c0 7.793 6.38 14.178 14.179 14.178h354.667c7.799 0 14.178-6.379 14.178-14.178V297.405c0-7.798-6.388-14.178-14.178-14.178H37.892c-12.618-.096-19.586-1.638-26.563-7.056z"
							/>
							<path
								fill="#1A1A1A"
								fill-rule="nonzero"
								d="M136.343 381.787h-17.035v19.785H93.103v-81.894h41.274c18.782 0 28.171 10.09 28.171 30.269 0 11.094-2.445 19.306-7.336 24.634-1.835 2.008-4.367 3.712-7.6 5.11-3.233 1.396-6.988 2.096-11.269 2.096zm-17.035-41.144v20.179h6.029c3.145 0 5.438-.327 6.878-.982 1.443-.656 2.162-2.162 2.162-4.522v-9.171c0-2.359-.719-3.866-2.162-4.521-1.44-.655-3.733-.983-6.878-.983h-6.029zm53.069 60.929v-81.894h36.689c14.762 0 24.895 3.145 30.399 9.435 5.502 6.289 8.255 16.794 8.255 31.512 0 14.72-2.753 25.223-8.255 31.513-5.504 6.29-15.637 9.434-30.399 9.434h-36.689zm37.083-60.929h-10.878v39.965h10.878c3.581 0 6.178-.416 7.794-1.244 1.616-.831 2.426-2.732 2.426-5.701v-26.075c0-2.969-.81-4.87-2.426-5.699-1.616-.83-4.213-1.246-7.794-1.246zm97.879 30.53h-22.277v30.399h-26.206v-81.894h53.724l-3.276 20.965h-24.242v11.008h22.277v19.522z"
							/>
						</svg>
						<div
							class="absolute -right-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#191919] bg-[#DB8F5E] shadow-md"
						>
							<PlusIcon class="size-4 text-white" />
						</div>
					</div>
				</div>

				<h3 class="mb-2 text-lg font-bold text-white">Drop your files here</h3>
				<p class="mb-5 text-sm text-[#767676]">Or choose another option:</p>

				<Button
					onclick={() => fileInputEl?.click()}
					class="relative cursor-pointer overflow-hidden rounded-[8px] border-t border-white/20 bg-[#302F2F] px-8 font-medium text-white shadow-[0_2px_4px_rgba(0,0,0,0.4)] hover:bg-[#404040]"
				>
					Browse files...
				</Button>
			</div>

			<!-- File List Area -->
			{#if uploadFiles.length > 0}
				<div class="flex flex-col gap-3">
					<div class="flex max-h-52 flex-col gap-2.5 overflow-y-auto pr-1">
						{#each uploadFiles as item (item.id)}
							{#if item.status === 'staged'}
								<!-- Row (Staged - Pre-upload) -->
								<div
									class="flex items-center justify-between rounded-xl border border-transparent bg-[#2A2A2A]/50 px-4 py-3"
								>
									<div class="flex items-center gap-4">
										<div
											class="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white/70"
										>
											<MxIcon name="document-outline" class="size-5" />
										</div>
										<div class="flex flex-col">
											<span class="text-sm font-bold text-white">{item.name}</span>
											<span class="text-xs text-[#959595]"
												>{item.sizeFormatted} -
												<span class="text-white/60">ready to upload</span></span
											>
										</div>
									</div>
									<div class="flex items-center gap-4">
										<Tooltip.Provider delayDuration={100}>
											<Tooltip.Root>
												<Tooltip.Trigger>
													{#snippet child({ props })}
														<button
															type="button"
															{...props}
															onclick={() => removeItem(item)}
															class="cursor-pointer text-[#767676] transition-colors hover:text-white"
														>
															<XIcon class="size-5" />
														</button>
													{/snippet}
												</Tooltip.Trigger>
												<Tooltip.Content
													class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
												>
													<p>Remove File</p>
												</Tooltip.Content>
											</Tooltip.Root>
										</Tooltip.Provider>
									</div>
								</div>
							{:else if item.status === 'success'}
								<!-- Row (Success) -->
								<div
									class="flex items-center justify-between rounded-xl border border-transparent bg-[#2A2A2A]/50 px-4 py-3"
								>
									<div class="flex items-center gap-4">
										<div
											class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]"
										>
											<MxIcon name="document-outline" class="size-5" />
										</div>
										<div class="flex flex-col">
											<span class="text-sm font-bold text-white">{item.name}</span>
											<span class="text-xs text-[#959595]"
												>{item.sizeFormatted} -
												<span class="text-[#22c55e]">successful upload</span></span
											>
										</div>
									</div>
									<div class="flex items-center gap-4">
										<span class="text-sm font-bold text-white">100%</span>
										<CheckCircle2Icon class="size-5 text-[#22c55e]" />
										<Tooltip.Provider delayDuration={100}>
											<Tooltip.Root>
												<Tooltip.Trigger>
													{#snippet child({ props })}
														<button
															type="button"
															{...props}
															onclick={() => removeItem(item)}
															class="cursor-pointer text-[#767676] transition-colors hover:text-[#ef4444]"
														>
															<MxIcon name="trash-bin-minimalistic-outline" class="size-5" />
														</button>
													{/snippet}
												</Tooltip.Trigger>
												<Tooltip.Content
													class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
												>
													<p>Delete File</p>
												</Tooltip.Content>
											</Tooltip.Root>
										</Tooltip.Provider>
									</div>
								</div>
							{:else if item.status === 'failed'}
								<!-- Row (Failed) -->
								<div
									class="flex items-center justify-between rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/5 px-4 py-3 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
								>
									<div class="flex items-center gap-4">
										<div
											class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ef4444]/10 text-[#ef4444]"
										>
											<MxIcon name="document-outline" class="size-5" />
										</div>
										<div class="flex flex-col">
											<span class="text-sm font-bold text-white">{item.name}</span>
											<span class="text-xs text-[#959595]"
												>{item.sizeFormatted} -
												<span class="font-bold text-[#ef4444]"
													>{item.errorMessage || 'upload failed'}</span
												></span
											>
										</div>
									</div>
									<div class="flex items-center gap-4">
										<span class="text-sm font-bold text-white">{item.progress}%</span>
										<Tooltip.Provider delayDuration={100}>
											<Tooltip.Root>
												<Tooltip.Trigger>
													{#snippet child({ props })}
														<button
															type="button"
															{...props}
															onclick={() => retryItem(item)}
															class="cursor-pointer text-[#767676] transition-colors hover:text-white"
														>
															<RotateCcwIcon class="size-5" />
														</button>
													{/snippet}
												</Tooltip.Trigger>
												<Tooltip.Content
													class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
												>
													<p>Retry Upload</p>
												</Tooltip.Content>
											</Tooltip.Root>
										</Tooltip.Provider>
										<Tooltip.Provider delayDuration={100}>
											<Tooltip.Root>
												<Tooltip.Trigger>
													{#snippet child({ props })}
														<button
															type="button"
															{...props}
															onclick={() => removeItem(item)}
															class="cursor-pointer text-[#767676] transition-colors hover:text-white"
														>
															<XIcon class="size-5" />
														</button>
													{/snippet}
												</Tooltip.Trigger>
												<Tooltip.Content
													class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
												>
													<p>Remove File</p>
												</Tooltip.Content>
											</Tooltip.Root>
										</Tooltip.Provider>
									</div>
								</div>
							{:else}
								<!-- Row (Uploading / Requesting / Confirming) -->
								<div
									class="flex items-center justify-between rounded-xl border border-transparent bg-[#2A2A2A]/50 px-4 py-3"
								>
									<div class="flex items-center gap-4">
										<div
											class="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white/70"
										>
											<MxIcon name="document-outline" class="size-5" />
										</div>
										<div class="flex flex-col">
											<span class="text-sm font-bold text-white">{item.name}</span>
											<span class="text-xs text-[#959595]"
												>{item.sizeFormatted} -
												<span class="font-medium text-white/80">
													{#if item.status === 'requesting'}
														preparing...
													{:else if item.status === 'confirming'}
														verifying...
													{:else}
														uploading...
													{/if}
												</span></span
											>
										</div>
									</div>
									<div class="flex items-center gap-4">
										{#if item.status === 'uploading'}
											<span class="text-sm font-bold text-white">{item.progress}%</span>
										{:else}
											<Loader2Icon class="size-4 animate-spin text-white/60" />
										{/if}
										<Tooltip.Provider delayDuration={100}>
											<Tooltip.Root>
												<Tooltip.Trigger>
													{#snippet child({ props })}
														<button
															type="button"
															{...props}
															onclick={() => removeItem(item)}
															class="cursor-pointer text-[#767676] transition-colors hover:text-white"
														>
															<XIcon class="size-5" />
														</button>
													{/snippet}
												</Tooltip.Trigger>
												<Tooltip.Content
													class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
												>
													<p>Cancel Upload</p>
												</Tooltip.Content>
											</Tooltip.Root>
										</Tooltip.Provider>
									</div>
								</div>
							{/if}
						{/each}
					</div>

					<!-- Real-time Summary Bar -->
					<div
						class="flex items-center justify-between rounded-xl border border-white/10 bg-[#222222]/70 px-4 py-2.5 text-xs text-[#959595]"
					>
						<div class="flex items-center gap-2">
							<span class="font-medium text-white/60">Total:</span>
							<span class="font-semibold text-white"
								>{totalFileCount} {totalFileCount === 1 ? 'file' : 'files'}</span
							>
							<span class="text-white/30">•</span>
							<span class="font-semibold text-white">{totalSizeFormatted}</span>
						</div>
						{#if hasSuccessfulUploads || isAnyUploading}
							<div class="flex items-center gap-2">
								<span class="text-white/60">Status:</span>
								<span class="font-medium text-white"
									>{completedCount}/{totalFileCount} completed</span
								>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer Section -->
		<div
			class="flex items-center justify-between border-t border-white/10 bg-[#1F1E1D] px-8 py-5 sm:rounded-b-[22px]"
		>
			<button
				type="button"
				class="flex cursor-pointer items-center gap-2 text-[#767676] transition-colors hover:text-white"
			>
				<div class="flex h-5 w-5 items-center justify-center rounded-full border border-current">
					<span class="text-xs font-bold">?</span>
				</div>
				<span class="text-sm font-medium">Get Help</span>
			</button>

			<div class="flex items-center gap-3">
				{#if hasFailedUploads}
					<!-- Retry All Failed Button -->
					<Button
						type="button"
						variant="ghost"
						onclick={retryAllFailed}
						disabled={isAnyUploading}
						class="cursor-pointer border border-[#DB8F5E]/40 bg-[#DB8F5E]/10 text-sm font-medium text-[#DB8F5E] hover:bg-[#DB8F5E]/20 hover:text-white disabled:opacity-40"
					>
						<RotateCcwIcon class="mr-2 size-4" />
						Retry Failed ({failedCount})
					</Button>
				{/if}

				{#if hasStartedUpload}
					<!-- Post-Upload Cancel All Button (Red Glass Style) -->
					<Button
						type="button"
						variant="ghost"
						onclick={cancelAllBackendUploads}
						disabled={isCleaningUp}
						class="cursor-pointer border border-red-500/30 bg-red-950/30 text-sm font-medium text-red-400 hover:bg-red-900/50 hover:text-red-300 disabled:opacity-40"
					>
						{#if isCleaningUp}
							<Loader2Icon class="mr-2 size-4 animate-spin" />
							Cancelling...
						{:else}
							Cancel All
						{/if}
					</Button>
				{:else}
					<!-- Pre-Upload Discard All Button -->
					<Button
						type="button"
						variant="ghost"
						onclick={discardLocalStagedFiles}
						disabled={uploadFiles.length === 0}
						class="cursor-pointer text-sm font-medium text-white hover:bg-white/10 disabled:opacity-40"
					>
						Discard All
					</Button>
				{/if}

				<div class="relative">
					<Tooltip.Provider delayDuration={100}>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										type="button"
										onclick={hasAllSucceeded ? finishAndClose : startBatchUpload}
										disabled={uploadFiles.length === 0 || isAnyUploading || hasFailedUploads}
										class="relative cursor-pointer bg-[#DB8F5E] font-medium text-white hover:bg-[#C47D4E] disabled:bg-[#DB8F5E]/40 disabled:text-white/50 disabled:opacity-100"
									>
										{#if isAnyUploading}
											<Loader2Icon class="mr-2 size-4 animate-spin" />
											Uploading...
										{:else if hasAllSucceeded}
											Done
										{:else}
											Upload Documents
										{/if}

										{#if hasFailedUploads}
											<!-- Notification Badge -->
											<div
												class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#1F1E1D] bg-[#ef4444] text-[10px] font-bold text-white"
											>
												{failedCount}
											</div>
										{/if}
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							{#if hasFailedUploads}
								<Tooltip.Content
									side="top"
									class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
								>
									<p>Fix Failed Uploads First</p>
								</Tooltip.Content>
							{/if}
						</Tooltip.Root>
					</Tooltip.Provider>
				</div>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
