window.TemplateEngines['lacre3x1-barcode.html'] = {

  drawPDF: async function(pdf, ox, oy, W, H, state) {
    const bw = Math.max((7 / 500) * W, 0.1);
    pdf.setLineWidth(bw);

    const [fr,fg,fb] = hexToRgb(state.fundo);
    const [tr,tg,tb] = hexToRgb(state.texto);
    const [dr,dg,db] = hexToRgb(state.destaque);

    // Fundo
    pdf.setFillColor(fr,fg,fb);
    pdf.rect(ox, oy, W, H, 'F');
    pdf.setDrawColor(tr,tg,tb);
    pdf.rect(ox, oy, W, H, 'S');

    // Proporções
    const topH  = H * 0.70;   // linha superior
    const mesH  = H * 0.30;   // linha de meses
    const logoW = W * 0.18;   // largura do logo
    const anosW = W * 0.12;   // largura da coluna de anos
    const centW = W - logoW - anosW; // largura do centro
    const hAno  = topH / 4;   // altura de cada célula de ano
    const wMes  = W / 12;     // largura de cada mês

    const ln = (x1, y, x2)   => pdf.line(ox+x1, oy+y,  ox+x2, oy+y);
    const lv = (x,  ya, yb)  => pdf.line(ox+x,  oy+ya, ox+x,  oy+yb);

    // Divisória topo/meses
    ln(0, topH, W);

    // Divisória logo | centro
    lv(logoW, 0, topH);

    // Divisória centro | anos
    lv(W - anosW, 0, topH);

    // Divisórias dos anos
    for (let i = 1; i < 4; i++) lv_anos: { pdf.line(ox+W-anosW, oy+hAno*i, ox+W, oy+hAno*i); }

    // Divisórias dos meses
    for (let i = 1; i < 12; i++) lv(wMes*i, topH, H);

    pdf.setFont('helvetica', 'bold');

    // ── Anos ──
    const anos = ['25','26','27','28'];
    const fsAno = Math.min(anosW * 0.55, hAno * 0.65) * 2.835;
    pdf.setFontSize(fsAno);
    pdf.setTextColor(dr,dg,db);
    anos.forEach((a, i) => {
      const cy = oy + hAno * i + hAno / 2 + (fsAno/2.835)*0.35;
      pdf.text(a, ox + W - anosW/2, cy, { align:'center' });
    });

    // ── Meses ──
    const meses = ['J','F','M','A','M','J','J','A','S','O','N','D'];
    const fsMes = Math.min(wMes * 0.70, mesH * 0.65) * 2.835;
    pdf.setFontSize(fsMes);
    pdf.setTextColor(tr,tg,tb);
    meses.forEach((m, i) => {
      const cx = ox + wMes*i + wMes/2;
      const cy = oy + topH + mesH/2 + (fsMes/2.835)*0.35;
      pdf.text(m, cx, cy, { align:'center' });
    });

    // ── Texto INFO ──
    const infoText = state.vars['CHAVE_INFO'] || '';
    const centX = ox + logoW + centW/2;

    // Barcode ou número
    const numero = state.numeroFormatado || state.vars?.CHAVE_NUMERO || '';
    const temBarcode = state.vars?.CHAVE_NUMERO && state.numCfg?.barcode;

    // Área disponível no centro
    const padC = bw * 2;
    const centAreaY = oy + padC;
    const centAreaH = topH - padC * 2;

    if (infoText) {
      // INFO ocupa metade de cima, barcode/num ocupa metade de baixo
      const fsInfo = Math.min(centW * 0.20, centAreaH * 0.30) * 2.835;
      pdf.setFontSize(fsInfo);
      pdf.setTextColor(tr,tg,tb);
      const infoY = centAreaY + centAreaH * 0.28 + (fsInfo/2.835)*0.35;
      pdf.text(infoText, centX, infoY, { align:'center' });
    }

    // Número sequencial
    if (numero) {
      const fsNum = Math.min(centW * 0.14, centAreaH * 0.22) * 2.835;
      pdf.setFontSize(fsNum);
      pdf.setTextColor(tr,tg,tb);
      const numY = centAreaY + centAreaH * 0.72 + (fsNum/2.835)*0.35;
      pdf.text(numero, centX, numY, { align:'center' });
    }

    // ── Logo ──
    if (state.logoSVGString && state.pdfRaw && window.svg2pdf) {
      const pad = bw * 2;
      const lx = ox + pad, ly = oy + pad;
      const lw = logoW - pad*2, lh = topH - pad*2;

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(state.logoSVGString, 'image/svg+xml');
      const svgEl  = svgDoc.documentElement;
      if (!svgEl.getAttribute('viewBox')) {
        svgEl.setAttribute('viewBox', `0 0 ${svgEl.getAttribute('width')||100} ${svgEl.getAttribute('height')||100}`);
      }
      svgEl.setAttribute('width', lw);
      svgEl.setAttribute('height', lh);
      svgEl.style.position = 'absolute';
      svgEl.style.left = '-9999px';
      svgEl.style.top  = '-9999px';
      document.body.appendChild(svgEl);
      try {
        if (typeof state.pdfRaw.svg === 'function') {
          await state.pdfRaw.svg(svgEl, { x: lx, y: ly, width: lw, height: lh });
        } else if (typeof window.svg2pdf === 'function') {
          await window.svg2pdf(svgEl, state.pdfRaw, { x: lx, y: ly, width: lw, height: lh });
        }
      } catch(e) { console.warn('svg2pdf:', e); }
      document.body.removeChild(svgEl);

    } else if (state.logoDataUrl) {
      const pad = bw * 2;
      const lx = ox + pad, ly = oy + pad;
      const lw = logoW - pad*2, lh = topH - pad*2;
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
    const r4  = v => Math.round(v * 10000) / 10000;
    const bw  = Math.max((7/500)*W, 0.1);
    const topH = H * 0.70, mesH = H * 0.30;
    const logoW = W * 0.18, anosW = W * 0.12;
    const centW = W - logoW - anosW;
    const hAno  = topH / 4, wMes = W / 12;

    const f = state.fundo, t = state.texto, d = state.destaque;
    const sw = `stroke="${t}" stroke-width="${r4(bw)}" stroke-linecap="square"`;
    const line = (x1,y1,x2,y2) =>
      `<line x1="${r4(ox+x1)}" y1="${r4(oy+y1)}" x2="${r4(ox+x2)}" y2="${r4(oy+y2)}" ${sw}/>`;

    let s = `<rect x="${r4(ox)}" y="${r4(oy)}" width="${r4(W)}" height="${r4(H)}" fill="${f}" stroke="none"/>`;
    s += `<rect x="${r4(ox)}" y="${r4(oy)}" width="${r4(W)}" height="${r4(H)}" fill="none" stroke="${t}" stroke-width="${r4(bw)}"/>`;

    // Divisórias estruturais
    s += line(0, topH, W, topH);
    s += line(logoW, 0, logoW, topH);
    s += line(W-anosW, 0, W-anosW, topH);
    for (let i=1; i<4; i++) s += line(W-anosW, hAno*i, W, hAno*i);
    for (let i=1; i<12; i++) s += line(wMes*i, topH, wMes*i, H);

    const txt = (label, cx, cy, col, fs, op='') =>
      `<text x="${r4(ox+cx)}" y="${r4(oy+cy)}" font-family="Arial,Helvetica,sans-serif" font-size="${r4(fs)}" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="${col}"${op}>${label}</text>`;

    // Anos
    const fsAno = Math.min(anosW*0.55, hAno*0.65);
    ['25','26','27','28'].forEach((a,i) =>
      s += txt(a, W-anosW/2, hAno*i+hAno/2, d, fsAno));

    // Meses
    const fsMes = Math.min(wMes*0.70, mesH*0.65);
    ['J','F','M','A','M','J','J','A','S','O','N','D'].forEach((m,i) =>
      s += txt(m, wMes*i+wMes/2, topH+mesH/2, t, fsMes));

    // Info
    const infoText = state.vars?.CHAVE_INFO || state.vars?.['CHAVE_INFO'] || '';
    const centX = logoW + centW/2;
    const padC  = bw*2;
    const centAreaH = topH - padC*2;

    if (infoText) {
      const fsInfo = Math.min(centW*0.20, centAreaH*0.30);
      s += txt(infoText, centX, padC + centAreaH*0.28, t, fsInfo);
    }

    // Número
    const numero = state.numeroFormatado || state.vars?.CHAVE_NUMERO || (state.vars && state.vars['CHAVE_NUMERO']) || '';
    if (numero) {
      const fsNum = Math.min(centW*0.14, centAreaH*0.22);
      s += txt(numero, centX, padC + centAreaH*0.72, t, fsNum, ' opacity="0.85"');
    }

    // Logo
    if (state.logoDataUrl) {
      const pad = bw*2;
      const lx = pad, ly = pad;
      const lw = logoW-pad*2, lh = topH-pad*2;
      const img = document.getElementById('logo-img');
      if (img && img.naturalWidth) {
        const ir = img.naturalWidth/img.naturalHeight, br = lw/lh;
        let dw, dh;
        if (ir>br){dw=lw;dh=lw/ir;}else{dh=lh;dw=lh*ir;}
        const dx = lx+(lw-dw)/2, dy = ly+(lh-dh)/2;
        s += `<image x="${r4(ox+dx)}" y="${r4(oy+dy)}" width="${r4(dw)}" height="${r4(dh)}" href="${state.logoDataUrl}" preserveAspectRatio="xMidYMid meet"/>`;
      }
    }

    return s;
  }
};
