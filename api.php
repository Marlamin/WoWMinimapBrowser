<?php

if($_GET['type'] == "areaname"){
	$mapid = intval($_GET['id']);

	$index = intval($_GET['index']);

	$assignments = json_decode(file_get_contents("map_json/".$mapid.".json"), true);

	$areas = json_decode(file_get_contents("areas.json"), true);

	//print_r($areas);

	$name = $areas[$assignments['Value']['adts'][$_GET['adt']]['ids'][$index]];

	if(empty($name)){
		$name = $assignments['Value']['name'];
		if(empty($name)){
			$name = "No name found :(";
		}
	}

	$return = array("name" => $name);

	echo json_encode($return);
}elseif($_GET['type'] == "flightpaths"){
	$csv = array_map('str_getcsv', file('TaxiNodes.csv'));

	$mapid = intval($_GET['id']);

	$pathcsv = array_map('str_getcsv', file('TaxiPath.csv'));
	$paths = array();

	foreach($pathcsv as $path){
		$paths[$path[1]][] = $path[2];
	}

	$return = array();

	foreach($csv as $entry){
		if($entry[0] == "ID") continue;
		if($entry[9] != $mapid) continue;
		if(strpos($entry[4], 'Quest') !== false) continue;
		if(strpos($entry[4], 'DISABLED') !== false) continue;
		if($entry[1] == 0 && $entry[2] == 0) continue;

		if($entry['5'] != 0 && $entry['6'] != 0){ $type = "neutral"; }elseif($entry['5'] != 0){ $type="horde"; }elseif($entry['6'] != 0){ $type = "alliance"; }else{ $type = "unknown"; }
		$return['ids'][] = $entry[0];
		$return['points'][$entry[0]] = array("x" => $entry[1], "y" => $entry[2], "name" => $entry[4], "type" => $type, "connected" => $paths[$entry[0]]);
	}
	echo json_encode($return);
}else{
	die("Invalid request!");
}

//print_r($assignments['Value']['adts'][$_GET['adt']]);
?>