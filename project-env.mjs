// Project API credentials are never sent to static pages or logged.
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
export function projectKey(){
 try {
  const config=parseEnv(readFileSync(new URL('./.env',import.meta.url),'utf8'));
  const key=(config.OPENAI_API_KEY||config.API_KEY||'').trim();
  if(key)return key;
 }catch(e){if(e?.code!=='ENOENT')return ''}
 return (process.env.OPENAI_API_KEY||'').trim();
}
