import path from 'path';
import fs from 'fs';

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