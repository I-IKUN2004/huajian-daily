import type { Config, Context } from '@netlify/functions';
import { createApp } from '../../src/server/app.mjs';
import { openCloud } from '../../src/server/cloud.mjs';
let app: ReturnType<typeof createApp> | undefined;
export default async (request: Request, context: Context) => {
 if (!app) {
  const passwordHash=Netlify.env.get('SPACE_PASSWORD_HASH');
  if (!passwordHash) return Response.json({error:'空间尚未配置访问密码'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  const namespace=context.deploy.context==='production'?'production':'preview-'+context.deploy.id;
  app=createApp({...openCloud(namespace),passwordHash,secureCookies:true,ai:{apiKey:Netlify.env.get('CHATANYWHERE_API_KEY'),model:Netlify.env.get('CHATANYWHERE_MODEL'),baseURL:Netlify.env.get('CHATANYWHERE_BASE_URL')}});
 }
 return app(request,{ip:context.ip});
};
export const config: Config={path:'/api/*',rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:300}};

