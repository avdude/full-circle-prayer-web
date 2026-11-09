<?php
// Export the plugin's built-in content for the standalone app (run with wp eval-file).
$out_dir = getenv( 'OUT' );
$orig    = get_option( PRWH_Bible::OPTION );
$ui      = null;
foreach ( array( 'WEB', 'KJV' ) as $v ) {
	update_option( PRWH_Bible::OPTION, $v );
	$movements = PRWH_Defaults::movements();
	foreach ( $movements as $i => $m ) {
		$movements[ $i ]['number'] = $i + 1;
	}
	$starters = array();
	foreach ( PRWH_Bible::starters( $v ) as $s ) {
		$starters[] = $s;
	}
	$settings = PRWH_Defaults::settings();
	unset( $settings['church_name'], $settings['logo_id'] );
	$data = array(
		'version'   => $v,
		'credit'    => PRWH_Bible::versions()[ $v ]['credit'],
		'closing'   => PRWH_Bible::closing_line( $v ),
		'settings'  => $settings,
		'movements' => $movements,
		'starters'  => $starters,
	);
	file_put_contents( $out_dir . '/content-' . strtolower( $v ) . '.json', wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) );
	if ( null === $ui ) {
		$html = PRWH_Frontend::render( array() );
		preg_match( '#<script type="application/json" class="prwh-config">(.*?)</script>#s', $html, $mm );
		$cfg = json_decode( $mm[1], true );
		$ui  = $cfg['i18n'];
	}
}
update_option( PRWH_Bible::OPTION, $orig );
file_put_contents( $out_dir . '/i18n-en.json', wp_json_encode( $ui, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) );
echo "ok\n";
