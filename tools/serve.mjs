// A tiny static server for trying Full Circle Prayer locally:
//   node tools/serve.mjs [port]     then open http://localhost:8080/examples/
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join( dirname( fileURLToPath( import.meta.url ) ), '..' );
const port = Number( process.argv[ 2 ] ) || 8080;
const types = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
};

createServer( async ( req, res ) => {
	let path = decodeURIComponent( new URL( req.url, 'http://x' ).pathname );
	path = normalize( path ).replace( /^(\.\.[\/\\])+/, '' );
	let file = join( root, path );
	try {
		if ( ( await stat( file ) ).isDirectory() ) {
			file = join( file, 'index.html' );
		}
		const body = await readFile( file );
		res.writeHead( 200, { 'Content-Type': types[ extname( file ) ] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' } );
		res.end( body );
	} catch {
		res.writeHead( 404, { 'Content-Type': 'text/plain' } );
		res.end( 'Not found' );
	}
} ).listen( port, () => console.log( 'Full Circle Prayer: http://localhost:' + port + '/examples/' ) );
