// This route is a self-contained design prototype. Every number is illustrative.
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const $$ = <T extends HTMLElement = HTMLElement>(selector: string) => [...document.querySelectorAll<T>(selector)];
const format = (n: number) => n.toFixed(1).replace('.', ',');
const indices = [
  { symbol: 'VNINDEX', exchange: 'HOSE', value: '1.284,32', change: '↗ +10,70 (+0,84%)', probabilities: [52.1,56.8,62.4,65.1,69.8] },
  { symbol: 'HNXINDEX', exchange: 'HNX', value: '229,76', change: '↗ +0,96 (+0,42%)', probabilities: [50.4,53.7,57.8,61.2,64.5] },
  { symbol: 'UPCOMINDEX', exchange: 'UPCoM', value: '94,18', change: '↘ −0,15 (−0,16%)', probabilities: [47.2,48.1,48.6,52.7,59.3] },
];
let index = 0, horizon = 21, period = 1, filter = 'all';
let saved = new Set(['FPT','VCB']);
try { const stored = JSON.parse(localStorage.getItem('merix-wireframe-watchlist') ?? 'null'); if (Array.isArray(stored)) saved = new Set(stored.filter((s: unknown) => typeof s === 'string')); if (localStorage.getItem('merix-wireframe-theme') === 'light') document.documentElement.classList.add('light'); } catch { /* Storage is optional for a preview. */ }
function savePreference(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Keep working in memory. */ } }
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600); }
let points: {x:number;y:number}[] = [];
function renderChart() {
  const count = [35,65,90,120][period];
  points = Array.from({length:count},(_,i)=>{
    const t=i/(count-1); const noise=Math.sin(i*2.7+index)*6+Math.cos(i*1.3)*4;
    const trend=index===2 ? 90+t*70 : 190-t*125;
    return {x:5+t*715,y:Math.max(26,Math.min(220,trend+Math.sin(t*17+period)*18+Math.sin(t*31)*8+noise))};
  });
  const endpointY = [66.36,87.4,130.5][index];
  const shift = endpointY - points.at(-1)!.y;
  points = points.map(p => ({x:p.x,y:Math.max(20,Math.min(225,p.y+shift))}));
  const d=points.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  $('#chart-line').setAttribute('d',d); $('#chart-area').setAttribute('d',`${d} L720,240 L5,240 Z`);
  const last=points.at(-1)!; $('#chart-dot').setAttribute('cx',String(last.x)); $('#chart-dot').setAttribute('cy',String(last.y));
  $('#price-guide').setAttribute('y1',String(last.y)); $('#price-guide').setAttribute('y2',String(last.y));
  $('#volume-bars').innerHTML=points.map((p,i)=>{const height=8+Math.abs(Math.sin(i*4.1))*26;return `<rect x="${p.x}" y="${241-height}" width="${Math.max(2,500/count)}" height="${height}" fill="${i%3===0?'#8c6573':'#427468'}" opacity=".28" />`;}).join('');
  const ticks=index===0?['1.300','1.275','1.250','1.225','1.200']:index===1?['235','230','225','220','215']:['98','96','94','92','90'];
  $$('.axis-text').forEach((el,i)=>el.textContent=ticks[i]);
  const dates=[['21 Thg 9','28 Thg 9','05 Thg 10','12 Thg 10','21 Thg 10'],['21 Thg 7','11 Thg 8','01 Thg 9','22 Thg 9','21 Thg 10'],['21 Thg 4','05 Thg 6','20 Thg 7','04 Thg 9','21 Thg 10'],['Thg 10, 2025','Thg 1, 2026','Thg 4','Thg 7','Thg 10, 2026']][period];
  $$('#chart-dates span').forEach((el,i)=>el.textContent=dates[i]);
  $('#price-chart').setAttribute('aria-label',`Biểu đồ ${indices[index].symbol}, khoảng ${['1 tháng','3 tháng','6 tháng','1 năm'][period]}. Dữ liệu minh họa.`);
}
function renderProbability() {
  const p=indices[index].probabilities[[1,5,21,63,252].indexOf(horizon)];
  $('#probability').innerHTML=`${format(p)}<span>%</span>`;
  $('#up-value').textContent=`${format(p)}%`; $('#notup-value').textContent=`${format(100-p)}%`;
  $('#horizon-label').textContent=`${horizon} phiên`; $('#gauge-value').setAttribute('stroke-dasharray',`${p} 100`);
}
$$('[data-index]').forEach(button=>button.addEventListener('click',()=>{
  index=Number(button.dataset.index); const current=indices[index];
  $$('[data-index]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});
  $('#chart-symbol').textContent=current.symbol; $('#chart-exchange').textContent=current.exchange; $('#chart-value').textContent=current.value; $('#chart-change').textContent=current.change; $('#chart-change').classList.toggle('negative',index===2);
  renderChart();renderProbability();
}));
$$('[data-period]').forEach(button=>button.addEventListener('click',()=>{period=Number(button.dataset.period);$$('[data-period]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderChart();}));
$$('[data-horizon]').forEach(button=>button.addEventListener('click',()=>{horizon=Number(button.dataset.horizon);$$('[data-horizon]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderProbability();}));
const chart=$<SVGElement & HTMLElement>('#price-chart');
chart.addEventListener('pointermove',(event)=>{
  const bounds=chart.getBoundingClientRect();const x=(event.clientX-bounds.left)/bounds.width*800;
  if(x<5||x>720)return;
  const point=points.reduce((best,p)=>Math.abs(p.x-x)<Math.abs(best.x-x)?p:best,points[0]);
  const cursor=$('#chart-cursor');cursor.setAttribute('visibility','visible');
  const line=cursor.querySelector('line')!;line.setAttribute('x1',String(point.x));line.setAttribute('x2',String(point.x));
  const dot=cursor.querySelector('circle')!;dot.setAttribute('cx',String(point.x));dot.setAttribute('cy',String(point.y));
  const labelX=Math.min(590,Math.max(4,point.x-60));
  const box=cursor.querySelector('rect')!;box.setAttribute('x',String(labelX));box.setAttribute('y','4');
  const text=cursor.querySelector('text')!;text.setAttribute('x',String(labelX+9));text.setAttribute('y','22');
  const value=index===0?1317.5-point.y*.5:index===1?238.5-point.y*.1:99.4-point.y*.04;
  text.textContent=`Minh họa: ${value.toLocaleString('vi-VN',{maximumFractionDigits:2})}`;
});
chart.addEventListener('pointerleave',()=>$('#chart-cursor').setAttribute('visibility','hidden'));
function applyFilters(){
  const query=$<HTMLInputElement>('#search').value.trim().toLocaleLowerCase('vi');const sector=$<HTMLSelectElement>('#sector-filter').value;let visible=0;
  $$<HTMLTableRowElement>('[data-stock]').forEach(row=>{const match=(!query||`${row.dataset.stock} ${row.dataset.name} ${row.dataset.sector}`.toLocaleLowerCase('vi').includes(query))&&(!sector||row.dataset.sector===sector)&&(filter!=='watchlist'||saved.has(row.dataset.stock!));row.hidden=!match;if(match)visible++;});
  $('#results-count').textContent=`Hiển thị ${visible} tài sản minh họa`;$('#empty-state').hidden=visible!==0;
  $$('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});
}
function renderSaved(){ $('#watch-count').textContent=String(saved.size);$$('[data-star]').forEach(b=>{const active=saved.has(b.dataset.star!);b.classList.toggle('saved',active);b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',`${active?'Bỏ theo dõi':'Theo dõi'} ${b.dataset.star}`);});applyFilters();}
$$('[data-star]').forEach(b=>b.addEventListener('click',()=>{const symbol=b.dataset.star!;if(saved.has(symbol)){saved.delete(symbol);toast(`Đã bỏ ${symbol} khỏi danh sách theo dõi`);}else{saved.add(symbol);toast(`Đã thêm ${symbol} vào danh sách theo dõi`);}savePreference('merix-wireframe-watchlist',JSON.stringify([...saved]));renderSaved();}));
$$('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter!;applyFilters();}));
$('#search').addEventListener('input',()=>{applyFilters();$('#stocks-section').scrollIntoView({block:'nearest'});});
$('#sector-filter').addEventListener('change',applyFilters);
$$('[data-sector-tile]').forEach(b=>b.addEventListener('click',()=>{const sector=b.dataset.sectorTile!;const select=$<HTMLSelectElement>('#sector-filter');if(![...select.options].some(o=>o.value===sector)){const option=new Option(sector,sector);select.add(option);}select.value=sector;filter='all';$<HTMLInputElement>('#search').value='';applyFilters();$('#stocks-section').scrollIntoView({block:'start'});toast(`Đang lọc ngành ${sector}`);}));
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>{
  $$('[data-view]').forEach(n=>{n.classList.toggle('active',n===b);if(n===b)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});
  const view=b.dataset.view;const labels:Record<string,string>={overview:'Tổng quan',market:'Khám phá thị trường',sectors:'Phân tích ngành',watchlist:'Danh sách theo dõi'};$('#breadcrumb-current').textContent=labels[view!];
  $('.sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');
  if(view==='overview'){filter='all';$<HTMLInputElement>('#search').value='';$<HTMLSelectElement>('#sector-filter').value='';applyFilters();window.scrollTo({top:0});}
  else if(view==='sectors')$('#sectors-section').scrollIntoView({block:'start'});
  else{filter=view==='watchlist'?'watchlist':'all';$<HTMLInputElement>('#search').value='';$<HTMLSelectElement>('#sector-filter').value='';applyFilters();$('#stocks-section').scrollIntoView({block:'start'});}
}));
$('#menu-toggle').addEventListener('click',()=>{const open=$('.sidebar').classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',String(open));});
document.addEventListener('click',event=>{const target=event.target as Element;if(!target.closest('.sidebar')&&!target.closest('#menu-toggle')){$('.sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');}});
$('#theme-toggle').addEventListener('click',()=>{const light=document.documentElement.classList.toggle('light');savePreference('merix-wireframe-theme',light?'light':'dark');});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!(event.target instanceof HTMLInputElement)&&!(event.target instanceof HTMLSelectElement)){event.preventDefault();$('#search').focus();}if(event.key==='Escape'){$('.sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');}});
const dialog=$<HTMLDialogElement>('#detail-dialog');
$$('[data-method]').forEach(b=>b.addEventListener('click',()=>{$('#dialog-title').textContent='Les nombres, avec méthode.';$('#dialog-title').textContent='Hiểu xác suất. Hiểu giới hạn.';$('#dialog-content').innerHTML='<p>MERIX nghiên cứu <strong>xác suất tăng và không tăng</strong> sau 1, 5, 21, 63 hoặc 252 phiên. “Không tăng” bao gồm cả giá đi ngang.</p><p><strong>Tham chiếu</strong> là kết quả từ mô hình cơ sở, chưa phải bằng chứng về khả năng dự báo. <strong>Chưa kiểm định</strong> nghĩa là chưa có đủ đánh giá để kết luận mô hình hữu ích.</p><p>Khi dữ liệu không đủ, hệ thống phải <strong>không phát dự báo</strong> và giải thích nguyên nhân. Không thay dữ liệu thiếu bằng 0% hay 50%.</p><p class="dialog-status">Đây là bản mẫu thiết kế. Các con số và đường biểu diễn đều được tạo để minh họa bố cục, không dùng để ra quyết định đầu tư.</p>';dialog.showModal();}));
$$('[data-detail]').forEach(b=>b.addEventListener('click',()=>{const row=b.closest<HTMLElement>('tr')!;const probability=row.dataset.probability;$('#dialog-title').textContent=`${row.dataset.stock} · ${row.dataset.name}`;$('#dialog-content').replaceChildren();const stat=document.createElement('div');stat.className='dialog-stat';stat.textContent=probability?`${format(Number(probability))}%`:'Không phát dự báo';const small=document.createElement('small');small.textContent=probability?'Xác suất tăng sau 21 phiên · Minh họa':'Thiếu lịch sử dữ liệu phù hợp · Minh họa';stat.append(small);$('#dialog-content').append(stat);const info=document.createElement('p');info.textContent=probability?`Xác suất không tăng: ${format(100-Number(probability))}%. Nhóm ngành: ${row.dataset.sector}.`:`Nhóm ngành: ${row.dataset.sector}. Cần bổ sung lịch sử giá trước khi tính xác suất.`;$('#dialog-content').append(info);const status=document.createElement('p');status.className='dialog-status';status.textContent=`Trạng thái: ${row.querySelector('.model-badge')!.textContent?.trim()}. Toàn bộ dữ liệu trong bản mẫu này là minh họa, không phải kết quả phân tích thực.`;$('#dialog-content').append(status);dialog.showModal();}));
$$('.dialog-close,.dialog-done').forEach(b=>b.addEventListener('click',()=>dialog.close()));dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
renderChart();renderProbability();renderSaved();
