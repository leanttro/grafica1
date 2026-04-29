window.TemplateEngines['lacre3x1-barcode.html'] = {

  // Sinaliza ao editor que este template gerencia o barcode internamente.
  // Com isso, o editor NÃO chama desenharBarcodeNoPDF() após drawPDF().
  handlesBarcodeInternally: true,

  // ─────────────────────────────────────────────────────────────────────────
  // Utilitário: gera SVG do barcode/QR em memória (DOM temporário)
  // Retorna uma string SVG ou null.
  // ─────────────────────────────────────────────────────────────────────────
  _gerarBarcodeSVGString: function(texto, cfg) {
    if (!texto) return null;
    if (cfg.bTipo === 'QR') return null; // QR via canvas, não via SVG inline

    try {
      const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgEl.style.display = 'none';
      document.body.appendChild(svgEl);
      JsBarcode(svgEl, texto, {
        format:       cfg.bTipo || 'CODE128',
        lineColor:    cfg.bCor  || '#000000',
        background:   'transparent',
        width:        2,
        height:       80,
        displayValue: true,
        fontSize:     14,
        margin:       4,
        xmlDocument:  document,
      });
      const str = new XMLSerializer().serializeToString(svgEl);
      document.body.removeChild(svgEl);
      return str;
    } catch(e) {
      console.warn('_gerarBarcodeSVGString:', e);
      return null;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Utilitário: gera dataURL PNG do barcode/QR (para PDF via addImage)
  // ─────────────────────────────────────────────────────────────────────────
  _gerarBarcodeDataUrl: function(texto, cfg) {
    return new Promise((resolve) => {
      if (!texto) { resolve(null); return; }
      const W = 600, H = 160;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;

      if (cfg.bTipo === 'QR') {
        const content = (cfg.qrSufixo || '') + texto;
        QRCode.toCanvas(canvas, content, {
          width: W, margin: 1,
          color: { dark: cfg.bCor || '#000000', light: cfg.bFundo || '#ffffff' }
        }, (err) => resolve(err ? null : canvas.toDataURL('image/png')));
      } else {
        try {
          JsBarcode(canvas, texto, {
            format:       cfg.bTipo || 'CODE128',
            lineColor:    cfg.bCor  || '#000000',
            background:   cfg.bFundo || '#ffffff',
            width:        2,
            height:       H * 0.72,
            displayValue: true,
            fontSize:     H * 0.16,
            margin:       4,
          });
          resolve(canvas.toDataURL('image/png'));
        } catch(e) {
          console.warn('_gerarBarcodeDataUrl:', e);
          resolve(null);
        }
      }
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // drawPDF — renderiza o lacre completo + barcode dentro da area-centro
  // ─────────────────────────────────────────────────────────────────────────
  drawPDF: async function(pdf, ox, oy, W, H, state) {
    const bw = Math.max((7 / 500) * W, 0.1);
    pdf.setLineWidth(bw);

    const [fr,fg,fb] = hexToRgb(state.fundo);
    const [tr,tg,tb] = hexToRgb(state.texto);
    const [dr,dg,db] = hexToRgb(state.destaque);

    // ── Proporções ──
    const topH  = H * 0.70;
    const mesH  = H * 0.30;
    const logoW = W * 0.18;
    const anosW = W * 0.12;
    const centW = W - logoW - anosW;
    const hAno  = topH / 4;
    const wMes  = W / 12;

    const ln = (x1, y, x2)  => pdf.line(ox+x1, oy+y,  ox+x2, oy+y);
    const lv = (x,  ya, yb) => pdf.line(ox+x,  oy+ya, ox+x,  oy+yb);

    // ── Fundo + borda ──
    pdf.setFillColor(fr,fg,fb);
    pdf.rect(ox, oy, W, H, 'F');
    pdf.setDrawColor(tr,tg,tb);
    pdf.rect(ox, oy, W, H, 'S');

    // ── Linhas estruturais ──
    ln(0, topH, W);
    lv(logoW, 0, topH);
    lv(W - anosW, 0, topH);
    for (let i = 1; i < 4; i++) pdf.line(ox+W-anosW, oy+hAno*i, ox+W, oy+hAno*i);
    for (let i = 1; i < 12; i++) lv(wMes*i, topH, H);

    pdf.setFont('helvetica', 'bold');

    // ── Anos ──
    const fsAno = Math.min(anosW * 0.55, hAno * 0.65) * 2.835;
    pdf.setFontSize(fsAno);
    pdf.setTextColor(dr,dg,db);
    ['26','27','28','29'].forEach((a, i) => {
      const cy = oy + hAno * i + hAno / 2 + (fsAno/2.835)*0.35;
      pdf.text(a, ox + W - anosW/2, cy, { align:'center' });
    });

    // ── Meses ──
    const fsMes = Math.min(wMes * 0.70, mesH * 0.65) * 2.835;
    pdf.setFontSize(fsMes);
    pdf.setTextColor(tr,tg,tb);
    ['J','F','M','A','M','J','J','A','S','O','N','D'].forEach((m, i) => {
      const cx = ox + wMes*i + wMes/2;
      const cy = oy + topH + mesH/2 + (fsMes/2.835)*0.35;
      pdf.text(m, cx, cy, { align:'center' });
    });

    // ── Área central ──
    const padC  = bw * 2;
    const centX = ox + logoW + centW / 2;
    const centAreaY = oy + padC;
    const centAreaH = topH - padC * 2;
    const infoText  = state.vars?.['CHAVE_INFO'] || '';
    const numero    = state.numeroFormatado || state.vars?.CHAVE_NUMERO || '';
    const numCfg    = state.numCfg || {};

    // Configurações de barcode (com defaults)
    const bLarguraPct = Math.min(Math.max(numCfg.bLargura ?? 85, 20), 100) / 100;
    const bOffsetYPct = Math.min(Math.max(numCfg.bOffsetY ?? 60, 10), 90) / 100;
    const temBarcode  = numCfg.ativo && numCfg.barcode && numero;

    pdf.setTextColor(tr,tg,tb);

    if (temBarcode) {
      // ── Modo barcode: INFO no topo, barcode abaixo ──
      if (infoText) {
        const fsInfo = Math.min(centW * 0.20, centAreaH * 0.28) * 2.835;
        pdf.setFontSize(fsInfo);
        const infoY = centAreaY + centAreaH * 0.22 + (fsInfo/2.835)*0.35;
        pdf.text(infoText, centX, infoY, { align:'center' });
      }

      // Barcode: posição Y controlada pelo usuário (bOffsetYPct)
      const bDataUrl = await this._gerarBarcodeDataUrl(numero, numCfg);
      if (bDataUrl) {
        const bW = centW * bLarguraPct;
        const bH = Math.min(centAreaH * 0.40, numCfg.bAltura || 8);
        const bx = ox + logoW + (centW - bW) / 2;
        const by = centAreaY + centAreaH * bOffsetYPct - bH / 2;
        // Clip dentro da area-centro para não vazar
        const byClipped = Math.max(centAreaY, Math.min(by, centAreaY + centAreaH - bH));
        pdf.addImage(bDataUrl, 'PNG', bx, byClipped, bW, bH, undefined, 'NONE');
      }

    } else {
      // ── Modo texto: INFO + número sequencial ──
      if (infoText) {
        const fsInfo = Math.min(centW * 0.20, centAreaH * 0.30) * 2.835;
        pdf.setFontSize(fsInfo);
        const infoY = centAreaY + centAreaH * 0.28 + (fsInfo/2.835)*0.35;
        pdf.text(infoText, centX, infoY, { align:'center' });
      }
      if (numero) {
        const fsNum = Math.min(centW * 0.14, centAreaH * 0.22) * 2.835;
        pdf.setFontSize(fsNum);
        const numY = centAreaY + centAreaH * 0.72 + (fsNum/2.835)*0.35;
        pdf.text(numero, centX, numY, { align:'center' });
      }
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

  // ─────────────────────────────────────────────────────────────────────────
  // drawSVG — renderiza o lacre completo + barcode dentro da area-centro
  // Retorna string SVG (sem <svg> wrapper) para ser inserida na montagem.
  // ─────────────────────────────────────────────────────────────────────────
  drawSVG: function(W, H, ox, oy, state) {
    const r4   = v => Math.round(v * 10000) / 10000;
    const bw   = Math.max((7/500)*W, 0.1);
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

    // Divisórias
    s += line(0, topH, W, topH);
    s += line(logoW, 0, logoW, topH);
    s += line(W-anosW, 0, W-anosW, topH);
    for (let i=1; i<4; i++) s += line(W-anosW, hAno*i, W, hAno*i);
    for (let i=1; i<12; i++) s += line(wMes*i, topH, wMes*i, H);

    const txt = (label, cx, cy, col, fs, extra='') =>
      `<text x="${r4(ox+cx)}" y="${r4(oy+cy)}" font-family="Arial,Helvetica,sans-serif" font-size="${r4(fs)}" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="${col}"${extra}>${label}</text>`;

    // Anos
    const fsAno = Math.min(anosW*0.55, hAno*0.65);
    ['26','27','28','29'].forEach((a,i) =>
      s += txt(a, W-anosW/2, hAno*i+hAno/2, d, fsAno));

    // Meses
    const fsMes = Math.min(wMes*0.70, mesH*0.65);
    ['J','F','M','A','M','J','J','A','S','O','N','D'].forEach((m,i) =>
      s += txt(m, wMes*i+wMes/2, topH+mesH/2, t, fsMes));

    // ── Área central ──
    const padC      = bw*2;
    const centX     = logoW + centW/2;
    const centAreaH = topH - padC*2;
    const infoText  = state.vars?.['CHAVE_INFO'] || '';
    const numero    = state.numeroFormatado || state.vars?.CHAVE_NUMERO || '';
    const numCfg    = state.numCfg || {};
    const temBarcode = numCfg.ativo && numCfg.barcode && numero;

    const bLarguraPct = Math.min(Math.max(numCfg.bLargura ?? 85, 20), 100) / 100;
    const bOffsetYPct = Math.min(Math.max(numCfg.bOffsetY ?? 60, 10), 90) / 100;

    if (temBarcode) {
      // INFO no topo
      if (infoText) {
        const fsInfo = Math.min(centW*0.20, centAreaH*0.28);
        s += txt(infoText, centX, padC + centAreaH*0.22, t, fsInfo);
      }

      // Barcode: usa SVG inline se disponível via JsBarcode (para SVG de montagem)
      // Gera placeholder visual — em SVG de exportação não é possível chamar JsBarcode
      // de forma síncrona com resultado inline. Inserimos um rect + texto como fallback.
      const bW = centW * bLarguraPct;
      const bH = Math.min(centAreaH * 0.38, 10);
      const bx = logoW + (centW - bW) / 2;
      const by = padC + centAreaH * bOffsetYPct - bH / 2;
      const byClipped = Math.max(padC, Math.min(by, padC + centAreaH - bH));

      // Tenta gerar o SVG do barcode inline via JsBarcode (disponível no browser)
      if (typeof JsBarcode !== 'undefined' && numero) {
        try {
          const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          svgEl.style.display = 'none';
          document.body.appendChild(svgEl);
          JsBarcode(svgEl, numero, {
            format:       numCfg.bTipo || 'CODE128',
            lineColor:    numCfg.bCor  || '#000000',
            background:   numCfg.bFundo || '#ffffff',
            width:        2,
            height:       60,
            displayValue: false,
            margin:       2,
            xmlDocument:  document,
          });
          // Pega viewBox do SVG gerado para escalar corretamente
          const vb = svgEl.getAttribute('viewBox') || `0 0 ${svgEl.getAttribute('width')||200} ${svgEl.getAttribute('height')||60}`;
          const inner = svgEl.innerHTML;
          document.body.removeChild(svgEl);
          // Reserva espaço inferior para o número (20% da altura total)
          const bHbarras = bH * 0.78;
          const bHnum    = bH * 0.22;
          const fsNumSVG = Math.min(bHnum * 0.85, bW * 0.07);
          // Insere como grupo escalado para caber no espaço
          s += `<g transform="translate(${r4(ox+bx)},${r4(oy+byClipped)})">`;
          s += `<rect x="0" y="0" width="${r4(bW)}" height="${r4(bH)}" fill="${numCfg.bFundo||'#ffffff'}"/>`;
          s += `<svg x="0" y="0" width="${r4(bW)}" height="${r4(bHbarras)}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
          s += `<text x="${r4(bW/2)}" y="${r4(bHbarras + bHnum * 0.85)}" font-family="monospace,Courier,Arial" font-size="${r4(fsNumSVG)}" font-weight="normal" text-anchor="middle" dominant-baseline="auto" fill="${numCfg.bCor||'#000000'}">${numero}</text>`;
          s += `</g>`;
        } catch(e) {
          // Fallback: retângulo placeholder
          s += `<rect x="${r4(ox+bx)}" y="${r4(oy+byClipped)}" width="${r4(bW)}" height="${r4(bH)}" fill="${numCfg.bFundo||'#ffffff'}" stroke="${numCfg.bCor||'#000000'}" stroke-width="0.3"/>`;
          s += txt(numero, centX, byClipped+bH/2, numCfg.bCor||'#000000', Math.min(bH*0.5, 4));
        }
      } else {
        // Fallback quando JsBarcode não disponível
        s += `<rect x="${r4(ox+bx)}" y="${r4(oy+byClipped)}" width="${r4(bW)}" height="${r4(bH)}" fill="${numCfg.bFundo||'#ffffff'}" stroke="${numCfg.bCor||'#000000'}" stroke-width="0.3"/>`;
        s += txt(numero, centX, byClipped+bH/2, numCfg.bCor||'#000000', Math.min(bH*0.5, 4));
      }
    } else {
      // Modo texto
      if (infoText) {
        const fsInfo = Math.min(centW*0.20, centAreaH*0.30);
        s += txt(infoText, centX, padC + centAreaH*0.28, t, fsInfo);
      }
      if (numero) {
        const fsNum = Math.min(centW*0.14, centAreaH*0.22);
        s += txt(numero, centX, padC + centAreaH*0.72, t, fsNum, ' opacity="0.85"');
      }
    }

    // ── Logo ──
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
