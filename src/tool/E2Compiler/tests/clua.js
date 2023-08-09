import { fileURLToPath } from 'url';
import process from 'process';
import path from 'path';

import tree from "../src/tree.js";
import grammarsBuilder from '../src/grammars.js';
import E2Data from '../src/tree/E2Data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const grammarsdir = path.join(__dirname, '../grammars');

const grammars = grammarsBuilder(grammarsdir, '../../', 'D:/Games/minecraft_launcher/MultiMC_6.12/jdk-16.0.1');
const parser = await grammars.create({});

const fat = new E2Data(path.join(__dirname, '../data/*.dat'), { warnConflictOps: false, warnConflictRetType: false });

console.log("# Compile Time: " + (new Date()).toString())

const [ outs, firstname ] = tree.compile(
    await tree.clear('clua.txt', fat, parser), fat, {
        pretty: true,
        debug: true
    }
);

process.stdout.write(outs[firstname]);

