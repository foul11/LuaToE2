import { globIterateSync } from "glob";
import tree from "../src/tree.js";
import path from "path";

export default async function(input, parser, fat) {
    for(let file of globIterateSync((input) ?? './e2s/**/*.txt', { windowsPathsNoEscape: true })) {
        console.log(file);
        
        try {
            await tree.clear(path.relative('e2s', file), fat, parser);
        } catch (e) {
            console.error(e);
        }
    }
}