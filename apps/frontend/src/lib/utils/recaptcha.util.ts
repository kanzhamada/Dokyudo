import '../types/recaptcha.types';

let scriptLoaded = false;

export function loadRecaptcha(siteKey: string): Promise<void> {
  if (scriptLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('reCAPTCHA can only be loaded in the browser'));
      return;
    }

    const existing = document.querySelector(`script[src*="recaptcha"]`);
    if (existing) {
      scriptLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA script'));
    document.head.appendChild(script);
  });
}

export function executeRecaptcha(siteKey: string, action: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.grecaptcha) {
      reject(new Error('reCAPTCHA not loaded'));
      return;
    }

    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(siteKey, { action })
        .then(resolve)
        .catch(reject);
    });
  });
}
