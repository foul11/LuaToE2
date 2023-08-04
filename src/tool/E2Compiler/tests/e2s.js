import { globIterateSync } from "glob";
import tree from "../src/tree.js";

export default async function(input, parser, fat) {
    for(let file of globIterateSync((input) ?? './e2s/**/*.txt')) {
        console.log(file);
        
        try {
            await tree.clear(await parser.parseFile(file), fat, parser);
        } catch (e) {
            console.error(e);
        }
    }
}