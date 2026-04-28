window.TemplateEngines['lacre2x1-1.html'] = {
  drawPDF: async function(pdf, ox, oy, W, H, state) {
    const bw = Math.max((7 / 500) * W, 0.1);
    pdf.setLineWidth(bw);

    const [fr,fg,fb] = hexToRgb(state.fundo);
    const [tr,tg,tb] = hexToRgb(state.texto);
    const [dr,dg,db] = hexToRgb(state.destaque);

    pdf.setFillColor(fr,fg,fb);
    pdf.rect(ox, oy, W, H, 'F');
    pdf.setDrawColor(tr,tg,tb);

    const ln = (x1, y, x2) => pdf.line(ox+x1, oy+y,  ox+x2, oy+y);
    const lv = (x, ya, yb) => pdf.line(ox+x,  oy+ya, ox+x,  oy+yb);

    // Borda externa
    pdf.rect(ox, oy, W, H, 'S');

    const topH = H * 0.70;
    const botH = H * 0.30;
    ln(0, topH, W);

    const rW = W * 0.15;
    const lW = W - rW;
    lv(lW, 0, topH);

    const hDest = topH / 3;
    ln(lW, hDest, W);
    ln(lW, hDest * 2, W);

    const hInfo = botH * (1.4 / 2.6);
    const yInfo = topH + hInfo;
    ln(0, yInfo, W);

    const wMes = W / 12;
    for (let i = 1; i < 12; i++) {
      lv(wMes * i, yInfo, H);
    }

    pdf.setFont('helvetica','bold');
    
    pdf.setTextColor(dr,dg,db);
    const fsDest = W * 0.08 * 2.835;
    pdf.setFontSize(fsDest);
    const cyOffset = (fsDest/2.835)*0.35;
    pdf.text('26', ox + lW + rW/2, oy + hDest/2 + cyOffset, { align:'center' });
    pdf.text('27', ox + lW + rW/2, oy + hDest + hDest/2 + cyOffset, { align:'center' });
    pdf.text('28', ox + lW + rW/2, oy + hDest*2 + hDest/2 + cyOffset, { align:'center' });

    pdf.setTextColor(tr,tg,tb);
    const infoText = state.vars['CHAVE_INFO'] || 'INFO';
    const fsInfo = hInfo * 0.65 * 2.835;
    pdf.setFontSize(fsInfo);
    pdf.text(infoText, ox + W/2, oy + topH + hInfo/2 + (fsInfo/2.835)*0.35, { align:'center' });

    const meses = ['J','F','M','A','M','J','J','A','S','O','N','D'];
    const fsMes = W * 0.05 * 2.835;
    pdf.setFontSize(fsMes);
    for (let i = 0; i < 12; i++) {
      pdf.text(meses[i], ox + wMes*i + wMes/2, oy + yInfo + (H-yInfo)/2 + (fsMes/2.835)*0.35, { align:'center' });
    }

    if (state.logoDataUrl || state.logoSVGString) {
      const pad = bw * 2;
      const lx  = ox + pad, ly = oy + pad;
      const lw  = lW - pad*2, lh = topH - pad*2;
      
      // Se for SVG e a biblioteca svg2pdf estiver disponível, usamos ela
      if (state.logoSVGString && window.svg2pdf) {
         try {
            // Em vez de calcular ratio por imagem, tentamos jogar no bounding box total 
            // e deixar o svg2pdf se virar (ele respeita viewBox se existir)
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
            svgEl.style.position = 'absolute';
            svgEl.style.visibility = 'hidden';
            document.body.appendChild(svgEl);
            // Aqui usamos lx e ly (já com offset) para colocar o logo no PDF
            await window.svg2pdf(svgEl, pdf, { x: lx, y: ly, width: lw, height: lh });
            document.body.removeChild(svgEl);
         } catch(e) {
             console.warn('Falha no svg2pdf dentro do template:', e);
             // fallback silently to raster if it somehow fails
         }
      } else if (state.logoDataUrl) {
         // Fallback raster antigo
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
    }
  },

  drawSVG: function(W, H, ox, oy, state) {
    const r4 = v => Math.round(v * 10000) / 10000;
    const bw = Math.max((7 / 500) * W, 0.1);
    const topH = H * 0.70, botH = H * 0.30;
    const rW = W * 0.15, lW = W - rW;
    const hDest = topH / 3;
    const hInfo = botH * (1.4 / 2.6), yInfo = topH + hInfo;
    const wMes = W / 12;

    const f = state.fundo, t = state.texto, d = state.destaque;

    let s = `<rect x="${r4(ox)}" y="${r4(oy)}" width="${r4(W)}" height="${r4(H)}" fill="${f}" stroke="none"/>`;

    s += `<rect x="${r4(ox)}" y="${r4(oy)}" width="${r4(W)}" height="${r4(H)}" fill="none" stroke="${t}" stroke-width="${r4(bw)}" stroke-linejoin="miter"/>`;

    const sw = `stroke="${t}" stroke-width="${r4(bw)}" stroke-linecap="square"`;
    const line = (x1,y1,x2,y2) => `<line x1="${r4(ox+x1)}" y1="${r4(oy+y1)}" x2="${r4(ox+x2)}" y2="${r4(oy+y2)}" ${sw}/>`;

    s += line(0,topH, W,topH) + line(0,yInfo, W,yInfo);
    
    s += line(lW,0, lW,topH);
    for(let i=1; i<12; i++) s += line(wMes*i,yInfo, wMes*i,H);
    
    s += line(lW,hDest, W,hDest) + line(lW,hDest*2, W,hDest*2);

    const txt = (label, cx, cy, col, fs) => `<text x="${r4(ox+cx)}" y="${r4(oy+cy)}" font-family="Arial,Helvetica,sans-serif" font-size="${r4(fs)}" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="${col}">${label}</text>`;

    const fsDest = W * 0.08, fsInfo = hInfo * 0.65, fsMes = W * 0.05;
    s += txt('26', lW+rW/2, hDest/2, d, fsDest);
    s += txt('27', lW+rW/2, hDest + hDest/2, d, fsDest);
    s += txt('28', lW+rW/2, hDest*2 + hDest/2, d, fsDest);
    
    const infoText = state.vars['CHAVE_INFO'] || 'INFO';
    s += txt(infoText, W/2, topH + hInfo/2, t, fsInfo);

    const meses = ['J','F','M','A','M','J','J','A','S','O','N','D'];
    for(let i=0; i<12; i++) s += txt(meses[i], wMes*i + wMes/2, yInfo + (H-yInfo)/2, t, fsMes);

    if (state.logoDataUrl) {
      const pad = bw * 2;
      const lx = 0 + pad, ly = 0 + pad;
      const lw = lW - pad*2, lh = topH - pad*2;
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
