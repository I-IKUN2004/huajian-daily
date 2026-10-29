import{readFile,writeFile}from'node:fs/promises';
import{resolve}from'node:path';
const html=await readFile('dist/index.html','utf8');
const jsPath=html.match(/<script[^>]+src="([^"]+)"/)?.[1];
const cssPath=html.match(/<link[^>]+href="([^"]+\.css)"/)?.[1];
if(!jsPath||!cssPath)throw new Error('Build the project first');
const js=(await readFile('dist'+jsPath,'utf8')).replaceAll('</script','<\\/script');
const css=await readFile('dist'+cssPath,'utf8');
const output=html.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/,()=>'<script>window.__DESIGN_PREVIEW__=true</script><script type="module">'+js+'</script>').replace(/<link[^>]+href="[^"]+\.css"[^>]*>/,()=>'<style>'+css+'</style>');
const path=resolve(process.argv[2]||'../dan-yu-yong-preview.html');
await writeFile(path,output);console.log('Standalone preview prepared: '+path);

