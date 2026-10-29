import type {Config} from '@netlify/functions';
import {openCloud} from '../../src/server/cloud.mjs';
import {purgeExpired} from '../../src/server/advanced.mjs';
export default async()=>{const result=await purgeExpired(openCloud('production'));return Response.json(result);};
export const config:Config={schedule:'0 19 * * *'}; // 03:00 Asia/Shanghai

