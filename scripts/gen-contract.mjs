// Lấy hợp đồng API từ backend đang chạy (`/openapi.json`, sinh từ code bằng utoipa) rồi ghi vào
// `contracts/openapi.json`. Đây là nguồn hợp đồng DUY NHẤT — không còn file YAML viết tay.
//
//   npm run gen:contract     ghi đè contracts/openapi.json bằng bản đang chạy ở backend
//   npm run check:contract   không ghi; thoát mã 1 nếu bản đã commit lệch backend đang chạy
//
// Biến môi trường: BACKEND_URL (mặc định http://localhost:8080).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = (process.env.BACKEND_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const out = join(dirname(fileURLToPath(import.meta.url)), '../contracts/openapi.json');
const kiemTra = process.argv.includes('--check');

let doc;
try {
    const res = await fetch(`${base}/openapi.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    doc = await res.json();
} catch (e) {
    console.error(`Không lấy được ${base}/openapi.json (${e.message}). Backend đã chạy chưa?`);
    process.exit(2);
}
if (!doc?.paths || !doc?.components?.schemas) {
    console.error(`${base}/openapi.json không phải một tài liệu OpenAPI hợp lệ.`);
    process.exit(2);
}

// Ghi có định dạng, kết thúc bằng xuống dòng: diff trong git đọc được.
const text = JSON.stringify(doc, null, 2) + '\n';
const nPaths = Object.keys(doc.paths).length;
const nSchemas = Object.keys(doc.components.schemas).length;

if (kiemTra) {
    const cu = existsSync(out) ? readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : '';
    if (cu !== text) {
        console.error(`contracts/openapi.json LỆCH backend (${base}). Chạy \`npm run gen:contract\`, xem diff rồi commit.`);
        process.exit(1);
    }
    console.log(`contracts/openapi.json khớp backend: ${nPaths} path, ${nSchemas} schema.`);
} else {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text);
    console.log(`Đã ghi contracts/openapi.json từ ${base}: ${nPaths} path, ${nSchemas} schema.`);
}
