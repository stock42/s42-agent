import {mkdir} from 'node:fs/promises';
import {$} from 'bun';
import {join,resolve} from 'node:path';
import {version} from '../package.json';
const variants=Bun.argv.includes('--compare'),root=resolve(import.meta.dir,'..'),directory=join(root,'dist');await mkdir(directory,{recursive:true});
const targets=variants?[{target:'bun-linux-x64',label:'normal',flags:[]},{target:'bun-linux-x64',label:'minify-map',flags:['--minify','--sourcemap']},{target:'bun-linux-x64',label:'bytecode',flags:['--minify','--sourcemap','--bytecode']}]:['bun-linux-x64','bun-linux-arm64','bun-darwin-x64','bun-darwin-arm64','bun-windows-x64','bun-windows-arm64'].map(target=>({target,label:target.replace(/^bun-/,''),flags:[]}));
const entries=[];
for(const entry of targets){const file=`s42-agent-${version}-${entry.label}${entry.target.includes('windows')?'.exe':''}`,path=join(directory,file),start=Date.now();const args=['build',join(root,'index.ts'),'--compile',`--target=${entry.target}`,...entry.flags,'--outfile',path];
 const result=await $`${process.execPath} ${args}`.cwd(root).quiet().nothrow();if(result.exitCode!==0)throw new Error(`Build ${entry.target}: ${result.stdout.toString()}\n${result.stderr.toString()}`);
 const bytes=await Bun.file(path).arrayBuffer(),sha256=new Bun.CryptoHasher('sha256').update(bytes).digest('hex');entries.push({target:entry.target,file,flags:entry.flags,bytes:bytes.byteLength,sha256,buildMs:Date.now()-start,runtimeValidated:false});console.log(JSON.stringify(entries.at(-1)));
}
const manifest={at:new Date().toISOString(),version,bun:Bun.version,embedded:'ESM imports, package version, UI; no GGUF/credentials/config/session',entries};const name=variants?'build-comparison':'build-targets',qaName=variants?name:'distribution-builds';await Bun.write(join(directory,name+'.json'),JSON.stringify(manifest,null,2)+'\n');await Bun.write(join(root,'docs/qa',qaName+'.json'),JSON.stringify(manifest,null,2)+'\n');await Bun.write(join(directory,name+'.sha256'),entries.map(e=>`${e.sha256}  ${e.file}`).join('\n')+'\n');
