/**
 * Cloudflare Pages Function - Turnstile Server-Side Verification
 * Endpoint: POST /api/turnstile/verify (same-origin with blog.zgqinc.gq)
 * Validates cf-turnstile-response token with Cloudflare's siteverify API.
 */

interface Env {
  TURNSTILE_SECRET_KEY?: string;
  [key: string]: any;
}

type PagesFunction<T = any> = (context: {
  request: Request;
  env: T;
  next: () => Promise<Response>;
  params?: Record<string, string>;
  data?: Record<string, unknown>;
  waitUntil?: (promise: Promise<any>) => void;
}) => Promise<Response> | Response;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const secretKey = context.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    return new Response(JSON.stringify({
      success: false,
      error: '服务端尚未配置 TURNSTILE_SECRET_KEY',
      code: 'MISSING_SECRET_KEY'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({
      success: false,
      error: '请求体格式错误，需为 JSON'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const token = body?.token || body?.response;
  if (!token || typeof token !== 'string' || !token.trim()) {
    return new Response(JSON.stringify({
      success: false,
      error: '缺少人机验证凭证 (token)'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const clientIp = context.request.headers.get('CF-Connecting-IP') || '';

  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token.trim());
  if (clientIp) {
    formData.append('remoteip', clientIp);
  }

  try {
    const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    const result: any = await cfRes.json();
    if (!result.success) {
      const errorCodes = result['error-codes'] || [];
      let humanMsg = '人机安全验证失败或凭据已失效，请重新进行验证';
      if (errorCodes.includes('timeout-or-duplicate')) {
        humanMsg = '人机验证凭证已过期或已被使用，请重新完成验证';
      } else if (errorCodes.includes('invalid-input-response')) {
        humanMsg = '人机验证凭据无效，请重新点击验证组件';
      }
      return new Response(JSON.stringify({
        success: false,
        error: humanMsg,
        error_codes: errorCodes
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      challenge_ts: result.challenge_ts,
      hostname: result.hostname
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: '人机验证服务器通信异常，请稍后重试'
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};
