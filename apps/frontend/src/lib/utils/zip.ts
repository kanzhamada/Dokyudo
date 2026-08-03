function makeCrc32Table(): Uint32Array {
	const table = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[i] = c;
	}
	return table;
}

const crc32Table = makeCrc32Table();

function calculateCrc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (let i = 0; i < data.length; i++) {
		crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xff];
	}
	return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFileEntry {
	name: string;
	data: Uint8Array;
}

/**
 * Creates an uncompressed (Store) ZIP archive Blob from an array of files.
 */
export function createZipArchive(files: ZipFileEntry[]): Blob {
	const textEncoder = new TextEncoder();
	const localHeaders: Uint8Array[] = [];
	const centralHeaders: Uint8Array[] = [];
	let offset = 0;

	for (const file of files) {
		const nameBytes = textEncoder.encode(file.name);
		const crc = calculateCrc32(file.data);
		const size = file.data.length;

		// Local Header (30 bytes + name + data)
		const localHeader = new Uint8Array(30 + nameBytes.length + size);
		const view = new DataView(localHeader.buffer);

		view.setUint32(0, 0x04034b50, true); // Signature PK\x03\x04
		view.setUint16(4, 10, true); // Version needed
		view.setUint16(6, 0, true); // General purpose flag
		view.setUint16(8, 0, true); // Compression method (0 = store)
		view.setUint16(10, 0, true); // File time
		view.setUint16(12, 0, true); // File date
		view.setUint32(14, crc, true); // CRC-32
		view.setUint32(18, size, true); // Compressed size
		view.setUint32(22, size, true); // Uncompressed size
		view.setUint16(26, nameBytes.length, true); // Filename length
		view.setUint16(28, 0, true); // Extra field length

		localHeader.set(nameBytes, 30);
		localHeader.set(file.data, 30 + nameBytes.length);
		localHeaders.push(localHeader);

		// Central Directory Header (46 bytes + name)
		const centralHeader = new Uint8Array(46 + nameBytes.length);
		const cView = new DataView(centralHeader.buffer);

		cView.setUint32(0, 0x02014b50, true); // Signature PK\x01\x02
		cView.setUint16(4, 20, true); // Version made by
		cView.setUint16(6, 10, true); // Version needed
		cView.setUint16(8, 0, true); // General purpose flag
		cView.setUint16(10, 0, true); // Compression method
		cView.setUint16(12, 0, true); // File time
		cView.setUint16(14, 0, true); // File date
		cView.setUint32(16, crc, true); // CRC-32
		cView.setUint32(20, size, true); // Compressed size
		cView.setUint32(24, size, true); // Uncompressed size
		cView.setUint16(28, nameBytes.length, true); // Filename length
		cView.setUint16(30, 0, true); // Extra field length
		cView.setUint16(32, 0, true); // File comment length
		cView.setUint16(34, 0, true); // Disk number start
		cView.setUint16(36, 0, true); // Internal file attributes
		cView.setUint32(38, 0, true); // External file attributes
		cView.setUint32(42, offset, true); // Relative offset of local header

		centralHeader.set(nameBytes, 46);
		centralHeaders.push(centralHeader);

		offset += localHeader.length;
	}

	const centralDirOffset = offset;
	let centralDirSize = 0;
	for (const ch of centralHeaders) {
		centralDirSize += ch.length;
	}

	// End of Central Directory Record (22 bytes)
	const eocd = new Uint8Array(22);
	const eView = new DataView(eocd.buffer);
	eView.setUint32(0, 0x06054b50, true); // EOCD signature PK\x05\x06
	eView.setUint16(4, 0, true); // Disk number
	eView.setUint16(6, 0, true); // Start disk
	eView.setUint16(8, files.length, true); // Disk entries
	eView.setUint16(10, files.length, true); // Total entries
	eView.setUint32(12, centralDirSize, true); // Central directory size
	eView.setUint32(16, centralDirOffset, true); // Central directory offset
	return new Blob([...localHeaders, ...centralHeaders, eocd] as any);
}


