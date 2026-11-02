import {access,cp,mkdir,readFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.join(root,'public'),output=path.join(root,'dist');
const required=['index.html','style.css','app.js','chat.js','assets/team.png'];
// Verify sources before replacing any generated output.
for(const file of required){
 try{await access(path.join(source,file))}catch{throw new Error(`Missing source: public/${file}. Upload the complete project, including public/ and scripts/.`)}
}
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(source,output,{recursive:true});
for(const file of required){
 const a=await readFile(path.join(source,file)),b=await readFile(path.join(output,file));
 if(!a.equals(b))throw new Error(`Build copy failed: ${file}`);
}
console.log('Built dist from public. All 5 required assets verified.');
