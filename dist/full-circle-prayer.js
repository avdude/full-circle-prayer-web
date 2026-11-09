/*! Full Circle Prayer 1.0.0 · https://github.com/avdude/full-circle-prayer-web · GPL-2.0-or-later */
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

	var VERSION = '1.0.0';
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

	var BOOKS = [["Genesis",["ge","gen","genesis","gn"]],["Exodus",["ex","exo","exod","exodus"]],["Leviticus",["le","lev","leviticus","lv"]],["Numbers",["nb","nm","nu","num","numbers"]],["Deuteronomy",["deu","deut","deuteronomy","dt"]],["Joshua",["jos","josh","joshua","jsh"]],["Judges",["jdg","jdgs","jg","judg","judges"]],["Ruth",["rth","ru","ruth"]],["1 Samuel",["1 sam","1 samuel","1 sm","1s","1sa","first samuel","i samuel"]],["2 Samuel",["2 sam","2 samuel","2 sm","2s","2sa","ii samuel","second samuel"]],["1 Kings",["1 kgs","1 kin","1 kings","1k","1ki","first kings","i kings"]],["2 Kings",["2 kgs","2 kin","2 kings","2k","2ki","ii kings","second kings"]],["1 Chronicles",["1 chr","1 chron","1 chronicles","1ch","first chronicles","i chronicles"]],["2 Chronicles",["2 chr","2 chron","2 chronicles","2ch","ii chronicles","second chronicles"]],["Ezra",["ez","ezr","ezra"]],["Nehemiah",["ne","neh","nehemiah"]],["Esther",["es","est","esth","esther"]],["Job",["jb","job"]],["Psalm",["ps","psa","psalm","psalms","psm","pss"]],["Proverbs",["pr","pro","prov","proverbs","prv"]],["Ecclesiastes",["ec","ecc","eccl","eccles","ecclesiastes","qoh"]],["Song of Solomon",["cant","canticles","sng","so","song","song of solomon","song of songs","sos"]],["Isaiah",["is","isa","isaiah"]],["Jeremiah",["je","jer","jeremiah","jr"]],["Lamentations",["la","lam","lamentations"]],["Ezekiel",["eze","ezek","ezekiel","ezk"]],["Daniel",["da","dan","daniel","dn"]],["Hosea",["ho","hos","hosea"]],["Joel",["jl","joel"]],["Amos",["am","amos"]],["Obadiah",["ob","obad","obadiah"]],["Jonah",["jnh","jon","jonah"]],["Micah",["mc","mic","micah"]],["Nahum",["na","nah","nahum"]],["Habakkuk",["hab","habakkuk","hb"]],["Zephaniah",["zep","zeph","zephaniah","zp"]],["Haggai",["hag","haggai","hg"]],["Zechariah",["zc","zec","zech","zechariah"]],["Malachi",["mal","malachi","ml"]],["Matthew",["mat","matt","matthew","mt"]],["Mark",["mar","mark","mk","mr","mrk"]],["Luke",["lk","luk","luke"]],["John",["jhn","jn","joh","john"]],["Acts",["ac","act","acts","acts of the apostles"]],["Romans",["rm","ro","rom","romans"]],["1 Corinthians",["1 cor","1 corinthians","1co","first corinthians","i corinthians"]],["2 Corinthians",["2 cor","2 corinthians","2co","ii corinthians","second corinthians"]],["Galatians",["ga","gal","galatians"]],["Ephesians",["eph","ephes","ephesians"]],["Philippians",["phil","philippians","php","pp"]],["Colossians",["co","col","colossians"]],["1 Thessalonians",["1 thes","1 thess","1 thessalonians","1th","first thessalonians","i thessalonians"]],["2 Thessalonians",["2 thes","2 thess","2 thessalonians","2th","ii thessalonians","second thessalonians"]],["1 Timothy",["1 tim","1 timothy","1ti","first timothy","i timothy"]],["2 Timothy",["2 tim","2 timothy","2ti","ii timothy","second timothy"]],["Titus",["ti","tit","titus"]],["Philemon",["philem","philemon","phm","pm"]],["Hebrews",["heb","hebrews"]],["James",["james","jas","jm"]],["1 Peter",["1 pet","1 peter","1pe","1pt","first peter","i peter"]],["2 Peter",["2 pet","2 peter","2pe","2pt","ii peter","second peter"]],["1 John",["1 jn","1 john","1jn","1jo","first john","i john"]],["2 John",["2 jn","2 john","2jn","2jo","ii john","second john"]],["3 John",["3 jn","3 john","3jn","3jo","iii john","third john"]],["Jude",["jd","jud","jude"]],["Revelation",["apocalypse","re","rev","revelation","revelations","the revelation"]]];
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

/**
 * Full Circle Prayer front end. No dependencies.
 *
 * Privacy: preferences, personal requests and running totals live in this
 * browser's localStorage. Notes live in memory only. The server receives a
 * single minute count when a session ends.
 */
