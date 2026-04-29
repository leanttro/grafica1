window.TemplateEngines['lacre3x1-barcode.html'] = {

  handlesBarcodeInternally: true,

  _gerarBarcodeSVGString: function(texto, cfg) {
    if (!texto) return null;
    if (cfg.bTipo === 'QR') return null;

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
        displayValue: false,
        margin:       0,
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
            height:       H,
            displayValue: false,
            margin:       0,
          });
          resolve(canvas.toDataURL('image/png'));
        } catch(e) {
          console.warn('_gerarBarcodeDataUrl:', e);
          resolve(null);
        }
      }
    });
  },

  drawPDF: async function(pdf, ox, oy, W, H, state) {
    const bw = Math.max((7 / 500) * W, 0.1);
    pdf.setLineWidth(bw);

    const [fr,fg,fb] = hexToRgb(state.fundo);
    const [tr,tg,tb] = hexToRgb(state.texto);
    const [dr,dg,db] = hexToRgb(state.destaque);

    const topH  = H * 0.70;
    const mesH  = H * 0.30;
    const logoW = W * 0.18;
    const anosW = W * 0.12;
    const centW = W - logoW - anosW;
    const hAno  = topH / 4;
    const wMes  = W / 12;

    const ln = (x1, y, x2)  => pdf.line(ox+x1, oy+y,  ox+x2, oy+y);
    const lv = (x,  ya, yb) => pdf.line(ox+x,  oy+ya, ox+x,  oy+yb);

    pdf.setFillColor(fr,fg,fb);
    pdf.rect(ox, oy, W, H, 'F');
    pdf.setDrawColor(tr,tg,tb);
    pdf.rect(ox, oy, W, H, 'S');

    ln(0, topH, W);
    lv(logoW, 0, topH);
    lv(W - anosW, 0, topH);
    for (let i = 1; i < 4; i++) pdf.line(ox+W-anosW, oy+hAno*i, ox+W, oy+hAno*i);
    for (let i = 1; i < 12; i++) lv(wMes*i, topH, H);

    pdf.setFont('helvetica', 'bold');

    const fsAno = Math.min(anosW * 0.55, hAno * 0.65) * 2.835;
    pdf.setFontSize(fsAno);
    pdf.setTextColor(dr,dg,db);
    ['26','27','28','29'].forEach((a, i) => {
      const cy = oy + hAno * i + hAno / 2 + (fsAno/2.835)*0.35;
      pdf.text(a, ox + W - anosW/2, cy, { align:'center' });
    });

    const fsMes = Math.min(wMes * 0.70, mesH * 0.65) * 2.835;
    pdf.setFontSize(fsMes);
    pdf.setTextColor(tr,tg,tb);
    ['J','F','M','A','M','J','J','A','S','O','N','D'].forEach((m, i) => {
      const cx = ox + wMes*i + wMes/2;
      const cy = oy + topH + mesH/2 + (fsMes/2.835)*0.35;
      pdf.text(m, cx, cy, { align:'center' });
    });

    const padC  = bw * 2;
    const centAreaY = oy + padC;
    const centAreaH = topH - padC * 2;
    const infoText  = state.vars?.['CHAVE_INFO'] || '';
    const numero    = state.numeroFormatado || state.vars?.CHAVE_NUMERO || '';
    const numCfg    = state.numCfg || {};

    const bLarguraPct = Math.min(Math.max(numCfg.bLargura ?? 85, 20), 100) / 100;
    const bAlturaPct  = Math.min(Math.max(numCfg.bAlturaPct ?? 40, 10), 100) / 100;
    const bOffsetYPct = Math.min(Math.max(numCfg.bOffsetY ?? 60, 10), 90) / 100;
    const temBarcode  = numCfg.ativo && numCfg.barcode && numero;

    pdf.setTextColor(tr,tg,tb);

    if (temBarcode) {
      if (infoText) {
        const scaleInfo = parseFloat(state.vars['CHAVE_INFO_TAM'] ?? 100) / 100;
        const pxInfo = parseFloat(state.vars['CHAVE_INFO_X'] ?? 50) / 100;
        const pyInfo = parseFloat(state.vars['CHAVE_INFO_Y'] ?? 22) / 100;
        const fsInfo = Math.min(centW * 0.20, centAreaH * 0.28) * 2.835 * scaleInfo;
        pdf.setFontSize(fsInfo);
        const infoX = ox + logoW + centW * pxInfo;
        const infoY = centAreaY + centAreaH * pyInfo + (fsInfo/2.835)*0.35;
        pdf.text(infoText, infoX, infoY, { align:'center' });
      }

      const bDataUrl = await this._gerarBarcodeDataUrl(numero, numCfg);
      if (bDataUrl) {
        const bW = centW * bLarguraPct;
        const bH = centAreaH * bAlturaPct;
        const bx = ox + logoW + (centW - bW) / 2;
        const by = centAreaY + centAreaH * bOffsetYPct - bH / 2;
        const byClipped = Math.max(centAreaY, Math.min(by, centAreaY + centAreaH - bH));
        pdf.addImage(bDataUrl, 'PNG', bx, byClipped, bW, bH, undefined, 'NONE');

        if (numCfg.bTipo !== 'QR') {
          let corR = tr, corG = tg, corB = tb;
          if (numCfg.bCor) [corR, corG, corB] = hexToRgb(numCfg.bCor);
          pdf.setTextColor(corR, corG, corB);

          const scaleNum = parseFloat(numCfg.nTam ?? 100) / 100;
          const pxNum = parseFloat(numCfg.nX ?? 50) / 100;
          const pyNum = parseFloat(numCfg.nY ?? 72) / 100;
          const fsNumAbaixo = Math.min(centW * 0.13, centAreaH * 0.20) * 2.835 * scaleNum;
          pdf.setFontSize(fsNumAbaixo);
          const numX = ox + logoW + centW * pxNum;
          const numY = centAreaY + centAreaH * pyNum + (fsNumAbaixo/2.835)*0.35;
          pdf.text(numero, numX, numY, { align:'center' });
        }
      }

    } else {
      if (infoText) {
        const scaleInfo = parseFloat(state.vars['CHAVE_INFO_TAM'] ?? 100) / 100;
        const pxInfo = parseFloat(state.vars['CHAVE_INFO_X'] ?? 50) / 100;
        const pyInfo = parseFloat(state.vars['CHAVE_INFO_Y'] ?? 28) / 100;
        const fsInfo = Math.min(centW * 0.20, centAreaH * 0.30) * 2.835 * scaleInfo;
        pdf.setFontSize(fsInfo);
        const infoX = ox + logoW + centW * pxInfo;
        const infoY = centAreaY + centAreaH * pyInfo + (fsInfo/2.835)*0.35;
        pdf.text(infoText, infoX, infoY, { align:'center' });
      }
      if (numero) {
        let scaleNum = 1, pxNum = 0.5, pyNum = 0.72;
        if (numCfg.ativo) {
            scaleNum = parseFloat(numCfg.nTam ?? 100) / 100;
            pxNum = parseFloat(numCfg.nX ?? 50) / 100;
            pyNum = parseFloat(numCfg.nY ?? 72) / 100;
        } else {
            scaleNum = parseFloat(state.vars['CHAVE_NUMERO_TAM'] ?? 100) / 100;
            pxNum = parseFloat(state.vars['CHAVE_NUMERO_X'] ?? 50) / 100;
            pyNum = parseFloat(state.vars['CHAVE_NUMERO_Y'] ?? 72) / 100;
        }
        const fsNum = Math.min(centW * 0.14, centAreaH * 0.22) * 2.835 * scaleNum;
        pdf.setFontSize(fsNum);
        const numX = ox + logoW + centW * pxNum;
        const numY = centAreaY + centAreaH * pyNum + (fsNum/2.835)*0.35;
        pdf.text(numero, numX, numY, { align:'center' });
      }
    }

    if (state.logoSVGString && state.pdfRaw && window.svg2pdf) {
      const pad = bw * 2;
      const lx = ox + pad, ly = oy + pad;
      const lw = logoW - pad*2, lh = topH - pad*2;
      const scale = parseFloat(state.vars['LOGO_TAM'] ?? 100) / 100;
      const px = parseFloat(state.vars['LOGO_X'] ?? 50) / 100;
      const py = parseFloat(state.vars['LOGO_Y'] ?? 50) / 100;

      const dw = lw * scale;
      const dh = lh * scale;
      const dx = lx + (lw - dw) * px;
      const dy = ly + (lh - dh) * py;

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(state.logoSVGString, 'image/svg+xml');
      const svgEl  = svgDoc.documentElement;
      if (!svgEl.getAttribute('viewBox')) {
        svgEl.setAttribute('viewBox', `0 0 ${svgEl.getAttribute('width')||100} ${svgEl.getAttribute('height')||100}`);
      }
      svgEl.setAttribute('width', dw);
      svgEl.setAttribute('height', dh);
      svgEl.style.position = 'absolute';
      svgEl.style.left = '-9999px';
      svgEl.style.top  = '-9999px';
      document.body.appendChild(svgEl);
      try {
        if (typeof state.pdfRaw.svg === 'function') {
          await state.pdfRaw.svg(svgEl, { x: dx, y: dy, width: dw, height: dh });
        } else if (typeof window.svg2pdf === 'function') {
          await window.svg2pdf(svgEl, state.pdfRaw, { x: dx, y: dy, width: dw, height: dh });
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
      
      const scale = parseFloat(state.vars['LOGO_TAM'] ?? 100) / 100;
      const px = parseFloat(state.vars['LOGO_X'] ?? 50) / 100;
      const py = parseFloat(state.vars['LOGO_Y'] ?? 50) / 100;
      dw *= scale; dh *= scale;
      const dx = lx + (lw - dw) * px;
      const dy = ly + (lh - dh) * py;
      
      const fmt = state.logoDataUrl.startsWith('data:image/png')?'PNG':'JPEG';
      pdf.addImage(state.logoDataUrl, fmt, dx, dy, dw, dh, undefined, 'NONE');
    }
  },

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

    s += line(0, topH, W, topH);
    s += line(logoW, 0, logoW, topH);
    s += line(W-anosW, 0, W-anosW, topH);
    for (let i=1; i<4; i++) s += line(W-anosW, hAno*i, W, hAno*i);
    for (let i=1; i<12; i++) s += line(wMes*i, topH, wMes*i, H);

    const txt = (label, cx, cy, col, fs, extra='') =>
      `<text x="${r4(ox+cx)}" y="${r4(oy+cy)}" font-family="Arial,Helvetica,sans-serif" font-size="${r4(fs)}" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="${col}"${extra}>${label}</text>`;

    const fsAno = Math.min(anosW*0.55, hAno*0.65);
    ['26','27','28','29'].forEach((a,i) =>
      s += txt(a, W-anosW/2, hAno*i+hAno/2, d, fsAno));

    const fsMes = Math.min(wMes*0.70, mesH*0.65);
    ['J','F','M','A','M','J','J','A','S','O','N','D'].forEach((m,i) =>
      s += txt(m, wMes*i+wMes/2, topH+mesH/2, t, fsMes));

    const padC      = bw*2;
    const centAreaH = topH - padC*2;
    const infoText  = state.vars?.['CHAVE_INFO'] || '';
    const numero    = state.numeroFormatado || state.vars?.CHAVE_NUMERO || '';
    const numCfg    = state.numCfg || {};
    const temBarcode = numCfg.ativo && numCfg.barcode && numero;

    const bLarguraPct = Math.min(Math.max(numCfg.bLargura ?? 85, 20), 100) / 100;
    const bAlturaPct  = Math.min(Math.max(numCfg.bAlturaPct ?? 40, 10), 100) / 100;
    const bOffsetYPct = Math.min(Math.max(numCfg.bOffsetY ?? 60, 10), 90) / 100;

    if (temBarcode) {
      if (infoText) {
        const scaleInfo = parseFloat(state.vars['CHAVE_INFO_TAM'] ?? 100) / 100;
        const pxInfo = parseFloat(state.vars['CHAVE_INFO_X'] ?? 50) / 100;
        const pyInfo = parseFloat(state.vars['CHAVE_INFO_Y'] ?? 22) / 100;
        const fsInfo = Math.min(centW * 0.20, centAreaH * 0.28) * scaleInfo;
        const infoX = logoW + centW * pxInfo;
        s += txt(infoText, infoX, padC + centAreaH * pyInfo, t, fsInfo);
      }

      const bW = centW * bLarguraPct;
      const bH = centAreaH * bAlturaPct;
      const bx = logoW + (centW - bW) / 2;
      const by = padC + centAreaH * bOffsetYPct - bH / 2;
      const byClipped = Math.max(padC, Math.min(by, padC + centAreaH - bH));

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
          const vb = svgEl.getAttribute('viewBox') || `0 0 ${svgEl.getAttribute('width')||200} ${svgEl.getAttribute('height')||60}`;
          const inner = svgEl.innerHTML;
          document.body.removeChild(svgEl);
          s += `<g transform="translate(${r4(ox+bx)},${r4(oy+byClipped)})">`;
          s += `<rect x="0" y="0" width="${r4(bW)}" height="${r4(bH)}" fill="${numCfg.bFundo||'#ffffff'}"/>`;
          s += `<svg x="0" y="0" width="${r4(bW)}" height="${r4(bH)}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
          s += `</g>`;
          
          if (numCfg.bTipo !== 'QR') {
            const scaleNum = parseFloat(numCfg.nTam ?? 100) / 100;
            const pxNum = parseFloat(numCfg.nX ?? 50) / 100;
            const pyNum = parseFloat(numCfg.nY ?? 72) / 100;
            const fsNumAbaixo = Math.min(centW * 0.13, centAreaH * 0.20) * scaleNum;
            const numX = logoW + centW * pxNum;
            s += txt(numero, numX, padC + centAreaH * pyNum, numCfg.bCor || t, fsNumAbaixo);
          }
        } catch(e) {
          s += `<rect x="${r4(ox+bx)}" y="${r4(oy+byClipped)}" width="${r4(bW)}" height="${r4(bH)}" fill="${numCfg.bFundo||'#ffffff'}" stroke="${numCfg.bCor||'#000000'}" stroke-width="0.3"/>`;
          if (numCfg.bTipo !== 'QR') {
            const scaleNum = parseFloat(numCfg.nTam ?? 100) / 100;
            const pxNum = parseFloat(numCfg.nX ?? 50) / 100;
            const pyNum = parseFloat(numCfg.nY ?? 72) / 100;
            const fsNumAbaixo = Math.min(centW * 0.13, centAreaH * 0.20) * scaleNum;
            const numX = logoW + centW * pxNum;
            s += txt(numero, numX, padC + centAreaH * pyNum, numCfg.bCor || t, fsNumAbaixo);
          }
        }
      } else {
        s += `<rect x="${r4(ox+bx)}" y="${r4(oy+byClipped)}" width="${r4(bW)}" height="${r4(bH)}" fill="${numCfg.bFundo||'#ffffff'}" stroke="${numCfg.bCor||'#000000'}" stroke-width="0.3"/>`;
        if (numCfg.bTipo !== 'QR') {
          const scaleNum = parseFloat(numCfg.nTam ?? 100) / 100;
          const pxNum = parseFloat(numCfg.nX ?? 50) / 100;
          const pyNum = parseFloat(numCfg.nY ?? 72) / 100;
          const fsNumAbaixo = Math.min(centW * 0.13, centAreaH * 0.20) * scaleNum;
          const numX = logoW + centW * pxNum;
          s += txt(numero, numX, padC + centAreaH * pyNum, numCfg.bCor || t, fsNumAbaixo);
        }
      }
    } else {
      if (infoText) {
        const scaleInfo = parseFloat(state.vars['CHAVE_INFO_TAM'] ?? 100) / 100;
        const pxInfo = parseFloat(state.vars['CHAVE_INFO_X'] ?? 50) / 100;
        const pyInfo = parseFloat(state.vars['CHAVE_INFO_Y'] ?? 28) / 100;
        const fsInfo = Math.min(centW * 0.20, centAreaH * 0.30) * scaleInfo;
        const infoX = logoW + centW * pxInfo;
        s += txt(infoText, infoX, padC + centAreaH * pyInfo, t, fsInfo);
      }
      if (numero) {
        let scaleNum = 1, pxNum = 0.5, pyNum = 0.72;
        if (numCfg.ativo) {
            scaleNum = parseFloat(numCfg.nTam ?? 100) / 100;
            pxNum = parseFloat(numCfg.nX ?? 50) / 100;
            pyNum = parseFloat(numCfg.nY ?? 72) / 100;
        } else {
            scaleNum = parseFloat(state.vars['CHAVE_NUMERO_TAM'] ?? 100) / 100;
            pxNum = parseFloat(state.vars['CHAVE_NUMERO_X'] ?? 50) / 100;
            pyNum = parseFloat(state.vars['CHAVE_NUMERO_Y'] ?? 72) / 100;
        }
        const fsNum = Math.min(centW * 0.14, centAreaH * 0.22) * scaleNum;
        const numX = logoW + centW * pxNum;
        s += txt(numero, numX, padC + centAreaH * pyNum, t, fsNum, ' opacity="0.85"');
      }
    }

    if (state.logoDataUrl) {
      const pad = bw*2;
      const lx = pad, ly = pad;
      const lw = logoW-pad*2, lh = topH-pad*2;
      const img = document.getElementById('logo-img');
      if (img && img.naturalWidth) {
        const ir = img.naturalWidth/img.naturalHeight, br = lw/lh;
        let dw, dh;
        if (ir>br){dw=lw;dh=lw/ir;}else{dh=lh;dw=lh*ir;}
        
        const scale = parseFloat(state.vars['LOGO_TAM'] ?? 100) / 100;
        const px = parseFloat(state.vars['LOGO_X'] ?? 50) / 100;
        const py = parseFloat(state.vars['LOGO_Y'] ?? 50) / 100;
        dw *= scale; dh *= scale;
        const dx = lx + (lw - dw) * px;
        const dy = ly + (lh - dh) * py;
        
        s += `<image x="${r4(ox+dx)}" y="${r4(oy+dy)}" width="${r4(dw)}" height="${r4(dh)}" href="${state.logoDataUrl}" preserveAspectRatio="xMidYMid meet"/>`;
      }
    }

    return s;
  }
};

// ── drawCanvas: renderiza direto em canvas 2D (igual drawPDF, sem SVG/viewBox) ──
window.TemplateEngines['lacre3x1-barcode.html'].drawCanvas = async function(ctx, ox, oy, W, H, S, state) {
  const bw    = Math.max((7/500)*W, 0.1) * S;
  const topH  = H*0.70*S, mesH = H*0.30*S;
  const logoW = W*0.18*S, anosW = W*0.12*S;
  const centW = (W - W*0.18 - W*0.12)*S;
  const hAno  = topH/4, wMes = W*S/12;
  const WS = W*S, HS = H*S;

  // Fundo
  ctx.fillStyle = state.fundo || '#ffffff';
  ctx.fillRect(ox, oy, WS, HS);

  // Borda
  ctx.strokeStyle = state.texto || '#000000';
  ctx.lineWidth = bw;
  ctx.strokeRect(ox+bw/2, oy+bw/2, WS-bw, HS-bw);

  const ln = (x1,y,x2) => { ctx.beginPath(); ctx.moveTo(ox+x1,oy+y); ctx.lineTo(ox+x2,oy+y); ctx.stroke(); };
  const lv = (x,ya,yb)  => { ctx.beginPath(); ctx.moveTo(ox+x,oy+ya); ctx.lineTo(ox+x,oy+yb); ctx.stroke(); };

  ln(0, topH, WS);
  lv(logoW, 0, topH);
  lv(WS-anosW, 0, topH);
  for (let i=1;i<4;i++) ln(WS-anosW, hAno*i, WS);
  for (let i=1;i<12;i++) lv(wMes*i, topH, HS);

  // Anos
  const fsAno = Math.min(anosW*0.55, hAno*0.65);
  ctx.font = `bold ${fsAno}px Arial,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = state.destaque || '#000000';
  ['26','27','28','29'].forEach((a,i) => ctx.fillText(a, ox+WS-anosW/2, oy+hAno*i+hAno/2));

  // Meses
  const fsMes = Math.min(wMes*0.70, mesH*0.65);
  ctx.font = `bold ${fsMes}px Arial,sans-serif`;
  ctx.fillStyle = state.texto || '#000000';
  ['J','F','M','A','M','J','J','A','S','O','N','D'].forEach((m,i) => ctx.fillText(m, ox+wMes*i+wMes/2, oy+topH+mesH/2));

  const padC = bw*2;
  const centAreaY = oy+padC, centAreaH = topH-padC*2;
  const infoText  = state.vars?.['CHAVE_INFO'] || '';
  const numero    = state.numeroFormatado || state.vars?.CHAVE_NUMERO || '';
  const numCfg    = state.numCfg || {};
  const bLarguraPct = Math.min(Math.max(numCfg.bLargura??85,20),100)/100;
  const bAlturaPct  = Math.min(Math.max(numCfg.bAlturaPct??40,10),100)/100;
  const bOffsetYPct = Math.min(Math.max(numCfg.bOffsetY??60,10),90)/100;
  const temBarcode  = numCfg.ativo && numCfg.barcode && numero;

  const dtxt = (txt,cx,cy,fs,cor,op) => {
    ctx.font=`bold ${fs}px Arial,sans-serif`; ctx.fillStyle=cor||state.texto||'#000000';
    ctx.globalAlpha=op??1; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(txt,cx,cy); ctx.globalAlpha=1;
  };

  if (temBarcode) {
    if (infoText) {
      const si=parseFloat(state.vars['CHAVE_INFO_TAM']??100)/100;
      const pxi=parseFloat(state.vars['CHAVE_INFO_X']??50)/100;
      const pyi=parseFloat(state.vars['CHAVE_INFO_Y']??22)/100;
      dtxt(infoText, ox+logoW+centW*pxi, centAreaY+centAreaH*pyi, Math.min(centW*.20,centAreaH*.28)*si, state.texto);
    }
    const bDataUrl = await this._gerarBarcodeDataUrl(numero, numCfg);
    if (bDataUrl) {
      const bW=centW*bLarguraPct, bH=centAreaH*bAlturaPct;
      const bx=ox+logoW+(centW-bW)/2;
      const by=centAreaY+centAreaH*bOffsetYPct-bH/2;
      const byC=Math.max(centAreaY,Math.min(by,centAreaY+centAreaH-bH));
      const bImg=new Image();
      await new Promise(r=>{bImg.onload=r;bImg.onerror=r;bImg.src=bDataUrl;});
      ctx.drawImage(bImg,bx,byC,bW,bH);
      if (numCfg.bTipo!=='QR') {
        const sn=parseFloat(numCfg.nTam??100)/100;
        const pxn=parseFloat(numCfg.nX??50)/100;
        const pyn=parseFloat(numCfg.nY??72)/100;
        dtxt(numero, ox+logoW+centW*pxn, centAreaY+centAreaH*pyn, Math.min(centW*.13,centAreaH*.20)*sn, numCfg.bCor||state.texto);
      }
    }
  } else {
    if (infoText) {
      const si=parseFloat(state.vars['CHAVE_INFO_TAM']??100)/100;
      const pxi=parseFloat(state.vars['CHAVE_INFO_X']??50)/100;
      const pyi=parseFloat(state.vars['CHAVE_INFO_Y']??28)/100;
      dtxt(infoText, ox+logoW+centW*pxi, centAreaY+centAreaH*pyi, Math.min(centW*.20,centAreaH*.30)*si, state.texto);
    }
    if (numero) {
      let sn=1,pxn=0.5,pyn=0.72;
      if (numCfg.ativo){sn=parseFloat(numCfg.nTam??100)/100;pxn=parseFloat(numCfg.nX??50)/100;pyn=parseFloat(numCfg.nY??72)/100;}
      else{sn=parseFloat(state.vars['CHAVE_NUMERO_TAM']??100)/100;pxn=parseFloat(state.vars['CHAVE_NUMERO_X']??50)/100;pyn=parseFloat(state.vars['CHAVE_NUMERO_Y']??72)/100;}
      dtxt(numero, ox+logoW+centW*pxn, centAreaY+centAreaH*pyn, Math.min(centW*.14,centAreaH*.22)*sn, state.texto, 0.85);
    }
  }

  // Logo
  if (state.logoDataUrl) {
    const pad=bw*2;
    const lx=ox+pad,ly=oy+pad,lw=logoW-pad*2,lh=topH-pad*2;
    const img=new Image();
    await new Promise(r=>{img.onload=r;img.onerror=r;img.src=state.logoDataUrl;});
    if (img.naturalWidth) {
      const ir=img.naturalWidth/img.naturalHeight,br=lw/lh;
      let dw,dh;
      if(ir>br){dw=lw;dh=lw/ir;}else{dh=lh;dw=lh*ir;}
      const sc=parseFloat(state.vars['LOGO_TAM']??100)/100;
      const px=parseFloat(state.vars['LOGO_X']??50)/100;
      const py=parseFloat(state.vars['LOGO_Y']??50)/100;
      dw*=sc;dh*=sc;
      ctx.drawImage(img,lx+(lw-dw)*px,ly+(lh-dh)*py,dw,dh);
    }
  }
};
