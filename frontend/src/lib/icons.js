export const icons = {
   "archive": `<path d="M10 12v-1"/><path d="M10 18v-2"/><path d="M10 7V6"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v16a2 2 0 0 0 .274 1.01"/><circle cx="10" cy="20" r="2"/>`,
   "text": `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
   "binary": `<rect x="14" y="14" width="4" height="6" rx="2"/><rect x="6" y="4" width="4" height="6" rx="2"/><path d="M6 20h4"/><path d="M14 10h4"/><path d="M6 14h2v6"/><path d="M14 4h2v6"/>`,
   "audio": `<path d="M17.5 22h.5a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M2 19a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0v-4a6 6 0 0 1 12 0v4a2 2 0 1 1-4 0v-1a2 2 0 1 1 4 0"/>`,
   "image": `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><circle cx="10" cy="12" r="2"/><path d="m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22"/>`,
   "sheet": `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 18v-1"/><path d="M12 18v-6"/><path d="M16 18v-3"/>`,
   "unknown": `<path d="M12 17h.01"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"/>`
}

export const iconsPath = {
   "application/zip": 'archive',
   "application/x-zip-compressed": 'archive',
   "application/x-7z-compressed": 'archive',

   "text/plain": 'text',
   "application/pdf": 'text',

   "application/octet-stream": 'binary',

   "audio/mpeg": 'audio',
   "audio/wav": 'audio',
   "audio/ogg": 'audio',

   "image/png": 'image',
   "image/svg+xml": 'image',
   "image/jpeg": 'image',
   "image/gif": 'image',
   "image/webp": 'image',
   "image/bmp": 'image',
   "image/tiff": 'image',


   "video/mp4": 'video',
   "video/x-matroska": 'video',
   "video/x-msvideo": 'video',
   "video/x-flv": 'video',
   "video/x-ms-wmv": 'video',
   "video/ogg": 'video',
   "video/webm": 'video',

   "application/vnd.ms-excel": 'sheet',
   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": 'sheet',
}
