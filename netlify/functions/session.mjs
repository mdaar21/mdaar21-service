import { InputError, readBounded, checkQuota, originAllowed } from './lib/ai-security.mjs';
import { authConfigured, publicAccessEnabled, accessCodeMatches, issueSession, hasSession, sessionCookie } from './lib/ai-auth.mjs';
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});
export default async function session(req, context) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return json({error:'method_not_allowed'},405,{Allow:'GET, POST, DELETE'});
  if (!originAllowed(req,process.env)) return json({error:'origin_not_allowed'},403);
  if (req.method === 'DELETE') return json({authenticated:false},200,{'Set-Cookie':sessionCookie()});
  if (!authConfigured(process.env)) return json({error:'auth_unconfigured'},503);
  const publicAccess=publicAccessEnabled(process.env);
  const mode=publicAccess?{publicAccess:true}:{};
  if (req.method === 'GET') return json({authenticated:hasSession(req,process.env),...mode});
  if (!/^application\/json(?:\s*;[^\r\n]*)?$/i.test(req.headers.get('content-type') || '')) return json({error:'unsupported_media_type'},415);
  let input;
  try {
    const body = await readBounded(req.body,1024,5000);
    try { input=JSON.parse(body); } catch { throw new InputError('invalid_json'); }
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1) throw new InputError('invalid_input');
    if (publicAccess ? !(input.start === true || input.consent === true) : (typeof input.code !== 'string' || input.code.length < 1 || input.code.length > 256)) throw new InputError('invalid_input');
  } catch(error) { return json({error:error instanceof InputError ? error.code : 'invalid_body'},error instanceof InputError ? error.status : 400); }
  try {
    const loginEnv={...process.env,LIMIT_PER_IP:'20',LIMIT_PER_DAY:'200',LIMIT_PER_MINUTE:'5'};
    if (!await checkQuota(context,loginEnv,fetch,Date.now(),'login')) return json({error:'limit'},429,{'Retry-After':'60'});
  } catch { return json({error:'rate_limit_unavailable'},503); }
  if (!publicAccess && !accessCodeMatches(input.code,process.env.AI_ACCESS_CODE)) return json({error:'invalid_access_code'},401);
  return json({authenticated:true,...mode},200,{'Set-Cookie':sessionCookie(issueSession(process.env.AI_SESSION_SECRET,Date.now(),publicAccess?'public':'invite'))});
}
export const config={path:'/api/session'};
