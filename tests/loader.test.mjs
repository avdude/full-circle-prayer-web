// Checks for the standalone build. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join( dirname( fileURLToPath( import.meta.url ) ), '..' );

/** Run a built file in a bare sandbox and return its window. */
function run( file ) {
	const noop = () => {};
	const el = () => ( { appendChild: noop, setAttribute: noop } );
	const document = {
		readyState: 'complete',
		getElementById: () => null,
		currentScript: { src: 'https://cdn.example/gh/avdude/full-circle-prayer-web@1/dist/' + file },
		addEventListener: noop,
		querySelector: () => null,
		querySelectorAll: () => [],
		createElement: el,
		head: el(),
	};
	const window = { document, matchMedia: () => ( { matches: false } ) };
	window.window = window;
	const head = { appendChild: ( l ) => ( window.cssHref = l.href ), setAttribute: () => {} };
	document.head = head;
	document.createElement = () => ( { setAttribute: () => {} } );
	vm.runInNewContext( readFileSync( join( root, 'dist', file ), 'utf8' ), { window, document } );
	return window;
}

function load() {
	return run( 'full-circle-prayer.js' ).FullCirclePrayer;
}

test( 'finds its files next to the script', () => {
	const pw = load();
	assert.equal( pw.base, 'https://cdn.example/gh/avdude/full-circle-prayer-web@1/dist/' );
	assert.equal( typeof pw.boot, 'function' );
	assert.equal( typeof pw.render, 'function' );
} );

test( 'loads the stylesheet named like the script', () => {
	assert.match( run( 'full-circle-prayer.js' ).cssHref, /\/dist\/full-circle-prayer\.css$/ );
} );

test( 'reads Bible references exactly as the WordPress plugin does', () => {
	const pw = load();
	const fixture = JSON.parse( readFileSync( join( root, 'tests/parse-ref.fixture.json' ), 'utf8' ) );
	for ( const [ ref, expected ] of fixture ) {
		const got = pw.parseRef( ref );
		assert.deepEqual( got ? JSON.parse( JSON.stringify( got ) ) : null, expected, ref );
	}
} );

test( 'content files are complete', () => {
	for ( const v of [ 'web', 'kjv' ] ) {
		const c = JSON.parse( readFileSync( join( root, 'dist/data/content-' + v + '.json' ), 'utf8' ) );
		assert.equal( c.movements.length, 12 );
		for ( const m of c.movements ) {
			assert.ok( m.key && m.title && m.text && m.ref, v + ' ' + m.key );
		}
		for ( let b = 1; b <= 66; b++ ) {
			assert.ok( existsSync( join( root, 'dist/bible', v, String( b ).padStart( 2, '0' ) + '.json' ) ), v + ' book ' + b );
		}
	}
} );
