// Sinh `contracts/openapi.json` — nguồn hợp đồng DUY NHẤT (utoipa sinh từ code backend).
//
//   npm run gen:contract     ghi đè contracts/openapi.json
//   npm run check:contract   không ghi; thoát mã 1 nếu bản đã commit lệch nguồn
//
// Mặc định sinh THẲNG TỪ CODE NGUỒN backend, không cần server: chạy example
// `print_openapi` của main-service (`cargo run -p merix-main-service --example print_openapi`).
// Lý do: một backend đang chạy có thể build từ code cũ, nên bản chụp lấy từ nó có thể lệch code
// mà không ai thấy.
//
// Biến môi trường:
//   BACKEND_DIR    thư mục repo backend (mặc định ../merix-backend, anh em với repo này)
//   CARGO_TARGET_DIR  chuyển tiếp cho cargo (dùng khi dịch vụ đang chạy giữ target mặc định)
//   --from-server  lấy `/openapi.json` từ server đang chạy ở BACKEND_URL (mặc định
//                  http://localhost:8080) thay vì dựng từ code — chỉ khi chắc server mới.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../contracts/openapi.json');
const kiemTra = process.argv.includes('--check');
const tuServer = process.argv.includes('--from-server');

let doc;
let nguon;
if (tuServer) {
    const base = (process.env.BACKEND_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
    nguon = `${base}/openapi.json`;
    try {
        const res = await fetch(nguon);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        doc = await res.json();
    } catch (e) {
        console.error(`Không lấy được ${nguon} (${e.message}). Backend đã chạy chưa?`);
        process.exit(2);
    }
} else {
    const dir = resolve(process.env.BACKEND_DIR ?? join(here, '../../merix-backend'));
    nguon = `code nguồn ${dir}`;
    if (!existsSync(join(dir, 'Cargo.toml'))) {
        console.error(`Không thấy backend ở ${dir}. Đặt BACKEND_DIR, hoặc dùng --from-server.`);
        process.exit(2);
    }
    const r = spawnSync(
        'cargo',
        ['run', '-q', '-p', 'merix-main-service', '--example', 'print_openapi'],
        { cwd: dir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    );
    if (r.status !== 0) {
        console.error(`cargo thất bại (mã ${r.status}):\n${r.stderr ?? r.error}`);
        process.exit(2);
    }
    try {
        doc = JSON.parse(r.stdout);
    } catch (e) {
        console.error(`Đầu ra của example print_openapi không phải JSON: ${e.message}`);
        process.exit(2);
    }
}
if (!doc?.paths || !doc?.components?.schemas) {
    console.error(`${nguon} không cho ra một tài liệu OpenAPI hợp lệ.`);
    process.exit(2);
}

// Ghi có định dạng, kết thúc bằng xuống dòng: diff trong git đọc được.
const text = JSON.stringify(doc, null, 2) + '\n';
const nPaths = Object.keys(doc.paths).length;
const nSchemas = Object.keys(doc.components.schemas).length;

/** Liệt kê CỤ THỂ cái gì lệch, để người thấy CI đỏ biết ngay phải nhìn đâu. */
function moTaLech(cu, moi) {
    const dong = [];
    const so = (nhan, a, b) => {
        const ka = Object.keys(a ?? {});
        const kb = Object.keys(b ?? {});
        const chiCu = ka.filter((k) => !kb.includes(k));
        const chiMoi = kb.filter((k) => !ka.includes(k));
        const khac = ka.filter((k) => kb.includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
        if (chiCu.length) dong.push(`  ${nhan} chỉ có trong bản đã commit: ${chiCu.join(', ')}`);
        if (chiMoi.length) dong.push(`  ${nhan} chỉ có trong code nguồn: ${chiMoi.join(', ')}`);
        if (khac.length) dong.push(`  ${nhan} có nội dung khác: ${khac.join(', ')}`);
    };
    so('path', cu?.paths, moi.paths);
    so('schema', cu?.components?.schemas, moi.components.schemas);
    if (!dong.length) dong.push('  (chỉ khác ở phần ngoài path/schema, hoặc chỉ khác định dạng)');
    return dong.join('\n');
}

if (kiemTra) {
    const cuText = existsSync(out) ? readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : '';
    if (cuText !== text) {
        let cu = null;
        try {
            cu = JSON.parse(cuText);
        } catch {
            // Bản đã commit không phải JSON: moTaLech sẽ báo mọi thứ là "chỉ có trong code nguồn".
        }
        console.error(
            `contracts/openapi.json LỆCH ${nguon}:\n${moTaLech(cu, doc)}\nChạy \`npm run gen:contract\`, xem diff rồi commit.`,
        );
        process.exit(1);
    }
    console.log(`contracts/openapi.json khớp ${nguon}: ${nPaths} path, ${nSchemas} schema.`);
} else {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text);
    console.log(`Đã ghi contracts/openapi.json từ ${nguon}: ${nPaths} path, ${nSchemas} schema.`);
}
