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
