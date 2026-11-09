/*!
 * Full Circle Prayer (standalone) — https://github.com/avdude/full-circle-prayer-web
 * Guided, timed prayer in twelve movements. GPL-2.0-or-later.
 *
 * This file builds the Full Circle Prayer page from a church's settings
 * (window.FullCirclePrayerConfig, or a JSON <script> inside the mount element),
 * then starts the same prayer engine the WordPress plugin uses.
 */
( function () {
	'use strict';

	var VERSION = '@@VERSION@@';
	var script = document.currentScript;
	var CSS_FILE = ( function () {
		var m = script && script.src ? script.src.match( /([^\/?#]+)\.js(?:[?#].*)?$/ ) : null;
		return ( m ? m[ 1 ] : 'full-circle-prayer' ) + '.css';
	}() );
	var BASE = ( function () {
		var src = script && script.src ? script.src : '';
		return src ? src.replace( /[^\/?#]*([?#].*)?$/, '' ) : '';
	}() );

	/* ---------- Small helpers ---------- */

	function esc( s ) {
		return String( s === undefined || s === null ? '' : s )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#39;' );
	}

	function lines( v ) {
		if ( Array.isArray( v ) ) {
			return v.map( function ( x ) {
				return String( x ).trim();
			} ).filter( Boolean );
		}
		return String( v || '' ).split( /\r?\n/ ).map( function ( x ) {
			return x.trim();
		} ).filter( Boolean );
	}

	function pad2( n ) {
		return ( n < 10 ? '0' : '' ) + n;
	}

	function isHex( c ) {
		return typeof c === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test( c );
	}

	function safeUrl( u ) {
		u = String( u || '' ).trim();
		return /^(https?:\/\/|\/|\.\/)/i.test( u ) ? u : '';
	}

	function getJSON( url ) {
		return window.fetch( url, { credentials: 'omit' } ).then( function ( r ) {
			if ( ! r.ok ) {
				throw new Error( 'HTTP ' + r.status + ' for ' + url );
			}
			return r.json();
		} );
	}

	function addStyles() {
		if ( document.querySelector( 'link[data-prwh-css]' ) ) {
			return;
		}
		var l = document.createElement( 'link' );
		l.rel = 'stylesheet';
		l.href = BASE + CSS_FILE;
		l.setAttribute( 'data-prwh-css', '' );
		document.head.appendChild( l );
	}

	/* ---------- Bible lookup (same rules as the plugin) ---------- */

	var BOOKS = @@BOOKS@@;
	var BOOK_INDEX = null;
	var ONE_CHAPTER = { 31: 1, 57: 1, 63: 1, 64: 1, 65: 1 };
	var bookCache = {};

	function normalizeRef( ref ) {
		return String( ref || '' )
			.replace( /\s+/g, ' ' )
			.trim()
			.replace( /\s*[-‐‑‒—―]\s*/g, '–' )
			.replace( /\s*–\s*/g, '–' )
			.replace( /^Psalms\s/, 'Psalm ' );
	}

	function bookIndex() {
		if ( ! BOOK_INDEX ) {
			BOOK_INDEX = {};
			BOOKS.forEach( function ( b, i ) {
				[ b[ 0 ] ].concat( b[ 1 ] ).forEach( function ( a ) {
					BOOK_INDEX[ a.toLowerCase().replace( /[\s.]+/g, '' ) ] = i + 1;
				} );
			} );
		}
		return BOOK_INDEX;
	}

	function parseRef( ref ) {
		ref = normalizeRef( ref );
		var m = ref.match( /^((?:[1-3]|i{1,3}|first|second|third)?\s*[a-z][a-z .]*?)\.?\s*(\d.*)$/i );
		if ( ! m ) {
			return null;
		}
		var book = bookIndex()[ m[ 1 ].toLowerCase().replace( /[\s.]+/g, '' ) ];
		if ( ! book ) {
			return null;
		}
		var one = !! ONE_CHAPTER[ book ];
		var chap = one ? 1 : 0;
		var verse = one;
		var parts = [];
		var segs = m[ 2 ].trim().split( /\s*[,;]\s*/ );
		for ( var i = 0; i < segs.length; i++ ) {
			var seg = segs[ i ];
			var x;
			if ( ! seg ) {
				continue;
			}
			if ( ( x = seg.match( /^(\d+):(\d+)(?:–(?:(\d+):)?(\d+))?$/ ) ) ) {
				chap = +x[ 1 ];
				verse = true;
				parts.push( [ chap, +x[ 2 ], x[ 3 ] ? +x[ 3 ] : chap, x[ 4 ] ? +x[ 4 ] : +x[ 2 ] ] );
			} else if ( ( x = seg.match( /^(\d+)(?:–(\d+))?$/ ) ) ) {
				parts.push( verse
					? [ chap, +x[ 1 ], chap, x[ 2 ] ? +x[ 2 ] : +x[ 1 ] ]
					: [ +x[ 1 ], 0, x[ 2 ] ? +x[ 2 ] : +x[ 1 ], 0 ] );
			} else {
				return null;
			}
		}
		return parts.length ? { book: book, name: BOOKS[ book - 1 ][ 0 ], parts: parts } : null;
	}

	function loadBook( book, version ) {
		var code = version === 'KJV' ? 'kjv' : 'web';
		var key = code + book;
		if ( ! bookCache[ key ] ) {
			bookCache[ key ] = getJSON( BASE + 'bible/' + code + '/' + pad2( book ) + '.json' );
		}
		return bookCache[ key ];
	}

	/** Promise of [ [label, text], … ] for a reference, or null when it can't be read. */
	function passage( ref, version ) {
		var p = parseRef( ref );
		if ( ! p ) {
			return Promise.resolve( null );
		}
		return loadBook( p.book, version ).then( function ( text ) {
			var out = [];
			var chaps = {};
			for ( var i = 0; i < p.parts.length; i++ ) {
				var c1 = p.parts[ i ][ 0 ], v1 = p.parts[ i ][ 1 ], c2 = p.parts[ i ][ 2 ], v2 = p.parts[ i ][ 3 ];
				if ( c1 < 1 || c2 < c1 || ( c2 === c1 && v1 && v2 < v1 ) ) {
					return null;
				}
				for ( var c = c1; c <= c2; c++ ) {
					var verses = text[ c - 1 ];
					if ( ! verses || ! verses.length ) {
						return null;
					}
					var first = ( c === c1 && v1 ) ? v1 : 1;
					var last = ( c === c2 && v2 ) ? Math.min( v2, verses.length ) : verses.length;
					if ( first > verses.length ) {
						return null;
					}
					chaps[ c ] = true;
					for ( var v = first; v <= last && out.length < 200; v++ ) {
						if ( verses[ v - 1 ] !== null ) {
							out.push( [ c, v, verses[ v - 1 ] ] );
						}
					}
				}
			}
			var many = Object.keys( chaps ).length > 1;
			return out.length ? out.map( function ( r ) {
				return [ many ? r[ 0 ] + ':' + r[ 1 ] : String( r[ 1 ] ), r[ 2 ] ];
			} ) : null;
		} );
	}

	/* ---------- Settings ---------- */

	/** Turn a church's settings into the plugin's setting names. */
	function settingsFrom( base, c ) {
		var s = Object.assign( {}, base );
		var w = c.welcome || {};
		var g = c.groups || {};
		var col = c.colors || {};
		var show = c.show || {};
		var fb = c.feedback || {};
		s.church_name = c.church || '';
		s.tagline = c.tagline || '';
		s.location_line = c.location || '';
		s.city_name = c.city || '';
		s.logo = safeUrl( c.logo );
		[ 'eyebrow', 'heading', 'intro' ].forEach( function ( k ) {
			if ( w[ k ] ) {
				s[ k ] = w[ k ];
			}
		} );
		[ 'up', 'in', 'out' ].forEach( function ( k ) {
			if ( g[ k ] && g[ k ].label ) {
				s[ k + '_label' ] = g[ k ].label;
			}
			if ( g[ k ] && g[ k ].sub ) {
				s[ k + '_sub' ] = g[ k ].sub;
			}
			if ( isHex( col[ k ] ) ) {
				s[ 'color_' + k ] = col[ k ];
			}
		} );
		if ( isHex( col.button ) ) {
			s.color_accent = col.button;
		}
		if ( c.duration ) {
			s.default_duration = String( c.duration );
		}
		if ( c.mode === 'full' || c.mode === 'simple' ) {
			s.default_mode = c.mode;
		}
		s.keep_notes = c.keepNotes === false ? 0 : 1;
		s.show_phone_tools = show.phoneTools === false ? 0 : 1;
		s.show_install = show.homeScreen === false ? 0 : 1;
		s.show_attribution = show.attribution === false ? 0 : 1;
		s.show_bottom_list = show.bottomList ? 1 : 0;
		s.show_counter = 0;
		s.feedback_email = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test( fb.email || '' ) ? fb.email : '';
		s.feedback_name = fb.name || '';
		if ( c.footer ) {
			s.footer_text = c.footer;
		}
		return s;
	}

	function tokens( text, s ) {
		var church = String( s.church_name || '' ).trim();
		var city = String( s.city_name || '' ).trim();
		return String( text || '' )
			.split( '{church}' ).join( church || 'your church' )
			.split( '{City}' ).join( city || 'Your City' )
			.split( '{city}' ).join( city || 'your city' );
	}

	function initials( name ) {
		var w = String( name || '' ).trim().split( /[\s&.,\/-]+/ ).filter( Boolean ).slice( 0, 2 );
		return w.map( function ( x ) {
			return x.charAt( 0 ).toUpperCase();
		} ).join( '' ) || '?';
	}

	function splitItem( line, s ) {
		var i = line.indexOf( '|' );
		if ( i > 0 ) {
			return { name: tokens( line.slice( 0, i ).trim(), s ), text: tokens( line.slice( i + 1 ).trim(), s ) };
		}
		return { name: '', text: tokens( line, s ) };
	}

	/** Prayer lists for one movement, as the prayer engine expects them. */
	function clientLists( lists, s, c ) {
		var out = [];
		( lists || [] ).forEach( function ( l ) {
			if ( ! l || ! l.label ) {
				return;
			}
			var items = [];
			var kind = 'list';
			var extra = {};
			if ( l.source === 'missionaries' ) {
				kind = 'people';
				( c.missionaries || [] ).forEach( function ( p ) {
					if ( ! p || ! p.name || p.show === false ) {
						return;
					}
					items.push( {
						name: p.name,
						place: p.location || '',
						text: p.prayer || 'Pray for health, safety, fruitful work, and joy.',
						photo: safeUrl( p.photo ),
						initials: initials( p.name ),
					} );
				} );
			} else if ( l.source === 'churches' ) {
				kind = 'churches';
				var ch = c.churches || {};
				var list = Array.isArray( ch ) ? ch : ( ch.list || [] );
				list.forEach( function ( x ) {
					if ( typeof x === 'string' ) {
						x = { name: x };
					}
					if ( x && x.name && x.show !== false ) {
						items.push( { name: x.name, text: [ x.detail, x.area ].filter( Boolean ).join( ' · ' ) } );
					}
				} );
				extra.perDay = Array.isArray( ch ) ? 3 : ( ch.perDay === undefined ? 3 : parseInt( ch.perDay, 10 ) || 0 );
			} else {
				lines( l.items ).forEach( function ( line ) {
					items.push( splitItem( line, s ) );
				} );
			}
			if ( ! items.length ) {
				return;
			}
			out.push( Object.assign( {
				label: tokens( String( l.label ).split( '{count}' ).join( String( items.length ) ), s ),
				intro: tokens( l.intro || '', s ),
				items: items,
				open: !! l.open,
				kind: kind,
			}, extra ) );
		} );
		return out;
	}

	/** Build the prayer engine's settings from the content files and the church's settings. */
	function buildConfig( content, i18n, c ) {
		var version = content.version;
		var s = settingsFrom( content.settings, c );
		var overrides = c.movements || {};
		var passages = ( c.passages || [] ).filter( function ( p ) {
			return p && p.text && p.reference;
		} );
		var byRef = {};
		passages.forEach( function ( p ) {
			byRef[ normalizeRef( p.reference ) ] = p;
		} );

		var movements = content.movements.map( function ( m0 ) {
			var o = overrides[ m0.key ] || {};
			var m = Object.assign( {}, m0, o );
			if ( o.lists ) {
				m.lists = m0.lists.concat( o.lists );
			}
			// World lists the church fills in: countries and country requests.
			if ( m0.key === 'world' ) {
				m.lists = m.lists.map( function ( l, i ) {
					if ( i === 1 && c.countries ) {
						return Object.assign( {}, l, { items: c.countries } );
					}
					if ( i === 3 && c.countryRequests ) {
						return Object.assign( {}, l, { items: c.countryRequests } );
					}
					return l;
				} );
			}

			var cat = m.category;
			var pool = [];
			if ( cat ) {
				pool.push( { text: m0.text, ref: m0.ref, translation: m0.translation } );
				content.starters.forEach( function ( st ) {
					if ( st.category === cat ) {
						pool.push( { text: st.passage, ref: st.reference, translation: st.version } );
					}
				} );
				passages.forEach( function ( p ) {
					if ( p.category === cat || p.category === m0.key ) {
						pool.push( { text: p.text, ref: p.reference, translation: p.version || version } );
					}
				} );
			}
			if ( o.text && o.ref ) {
				pool = [ { text: o.text, ref: o.ref, translation: o.translation || version } ];
			}

			var refs = lines( m.fullScripture || m.full_scripture );
			var refTexts = {};
			refs.forEach( function ( ref ) {
				var own = byRef[ normalizeRef( ref ) ];
				if ( own ) {
					refTexts[ ref ] = { text: own.text, translation: own.version || version };
				} else if ( parseRef( ref ) ) {
					refTexts[ ref ] = {
						translation: version,
						load: function () {
							return passage( ref, version );
						},
					};
				}
			} );

			var resources = [];
			lines( m.resources ).forEach( function ( line ) {
				var i = line.indexOf( '|' );
				var label = i > 0 ? line.slice( 0, i ).trim() : line;
				var url = safeUrl( i > 0 ? line.slice( i + 1 ).trim() : line );
				if ( url ) {
					resources.push( { label: label, url: url } );
				}
			} );

			return {
				key: m0.key,
				number: m0.number,
				group: m.group,
				title: tokens( m.title, s ),
				summary: tokens( m.summary, s ),
				ref: m.ref,
				text: m.text,
				translation: m.translation,
				prompt: tokens( m.prompt, s ),
				fullPrompts: lines( m.fullPrompts || m.full_prompts ).map( function ( l ) {
					return tokens( l, s );
				} ),
				fullScripture: refs,
				refTexts: refTexts,
				rotation: lines( m.rotation ).map( function ( l ) {
					return tokens( l, s );
				} ),
				resources: resources,
				pool: pool,
				focusLabel: tokens( m.focusLabel || m.focus_label || '', s ),
				lists: clientLists( m.lists, s, c ),
				sources: '',
			};
		} );

		var groups = {
			up: { label: s.up_label, sub: s.up_sub },
			in: { label: s.in_label, sub: s.in_sub },
			out: { label: s.out_label, sub: s.out_sub },
		};
		var duration = String( s.default_duration );
		return {
			s: s,
			cfg: {
				movements: movements,
				groups: groups,
				duration: duration,
				mode: s.default_mode === 'full' ? 'full' : 'simple',
				showCounter: false,
				church: s.church_name,
				keepNotes: !! s.keep_notes,
				statsUrl: '',
				sessionUrl: '',
				i18n: Object.assign( {
					loading: 'Loading…',
					loadFailed: 'This passage could not be loaded. Check your connection and try again.',
					notFound: 'This passage is not in this translation.',
				}, i18n ),
			},
		};
	}

	/* ---------- Markup (mirrors the plugin's templates/app.php) ---------- */

	function wheelSvg( movements, groups, extra ) {
		var rOut = 200, rIn = 78, n = movements.length;
		var rad = function ( d ) {
			return d * Math.PI / 180;
		};
		var f = function ( x ) {
			return x.toFixed( 2 );
		};
		var svg = '<svg class="prwh-wheel ' + esc( extra || '' ) + '" viewBox="-210 -210 420 420" role="img" aria-hidden="true" focusable="false">';
		movements.forEach( function ( m, i ) {
			var a0 = rad( -90 + ( 360 / n ) * i + 0.8 );
			var a1 = rad( -90 + ( 360 / n ) * ( i + 1 ) - 0.8 );
			var mid = ( a0 + a1 ) / 2;
			var d = 'M ' + f( rOut * Math.cos( a0 ) ) + ' ' + f( rOut * Math.sin( a0 ) ) +
				' A ' + rOut + ' ' + rOut + ' 0 0 1 ' + f( rOut * Math.cos( a1 ) ) + ' ' + f( rOut * Math.sin( a1 ) ) +
				' L ' + f( rIn * Math.cos( a1 ) ) + ' ' + f( rIn * Math.sin( a1 ) ) +
				' A ' + rIn + ' ' + rIn + ' 0 0 0 ' + f( rIn * Math.cos( a0 ) ) + ' ' + f( rIn * Math.sin( a0 ) ) + ' Z';
			svg += '<g class="prwh-wedge prwh-wedge--' + esc( m.group ) + '" data-index="' + i + '">' +
				'<path d="' + d + '"/>' +
				'<text x="' + f( 142 * Math.cos( mid ) ) + '" y="' + f( 142 * Math.sin( mid ) ) + '" text-anchor="middle" dominant-baseline="central">' + pad2( m.number ) + '</text></g>';
		} );
		svg += '<circle class="prwh-hub" r="' + ( rIn - 6 ) + '"/>';
		[ [ 'up', -24 ], [ 'in', 0 ], [ 'out', 24 ] ].forEach( function ( g ) {
			svg += '<text class="prwh-hub__t prwh-hub__t--' + g[ 0 ] + '" y="' + g[ 1 ] + '" text-anchor="middle" dominant-baseline="central">' + esc( groups[ g[ 0 ] ].label ) + '</text>';
		} );
		return svg + '</svg>';
	}

	function mapSection( movements, groups, extraClass ) {
		var h = '<section class="prwh-card prwh-map' + ( extraClass ? ' ' + extraClass : '' ) + '" aria-label="The twelve movements">' + wheelSvg( movements, groups ) + '<div class="prwh-legend">';
		[ 'up', 'in', 'out' ].forEach( function ( g ) {
			h += '<div class="prwh-legend__group prwh-legend__group--' + g + '"><p class="prwh-legend__head"><strong>' + esc( groups[ g ].label ) + '</strong> ' + esc( groups[ g ].sub ) + '</p><ol>';
			movements.forEach( function ( m ) {
				if ( m.group === g ) {
					h += '<li value="' + m.number + '"><span class="prwh-num">' + pad2( m.number ) + '</span> ' + esc( m.title ) + '</li>';
				}
			} );
			h += '</ol></div>';
		} );
		return h + '</div></section>';
	}

	function themeButton() {
		return '<button type="button" class="prwh-chip" data-prwh="theme" data-light="Light" data-dark="Dark" aria-label="Switch light or dark mode">Dark</button>';
	}

	function introHtml( s ) {
		var h = esc( s.intro );
		[ 'up', 'in', 'out' ].forEach( function ( g ) {
			h = h.split( '{' + g + '}' ).join( '<strong class="prwh-g--' + g + '">' + esc( s[ g + '_label' ] ) + '</strong>' );
		} );
		return h;
	}

	function appHtml( id, s, cfg, closing ) {
		var movements = cfg.movements;
		var groups = cfg.groups;
		var duration = cfg.duration;
		var presets = [ '15', '30', '60' ];
		var isCustom = presets.indexOf( duration ) < 0 && duration !== 'pace';
		var custom = isCustom && parseInt( duration, 10 ) ? parseInt( duration, 10 ) : 45;
		var email = s.feedback_email;
		var who = String( s.feedback_name || '' ).trim() || 'us';
		var checked = function ( on ) {
			return on ? ' checked' : '';
		};
		var h = '';

		h += '<header class="prwh-brand"><div class="prwh-brand__id">';
		if ( s.logo ) {
			h += '<img class="prwh-brand__logo" src="' + esc( s.logo ) + '" alt="">';
		}
		h += '<div>';
		if ( s.church_name ) {
			h += '<p class="prwh-brand__name">' + esc( s.church_name ) + '</p>';
		}
		if ( s.tagline ) {
			h += '<p class="prwh-brand__tag">' + esc( s.tagline ) + '</p>';
		}
		if ( s.location_line ) {
			h += '<p class="prwh-brand__tag">' + esc( s.location_line ) + '</p>';
		}
		h += '</div></div>' + themeButton() + '</header>';

		h += '<section class="prwh-hero"><p class="prwh-eyebrow">' + esc( s.eyebrow ) + '</p>' +
			'<h2 class="prwh-hero__title">' + esc( s.heading ) + '</h2>' +
			'<p class="prwh-hero__intro">' + introHtml( s ) + '</p>' +
			'<div class="prwh-hero__actions"><button type="button" class="prwh-btn prwh-btn--primary" data-prwh="begin">Begin Prayer</button>' +
			'<button type="button" class="prwh-btn prwh-btn--ghost" data-prwh="quick"><strong>New to Full Circle Prayer?</strong><span>Start with a simple 15-minute prayer.</span></button></div>' +
			'<p class="prwh-status" data-prwh="status" role="status" aria-live="polite"></p></section>';

		h += '<fieldset class="prwh-card prwh-time"><legend>Prayer Time</legend><div class="prwh-options">';
		presets.forEach( function ( p ) {
			h += '<label class="prwh-option"><input type="radio" name="' + id + '-dur" value="' + p + '"' + checked( duration === p ) + '><span><strong>' + p + '</strong> minutes</span></label>';
		} );
		h += '<label class="prwh-option"><input type="radio" name="' + id + '-dur" value="custom"' + checked( isCustom ) + '><span><strong>Custom</strong> choose minutes</span></label>' +
			'<label class="prwh-option"><input type="radio" name="' + id + '-dur" value="pace"' + checked( duration === 'pace' ) + '><span><strong>Open</strong> no timer</span></label></div>' +
			'<label class="prwh-custom" data-prwh="custom-wrap"' + ( isCustom ? '' : ' hidden' ) + '><span>Minutes</span>' +
			'<input type="number" min="1" max="240" step="1" inputmode="numeric" value="' + custom + '" data-prwh="custom"></label>' +
			'<p class="prwh-hint" data-prwh="time-hint"></p></fieldset>';

		h += mapSection( movements, groups, '' );

		h += '<fieldset class="prwh-card prwh-mode"><legend>Prayer Experience</legend><div class="prwh-options prwh-options--two">' +
			'<label class="prwh-option"><input type="radio" name="' + id + '-mode" value="simple"' + checked( cfg.mode === 'simple' ) + '><span><strong>Simple Prayer</strong> One Scripture passage and one prayer prompt per movement, with space for notes.</span></label>' +
			'<label class="prwh-option"><input type="radio" name="' + id + '-mode" value="full"' + checked( cfg.mode === 'full' ) + '><span><strong>Full Prayer</strong> Extra prompts, Scripture, daily rotations, personal requests, and resources.</span></label>' +
			'</div></fieldset>';

		h += '<details class="prwh-card prwh-acc"><summary><strong>Don’t have time for all 12 movements?</strong> <span>Choose movements</span></summary><div class="prwh-acc__body"><div class="prwh-pick-tools">' +
			'<button type="button" class="prwh-chip" data-prwh="pick-all">All</button>';
		[ 'up', 'in', 'out' ].forEach( function ( g ) {
			h += '<button type="button" class="prwh-chip" data-prwh="pick-group" data-group="' + g + '">' + esc( groups[ g ].label ) + '</button>';
		} );
		h += '</div><ul class="prwh-pick">';
		movements.forEach( function ( m, i ) {
			h += '<li><label class="prwh-check prwh-check--' + esc( m.group ) + '"><input type="checkbox" data-prwh="pick" value="' + i + '" checked><span class="prwh-num">' + pad2( m.number ) + '</span> ' + esc( m.title ) + '</label></li>';
		} );
		h += '</ul></div></details>';

		h += '<details class="prwh-card prwh-acc"><summary><strong>Prayer tools &amp; settings</strong> <span>Pause &amp; sound · Phone tools · Feedback</span></summary><div class="prwh-acc__body">' +
			'<label class="prwh-toggle"><input type="checkbox" data-prwh="pause-between"><span><strong>Pause between movements</strong> Off by default: the timer moves you forward automatically.</span></label>' +
			'<label class="prwh-toggle"><input type="checkbox" data-prwh="sound"><span><strong>Transition cues</strong> A single short chime between movements. Keep this page open and your media volume up.</span></label>' +
			'<button type="button" class="prwh-chip" data-prwh="test-chime">Test chime</button>';
		if ( s.show_phone_tools ) {
			h += '<details class="prwh-sub"><summary>Distraction-free prayer: iPhone Guided Access or Android App Pinning</summary>' +
				'<h3>iPhone · Guided Access</h3><ol>' +
				'<li>Open Settings → Accessibility → Guided Access and turn it on. Set a passcode or Face ID.</li>' +
				'<li>In Guided Access settings, set Display Auto-Lock to Never so the screen stays on.</li>' +
				'<li>Return to this page in Safari and triple-click the side button.</li>' +
				'<li>Optional: circle any part of the screen you do not want to respond to touch.</li>' +
				'<li>Tap Start. Triple-click the side button again when you are done.</li></ol>' +
				'<p><strong>After praying:</strong> set Display Auto-Lock back to your usual time if you do not want the screen to stay on.</p>' +
				'<p><a href="https://support.apple.com/guide/iphone/lock-iphone-to-one-app-iph7fad0d10/ios" target="_blank" rel="noopener">Apple’s Guided Access instructions</a></p>' +
				'<h3>Android · App Pinning</h3><ol>' +
				'<li>Open Settings → Security &amp; privacy → More security settings → App pinning and turn it on. Menu names vary by phone.</li>' +
				'<li>Return to this page in Chrome, then open your recent apps.</li>' +
				'<li>Tap the Chrome icon above its preview and choose Pin.</li>' +
				'<li>When you are finished, use the unpin gesture your phone shows.</li></ol>' +
				'<p><a href="https://support.google.com/android/answer/9455138" target="_blank" rel="noopener">Android’s App Pinning instructions</a></p>' +
				'<p class="prwh-hint">A website cannot turn these on for you, so set them up before you tap Begin Prayer.</p></details>';
		}
		if ( s.show_install ) {
			h += '<details class="prwh-sub"><summary>Add Full Circle Prayer to your Home Screen</summary>' +
				'<h3>iPhone · Safari</h3><ol><li>Open this page in Safari.</li><li>Tap the Share button.</li><li>Scroll down and tap Add to Home Screen.</li><li>Leave Open as Web App on if it appears, then tap Add.</li></ol>' +
				'<p><a href="https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios" target="_blank" rel="noopener">See Apple’s illustrated instructions</a></p>' +
				'<h3>Android · Chrome</h3><ol><li>Open this page in Chrome.</li><li>Tap the three-dot menu beside the address bar.</li><li>Tap Add to Home screen, Create shortcut, or Install app.</li><li>Confirm the name and tap Add or Install.</li></ol>' +
				'<p><a href="https://support.google.com/chrome/answer/15085120?co=GENIE.Platform%3DAndroid" target="_blank" rel="noopener">See Google’s instructions</a></p></details>';
		}
		if ( email ) {
			h += '<div class="prwh-feedback"><p>' + esc( 'Help us improve Full Circle Prayer. Try a session and tell ' + who + ': What helped you pray? What confused you? What interrupted you? Please include your phone and browser, but no private prayer requests.' ) + '</p>' +
				'<a class="prwh-btn prwh-btn--ghost" href="mailto:' + esc( email ) + '?subject=' + encodeURIComponent( 'Full Circle Prayer feedback' ) + '">Email ' + esc( who ) + '</a></div>';
		}
		h += '</div></details>';

		if ( s.show_bottom_list ) {
			h += mapSection( movements, groups, 'prwh-map--footer' );
		}

		h += '<footer class="prwh-foot">';
		if ( email ) {
			h += '<p class="prwh-foot__help">Need help? <a href="mailto:' + esc( email ) + '?subject=' + encodeURIComponent( 'Full Circle Prayer help' ) + '">Email ' + esc( who ) + '</a></p>';
		}
		if ( s.show_attribution ) {
			h += '<p>Prayer wheel adapted from Dick Eastman, <a href="https://www.dickeastman.com/books/the-hour-that-changes-the-world/" target="_blank" rel="noopener"><em>The Hour That Changes the World</em></a></p>';
		}
		if ( s.credits ) {
			h += '<details class="prwh-sub"><summary>Scripture credits</summary><div><p>' + esc( s.credits ) + '</p></div></details>';
		}
		if ( s.footer_text ) {
			h += '<p class="prwh-foot__text">' + esc( s.footer_text ) + '</p>';
		}
		h += '</footer>';

		h += '<div class="prwh-session" data-prwh="session" role="dialog" aria-modal="true" aria-labelledby="' + id + '-title" hidden>' +
			'<div class="prwh-session__bar"><span class="prwh-session__step" data-prwh="step"></span><span class="prwh-session__group" data-prwh="group"></span><span class="prwh-session__spacer"></span>' +
			themeButton() +
			'<button type="button" class="prwh-chip" data-prwh="smaller" aria-label="Smaller text">A−</button>' +
			'<button type="button" class="prwh-chip" data-prwh="larger" aria-label="Larger text">A+</button>' +
			'<button type="button" class="prwh-chip" data-prwh="end">End</button></div>' +
			'<div class="prwh-progress" aria-hidden="true"><span data-prwh="progress"></span></div>' +
			'<div class="prwh-session__scroll" data-prwh="scroll"><article class="prwh-session__body" data-prwh="body">' +
			'<div class="prwh-session__head">' + wheelSvg( movements, groups, 'prwh-wheel--mini' ) +
			'<div><p class="prwh-session__num" data-prwh="num"></p><h2 class="prwh-session__title" id="' + id + '-title" tabindex="-1" data-prwh="title"></h2><p class="prwh-session__summary" data-prwh="summary"></p></div></div>' +
			'<blockquote class="prwh-scripture"><p data-prwh="text"></p><cite data-prwh="ref"></cite></blockquote>' +
			'<p class="prwh-prompt" data-prwh="prompt"></p><div class="prwh-full" data-prwh="full"></div>' +
			'<label class="prwh-notes"><span>Notes, insights &amp; feelings</span><textarea rows="3" data-prwh="notes" placeholder="What is God saying? What are you praying?"></textarea>' +
			'<small data-prwh="notes-note">' + esc( s.keep_notes ? cfg.i18n.notesKept : cfg.i18n.notesGone ) + '</small></label></article>' +
			'<div class="prwh-transition" data-prwh="transition" hidden><p class="prwh-eyebrow">Up next</p><p class="prwh-transition__title" data-prwh="next-title"></p>' +
			'<button type="button" class="prwh-btn prwh-btn--primary" data-prwh="continue">Continue</button></div>' +
			'<div class="prwh-done" data-prwh="done" hidden>' + wheelSvg( movements, groups, 'prwh-wheel--done' ) +
			'<h2 class="prwh-done__title" data-prwh="done-title" tabindex="-1"></h2><p class="prwh-done__line">' + esc( closing ) + '</p>' +
			'<p class="prwh-done__hint" data-prwh="notes-hint" hidden>' + esc( cfg.i18n.hintGone ) + '</p><div class="prwh-done__actions">' +
			'<button type="button" class="prwh-btn prwh-btn--ghost" data-prwh="save-notes" hidden>Save my notes</button>' +
			'<button type="button" class="prwh-btn prwh-btn--ghost" data-prwh="copy-notes" hidden>Copy my notes</button>' +
			'<button type="button" class="prwh-btn prwh-btn--ghost" data-prwh="clear-notes" hidden>Clear today’s notes</button>' +
			'<button type="button" class="prwh-btn prwh-btn--primary" data-prwh="close">Close</button></div></div></div>' +
			'<div class="prwh-controls" data-prwh="controls"><button type="button" class="prwh-round" data-prwh="prev" aria-label="Previous movement">‹</button>' +
			'<div class="prwh-timer"><span class="prwh-timer__clock" data-prwh="clock" aria-live="off">0:00</span>' +
			'<button type="button" class="prwh-btn prwh-btn--primary prwh-btn--small" data-prwh="toggle">Pause</button></div>' +
			'<button type="button" class="prwh-round" data-prwh="next" aria-label="Next movement">›</button></div></div>';
		return h;
	}

	/* ---------- Mounting ---------- */

	function settingsFor( el ) {
		var inline = el.querySelector( 'script[type="application/json"]' );
		if ( inline ) {
			try {
				return JSON.parse( inline.textContent );
			} catch ( e ) {
				window.console && window.console.error( 'Full Circle Prayer: the settings JSON could not be read.', e );
			}
		}
		return window.FullCirclePrayerConfig || {};
	}

	var count = 0;

	function mount( el, settings ) {
		count++;
		var id = 'prwh-' + count;
		var c = settings || settingsFor( el );
		var version = String( c.bible || 'WEB' ).toUpperCase() === 'KJV' ? 'KJV' : 'WEB';
		el.setAttribute( 'aria-busy', 'true' );
		return Promise.all( [
			getJSON( BASE + 'data/content-' + version.toLowerCase() + '.json' ),
			getJSON( BASE + 'data/i18n-en.json' ),
		] ).then( function ( r ) {
			var built = buildConfig( r[ 0 ], r[ 1 ], c );
			var s = built.s;
			if ( c.credits ) {
				s.credits = c.credits;
			}
			var root = document.createElement( 'div' );
			root.className = 'prwh';
			root.id = id;
			root.setAttribute( 'data-theme', 'auto' );
			root.style.cssText = '--prwh-up:' + s.color_up + ';--prwh-in:' + s.color_in + ';--prwh-out:' + s.color_out + ';--prwh-brand:' + s.color_accent + ';';
			root.innerHTML = appHtml( id, s, built.cfg, r[ 0 ].closing );
			root.prwhConfig = built.cfg;
			el.textContent = '';
			el.appendChild( root );
			el.removeAttribute( 'aria-busy' );
			window.FullCirclePrayer.boot();
			return root;
		} ).catch( function ( err ) {
			el.removeAttribute( 'aria-busy' );
			el.textContent = 'Full Circle Prayer could not load. Please check your connection and refresh the page.';
			window.console && window.console.error( 'Full Circle Prayer:', err );
		} );
	}

	function start() {
		addStyles();
		if ( script && script.hasAttribute && script.hasAttribute( 'data-no-auto' ) ) {
			return;
		}
		var targets = Array.prototype.slice.call( document.querySelectorAll( '[data-full-circle-prayer]' ) );
		if ( ! targets.length ) {
			var byId = document.getElementById( 'full-circle-prayer' );
			if ( byId ) {
				targets = [ byId ];
			} else if ( script && script.parentNode ) {
				var div = document.createElement( 'div' );
				script.parentNode.insertBefore( div, script.nextSibling );
				targets = [ div ];
			}
		}
		targets.forEach( function ( el ) {
			if ( ! el.prwhMounted ) {
				el.prwhMounted = true;
				mount( el );
			}
		} );
	}

	var api = window.FullCirclePrayer = window.FullCirclePrayer || {};
	api.version = VERSION;
	api.base = BASE;
	/** Build Full Circle Prayer in an element with the given settings (used by the settings builder). */
	api.render = function ( el, settings ) {
		addStyles();
		el.prwhMounted = true;
		return mount( el, settings );
	};
	api.parseRef = parseRef;

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', start );
	} else {
		start();
	}
}() );
