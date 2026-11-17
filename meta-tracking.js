// Lapisan tracking khusus traffic Meta Ads untuk LP ini.
// Yang dilakukan:
// 1. Memuat Meta Pixel (ganti PIXEL_ID di bawah).
// 2. Menangkap UTM dan fbclid dari URL iklan, menyimpannya, dan meneruskannya ke pesan WhatsApp.
// 3. Menembak event Pixel + CAPI dengan event_id yang sama supaya deduplikasi di Events Manager.
// 4. Event: PageView, ViewContent, InitiateCheckout (klik paket / fokus form), Lead (submit form).

var META_PIXEL_ID = 'GANTI_DENGAN_PIXEL_ID';

(function () {
  // --- Meta Pixel base code ---
  if (META_PIXEL_ID !== 'GANTI_DENGAN_PIXEL_ID') {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
  }

  // --- Tangkap UTM + fbclid ---
  var params = new URLSearchParams(window.location.search);
  var kunci = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
  var tangkapan = {};
  kunci.forEach(function (k) {
    var v = params.get(k);
    if (v) {
      tangkapan[k] = v;
      try { localStorage.setItem('mt_' + k, v); } catch (e) {}
    } else {
      try { tangkapan[k] = localStorage.getItem('mt_' + k) || ''; } catch (e) { tangkapan[k] = ''; }
    }
  });
  window.MT_ATTRIBUTION = tangkapan;

  function buatEventId() {
    return 'mt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  // --- Tembak event ganda: Pixel browser + CAPI server ---
  window.mtTrack = function (eventName, data) {
    data = data || {};
    var eventId = buatEventId();
    if (window.fbq) {
      fbq('track', eventName, {
        content_name: data.content_name || 'Paket Template LP Siap Pakai',
        content_category: 'Template Landing Page',
        value: data.value || 0,
        currency: 'IDR'
      }, { eventID: eventId });
    }
    try {
      fetch('/api/capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          event_name: eventName,
          event_id: eventId,
          event_source_url: window.location.href,
          value: data.value || 0,
          currency: 'IDR',
          phone: data.phone || '',
          fbp: (document.cookie.match(/_fbp=([^;]+)/) || [])[1] || '',
          fbc: tangkapan.fbclid ? 'fb.1.' + Date.now() + '.' + tangkapan.fbclid : ''
        })
      });
    } catch (e) {}
    return eventId;
  };

  // ViewContent saat LP dibuka
  window.addEventListener('load', function () {
    window.mtTrack('ViewContent', { value: 169000 });
  });

  // InitiateCheckout saat pengunjung menyentuh form atau memilih paket
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.querySelector('form.pesan');
    if (form) {
      var sudah = false;
      form.addEventListener('focusin', function () {
        if (!sudah) { sudah = true; window.mtTrack('InitiateCheckout', { value: 169000 }); }
      });
    }
  });

  // Ringkasan atribusi untuk ditempel ke pesan WhatsApp
  window.mtRingkasanAtribusi = function () {
    var b = [];
    if (tangkapan.utm_campaign) b.push('Kampanye: ' + tangkapan.utm_campaign);
    if (tangkapan.utm_content) b.push('Iklan: ' + tangkapan.utm_content);
    return b.join(' | ');
  };
})();
