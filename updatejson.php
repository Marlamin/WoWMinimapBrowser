<?php
if(php_sapi_name() != "cli") die("This script cannot be run outside of CLI.");

include "inc/config.php";

function getConfigByMapVersion($mapid, $versionid){
	global $mysqli;
	$q = $mysqli->query("SELECT resx, resy, zoom, minzoom, maxzoom FROM gmaps_config WHERE mapid = '".$mysqli->real_escape_string($mapid)."' AND versionid = '".$mysqli->real_escape_string($versionid)."' AND resx != 0");
	if($q->num_rows == 0){
		$config['resx'] = 0;
		$config['resy'] = 0;
		$config['zoom'] = 4;
		$config['minzoom'] = 4;
		$config['maxzoom'] = 7;
		$config['fallback'] = true;
	}else{
		$config = $q->fetch_assoc();
	}
	return $config;
}

// Map config JSON, this used for everything important

header("Content-Type: application/json");
$data = [
	'maps' => [],
	'versions' => []
];

$q = $mysqli->query("SELECT * FROM maps ORDER BY firstseen ASC");

while($map = $q->fetch_assoc()){
	$mapnameraw = $map['internal'];
	$map['internal'] = str_replace("'", '', str_replace('-', '', $map['internal']));
	$data['maps'][] = $map;

	$mvq = $mysqli->query("SELECT * FROM maps_versions JOIN versions ON version = id WHERE map_id = '".$map['id']."' ORDER BY build ASC");

	$prevmd5 = '';

	while($mapversion = $mvq->fetch_assoc()){
		if($mapversion['md5'] == $prevmd5){ continue; }
		$mapversion['fullbuild'] = $mapversion['expansion'].".".$mapversion['major'].".".$mapversion['minor'].".".$mapversion['build'];
		$mapversion['config'] = getConfigByMapVersion($map['id'], $mapversion['id']);

		$prevmd5 = $mapversion['md5'];
		$version = $mapversion['version'];

		$mapversion['config']['zoom'] = (int) $mapversion['config']['zoom'];
		$mapversion['config']['minzoom'] = (int) $mapversion['config']['minzoom'];
		$mapversion['config']['maxzoom'] = (int) $mapversion['config']['maxzoom'];

		$maprawdir = "/home/marlamin/wow/automatic/" . $mapversion['expansion'].".".$mapversion['major'].".".$mapversion['minor'].".".$mapversion['build']."/World/Minimaps/".$mapnameraw;

		$mapversion['config']['offset']['min']['y'] = 63;
		$mapversion['config']['offset']['min']['x'] = 63;

		$mapversion['config']['offset']['max']['y'] = 0;
		$mapversion['config']['offset']['max']['x'] = 0;

		if(is_dir($maprawdir)){

			foreach(glob($maprawdir."/*") as $tileindir){
				$tileparts = explode ("/", $tileindir);
				$tile = str_replace(".blp", "", $tileparts[9]);
				$tile = str_replace("map", "", $tile);
				$tile = explode("_", $tile);

				if(!is_numeric($tile[0])){ continue; }

				if($mapversion['config']['offset']['min']['x'] > $tile[0]){ $mapversion['config']['offset']['min']['x'] = (int) $tile[0]; }
				if($mapversion['config']['offset']['min']['y'] > $tile[1]){ $mapversion['config']['offset']['min']['y'] = (int) $tile[1]; }
				if($mapversion['config']['offset']['max']['x'] < $tile[0]){ $mapversion['config']['offset']['max']['x'] = (int) $tile[0]; }
				if($mapversion['config']['offset']['max']['y'] < $tile[1]){ $mapversion['config']['offset']['max']['y'] = (int) $tile[1]; }
			}
		}

		/* Unship data not used in JSON! */
		unset($mapversion['id'], $mapversion['expansion'], $mapversion['major'], $mapversion['minor'], $mapversion['map_id'], $mapversion['builton'], $mapversion['version']);

		$mapversion['build'] = (int)$mapversion['build'];

		$data['versions'][$map['id']][$version] = $mapversion;
	}
	// $data['versions'][$map['id']] = array_reverse($data['versions'][$map['id']], true);
	uasort($data['versions'][$map['id']], function($a, $b) { if($a['build'] === $b['build']) return 0; return $a['build'] < $b['build']; } );
}

file_put_contents("data.json", json_encode($data));

// Offsets json. Gets top-left ADT tile. Generated from partial tilesets. Needs to be complete before production!

$offsets = array();

foreach(glob("/home/marlamin/wow/automatic/*", GLOB_ONLYDIR) as $dir){
	$parts = explode("/", $dir);
	$ver = explode(".", $parts[5]);

	if(count($ver) != 4){ continue;	} // Skip dirs without versions

	$offsets[$ver[3]] = array();

	foreach(glob($dir."/World/Minimaps/*", GLOB_ONLYDIR) as $versiondir){
		$versionparts = explode("/", $versiondir);
		if($versionparts[8] == "WMO" || $versionparts[8] == "wmo"){ continue; } // Skip WMOs... for now :)
		$versionparts[8] = str_replace("'", '', str_replace('-', '', $versionparts[8]));
		$offsets[$ver[3]][$versionparts[8]] = array("x" => 63, "y" => 63);

		foreach(glob($versiondir."/*") as $tileindir){
			$tileparts = explode ("/", $tileindir);
			$tile = str_replace(".blp", "", $tileparts[9]);
			$tile = str_replace("map", "", $tile);
			$tile = explode("_", $tile);

			if(!is_numeric($tile[0])){ continue; }

			//Y and X are flipped yo

			if($offsets[$ver[3]][$versionparts[8]]['y'] > $tile[0]){ $offsets[$ver[3]][$versionparts[8]]['y'] = (int) $tile[0]; }
			if($offsets[$ver[3]][$versionparts[8]]['x'] > $tile[1]){ $offsets[$ver[3]][$versionparts[8]]['x'] = (int) $tile[1]; }
		}
	}
}


file_put_contents("offsets70.json", json_encode($offsets));
