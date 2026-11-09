// Build dist/full-circle-prayer.js and dist/full-circle-prayer.css from src/.
//
//   node tools/build.mjs            build
//   node tools/build.mjs --sync ../full-circle-prayer
//                                   first copy the prayer engine and styles from the
//                                   WordPress plugin, so both stay the same
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join( dirname( fileURLToPath( import.meta.url ) ), '..' );
const pkg = JSON.parse( readFileSync( join( root, 'package.json' ), 'utf8' ) );
const args = process.argv.slice( 2 );

const syncAt = args.indexOf( '--sync' );
if ( syncAt >= 0 ) {
	const plugin = args[ syncAt + 1 ];
	if ( ! plugin || ! existsSync( join( plugin, 'full-circle-prayer.php' ) ) ) {
		console.error( 'Give the path of the full-circle-prayer plugin folder after --sync.' );
		process.exit( 1 );
	}
	copyFileSync( join( plugin, 'assets/js/full-circle-prayer.js' ), join( root, 'src/engine.js' ) );
	copyFileSync( join( plugin, 'assets/css/full-circle-prayer.css' ), join( root, 'src/full-circle-prayer.css' ) );
	console.log( 'Copied the engine and styles from ' + plugin );
}

const books = JSON.stringify( JSON.parse( readFileSync( join( root, 'src/books.json' ), 'utf8' ) ) );
const engine = readFileSync( join( root, 'src/engine.js' ), 'utf8' );
const loader = readFileSync( join( root, 'src/loader.js' ), 'utf8' )
	.replace( '@@VERSION@@', pkg.version )
	.replace( '@@BOOKS@@', books );

if ( ! engine.includes( 'window.FullCirclePrayer.boot = boot' ) ) {
	console.error( 'src/engine.js is missing window.FullCirclePrayer.boot. Sync from Full Circle Prayer 1.13.0 or later.' );
	process.exit( 1 );
}

const banner = '/*! Full Circle Prayer ' + pkg.version + ' · https://github.com/avdude/full-circle-prayer-web · GPL-2.0-or-later */\n';
// The loader runs first, so it can read document.currentScript before anything else.
const js = banner + loader + '\n' + engine;
const css = banner + readFileSync( join( root, 'src/full-circle-prayer.css' ), 'utf8' );
writeFileSync( join( root, 'dist/full-circle-prayer.js' ), js );
writeFileSync( join( root, 'dist/full-circle-prayer.css' ), css );
console.log( 'Built dist/full-circle-prayer.js and dist/full-circle-prayer.css ('  + pkg.version + ')' );
