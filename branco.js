/**
 * branco.js — Engine do template "branco" para o sistema Leanttro.
 *
 * Registra window.TemplateEngines['branco.html'] com drawPDF e drawSVG.
 * Este template é usado pelo editor_dtf e serve de base para qualquer
 * produto que precise apenas posicionar uma arte (imagem ou SVG) em
 * um espaço em branco, sem bordas, textos ou elementos extras.
 *
 * state esperado:
 *   state.imagemDataUrl    — data URL da arte (raster ou SVG como data URI)
 *   state.imagemSVGString  — string SVG bruta (quando for vetorial)
 *   state.imagemTipo       — 'svg' | 'raster'
 *
 * Compatível também com os campos do lacre (logoDataUrl / logoSVGString)
 * para que outros editores possam reutilizar este engine se necessário.
 */

window.TemplateEngines = window.TemplateEngines || {};

window.TemplateEngines['branco.html'] = {

  // ─────────────────────────────────────────────────────────────────
  // drawPDF — renderiza a arte diretamente no jsPDF
  // Parâmetros:
  //   pdf          instância jsPDF
  //   ox, oy       offset de origem (mm) dentro da página
  //   W, H         dimensões da célula (mm) onde a arte deve caber
  //   state        estado do editor
  // ─────────────────────────────────────────────────────────────────
  drawPDF: async function(pdf, ox, oy, W, H, state) {

    // Resolve a fonte de dados: editor_dtf usa imagemDataUrl/imagemSVGString,
    // outros editores podem usar logoDataUrl/logoSVGString.
    const dataUrl   = state.imagemDataUrl   || state.logoDataUrl   || '';
    const svgString = state.imagemSVGString || state.logoSVGString || '';
    const tipo      = state.imagemTipo      || (svgString ? 'svg' : 'raster');

    if (!dataUrl && !svgString) return;

    // Fundo branco para a célula
    pdf.setFillColor(255, 255, 255);
    pdf.rect(ox, oy, W, H, 'F');

    // ── SVG vetorial via svg2pdf ──────────────────────────────────
    if (tipo === 'svg' && svgString && window.svg2pdf) {
      try {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgEl  = svgDoc.documentElement;

        // Garante viewBox
        if (!svgEl.getAttribute('viewBox')) {
          const sw = svgEl.getAttribute('width')  || '100';
          const sh = svgEl.getAttribute('height') || '100';
          svgEl.setAttribute('viewBox', `0 0 ${parseFloat(sw)} ${parseFloat(sh)}`);
        }

        // Calcula fit (contain) mantendo aspect ratio
        const vb = svgEl.getAttribute('viewBox').split(/[\s,]+/);
        const nw = parseFloat(vb[2]) || W;
        const nh = parseFloat(vb[3]) || H;
        const ir = nw / nh, br = W / H;
        let dw, dh;
        if (ir > br) { dw = W; dh = W / ir; } else { dh = H; dw = H * ir; }
        const dx = ox + (W - dw) / 2;
        const dy = oy + (H - dh) / 2;

        svgEl.setAttribute('width',  dw);
        svgEl.setAttribute('height', dh);
        svgEl.style.position   = 'absolute';
        svgEl.style.left       = '-9999px';
        svgEl.style.top        = '-9999px';
        svgEl.style.visibility = 'hidden';
        document.body.appendChild(svgEl);

        if (typeof pdf.svg === 'function') {
          await pdf.svg(svgEl, { x: dx, y: dy, width: dw, height: dh });
        } else {
          await window.svg2pdf(svgEl, pdf, { x: dx, y: dy, width: dw, height: dh });
        }

        document.body.removeChild(svgEl);
        return;
      } catch(e) {
        console.warn('branco.js — svg2pdf falhou, usando raster:', e);
        // fallback para raster abaixo
      }
    }

    // ── Raster (PNG / JPG / WebP / SVG como data URI fallback) ────
    const url = dataUrl || ('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString));
    const img = new Image();
    img.src = url;
    await new Promise(r => { img.onload = r; img.onerror = r; });

    const iw = img.naturalWidth  || W;
    const ih = img.naturalHeight || H;
    const ir = iw / ih, br = W / H;
    let dw, dh;
    if (ir > br) { dw = W; dh = W / ir; } else { dh = H; dw = H * ir; }
    const dx = ox + (W - dw) / 2;
    const dy = oy + (H - dh) / 2;

    const fmt = url.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    pdf.addImage(url, fmt, dx, dy, dw, dh, undefined, 'NONE');
  },

  // ─────────────────────────────────────────────────────────────────
  // drawSVG — retorna fragmento SVG para montagem em arquivo .svg
  // Parâmetros:
  //   W, H         dimensões da célula (unidades SVG = mm)
  //   ox, oy       offset de origem
  //   state        estado do editor
  // Retorna: string com elementos SVG prontos para injetar num <svg>
  // ─────────────────────────────────────────────────────────────────
  drawSVG: function(W, H, ox, oy, state) {
    const r4 = v => Math.round(v * 10000) / 10000;

    const dataUrl   = state.imagemDataUrl   || state.logoDataUrl   || '';
    const svgString = state.imagemSVGString || state.logoSVGString || '';

    let s = `<rect x="${r4(ox)}" y="${r4(oy)}" width="${r4(W)}" height="${r4(H)}" fill="#ffffff"/>`;

    if (!dataUrl && !svgString) return s;

    // Tenta calcular dimensões naturais da arte para fit correto
    let nw = W, nh = H;

    if (svgString) {
      try {
        const parser = new DOMParser();
        const doc    = parser.parseFromString(svgString, 'image/svg+xml');
        const el     = doc.documentElement;
        const vb     = el.getAttribute('viewBox');
        if (vb) {
          const parts = vb.split(/[\s,]+/);
          nw = parseFloat(parts[2]) || W;
          nh = parseFloat(parts[3]) || H;
        } else {
          nw = parseFloat(el.getAttribute('width'))  || W;
          nh = parseFloat(el.getAttribute('height')) || H;
        }
      } catch(_) {}
    } else {
      // Para raster, tenta pegar do elemento img no DOM se disponível
      const img = document.getElementById('img-raster') || document.getElementById('logo-img');
      if (img && img.naturalWidth) {
        nw = img.naturalWidth;
        nh = img.naturalHeight;
      }
    }

    const ir = nw / nh, br = W / H;
    let dw, dh;
    if (ir > br) { dw = W; dh = W / ir; } else { dh = H; dw = H * ir; }
    const dx = ox + (W - dw) / 2;
    const dy = oy + (H - dh) / 2;

    const href = dataUrl || ('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString));

    s += `<image x="${r4(dx)}" y="${r4(dy)}" width="${r4(dw)}" height="${r4(dh)}" ` +
         `href="${href}" preserveAspectRatio="xMidYMid meet"/>`;

    return s;
  }

};
