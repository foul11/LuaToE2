#!/bin/env node

import { fileURLToPath } from 'url';
import process from 'process';
import path from 'path';

import E2Data from './src/tree/E2Data.js';
import grammarsBuilder from './src/grammars.js';
import { hideBin } from 'yargs/helpers';
import tree from './src/tree.js';
import yargs from 'yargs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const grammarsdir = path.join(__dirname, 'grammars');

let grammars = null;
/** @type {import('./src/grammars.js').Workers} */
let parser = null;
/** @type {import('./src/tree/E2Data.js').default} */
let fat = null;

async function init(argv) {
	let threads = argv.threads;
	let useJava = argv.UseJava;
	
	grammars = grammarsBuilder(grammarsdir, argv.IncDir, argv.java);
	
	if (argv.grammar) {
		try {
			await grammars.build();
			
			process.stdout.write('\n');
			console.log('Generate success');
		} catch(e) {
			process.stdout.write('\n');
			console.error(`Generate error with code: ${e.toString()}`);
		}
	}
	
	parser = grammars.create({
		countJava: threads,
		liteonly: !useJava
	});
	
	fat = new E2Data(argv.fat, { warnConflictOps: false, warnConflictRetType: false });
}

// eslint-disable-next-line no-unused-vars
const argv = await yargs(hideBin(process.argv))
	.scriptName("E2Compiler")
	.usage('$0 <cmd> [args]')
	.option('java', {
		requiresArg: true,
		default: process.env['JAVA_HOME_18']
			  || process.env['JAVA_HOME_17']
			  || process.env['JAVA_HOME_16']
			  || process.env['JAVA_HOME'],
	})
	.option('fat', {
		requiresArg: true,
		type: 'string',
		describe: 'path for dir or file fat.dat (function and types e2)',
		default: 'data/*.dat'
	})
	.option('IncDir', {
		requiresArg: true,
		type: 'string',
		describe: 'path to Includes file for e2',
		default: 'e2s'
	})
	.option('UseJava', {
		requiresArg: true,
		type: 'boolean',
		describe: 'use java binaries in lexer and parser',
		default: true
	})
	.option('threads', {
		requiresArg: true,
		type: 'number',
		describe: 'count threads (proccess) for use',
		default: 4
	})
	.option('grammar', {
		requiresArg: false,
		type: 'boolean',
		describe: 'rebuild grammars',
		default: false
	})
	.middleware(init)
	.command('build <in> <out>', 'Compile file', (yargs) => {
		yargs.positional('in', {
			type: 'string',
			describe: 'input file'
		})
		
		yargs.positional('out', {
			type: 'string',
			describe: 'output file',
		})
	}, async (argv) => {
		const input = /** @type {string} */ (argv.in);
		
		console.log(
			await tree.compile(
				await tree.clear(await parser.parseFile(input), fat, parser), fat,
				{
					pretty: true,
					opcounter: true,
					debug: true
				}
			)
		);
	})
	.command('generate', 'Build grammars', null, async () => {
		try {
			await grammars.build();
			
			process.stdout.write('\n');
			console.log('Generate success');
		} catch(e) {
			process.stdout.write('\n');
			console.error(`Generate error with code: ${e.toString()}`);
		}
	})
	.command('printTree <in>', '', (yargs) => {
		yargs.positional('in', {
			type: 'string',
			describe: 'input file'
		})
	}, async (argv) => {
		const input = /** @type {string} */ (argv.in);
		
		tree.simpleOutput(
			await tree.clear(await parser.parseFile(input), fat, parser)
		);
	})
	.command('test [subcommand]', 'test command', (yargs) => {
		yargs.positional('subcommand', {
			type: 'string',
		})
		yargs.option('target', {
			type: 'string',
		})
	}, async (argv) => {
		const input = /** @type {string} */ (argv.target);
		
		switch(argv.subcommand) {
			case 'multicalss':  await import('./tests/MultiClass.js');                     			 break;
			case 'e2s':        (await import('./tests/e2s.js')        ).default(input, parser, fat); break;
			case 'loaddat':    (await import('./tests/loaddat.js')    ).default(argv.fat); 			 break;
		}
	})
	.epilog(`use lua "file.Write('fat.dat', util.TableToJSON({ wire_expression2_funcs, wire_expression_types }))" for collect data`)
	.epilog('Use keyword ("stdin" for <in>) or ("stdout" for <out>)')
	.fail((msg, err) => {
		throw err;
	})
	.help()
	.argv

process.exit(0);
