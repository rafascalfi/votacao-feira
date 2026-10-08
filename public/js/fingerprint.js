/**
 * Motor de Digital do Dispositivo (Device Fingerprint)
 * Gera uma assinatura única e resistente para cada celular ou computador.
 * Combina Canvas, WebGL, Áudio, Hardware e Recursos de Sistema com hash SHA-256.
 */

window.FeiraFingerprint = {
  // Gera ou recupera o token UUID local e cookie
  getOrCreateVoterToken: function() {
    let token = localStorage.getItem('feira_voter_token');
    
    // Tenta ler de cookie se não estiver no localStorage
    if (!token) {
      const match = document.cookie.match(/(?:^|; )feira_voter_token=([^;]*)/);
      if (match) {
        token = decodeURIComponent(match[1]);
        localStorage.setItem('feira_voter_token', token);
      }
    }

    if (!token) {
      token = 'vt_' + ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
      localStorage.setItem('feira_voter_token', token);
    }

    // Garante que o cookie também está gravado por 365 dias
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `feira_voter_token=${encodeURIComponent(token)}; expires=${expires}; path=/; SameSite=Lax`;

    return token;
  },

  // Gera o Canvas Fingerprint
  getCanvasHash: function() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 140;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'canvas_unsupported';

      ctx.textBaseline = 'top';
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);

      ctx.fillStyle = '#069';
      ctx.fillText('FeiraProjetos🎯2024!', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('VotaçãoAntiFraud🛡️', 4, 45);

      // Curva e gradiente
      const grad = ctx.createLinearGradient(0, 0, 150, 0);
      grad.addColorStop(0, '#ff0055');
      grad.addColorStop(1, '#00c3ff');
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.arc(50, 90, 40, 0, Math.PI * 2, true);
      ctx.stroke();

      return canvas.toDataURL();
    } catch (e) {
      return 'canvas_error_' + e.message;
    }
  },

  // Gera o WebGL Fingerprint
  getWebGLHash: function() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return 'webgl_unsupported';

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

      return `${vendor}~${renderer}~${maxTextureSize}`;
    } catch (e) {
      return 'webgl_error_' + e.message;
    }
  },

  // Gera o Audio Fingerprint via OfflineAudioContext
  getAudioHash: async function() {
    try {
      const AudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AudioContext) return 'audio_unsupported';

      const context = new AudioContext(1, 44100, 44100);
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, context.currentTime);

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, context.currentTime);
      compressor.knee.setValueAtTime(40, context.currentTime);
      compressor.ratio.setValueAtTime(12, context.currentTime);
      compressor.reduction.setValueAtTime(-20, context.currentTime);
      compressor.attack.setValueAtTime(0, context.currentTime);
      compressor.release.setValueAtTime(0.25, context.currentTime);

      oscillator.connect(compressor);
      compressor.connect(context.destination);
      oscillator.start(0);

      const audioBuffer = await context.startRendering();
      const samples = audioBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < samples.length; i += 100) {
        sum += Math.abs(samples[i]);
      }
      return 'audio_' + sum.toFixed(6);
    } catch (e) {
      return 'audio_fallback';
    }
  },

  // Resumo amigável do dispositivo (ex: "iPhone - Safari", "Android - Chrome", "Windows - Chrome")
  getDeviceSummary: function() {
    const ua = navigator.userAgent;
    let device = 'Computador';
    if (/android/i.test(ua)) device = 'Android';
    else if (/iPad|iPhone|iPod/.test(ua)) device = 'iPhone/iPad';
    else if (/Macintosh/i.test(ua)) device = 'Mac';
    else if (/Windows/i.test(ua)) device = 'Windows';
    else if (/Linux/i.test(ua)) device = 'Linux';

    let browser = 'Navegador';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua)) browser = 'Safari';

    return `${device} (${browser})`;
  },

  // Gera o fingerprint completo assíncrono com Hash SHA-256
  getFingerprint: async function() {
    const voterToken = this.getOrCreateVoterToken();
    const canvasData = this.getCanvasHash();
    const webglData = this.getWebGLHash();
    const audioData = await this.getAudioHash();

    const screenData = `${screen.width}x${screen.height}x${screen.colorDepth}_pr${window.devicePixelRatio || 1}`;
    const hardware = `c${navigator.hardwareConcurrency || 'x'}_m${navigator.deviceMemory || 'x'}_touch${navigator.maxTouchPoints || 0}`;
    const env = `${Intl.DateTimeFormat().resolvedOptions().timeZone || ''}_${navigator.language || ''}_${navigator.platform || ''}`;

    // Monta a string de semente
    const rawFingerprint = [
      canvasData,
      webglData,
      audioData,
      screenData,
      hardware,
      env
    ].join('|||');

    // Gera SHA-256 nativo
    let hashHex = '';
    try {
      const msgBuffer = new TextEncoder().encode(rawFingerprint);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fallback simples caso SubtleCrypto falhe
      let hash = 0;
      for (let i = 0; i < rawFingerprint.length; i++) {
        const char = rawFingerprint.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      hashHex = 'hash_' + Math.abs(hash).toString(16);
    }

    return {
      fingerprint: hashHex,
      voterToken: voterToken,
      deviceSummary: this.getDeviceSummary()
    };
  }
};
