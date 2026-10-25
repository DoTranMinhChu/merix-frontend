/**
 * Kiem accessibility bang cach doc chinh source `.astro`.
 *
 * # Vi sao test tinh chu khong dung axe-core tren trinh duyet
 *
 * axe-core kiem duoc nhieu hon, nhung no can mot trang da render, tuc can server + trinh duyet
 * trong CI. Nhung loi a11y hay quay lai nhat o du an nay lai la loai **doc duoc tu source**:
 * mot `<th>` moi khong co `scope`, mot bang moi khong co `<caption>`, mot layout moi khong co
 * lien ket bo qua. Test nay chay trong 10ms va chan dung loai do.
 *
 * Phan con lai — thu tu focus, thong bao cua screen reader — van can kiem bang tay, va muc
 * 12.7 cua ARCHITECTURE.md noi ro dieu do thay vi de nguoi doc tuong la da phu het.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dirname, '..');

/** Mọi file `.astro` dưới `src/`. */
function astroFiles(dir = SRC): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...astroFiles(p));
        else if (name.endsWith('.astro')) out.push(p);
    }
    return out;
}

const files = astroFiles().map((p) => ({
    path: p.slice(SRC.length + 1).split('\\').join('/'),
    src: readFileSync(p, 'utf8'),
}));

