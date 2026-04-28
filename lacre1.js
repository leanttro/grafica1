window.TemplateEngines['lacre1.html'] = {
  drawPDF: async function(pdf, ox, oy, W, H, state) {
    const bw = Math.max((7 / 500) * W, 0.1);
    pdf.setLineWidth(bw);

    const topH = H * 0.20, midH = H * 0.60, botH = H * 0.20;
    const lW   = W * 0.20,  cW  = W * 0.60,  rW  = W * 0.20;
    const y1 = topH, y2 = topH + midH;

    const [fr,fg,fb] = hexToRgb(state.fundo);
    const [tr,tg,tb] = hexToRgb(state.texto);
    const [dr,dg,db] = hexToRgb(state.destaque);

    pdf.setFillColor(fr,fg,fb);
    pdf.rect(ox, oy, W, H, 'F');
    pdf.setDrawColor(tr,tg,tb);

    const ln = (x1, y, x2) => pdf.line(ox+x1, oy+y,  ox+x2, oy+y);
    const lv = (x, ya, yb) => pdf.line(ox+x,  oy+ya, ox+x,  oy+yb);

    ln(0, 0, W); ln(0, H, W);
    lv(0, 0, H); lv(W, 0, H);

    ln(0, y1, W);
    ln(0, y2, W);

    lv(lW,   y1, y2);
    lv(W-rW, y1, y2);

    lv(W*0.20, 0, y1);
    lv(W*0.50, 0, y1);
    lv(W*0.80, 0, y1);

    lv(W*0.20, y2, H);
    lv(W*0.40, y2, H);
    lv(W*0.60, y2, H);
    lv(W*0.80, y2, H);

    const mh1 = y1 + midH/3, mh2 = y1 + 2*midH/3;
    ln(0,   mh1, lW);
    ln(0,   mh2, lW);

    ln(W-rW, mh1, W);
    ln(W-rW, mh2, W);

    const fs = W * 0.11 * 2.835;
    pdf.setFont('helvetica','bold');

    function txt(label, x, y, w, h, rgb) {
      pdf.setFontSize(fs);
      pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
      const cy = oy + y + h/2 + (fs/2.835)*0.35;
      pdf.text(label, ox + x + w/2, cy, { align:'center' });
    }

    const T = [tr,tg,tb], D = [dr,dg,db];
    txt('1',  0,       0,       lW,     topH,    T);
    txt('26', lW,      0,       W*0.30, topH,    D);
    txt('27', W*0.50,  0,       W*0.30, topH,    D);
    txt('28', W*0.80,  0,       W*0.20, topH,    D);
    txt('2',  0,       y1,           lW, midH/3, T);
    txt('3',  0,       y1+midH/3,    lW, midH/3, T);
    txt('4',  0,       y1+2*midH/3,  lW, midH/3, T);
    txt('12', W-rW,    y1,           rW, midH/3, T);
    txt('11', W-rW,    y1+midH/3,    rW, midH/3, T);
    txt('10', W-rW,    y1+2*midH/3,  rW, midH/3, T);
    txt('5',  0,       y2, W*0.20, botH, T);
    txt('6',  W*0.20,  y2, W*0.20, botH, T);
    txt('7',  W*0.40,  y2, W*0.20, botH, T);
    txt('8',  W*0.60,  y2, W*0.20, botH, T);
    txt('9',  W*0.80,  y2, W*0.20, botH, T);

    if (state.logoSVGString && state.pdfRaw && window.svg2pdf) {
      const pad = bw * 2;
      const lx  = ox + lW + pad, ly = oy + y1 + pad;
      const lw  = cW - pad*2,    lh = midH - pad*2;

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(state.logoSVGString, 'image/svg+xml');
      const svgEl = svgDoc.documentElement;
      
      if (!svgEl.getAttribute('viewBox')) {
        const svgw = svgEl.getAttribute('width') || '100';
        const svgh = svgEl.getAttribute('height') || '100';
        svgEl.setAttribute('viewBox', `0 0 ${parseFloat(svgw)} ${parseFloat(svgh)}`);
      }
      
      svgEl.setAttribute('width', lw);
      svgEl.setAttribute('height', lh);
      
      // O SEGREDO ESTÁ AQUI: Fora da tela, mas visível para o renderizador
      svgEl.style.position = 'absolute';
      svgEl.style.left = '-9999px';
      svgEl.style.top = '-9999px';
      
      document.body.appendChild(svgEl);
      
      try {
        if (typeof state.pdfRaw.svg === 'function') {
          await state.pdfRaw.svg(svgEl, { x: lx, y: ly, width: lw, height: lh });
        } else if (typeof window.svg2pdf === 'function') {
          await window.svg2pdf(svgEl, state.pdfRaw, { x: lx, y: ly, width: lw, height: lh });
        }
      } catch(e) {
        console.error('Erro no svg2pdf:', e);
      }
      
      document.body.removeChild(svgEl);

    } else if (state.logoDataUrl) {
      const pad = bw * 2;
      const lx  = ox + lW + pad, ly = oy + y1 + pad;
      const lw  = cW - pad*2,    lh = midH - pad*2;
      const img = new Image();
      img.src = state.logoDataUrl;
      await new Promise(r => { img.onload=r; img.onerror=r; });
      const ir = img.naturalWidth/img.naturalHeight, br = lw/lh;
      let dw, dh;
      if (ir>br){dw=lw;dh=lw/ir;}else{dh=lh;dw=lh*ir;}
      const dx = lx+(lw-dw)/2, dy = ly+(lh-dh)/2;
      const fmt = state.logoDataUrl.startsWith('data:image/png')?'PNG':'JPEG';
      pdf.addImage(state.logoDataUrl, fmt, dx, dy, dw, dh, undefined, 'NONE');
    }
  },

  drawSVG: function(W, H, ox, oy, state) {
    const bw = Math.max((7 / 500) * W, 0.1);
    const topH = H * 0.20, midH = H * 0.60, botH = H * 0.20;
    const lW = W * 0.20, cW = W * 0.60, rW = W * 0.20;
    const y1 = topH, y2 = topH + midH;
    const mh1 = y1 + midH / 3, mh2 = y1 + 2 * midH / 3;

    const f = state.fundo, t = state.texto, d = state.destaque;
    const r4 = v => Math.round(v * 10000) / 10000;

    let s = `<rect x="${r4(ox)}" y="${r4(oy)}" width="${r4(W)}" height="${r4(H)}" fill="${f}" stroke="none"/>`;
    const sw = `stroke="${t}" stroke-width="${r4(bw)}" stroke-linecap="square"`;
    const line = (x1,y1,x2,y2) => `<line x1="${r4(ox+x1)}" y1="${r4(oy+y1)}" x2="${r4(ox+x2)}" y2="${r4(oy+y2)}" ${sw}/>`;

    s += line(0,0,W,0) + line(0,H,W,H) + line(0,0,0,H) + line(W,0,W,H);
    s += line(0,y1,W,y1) + line(0,y2,W,y2);
    s += line(lW,y1,lW,y2) + line(W-rW,y1,W-rW,y2);

    s += line(W*0.20,0,W*0.20,y1) + line(W*0.50,0,W*0.50,y1) + line(W*0.80,0,W*0.80,y1);
    s += line(W*0.20,y2,W*0.20,H) + line(W*0.40,y2,W*0.40,H) + line(W*0.60,y2,W*0.60,H) + line(W*0.80,y2,W*0.80,H);

    s += line(0,mh1,lW,mh1) + line(0,mh2,lW,mh2);
    s += line(W-rW,mh1,W,mh1) + line(W-rW,mh2,W,mh2);

    const fs = r4(W * 0.11);
    const ta = `font-family="Arial,Helvetica,sans-serif" font-size="${fs}" font-weight="bold" text-anchor="middle" dominant-baseline="middle"`;
    const txt = (label, cx, cy, col) => `<text x="${r4(ox+cx)}" y="${r4(oy+cy)}" ${ta} fill="${col}">${label}</text>`;

    s += txt('1',  lW*0.5,               topH/2,             t);
    s += txt('26', lW+W*0.15,            topH/2,             d);
    s += txt('27', W*0.50+W*0.15,        topH/2,             d);
    s += txt('28', W*0.80+W*0.10,        topH/2,             d);
    s += txt('2',  lW/2,                 y1+midH/6,          t);
    s += txt('3',  lW/2,                 y1+midH/2,          t);
    s += txt('4',  lW/2,                 y1+midH*5/6,        t);
    s += txt('12', W-rW/2,               y1+midH/6,          t);
    s += txt('11', W-rW/2,               y1+midH/2,          t);
    s += txt('10', W-rW/2,               y1+midH*5/6,        t);
    s += txt('5',  W*0.10,               y2+botH/2,          t);
    s += txt('6',  W*0.30,               y2+botH/2,          t);
    s += txt('7',  W*0.50,               y2+botH/2,          t);
    s += txt('8',  W*0.70,               y2+botH/2,          t);
    s += txt('9',  W*0.90,               y2+botH/2,          t);

    if (state.logoDataUrl) {
      const pad = bw * 2;
      const lx = lW + pad, ly = y1 + pad;
      const lw = cW - pad * 2, lh = midH - pad * 2;
      const img = document.getElementById('logo-img');
      if (img && img.naturalWidth) {
        const ir = img.naturalWidth / img.naturalHeight, br = lw / lh;
        let dw, dh;
        if (ir > br) { dw = lw; dh = lw / ir; } else { dh = lh; dw = lh * ir; }
        const dx = lx + (lw - dw) / 2, dy = ly + (lh - dh) / 2;
        s += `<image x="${r4(ox+dx)}" y="${r4(oy+dy)}" width="${r4(dw)}" height="${r4(dh)}" href="${state.logoDataUrl}" preserveAspectRatio="xMidYMid meet"/>`;
      }
    }

    return s;
  }
};
