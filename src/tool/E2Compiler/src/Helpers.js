import path from 'path';
import fs from 'fs';

/** @param {import('stream').Readable} input */
export async function readAll(input) {
    let chunks = [];
    
    for await (let chunk of input)
        chunks.push(chunk);
        
    return chunks.join();
}

export function* traverseDir(dirPath) {
	if(!fs.lstatSync(dirPath).isDirectory()){
		yield dirPath
		return
	}
	
	const dirEntries = fs.readdirSync(dirPath, {withFileTypes: true});
	
	dirEntries.sort(
		(a, b) => a.name.localeCompare(b.name, "en")
	);
	
	for (const dirEntry of dirEntries) {
		const fileName = dirEntry.name;
		const pathName = path.join(dirPath, fileName);
		
		if (dirEntry.isDirectory()) {
			yield* traverseDir(pathName);
		}else{
			yield pathName;
		}
	}
}