/** Bỏ các khối chú thích để không bắt ví dụ trong comment. */
function khongCoChuThich(s: string): string {
    return s
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

describe('a11y tĩnh trong source .astro', () => {
    it('tìm thấy các file .astro để kiểm', () => {
        // Nếu `astroFiles` hỏng thì mọi test dưới đây xanh vì không có gì để kiểm.
        expect(files.length).toBeGreaterThanOrEqual(8);
    });

    it('mọi <th> đều có scope', () => {
        const sai: string[] = [];
        for (const f of files) {
            const s = khongCoChuThich(f.src);
            // `<th` không đi kèm `scope=` trong cùng thẻ.
            const the = s.match(/<th\b[^>]*>/g) ?? [];
            for (const t of the) {
                if (!t.includes('scope=')) sai.push(`${f.path}: ${t.slice(0, 60)}`);
            }
        }
        expect(sai, 'th thiếu scope ⇒ screen reader phải đoán quan hệ ô↔tiêu đề').toEqual([]);
    });

    it('mọi <table> đều có <caption>', () => {
        const sai: string[] = [];
        for (const f of files) {
            const s = khongCoChuThich(f.src);
            const soTable = (s.match(/<table\b/g) ?? []).length;
            const soCaption = (s.match(/<caption\b/g) ?? []).length;
            if (soTable > soCaption) {
                sai.push(`${f.path}: ${soTable} table nhưng ${soCaption} caption`);
            }
        }
        expect(sai, 'table thiếu caption ⇒ vào bảng mà không biết là bảng gì').toEqual([]);
    });

    it('mọi layout đều có liên kết bỏ qua và landmark main có id', () => {
        const layouts = files.filter((f) => f.path.startsWith('layouts/'));
        expect(layouts.length).toBeGreaterThanOrEqual(2);

        for (const f of layouts) {
            expect(f.src, `${f.path} thiếu .skip-link`).toContain('skip-link');
            expect(f.src, `${f.path} thiếu <main id="noi-dung">`).toContain('id="noi-dung"');
            // Liên kết bỏ qua phải trỏ đúng vào id đó.
            expect(f.src, `${f.path}: liên kết bỏ qua trỏ sai đích`).toContain('href="#noi-dung"');
        }
    });

    it('mọi layout khai lang cho tiếng Việt', () => {
        for (const f of files.filter((x) => x.src.includes('<html'))) {
            expect(f.src, `${f.path} thiếu lang="vi"`).toContain('lang="vi"');
        }
    });

    it('không trang nào có nhiều hơn một h1', () => {
        const sai: string[] = [];
        for (const f of files) {
            const n = (khongCoChuThich(f.src).match(/<h1\b/g) ?? []).length;
            if (n > 1) sai.push(`${f.path}: ${n} h1`);
        }
        // Nhiều h1 là một cây tiêu đề sai, và screen reader đọc hết.
        expect(sai).toEqual([]);
    });

    it('mỗi trang admin lấy h1 từ layout, không tự đặt thêm', () => {
        const admin = files.filter((f) => f.path.startsWith('pages/admin/'));
        expect(admin.length).toBeGreaterThanOrEqual(3);
        for (const f of admin) {
            const n = (khongCoChuThich(f.src).match(/<h1\b/g) ?? []).length;
            expect(n, `${f.path} tự đặt h1 trong khi AdminLayout đã dựng một cái`).toBe(0);
        }
    });

    it('ô nhập của form đăng nhập gắn với thông báo lỗi', () => {
        const login = files.find((f) => f.path === 'pages/admin/login.astro');
        expect(login).toBeDefined();
        const s = login?.src ?? '';
        // Hai ô nhập, mỗi ô một `aria-describedby` trỏ vào id của thông báo.
        expect((s.match(/aria-describedby=\{loi \? "loi-dang-nhap"/g) ?? []).length).toBe(2);
        expect((s.match(/aria-invalid=/g) ?? []).length).toBe(2);
        expect(s).toContain('id="loi-dang-nhap"');
    });

    it('viền của ô nhập dùng màu đạt 3:1, không dùng màu viền trang trí', () => {
        const sai: string[] = [];
        for (const f of files) {
            const s = khongCoChuThich(f.src);
            // Một `<input>`/`<select>` mang `--color-line` là ranh giới dưới 3:1 (đo được 1,33:1).
            for (const the of s.match(/<(input|select|textarea)\b[^>]*>/g) ?? []) {
                if (the.includes('--color-line')) sai.push(`${f.path}: ${the.slice(0, 70)}`);
            }
        }
        expect(sai, 'WCAG 1.4.11: ranh giới thành phần giao diện cần 3:1').toEqual([]);
    });
});

describe('biến CSS', () => {
    /**
     * Mọi `var(--color-*)` dùng trong `.astro` phải được khai trong `global.css`.
     *
     * Biến CSS không tồn tại **không gây lỗi** — trình duyệt bỏ qua cả khai báo chứa nó, nên
     * viền biến mất mà không có cảnh báo nào. Đo được: `--color-accent` được dùng ở hai chỗ
     * trong `pages/index.astro` mà chưa bao giờ được khai, nên viền nút "Xem" và viền hover của
     * thẻ tài sản đều không hiện. `astro check` không bắt được loại này.
     */
    it('không dùng biến màu nào chưa được khai', () => {
        const css = readFileSync(join(SRC, 'core/styles/global.css'), 'utf8');
        const khai = new Set([...css.matchAll(/--color-([a-z-]+):/g)].map((m) => m[1]));
        expect(khai.size, 'global.css phải khai ít nhất 8 màu').toBeGreaterThanOrEqual(8);

        const thieu = new Set<string>();
        for (const f of files) {
            // `\(` phải là dấu ngoặc THẬT. Lần đầu viết test này nó thành một nhóm bắt, nên
            // regex đi tìm `var--color-up` — không khớp gì, và test xanh mà không kiểm gì.
            for (const m of f.src.matchAll(/var\(--color-([a-z-]+)\)/g)) {
                if (!khai.has(m[1])) thieu.add(`${f.path}: --color-${m[1]}`);
            }
        }
        expect([...thieu]).toEqual([]);
    });

    /** Test trên phải thực sự tìm thấy biến, nếu không nó xanh vì rỗng. */
    it('quét được biến màu trong source', () => {
        let n = 0;
        for (const f of files) n += [...f.src.matchAll(/var\(--color-([a-z-]+)\)/g)].length;
        expect(n, 'không tìm thấy var(--color-*) nào ⇒ regex đã hỏng').toBeGreaterThan(30);
    });
});

describe('tương phản màu WCAG', () => {
    /** Độ chói tương đối theo WCAG 2.1. */
    function lum(hex: string): number {
        const h = hex.replace('#', '');
        const ch = [0, 2, 4].map((i) => {
            const c = Number.parseInt(h.slice(i, i + 2), 16) / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    }
    function ratio(a: string, b: string): number {
        const [la, lb] = [lum(a), lum(b)];
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    /** Đọc bảng màu từ chính `global.css` — không chép lại giá trị. */
    const css = readFileSync(join(SRC, 'core/styles/global.css'), 'utf8');
    function mau(ten: string): string {
        const m = css.match(new RegExp(`--color-${ten}:\\s*(#[0-9a-fA-F]{6})`));
        if (!m) throw new Error(`global.css không khai --color-${ten}`);
        return m[1];
    }

    const surface = mau('surface');
    const panel = mau('panel');

    it.each([['ink'], ['muted'], ['up'], ['notup'], ['warn']])(
        'màu chữ %s đạt AA 4.5:1 trên cả hai nền',
        (ten) => {
            const c = mau(ten);
            const xau = Math.min(ratio(c, surface), ratio(c, panel));
            expect(xau, `--color-${ten} = ${c} chỉ đạt ${xau.toFixed(2)}:1`).toBeGreaterThanOrEqual(
                4.5,
            );
        },
    );

    it('màu viền của ô nhập đạt 3:1 cho thành phần giao diện', () => {
        const c = mau('control');
        const xau = Math.min(ratio(c, surface), ratio(c, panel));
        expect(xau, `--color-control = ${c} chỉ đạt ${xau.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    });

    it('vành focus đủ tương phản để thấy được trên nền tối', () => {
        // Vành focus dùng `--color-up`; nó phải nổi so với cả hai nền.
        expect(css, 'thiếu quy tắc :focus-visible').toContain(':focus-visible');
        const c = mau('up');
        expect(Math.min(ratio(c, surface), ratio(c, panel))).toBeGreaterThanOrEqual(3);
    });
});