( function () {
	'use strict';

	var STORE = {
		prefs: 'prwh_prefs',
		mine: 'prwh_my_minutes',
		requests: 'prwh_requests',
		notes: 'prwh_notes',
	};

	/** Local date as YYYY-MM-DD. */
	function dayKey( d ) {
		d = d || new Date();
		return d.getFullYear() + '-' + String( d.getMonth() + 1 ).padStart( 2, '0' ) + '-' + String( d.getDate() ).padStart( 2, '0' );
	}

	function load( key, fallback ) {
		try {
			var v = window.localStorage.getItem( key );
			return v === null ? fallback : JSON.parse( v );
		} catch ( e ) {
			return fallback;
		}
	}

	function save( key, value ) {
		try {
			window.localStorage.setItem( key, JSON.stringify( value ) );
		} catch ( e ) {}
	}

	function fmt( str ) {
		var args = Array.prototype.slice.call( arguments, 1 );
		var i = 0;
		return str.replace( /%(\d+\$)?[sd]/g, function ( m, pos ) {
			var idx = pos ? parseInt( pos, 10 ) - 1 : i++;
			return String( args[ idx ] );
		} );
	}

	function clock( ms ) {
		var total = Math.max( 0, Math.ceil( ms / 1000 ) );
		var h = Math.floor( total / 3600 );
		var m = Math.floor( ( total % 3600 ) / 60 );
		var s = total % 60;
		var mm = h ? String( m ).padStart( 2, '0' ) : String( m );
		return ( h ? h + ':' : '' ) + mm + ':' + String( s ).padStart( 2, '0' );
	}

	function make( tag, cls, text ) {
		var n = document.createElement( tag );
		if ( cls ) {
			n.className = cls;
		}
		if ( text !== undefined && text !== null ) {
			n.textContent = text;
		}
		return n;
	}

	/* ---------- Chime (Web Audio, unlocked on first tap) ---------- */
	var audioCtx = null;
	function unlockAudio() {
		if ( audioCtx ) {
			if ( audioCtx.state === 'suspended' ) {
				audioCtx.resume();
			}
			return;
		}
		var AC = window.AudioContext || window.webkitAudioContext;
		if ( AC ) {
			audioCtx = new AC();
		}
	}
	function chime() {
		unlockAudio();
		if ( ! audioCtx ) {
			return;
		}
		var t = audioCtx.currentTime;
		[ 880, 1320 ].forEach( function ( f, i ) {
			var o = audioCtx.createOscillator();
			var g = audioCtx.createGain();
			o.type = 'sine';
			o.frequency.value = f;
			g.gain.setValueAtTime( 0.0001, t );
			g.gain.exponentialRampToValueAtTime( i ? 0.08 : 0.25, t + 0.02 );
			g.gain.exponentialRampToValueAtTime( 0.0001, t + 2.2 );
			o.connect( g ).connect( audioCtx.destination );
			o.start( t );
			o.stop( t + 2.3 );
		} );
	}

	/* ---------- Screen wake lock ---------- */
	var wakeLock = null;
	function keepAwake( on ) {
		if ( ! ( 'wakeLock' in navigator ) ) {
			return;
		}
		if ( on && ! wakeLock ) {
			navigator.wakeLock.request( 'screen' ).then( function ( l ) {
				wakeLock = l;
				l.addEventListener( 'release', function () {
					wakeLock = null;
				} );
			} ).catch( function () {} );
		} else if ( ! on && wakeLock ) {
			wakeLock.release().catch( function () {} );
			wakeLock = null;
		}
	}

	/* ---------- App ---------- */
	function App( root ) {
		var cfgNode = root.querySelector( '.prwh-config' );
		this.root = root;
		// The standalone build hands its settings over directly; WordPress prints them as JSON.
		this.cfg = root.prwhConfig || JSON.parse( cfgNode.textContent );
		this.t = this.cfg.i18n;
		this.prefs = Object.assign(
			{ duration: this.cfg.duration, custom: 45, mode: this.cfg.mode, pause: false, sound: false, scale: 1, theme: 'auto' },
			load( STORE.prefs, {} )
		);
		this.notes = {};
		this.timer = null;
		this.bind();
		this.applyPrefs();
		this.refreshCounter();
	}

	App.prototype.$ = function ( name, scope ) {
		return ( scope || this.root ).querySelector( '[data-prwh="' + name + '"]' );
	};
	App.prototype.$$ = function ( name ) {
		return Array.prototype.slice.call( this.root.querySelectorAll( '[data-prwh="' + name + '"]' ) );
	};
	App.prototype.radios = function ( suffix ) {
		return Array.prototype.slice.call( this.root.querySelectorAll( 'input[name="' + this.root.id + '-' + suffix + '"]' ) );
	};

	App.prototype.persist = function () {
		save( STORE.prefs, this.prefs );
	};

	App.prototype.bind = function () {
		var self = this;

		this.$( 'begin' ).addEventListener( 'click', function () {
			self.start();
		} );
		this.$( 'quick' ).addEventListener( 'click', function () {
			self.setDuration( '15' );
			self.setMode( 'simple' );
			self.pick( function () {
				return true;
			} );
			self.start();
		} );

		this.radios( 'dur' ).forEach( function ( r ) {
			r.addEventListener( 'change', function () {
				self.setDuration( r.value );
			} );
		} );
		this.$( 'custom' ).addEventListener( 'input', function ( e ) {
			var v = parseInt( e.target.value, 10 );
			if ( v > 0 ) {
				self.prefs.custom = Math.min( 240, v );
				self.persist();
				self.updateHint();
			}
		} );
		this.radios( 'mode' ).forEach( function ( r ) {
			r.addEventListener( 'change', function () {
				self.setMode( r.value );
			} );
		} );

		this.$$( 'pick' ).forEach( function ( c ) {
			c.addEventListener( 'change', function () {
				self.updateHint();
			} );
		} );
		this.$( 'pick-all' ).addEventListener( 'click', function () {
			self.pick( function () {
				return true;
			} );
		} );
		this.$$( 'pick-group' ).forEach( function ( b ) {
			b.addEventListener( 'click', function () {
				self.pick( function ( m ) {
					return m.group === b.getAttribute( 'data-group' );
				} );
			} );
		} );

		this.$( 'pause-between' ).addEventListener( 'change', function ( e ) {
			self.prefs.pause = e.target.checked;
			self.persist();
		} );
		this.$( 'sound' ).addEventListener( 'change', function ( e ) {
			self.prefs.sound = e.target.checked;
			self.persist();
			if ( e.target.checked ) {
				unlockAudio();
			}
		} );
		this.$( 'test-chime' ).addEventListener( 'click', chime );

		// One toggle on the welcome screen and one in the prayer screen's top bar.
		this.$$( 'theme' ).forEach( function ( btn ) {
			btn.addEventListener( 'click', function () {
				var dark = self.isDark();
				self.prefs.theme = dark ? 'light' : 'dark';
				self.persist();
				self.applyTheme();
			} );
		} );

		// Session controls.
		this.$( 'toggle' ).addEventListener( 'click', function () {
			self.setRunning( ! self.running );
		} );
		this.$( 'next' ).addEventListener( 'click', function () {
			self.advance( 1 );
		} );
		this.$( 'prev' ).addEventListener( 'click', function () {
			self.advance( -1 );
		} );
		this.$( 'continue' ).addEventListener( 'click', function () {
			self.advance( 1 );
		} );
		this.$( 'end' ).addEventListener( 'click', function () {
			if ( self.finished ) {
				self.close();
			} else {
				self.finish();
			}
		} );
		this.$( 'close' ).addEventListener( 'click', function () {
			self.close();
		} );
		this.$( 'copy-notes' ).addEventListener( 'click', function () {
			self.copyNotes();
		} );
		this.$( 'save-notes' ).addEventListener( 'click', function () {
			self.saveNotes();
		} );
		this.$( 'smaller' ).addEventListener( 'click', function () {
			self.scale( -0.1 );
		} );
		this.$( 'larger' ).addEventListener( 'click', function () {
			self.scale( 0.1 );
		} );
		this.$( 'notes' ).addEventListener( 'input', function ( e ) {
			if ( self.current !== undefined ) {
				self.notes[ self.order[ self.current ] ] = e.target.value;
				self.storeNotes();
			}
		} );
		this.$( 'clear-notes' ).addEventListener( 'click', function () {
			self.clearNotes();
		} );

		this.$( 'session' ).addEventListener( 'keydown', function ( e ) {
			if ( e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' ) {
				return;
			}
			if ( e.key === 'Escape' ) {
				e.preventDefault();
				self.$( 'end' ).click();
			} else if ( e.key === 'ArrowRight' && ! self.finished ) {
				self.advance( 1 );
			} else if ( e.key === 'ArrowLeft' && ! self.finished ) {
				self.advance( -1 );
			} else if ( e.key === ' ' && e.target.tagName !== 'BUTTON' && ! self.finished ) {
				e.preventDefault();
				self.setRunning( ! self.running );
			}
		} );

		document.addEventListener( 'visibilitychange', function () {
			if ( document.visibilityState === 'visible' && self.active && self.running ) {
				keepAwake( true );
			}
		} );

		if ( window.matchMedia ) {
			window.matchMedia( '(prefers-color-scheme: dark)' ).addEventListener( 'change', function () {
				self.applyTheme();
			} );
		}
	};

	App.prototype.applyPrefs = function () {
		var self = this;
		this.setDuration( this.prefs.duration, true );
		this.setMode( this.prefs.mode, true );
		this.$( 'custom' ).value = this.prefs.custom;
		this.$( 'pause-between' ).checked = !! this.prefs.pause;
		this.$( 'sound' ).checked = !! this.prefs.sound;
		if ( Array.isArray( this.prefs.picked ) && this.prefs.picked.length ) {
			this.$$( 'pick' ).forEach( function ( c ) {
				c.checked = self.prefs.picked.indexOf( parseInt( c.value, 10 ) ) !== -1;
			} );
		}
		this.applyTheme();
		this.updateHint();
	};

	App.prototype.isDark = function () {
		if ( this.prefs.theme === 'dark' ) {
			return true;
		}
		if ( this.prefs.theme === 'light' ) {
			return false;
		}
		return !! ( window.matchMedia && window.matchMedia( '(prefers-color-scheme: dark)' ).matches );
	};

	App.prototype.applyTheme = function () {
		var dark = this.isDark();
		this.root.setAttribute( 'data-theme', dark ? 'dark' : 'light' );
		this.$$( 'theme' ).forEach( function ( btn ) {
			btn.textContent = dark ? btn.getAttribute( 'data-light' ) || 'Light' : btn.getAttribute( 'data-dark' ) || 'Dark';
			btn.setAttribute( 'aria-pressed', dark ? 'true' : 'false' );
		} );
	};

	App.prototype.setDuration = function ( v, quiet ) {
		this.prefs.duration = v;
		this.radios( 'dur' ).forEach( function ( r ) {
			r.checked = r.value === v || ( v !== 'pace' && [ '15', '30', '60' ].indexOf( v ) === -1 && r.value === 'custom' );
		} );
		var isCustom = [ '15', '30', '60', 'pace' ].indexOf( v ) === -1;
		if ( isCustom && v !== 'custom' && parseInt( v, 10 ) > 0 ) {
			this.prefs.custom = parseInt( v, 10 );
		}
		if ( isCustom ) {
			this.prefs.duration = 'custom';
		}
		this.$( 'custom-wrap' ).hidden = ! isCustom;
		if ( ! quiet ) {
			this.persist();
		}
		this.updateHint();
	};

	App.prototype.setMode = function ( v, quiet ) {
		this.prefs.mode = v === 'full' ? 'full' : 'simple';
		var mode = this.prefs.mode;
		this.radios( 'mode' ).forEach( function ( r ) {
			r.checked = r.value === mode;
		} );
		if ( ! quiet ) {
			this.persist();
		}
	};

	App.prototype.pick = function ( test ) {
		var ms = this.cfg.movements;
		this.$$( 'pick' ).forEach( function ( c ) {
			c.checked = !! test( ms[ parseInt( c.value, 10 ) ] );
		} );
		this.updateHint();
	};

	App.prototype.selected = function () {
		return this.$$( 'pick' ).filter( function ( c ) {
			return c.checked;
		} ).map( function ( c ) {
			return parseInt( c.value, 10 );
		} );
	};

	App.prototype.totalMinutes = function () {
		if ( this.prefs.duration === 'pace' ) {
			return 0;
		}
		if ( this.prefs.duration === 'custom' ) {
			return Math.max( 1, Math.min( 240, parseInt( this.prefs.custom, 10 ) || 1 ) );
		}
		return parseInt( this.prefs.duration, 10 );
	};

	App.prototype.minutesLabel = function ( n ) {
		return n === 1 ? this.t.minute : fmt( this.t.minutes, n.toLocaleString() );
	};

	App.prototype.updateHint = function () {
		var picked = this.selected();
		this.prefs.picked = picked;
		this.persist();
		var hint = this.$( 'time-hint' );
		var total = this.totalMinutes();
		if ( ! total ) {
			hint.textContent = this.t.noCountdown;
			return;
		}
		if ( ! picked.length ) {
			hint.textContent = this.t.pickOne;
			return;
		}
		var per = ( total * 60 ) / picked.length;
		var label = per >= 60 && per % 60 === 0 ? this.minutesLabel( per / 60 ) : clock( per * 1000 );
		hint.textContent = fmt( this.t.perMovement, label );
	};

	/* ---------- Counter ---------- */
	App.prototype.refreshCounter = function () {
		var self = this;
		if ( ! this.cfg.showCounter ) {
			return;
		}
		var mine = parseInt( load( STORE.mine, 0 ), 10 ) || 0;
		var mineNode = this.$( 'counter-mine' );
		if ( mineNode ) {
			mineNode.textContent = mine ? fmt( this.t.mine, this.minutesLabel( mine ) ) : '';
		}
		if ( ! this.cfg.statsUrl ) {
			return;
		}
		window.fetch( this.cfg.statsUrl, { credentials: 'omit', cache: 'no-store' } )
			.then( function ( r ) {
				return r.ok ? r.json() : null;
			} )
			.then( function ( data ) {
				if ( data && data.minutes > 0 ) {
					self.$( 'counter-text' ).textContent = fmt( self.t.together, self.minutesLabel( data.minutes ) );
				}
			} )
			.catch( function () {} );
	};

	/* ---------- Session ---------- */
	App.prototype.start = function () {
		var order = this.selected();
		if ( ! order.length ) {
			this.$( 'status' ).textContent = this.t.pickOne;
			return;
		}
		this.$( 'status' ).textContent = '';
		unlockAudio();

		this.order = order;
		this.full = this.prefs.mode === 'full';
		this.perMs = this.totalMinutes() ? ( this.totalMinutes() * 60000 ) / order.length : 0;
		this.prayedMs = 0;
		this.notes = this.loadNotes();
		this.picks = this.pickScripture( order );
		this.finished = false;
		this.active = true;
		this.opener = document.activeElement;

		var session = this.$( 'session' );
		session.hidden = false;
		session.style.setProperty( '--prwh-scale', this.prefs.scale );
		this.$( 'done' ).hidden = true;
		session.classList.remove( 'is-finished' );
		this.$( 'controls' ).hidden = false;
		document.documentElement.classList.add( 'prwh-lock' );

		this.show( 0 );
		this.lastTick = Date.now();
		var self = this;
		this.timer = window.setInterval( function () {
			self.tick();
		}, 250 );
		this.setRunning( true );
	};

	App.prototype.show = function ( i ) {
		var m = this.cfg.movements[ this.order[ i ] ];
		var g = this.cfg.groups[ m.group ];
		var session = this.$( 'session' );

		this.current = i;
		this.remaining = this.perMs;
		this.elapsed = 0;
		this.waiting = false;

		session.setAttribute( 'data-group', m.group );
		this.$( 'step' ).textContent = fmt( this.t.stepOf, i + 1, this.order.length );
		this.$( 'group' ).textContent = g.label + ' · ' + g.sub;
		this.$( 'num' ).textContent = String( m.number ).padStart( 2, '0' );
		this.$( 'title' ).textContent = m.title;
		this.$( 'summary' ).textContent = m.summary;
		var verse = this.picks[ this.order[ i ] ] || m;
		this.$( 'text' ).textContent = verse.text;
		this.$( 'ref' ).textContent = verse.ref + ( verse.translation ? ' ' + verse.translation : '' );
		this.$( 'prompt' ).textContent = m.prompt;
		this.$( 'notes' ).value = this.notes[ this.order[ i ] ] || '';
		this.$( 'body' ).hidden = false;
		this.$( 'transition' ).hidden = true;
		this.$( 'progress' ).style.width = ( ( i / this.order.length ) * 100 ) + '%';
		this.$( 'next' ).setAttribute( 'aria-label', i === this.order.length - 1 ? this.t.finish : this.t.next );
		this.$( 'prev' ).disabled = i === 0;

		this.$( 'notes-note' ).textContent = this.cfg.keepNotes ? this.t.notesKept : this.t.notesGone;
		this.renderFull( m );
		this.markWheel( session.querySelector( '.prwh-wheel--mini' ), i );
		this.renderClock();

		this.$( 'scroll' ).scrollTop = 0;
		this.$( 'title' ).focus( { preventScroll: true } );
	};

	/**
	 * Choose one random library passage per movement for this session.
	 * Movements without a pool keep their own passage. When two movements
	 * share a category, they get different passages where possible.
	 */
	App.prototype.pickScripture = function ( order ) {
		var picks = {};
		var used = {};
		var ms = this.cfg.movements;
		order.forEach( function ( idx ) {
			var pool = ms[ idx ].pool || [];
			if ( ! pool.length ) {
				return;
			}
			var fresh = pool.filter( function ( v ) {
				return ! used[ v.ref + '|' + v.text ];
			} );
			var from = fresh.length ? fresh : pool;
			var v = from[ Math.floor( Math.random() * from.length ) ];
			used[ v.ref + '|' + v.text ] = true;
			picks[ idx ] = v;
		} );
		return picks;
	};

	App.prototype.markWheel = function ( svg, i ) {
		var self = this;
		if ( ! svg ) {
			return;
		}
		Array.prototype.forEach.call( svg.querySelectorAll( '.prwh-wedge' ), function ( w ) {
			var idx = parseInt( w.getAttribute( 'data-index' ), 10 );
			var pos = self.order.indexOf( idx );
			w.classList.toggle( 'is-active', pos === i );
			w.classList.toggle( 'is-done', pos !== -1 && pos < i );
			w.classList.toggle( 'is-skipped', pos === -1 );
		} );
	};

	App.prototype.renderFull = function ( m ) {
		var box = this.$( 'full' );
		var t = this.t;
		var self = this;
		box.textContent = '';
		box.hidden = ! this.full;
		if ( ! this.full ) {
			return;
		}

		if ( m.rotation.length ) {
			var day = new Date().getDay();
			var focus = m.rotation[ day % m.rotation.length ];
			var sec = make( 'div', 'prwh-full__today' );
			sec.appendChild( make( 'p', 'prwh-eyebrow', m.focusLabel || ( m.key === 'word' ? t.todayPassage : t.today ) ) );
			sec.appendChild( make( 'p', 'prwh-full__focus', focus ) );
			box.appendChild( sec );
		}

		function list( title, items, cls ) {
			if ( ! items.length ) {
				return;
			}
			var s = make( 'div', 'prwh-full__sec ' + ( cls || '' ) );
			s.appendChild( make( 'p', 'prwh-eyebrow', title ) );
			var ul = make( 'ul' );
			items.forEach( function ( it ) {
				ul.appendChild( make( 'li', '', it ) );
			} );
			s.appendChild( ul );
			box.appendChild( s );
		}
		list( t.morePrompts, m.fullPrompts );
		if ( m.fullScripture.length ) {
			box.appendChild( this.refsUI( m ) );
		}

		if ( m.key === 'intercede' ) {
			box.appendChild( this.requestsUI() );
		}

		( m.lists || [] ).forEach( function ( l ) {
			box.appendChild( self.listUI( l ) );
		} );

		if ( m.resources.length ) {
			var r = make( 'div', 'prwh-full__sec' );
			r.appendChild( make( 'p', 'prwh-eyebrow', t.resources ) );
			var ul = make( 'ul' );
			m.resources.forEach( function ( res ) {
				var li = make( 'li' );
				var a = make( 'a', '', res.label );
				a.href = res.url;
				a.target = '_blank';
				a.rel = 'noopener';
				li.appendChild( a );
				ul.appendChild( li );
			} );
			r.appendChild( ul );
			box.appendChild( r );
		}

		if ( m.sources ) {
			var src = make( 'details', 'prwh-full__sec prwh-sources' );
			src.appendChild( make( 'summary', '', t.sources ) );
			var body = make( 'div', 'prwh-sources__body' );
			body.innerHTML = m.sources; // Sanitized server-side with wp_kses (links and emphasis only).
			Array.prototype.forEach.call( body.querySelectorAll( 'a' ), function ( a ) {
				a.target = '_blank';
				a.rel = 'noopener';
			} );
			src.appendChild( body );
			box.appendChild( src );
		}
	};

	/**
	 * "Read and reflect" references. Ones with text open the passage in a pop-out.
	 */
	App.prototype.refsUI = function ( m ) {
		var self = this;
		var t = this.t;
		var texts = m.refTexts || {};
		var s = make( 'div', 'prwh-full__sec prwh-full__refs' );
		s.appendChild( make( 'p', 'prwh-eyebrow', t.moreScripture ) );
		var ul = make( 'ul' );
		var any = false;
		m.fullScripture.forEach( function ( ref ) {
			var li = make( 'li' );
			var p = Object.prototype.hasOwnProperty.call( texts, ref ) ? texts[ ref ] : null;
			if ( p ) {
				any = true;
				var b = make( 'button', 'prwh-ref', ref );
				b.type = 'button';
				b.setAttribute( 'aria-haspopup', 'dialog' );
				b.addEventListener( 'click', function () {
					self.openPassage( ref, p, b );
				} );
				li.appendChild( b );
			} else {
				li.appendChild( make( 'span', 'prwh-ref prwh-ref--plain', ref ) );
			}
			ul.appendChild( li );
		} );
		s.appendChild( ul );
		if ( any ) {
			s.appendChild( make( 'p', 'prwh-full__hint', t.readPassage ) );
		}
		return s;
	};

	/**
	 * The passage pop-out (one <dialog>, reused).
	 */
	App.prototype.openPassage = function ( ref, p, opener ) {
		var t = this.t;
		var d = this.passageDialog;
		if ( ! d ) {
			d = make( 'dialog', 'prwh-passage' );
			d.setAttribute( 'aria-labelledby', this.root.id + '-passage-title' );
			var head = make( 'div', 'prwh-passage__head' );
			var h = make( 'h2', 'prwh-passage__ref' );
			h.id = this.root.id + '-passage-title';
			var x = make( 'button', 'prwh-passage__x', '×' );
			x.type = 'button';
			x.setAttribute( 'aria-label', t.close );
			head.appendChild( h );
			head.appendChild( x );
			d.appendChild( head );
			d.appendChild( make( 'div', 'prwh-passage__body' ) );
			var foot = make( 'div', 'prwh-passage__foot' );
			foot.appendChild( make( 'span', 'prwh-passage__tr' ) );
			var c = make( 'button', 'prwh-btn prwh-passage__close', t.close );
			c.type = 'button';
			foot.appendChild( c );
			d.appendChild( foot );
			var close = function () {
				d.close();
			};
			x.addEventListener( 'click', close );
			c.addEventListener( 'click', close );
			// Tap outside the card closes it.
			d.addEventListener( 'click', function ( e ) {
				if ( e.target === d ) {
					close();
				}
			} );
			d.addEventListener( 'close', function () {
				if ( d._opener && document.contains( d._opener ) ) {
					d._opener.focus();
				}
			} );
			this.root.appendChild( d );
			this.passageDialog = d;
		}
		d.querySelector( '.prwh-passage__ref' ).textContent = ref;
		var body = d.querySelector( '.prwh-passage__body' );
		body.textContent = '';
		var para = make( 'p' );
		if ( ! p.verses && ! p.text && typeof p.load === 'function' ) {
			// Text that is fetched on first use (standalone build): show it once it arrives.
			var self = this;
			para.textContent = t.loading || '…';
			p.load().then( function ( verses ) {
				if ( verses && verses.length ) {
					p.verses = verses;
				} else {
					p.text = t.notFound || '';
				}
				if ( d.open && d._ref === ref ) {
					self.openPassage( ref, p, d._opener );
				}
			} ).catch( function () {
				para.textContent = t.loadFailed || '';
			} );
		} else if ( p.verses && p.verses.length ) {
			var many = p.verses.length > 1;
			p.verses.forEach( function ( v, i ) {
				if ( many ) {
					para.appendChild( make( 'sup', 'prwh-passage__v', String( v[ 0 ] ) ) );
				}
				para.appendChild( document.createTextNode( v[ 1 ] + ( i < p.verses.length - 1 ? ' ' : '' ) ) );
			} );
		} else {
			para.textContent = p.text || '';
		}
		body.appendChild( para );
		body.scrollTop = 0;
		d.querySelector( '.prwh-passage__tr' ).textContent = p.translation || '';
		d._opener = opener;
		d._ref = ref;
		// Use the current movement's group color (the dialog sits outside the session element).
		var session = opener && opener.closest ? opener.closest( '[data-group]' ) : null;
		var g = session ? window.getComputedStyle( session ).getPropertyValue( '--prwh-g' ) : '';
		if ( g ) {
			d.style.setProperty( '--prwh-g', g.trim() );
		} else {
			d.style.removeProperty( '--prwh-g' );
		}
		if ( typeof d.showModal === 'function' ) {
			d.showModal();
		} else {
			d.setAttribute( 'open', '' );
		}
		d.querySelector( '.prwh-passage__close' ).focus();
	};

	/**
	 * One prayer list: expanded, or behind a "View all" button.
	 */
	App.prototype.listUI = function ( l ) {
		var t = this.t;
		// Local churches: feature a few each day, taking turns through the list.
		if ( 'churches' === l.kind && l.perDay > 0 && l.items.length > l.perDay ) {
			var group = make( 'div', 'prwh-chgroup' );
			var now = new Date();
			var day = Math.floor( Date.UTC( now.getFullYear(), now.getMonth(), now.getDate() ) / 864e5 );
			var n = l.items.length;
			var start = ( day * l.perDay ) % n;
			var today = make( 'div', 'prwh-full__sec prwh-plist is-open prwh-today' );
			today.appendChild( make( 'p', 'prwh-plist__title', t.todayChurches ) );
			var tol = make( 'ul', 'prwh-today__items' );
			for ( var k = 0; k < l.perDay; k++ ) {
				var it = l.items[ ( start + k ) % n ];
				var li = make( 'li' );
				li.appendChild( make( 'strong', '', it.name ) );
				if ( it.text ) {
					li.appendChild( make( 'span', '', it.text ) );
				}
				tol.appendChild( li );
			}
			today.appendChild( tol );
			if ( l.credit && l.credit.url ) {
				var tcr = make( 'p', 'prwh-plist__credit' );
				var tca = make( 'a', '', l.credit.text );
				tca.href = l.credit.url;
				tca.target = '_blank';
				tca.rel = 'noopener';
				tcr.appendChild( tca );
				today.appendChild( tcr );
			}
			group.appendChild( today );
			var all = {};
			Object.keys( l ).forEach( function ( key ) {
				all[ key ] = l[ key ];
			} );
			all.perDay = 0;
			group.appendChild( this.listUI( all ) );
			return group;
		}
		var wrap = make( l.open ? 'div' : 'details', 'prwh-full__sec prwh-plist' + ( l.open ? ' is-open' : '' ) );
		if ( l.open ) {
			wrap.appendChild( make( 'p', 'prwh-plist__title', l.label ) );
		} else {
			wrap.appendChild( make( 'summary', 'prwh-plist__toggle', l.label ) );
		}
		if ( l.intro ) {
			wrap.appendChild( make( 'p', 'prwh-plist__intro', l.intro ) );
		}
		if ( 'people' === l.kind ) {
			wrap.appendChild( this.peopleUI( l.items ) );
		}
		var ol = make( 'ol', 'prwh-plist__items' );
		( 'people' === l.kind ? [] : l.items ).forEach( function ( it ) {
			var li = make( 'li' );
			if ( it.name ) {
				li.appendChild( make( 'strong', '', it.name ) );
				li.appendChild( document.createTextNode( ' ' ) );
			}
			li.appendChild( make( 'span', '', it.text ) );
			ol.appendChild( li );
		} );
		if ( 'people' !== l.kind ) {
			wrap.appendChild( ol );
		}
		if ( l.credit && l.credit.url ) {
			var cr = make( 'p', 'prwh-plist__credit' );
			var ca = make( 'a', '', l.credit.text );
			ca.href = l.credit.url;
			ca.target = '_blank';
			ca.rel = 'noopener';
			cr.appendChild( ca );
			wrap.appendChild( cr );
		}
		if ( ! l.open ) {
			var less = make( 'button', 'prwh-chip prwh-chip--quiet prwh-plist__less', t.showLess );
			less.type = 'button';
			less.addEventListener( 'click', function () {
				wrap.open = false;
				wrap.querySelector( 'summary' ).focus();
			} );
			wrap.appendChild( less );
		}
		return wrap;
	};

	/**
	 * Missionaries as cards: photo (or initials), name, place, prayer focus.
	 */
	App.prototype.peopleUI = function ( items ) {
		var ul = make( 'ul', 'prwh-people' );
		items.forEach( function ( it ) {
			var li = make( 'li', 'prwh-person' );
			var pic = make( 'span', 'prwh-person__photo' );
			if ( it.photo ) {
				var img = make( 'img' );
				img.src = it.photo;
				img.alt = '';
				img.loading = 'lazy';
				img.decoding = 'async';
				pic.appendChild( img );
			} else {
				pic.appendChild( make( 'span', 'prwh-person__initials', it.initials || '' ) );
				pic.setAttribute( 'aria-hidden', 'true' );
			}
			li.appendChild( pic );
			var body = make( 'span', 'prwh-person__body' );
			body.appendChild( make( 'strong', 'prwh-person__name', it.name ) );
			if ( it.place ) {
				body.appendChild( make( 'span', 'prwh-person__place', it.place ) );
			}
			if ( it.text ) {
				body.appendChild( make( 'span', 'prwh-person__text', it.text ) );
			}
			li.appendChild( body );
			ul.appendChild( li );
		} );
		return ul;
	};

	App.prototype.requestsUI = function () {
		var t = this.t;
		var wrap = make( 'div', 'prwh-full__sec prwh-requests' );
		wrap.appendChild( make( 'p', 'prwh-eyebrow', t.requests ) );
		var ul = make( 'ul', 'prwh-requests__list' );
		var form = make( 'form', 'prwh-requests__add' );
		var input = make( 'input' );
		input.type = 'text';
		input.maxLength = 200;
		input.setAttribute( 'aria-label', t.requests );
		var add = make( 'button', 'prwh-chip', t.addRequest );
		add.type = 'submit';
		form.appendChild( input );
		form.appendChild( add );

		function draw() {
			var items = load( STORE.requests, [] );
			ul.textContent = '';
			items.forEach( function ( text, i ) {
				var li = make( 'li' );
				li.appendChild( make( 'span', '', text ) );
				var rm = make( 'button', 'prwh-chip prwh-chip--quiet', t.answered );
				rm.type = 'button';
				rm.setAttribute( 'aria-label', t.removeRequest + ': ' + text );
				rm.addEventListener( 'click', function () {
					var cur = load( STORE.requests, [] );
					cur.splice( i, 1 );
					save( STORE.requests, cur );
					draw();
				} );
				li.appendChild( rm );
				ul.appendChild( li );
			} );
		}

		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();
			var v = input.value.trim();
			if ( ! v ) {
				return;
			}
			var cur = load( STORE.requests, [] );
			cur.push( v );
			save( STORE.requests, cur );
			input.value = '';
			draw();
		} );

		draw();
		wrap.appendChild( ul );
		wrap.appendChild( form );
		wrap.appendChild( make( 'small', '', t.requestsNote ) );
		return wrap;
	};

	App.prototype.setRunning = function ( on ) {
		this.running = !! on && ! this.finished;
		this.lastTick = Date.now();
		this.$( 'toggle' ).textContent = this.running ? this.t.pause : this.t.resume;
		this.$( 'session' ).classList.toggle( 'is-paused', ! this.running );
		keepAwake( this.running );
	};

	App.prototype.tick = function () {
		var now = Date.now();
		var dt = now - this.lastTick;
		this.lastTick = now;
		if ( ! this.running || this.waiting || this.finished ) {
			return;
		}
		// Ignore large gaps (device slept) beyond one second.
		dt = Math.min( dt, 1000 );
		this.prayedMs += dt;
		this.elapsed += dt;
		if ( this.perMs ) {
			this.remaining -= dt;
			if ( this.remaining <= 0 ) {
				this.remaining = 0;
				this.renderClock();
				this.movementDone();
				return;
			}
		}
		this.renderClock();
	};

	App.prototype.renderClock = function () {
		var c = this.$( 'clock' );
		if ( this.perMs ) {
			c.textContent = clock( this.remaining );
			var within = 1 - this.remaining / this.perMs;
			this.$( 'progress' ).style.width = ( ( ( this.current + within ) / this.order.length ) * 100 ) + '%';
		} else {
			c.textContent = clock( this.elapsed );
		}
	};

	App.prototype.movementDone = function () {
		if ( this.prefs.sound ) {
			chime();
		}
		if ( this.current >= this.order.length - 1 ) {
			this.finish();
			return;
		}
		if ( this.prefs.pause ) {
			this.waiting = true;
			var next = this.cfg.movements[ this.order[ this.current + 1 ] ];
			this.$( 'next-title' ).textContent = String( next.number ).padStart( 2, '0' ) + ' · ' + next.title;
			this.$( 'body' ).hidden = true;
			this.$( 'transition' ).hidden = false;
			this.$( 'continue' ).focus();
			return;
		}
		this.show( this.current + 1 );
	};

	App.prototype.advance = function ( dir ) {
		if ( this.finished ) {
			return;
		}
		var to = this.current + dir;
		if ( to < 0 ) {
			return;
		}
		if ( to >= this.order.length ) {
			this.finish();
			return;
		}
		this.show( to );
		if ( ! this.running ) {
			this.setRunning( true );
		}
	};

	App.prototype.finish = function () {
		var self = this;
		this.finished = true;
		this.running = false;
		window.clearInterval( this.timer );
		keepAwake( false );

		var minutes = Math.round( this.prayedMs / 60000 );
		this.$( 'body' ).hidden = true;
		this.$( 'transition' ).hidden = true;
		this.$( 'controls' ).hidden = true;
		this.$( 'done' ).hidden = false;
		this.$( 'session' ).classList.add( 'is-finished' );
		this.$( 'progress' ).style.width = '100%';
		this.$( 'step' ).textContent = '';
		this.$( 'group' ).textContent = '';
		this.$( 'session' ).removeAttribute( 'data-group' );
		this.$( 'done-title' ).textContent = minutes >= 1 ? fmt( this.t.doneTitle, this.minutesLabel( minutes ) ) : this.t.doneShort;
		this.lastMinutes = minutes;
		this.finishedAt = new Date();
		this.notesSaved = false;
		var hasNotes = this.hasNotes();
		this.$( 'save-notes' ).hidden = ! hasNotes;
		this.$( 'copy-notes' ).hidden = ! hasNotes || ! navigator.clipboard;
		this.$( 'notes-hint' ).hidden = ! hasNotes;
		this.$( 'notes-hint' ).textContent = this.cfg.keepNotes ? this.t.hintKept : this.t.hintGone;
		this.$( 'clear-notes' ).hidden = ! hasNotes || ! this.cfg.keepNotes;

		var doneWheel = this.$( 'session' ).querySelector( '.prwh-wheel--done' );
		Array.prototype.forEach.call( doneWheel.querySelectorAll( '.prwh-wedge' ), function ( w ) {
			var idx = parseInt( w.getAttribute( 'data-index' ), 10 );
			w.classList.toggle( 'is-done', self.order.indexOf( idx ) !== -1 );
			w.classList.toggle( 'is-skipped', self.order.indexOf( idx ) === -1 );
		} );
		this.$( 'done-title' ).focus( { preventScroll: true } );

		if ( minutes >= 1 ) {
			save( STORE.mine, ( parseInt( load( STORE.mine, 0 ), 10 ) || 0 ) + minutes );
			if ( this.cfg.sessionUrl ) {
				window.fetch( this.cfg.sessionUrl, {
					method: 'POST',
					credentials: 'same-origin',
					headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': this.cfg.restNonce || '' },
					body: JSON.stringify( { minutes: minutes } ),
				} ).then( function () {
					self.refreshCounter();
				} ).catch( function () {} );
			}
		}
	};

	App.prototype.close = function () {
		if ( ! this.finished ) {
			this.finish();
		}
		this.active = false;
		this.notes = {};
		this.$( 'notes' ).value = '';
		if ( ! this.cfg.keepNotes ) {
			this.clearNotes( true );
		}
		this.$( 'session' ).hidden = true;
		document.documentElement.classList.remove( 'prwh-lock' );
		this.refreshCounter();
		var back = this.opener && this.root.contains( this.opener ) ? this.opener : this.$( 'begin' );
		back.focus();
	};

	/**
	 * Today's saved notes, keyed by movement index. Notes are stored per day
	 * and per movement key in this browser only; days older than 30 are pruned.
	 */
	App.prototype.loadNotes = function () {
		var out = {};
		if ( ! this.cfg.keepNotes ) {
			return out;
		}
		var all = load( STORE.notes, {} );
		var today = all[ dayKey() ] || {};
		this.cfg.movements.forEach( function ( m, idx ) {
			if ( today[ m.key ] ) {
				out[ idx ] = today[ m.key ];
			}
		} );
		return out;
	};

	App.prototype.storeNotes = function () {
		if ( ! this.cfg.keepNotes ) {
			return;
		}
		var self = this;
		var all = load( STORE.notes, {} );
		var day = {};
		Object.keys( this.notes ).forEach( function ( idx ) {
			var text = self.notes[ idx ];
			if ( text && text.trim() ) {
				day[ self.cfg.movements[ idx ].key ] = text;
			}
		} );
		all[ dayKey() ] = day;
		var cutoff = dayKey( new Date( Date.now() - 30 * 86400000 ) );
		Object.keys( all ).forEach( function ( k ) {
			if ( k < cutoff || ! Object.keys( all[ k ] ).length ) {
				delete all[ k ];
			}
		} );
		save( STORE.notes, all );
	};

	App.prototype.clearNotes = function ( quiet ) {
		var all = load( STORE.notes, {} );
		delete all[ dayKey() ];
		save( STORE.notes, all );
		if ( quiet ) {
			return;
		}
		this.notes = {};
		this.$( 'notes' ).value = '';
		this.$( 'save-notes' ).hidden = true;
		this.$( 'copy-notes' ).hidden = true;
		this.$( 'clear-notes' ).hidden = true;
		this.$( 'notes-hint' ).textContent = this.t.cleared;
	};

	App.prototype.hasNotes = function () {
		var self = this;
		return ( this.order || [] ).some( function ( idx ) {
			return ( self.notes[ idx ] || '' ).trim() !== '';
		} );
	};

	/**
	 * Notes as plain text, each tagged with its movement, group, Scripture
	 * and (in Full Prayer) the day's focus.
	 */
	App.prototype.notesText = function () {
		var self = this;
		var t = this.t;
		var cfg = this.cfg;
		var now = this.finishedAt || new Date();
		var day = now.getDay();
		var date = now.toLocaleDateString( undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' } );
		var rule = '----------------------------------------';
		var head = [ t.notesHeading + ' · ' + date ];
		var sub = [];
		if ( cfg.church ) {
			sub.push( cfg.church );
		}
		if ( this.lastMinutes >= 1 ) {
			sub.push( fmt( t.prayedFor, this.minutesLabel( this.lastMinutes ) ) );
		}
		sub.push( this.full ? t.modeFull : t.modeSimple );
		head.push( sub.join( ' · ' ) );

		var blocks = this.order.map( function ( idx ) {
			var n = ( self.notes[ idx ] || '' ).trim();
			if ( ! n ) {
				return '';
			}
			var m = cfg.movements[ idx ];
			var g = cfg.groups[ m.group ];
			var v = self.picks[ idx ] || m;
			var lines = [
				String( m.number ).padStart( 2, '0' ) + ' · ' + m.title + ' · ' + g.label + ' (' + g.sub + ')',
				t.scripture + ': ' + v.ref + ( v.translation ? ' ' + v.translation : '' ),
				'“' + v.text + '”',
			];
			if ( self.full && m.rotation.length ) {
				lines.push( ( m.key === 'word' ? t.todayPassage : t.today ) + ': ' + m.rotation[ day % m.rotation.length ] );
			}
			lines.push( '', t.notesLabel + ':', n );
			return lines.join( '\n' );
		} ).filter( Boolean );

		return head.join( '\n' ) + '\n\n' + rule + '\n\n' + blocks.join( '\n\n' + rule + '\n\n' ) + '\n';
	};

	App.prototype.notesFileName = function () {
		var d = this.finishedAt || new Date();
		var ymd = d.getFullYear() + '-' + String( d.getMonth() + 1 ).padStart( 2, '0' ) + '-' + String( d.getDate() ).padStart( 2, '0' );
		return 'prayer-notes-' + ymd + '.txt';
	};

	App.prototype.flash = function ( name, text ) {
		var btn = this.$( name );
		var label = btn.getAttribute( 'data-label' ) || btn.textContent;
		btn.setAttribute( 'data-label', label );
		btn.textContent = text;
		window.setTimeout( function () {
			btn.textContent = label;
		}, 2500 );
	};

	App.prototype.copyNotes = function () {
		var self = this;
		var text = this.notesText();
		if ( navigator.clipboard && text ) {
			navigator.clipboard.writeText( text ).then( function () {
				self.flash( 'copy-notes', self.t.copied );
			} ).catch( function () {} );
		}
	};

	/**
	 * Save a .txt copy to the device. Phones get the share sheet (Save to
	 * Files, Notes, email); other browsers download the file.
	 */
	App.prototype.saveNotes = function () {
		var self = this;
		var name = this.notesFileName();
		var text = this.notesText();
		var blob = new Blob( [ '\ufeff' + text ], { type: 'text/plain;charset=utf-8' } );

		function download() {
			var url = URL.createObjectURL( blob );
			var a = document.createElement( 'a' );
			a.href = url;
			a.download = name;
			a.rel = 'noopener';
			document.body.appendChild( a );
			a.click();
			a.remove();
			window.setTimeout( function () {
				URL.revokeObjectURL( url );
			}, 4000 );
			self.notesSaved = true;
			self.flash( 'save-notes', self.t.saved );
		}

		var coarse = window.matchMedia && window.matchMedia( '(pointer: coarse)' ).matches;
		var file = null;
		try {
			file = new File( [ blob ], name, { type: 'text/plain' } );
		} catch ( e ) {}

		if ( coarse && file && navigator.canShare && navigator.canShare( { files: [ file ] } ) ) {
			navigator.share( { files: [ file ], title: name } ).then( function () {
				self.notesSaved = true;
				self.flash( 'save-notes', self.t.saved );
			} ).catch( function ( err ) {
				if ( ! err || err.name !== 'AbortError' ) {
					download();
				}
			} );
			return;
		}
		download();
	};

	App.prototype.scale = function ( d ) {
		this.prefs.scale = Math.round( Math.min( 1.6, Math.max( 0.8, ( this.prefs.scale || 1 ) + d ) ) * 10 ) / 10;
		this.persist();
		this.$( 'session' ).style.setProperty( '--prwh-scale', this.prefs.scale );
	};

	function boot() {
		Array.prototype.forEach.call( document.querySelectorAll( '.prwh' ), function ( root ) {
			if ( ! root.prwhApp && ( root.prwhConfig || root.querySelector( '.prwh-config' ) ) ) {
				root.prwhApp = new App( root );
			}
		} );
	}

	// Used by the standalone build to start the app after it has built the page.
	window.FullCirclePrayer = window.FullCirclePrayer || {};
	window.FullCirclePrayer.boot = boot;

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
}() );
