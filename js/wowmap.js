/* global google:false */
(function()
{
	var GoogleMap = InitializeMap();
	var Versions;
	var Elements =
	{
		Maps: document.getElementById( 'js-map-select' ),
		Versions: document.getElementById( 'js-version-select' ),
		PrevMap: document.getElementById( 'js-version-prev' ),
		NextMap: document.getElementById( 'js-version-next' ),
		Sidebar: document.getElementById( 'js-sidebar' ),
		Map: document.getElementById( 'js-map' )
	};
	var Current =
	{
		Map: false,
		InternalMap: false,
		Version: 0
	};

	// Sidebar button
	document.getElementById( 'js-sidebar-button' ).addEventListener( 'click', function( )
	{
		Elements.Sidebar.classList.toggle( 'closed' );
	} );

	var d, isDebug = window.location.hash !== '#nodebug';

	if( isDebug && !( 'ontouchstart' in window ) )
	{
		var debugEl = document.createElement( 'pre' );
		debugEl.style.zIndex = 1337;
		debugEl.style.color = '#FFF';
		debugEl.style.position = 'absolute';
		debugEl.style.bottom = '15px';
		debugEl.style.left = '15px';
		debugEl.style.maxHeight = '300px';
		debugEl.style.overflowY = 'hidden';
		debugEl.style.backgroundColor = 'rgba(0, 0, 0, .5)';

		document.body.appendChild( debugEl );

		d = function(text) { debugEl.textContent = text + "\n" + debugEl.textContent; };
	}
	else
	{
		d = function() {};
	}

	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = Initialize;
	xhr.open( 'GET', '/data.json', true );
	xhr.responseType = 'json';
	xhr.send();

	function Initialize()
	{
		if( xhr.readyState !== 4 )
		{
			return;
		}

		d( 'JSON data loaded: ' + xhr.status );

		if( xhr.status !== 200 || !xhr.response.maps )
		{
			alert( 'Failed to load JSON data. Whoops.' );

			return;
		}

		Versions = xhr.response.versions;

		InitializeMapOptions( xhr.response.maps );
		InitializeEvents();
	}

	function InitializeMap()
	{
		var mapOptions =
		{
			zoom: 1,
			minZoom: 2,
			maxZoom: 7,
			streetViewControl: false,
			backgroundColor: '#001D28',
			disableDefaultUI: true,
			zoomControl: true,
			zoomControlOptions:
			{
				style: google.maps.ZoomControlStyle.LARGE,
				position: google.maps.ControlPosition.TOP_RIGHT
			}
		};

		return new google.maps.Map( document.getElementById( 'js-map' ), mapOptions );
	}

	function InitializeMapOptions( maps )
	{
		var url = window.location.pathname.split( '/' ),
		option,
		fragment = document.createDocumentFragment();

		maps.forEach( function( map, i )
		{
			option = document.createElement( 'option' );
			option.dataset.internal = map.internal;
			option.value = map.id;
			option.textContent = map.name;

			fragment.appendChild( option );

			// Either first map, or specified map
			if( i === 0 || map.internal === url[ 1 ] )
			{
				d( 'Using ' + map.internal + ' for current status' );

				Current.Map = map.id;
				Current.InternalMap = map.internal;
				Current.Version = '' + parseInt( url[ 2 ], 10 );

				if( map.internal === url[ 1 ] )
				{
					option.selected = true;
				}
			}
		} );

		Elements.Maps.appendChild( fragment );

		UpdateMapVersions();

		d( 'Initialized map ' + Current.Map + ' on version ' + Current.Version );

		// Get zoom level, from url or fallback to default
		var zoom = parseInt( url[ 3 ], 10 ) || 0;

		// Get map coordinates
		var point = new google.maps.Point( parseFloat( url[ 4 ] ), parseFloat( url[ 5 ] ) );

		// Fallback to map default if needed
		if( isNaN( point.x ) || isNaN( point.y ) )
		{
			point = new google.maps.Point(
				Versions[ Current.Map ][ Current.Version ].config.resx / 256,
				Versions[ Current.Map ][ Current.Version ].config.resy / 256
				);
		}

		RenderMap( point, zoom, true );
	}

	function UpdateMapVersions()
	{
		var element,
		sortable = [],
		fragment = document.createDocumentFragment();

		// Turn versions object into a list so that it can be sorted
		Object.keys( Versions[ Current.Map ] ).forEach( function( versionId )
		{
			element = Versions[ Current.Map ][ versionId ];
			element.version = versionId;

			sortable.push( element );
		} );

		sortable
			// Sort versions by build
			.sort( function( a, b )
			{
				if( a.build === b.build )
				{
					return 0;
				}

				return a.build > b.build ? -1 : 1;
			} )
			// Append each version
			.forEach( function( version )
			{
				element = document.createElement( 'option' );
				element.value = version.version;

				// If we switch to another map, and current version is present in that map, select it
				if( version.version === Current.Version )
				{
					element.selected = true;
				}

				if( version.desc.length > 0 )
				{
					element.textContent = version.fullbuild + ' (' + version.desc + ')';
				}
				else
				{
					element.textContent = version.fullbuild;
				}

				fragment.appendChild( element );
			} );

		Elements.Versions.innerHTML = ''; // A bad way of removing children (from your life)
		Elements.Versions.appendChild( fragment );

		// If current version is not valid for this map, reset it
		if( !Versions[ Current.Map ][ Current.Version ] )
		{
			d( 'Using first version' );

			Current.Version = Elements.Versions.firstChild.value;
		}

		UpdateArrowButtons();
	}

	function UpdateArrowButtons()
	{
		var element = Elements.Versions.options[ Elements.Versions.selectedIndex ];

		// Enable or disable arrow keys as necessary
		Elements.PrevMap.disabled = element.nextSibling === null;
		Elements.NextMap.disabled = element.previousSibling === null;
	}

	function InitializeEvents()
	{
		Elements.Maps.addEventListener( 'change', function( )
		{
			d( 'Changed map to ' + this.value + ' from ' + Current.Map );

			Current.Map = this.value;
			Current.InternalMap = this.options[ this.selectedIndex ].dataset.internal;

			UpdateMapVersions();

			RenderMap(
				new google.maps.Point(
					Versions[ Current.Map ][ Current.Version ].config.resx / 256,
					Versions[ Current.Map ][ Current.Version ].config.resy / 256
					), 0, true
				);
		} );

		Elements.Versions.addEventListener( 'change', ChangeVersion );

		Elements.PrevMap.addEventListener( 'click', function( )
		{
			Elements.Versions.selectedIndex = Elements.Versions.selectedIndex + 1;

			ChangeVersion();
		} );

		google.maps.event.addDomListener( document, 'keydown', function (e) {
			console.log(e);

			var element = Elements.Versions.options[ Elements.Versions.selectedIndex ];

			if (e.keyCode == '37' && element.nextSibling !== null) {
				Elements.Versions.selectedIndex = Elements.Versions.selectedIndex + 1;
				ChangeVersion();
			}
			else if (e.keyCode == '39' && element.previousSibling !== null) {
				Elements.Versions.selectedIndex = Elements.Versions.selectedIndex - 1;
				ChangeVersion();
			}
		});

		Elements.NextMap.addEventListener( 'click', function( )
		{
			Elements.Versions.selectedIndex = Elements.Versions.selectedIndex - 1;

			ChangeVersion();
		} );

		google.maps.event.addListener( GoogleMap, 'dragend', function()
		{
			SynchronizeTitleAndURL();
		} );

		google.maps.event.addListener( GoogleMap, 'zoom_changed', function()
		{
			SynchronizeTitleAndURL();
		} );

		Elements.Maps.disabled = false;
		Elements.Versions.disabled = false;

		window.onpopstate = function( ev )
		{
			d( '>> popstate' );

			var state = ev.state;

			if( !state.Current )
			{
				d( '>>> no state' );

				return;
			}

			Current = state.Current;

			RenderMap( state.Point, state.Zoom );
		};
	}

	function ChangeVersion()
	{
		d( 'Changed version to ' + Elements.Versions.value + ' from ' + Current.Version );

		Current.Version = Elements.Versions.value;

		UpdateArrowButtons();

		RenderMap( GoogleMap.getProjection().fromLatLngToPoint( GoogleMap.getCenter() ), GoogleMap.getZoom(), true );
	}

	function GetNormalizedCoord( point, zoom )
	{
		var y = point.y;
		var x = point.x;

		if( x < 0 || y < 0 ) { return null; }

		var size = Math.pow( 2, 15 - zoom );

		var tileX = Math.ceil( Versions[ Current.Map ][ Current.Version ].config.resx / size );

		if( x >= tileX ) { return null; }

		var tileY = Math.ceil( Versions[ Current.Map ][ Current.Version ].config.resy / size );

		if( y >= tileY ) { return null; }

		return { x: x, y: y };
	}

	function GetTileURL( point, zoom )
	{
		var normalizedCoord = GetNormalizedCoord( point, zoom );

		if( !normalizedCoord )
		{
			return isDebug ? '/img/debug.png' : null;
		}

		return "https://newmaps.marlam.in/tiles/test/" + Current.Map + "/" + Versions[ Current.Map ][ Current.Version ].md5 + "/z" + zoom + "x" + normalizedCoord.x + "y" + normalizedCoord.y + ".png";
	}

	var markers = [];

	function RenderMap( center, zoom, isMapChange )
	{
		var name = 'WoW_' + Current.Map + '_' + Current.Version;

		d( 'Loading map ' + name );

		var projection = GoogleMap.getProjection();

		if( !projection )
		{
			d( 'Projection not yet available, binding an event' );

			google.maps.event.addListenerOnce( GoogleMap, 'projection_changed', function()
			{
				d( '>> projection_changed' );

				SetMapCenterAndZoom( GoogleMap.getProjection(), center, zoom, isMapChange );
			} );
		}

		var mapType = new google.maps.ImageMapType( {
			name: name,
			getTileUrl: GetTileURL,
			tileSize: new google.maps.Size( 256, 256 ),
			minZoom: 2,
			maxZoom: 7
		} );

		GoogleMap.mapTypes.set( name, mapType );
		GoogleMap.setMapTypeId( name );

		if( projection )
		{
			SetMapCenterAndZoom( projection, center, zoom, isMapChange );
		}
	}

	var markers = [];

	function SetMapCenterAndZoom( projection, center, zoom, isMapChange )
	{
		GoogleMap.setCenter( projection.fromPointToLatLng( center ) );

		if( !zoom )
		{
			GoogleMap.fitBounds( new google.maps.LatLngBounds(
				projection.fromPointToLatLng( new google.maps.Point( 0, 0 ) ),
				projection.fromPointToLatLng( new google.maps.Point(
					Versions[ Current.Map ][ Current.Version ].config.resx / 128,
					Versions[ Current.Map ][ Current.Version ].config.resy / 128
					) )
				) );
		}
		else if( GoogleMap.getZoom() !== zoom )
		{
			GoogleMap.setZoom( zoom );
		}

		SynchronizeTitleAndURL( isMapChange, center );

		for( var i = 0; i < markers.length; i++ )
		{
			markers[i].setMap(null);
		}

		markers = [];

		//IG coords chest -1087.453 -357.4323

		//Center of map in px
		console.log(new google.maps.Point(
			Versions[ Current.Map ][ Current.Version ].config.resx / 256,
			Versions[ Current.Map ][ Current.Version ].config.resy / 256
			));
		markers.push(new google.maps.Marker({
			position: projection.fromPointToLatLng( new google.maps.Point(
				Versions[ Current.Map ][ Current.Version ].config.resx / 256,
				Versions[ Current.Map ][ Current.Version ].config.resy / 256
				) ),
			map: GoogleMap,
			title: 'Map center'
		}));

/*
		if(Versions[ Current.Map ][ Current.Version ].config.offset && Versions[ Current.Map ][ Current.Version ].config.offset.min.x != 63){

			d('This map has offsets! MAX x = ' + Versions[ Current.Map ][ Current.Version ].config.offset.max.x + ' y = ' + Versions[ Current.Map ][ Current.Version ].config.offset.max.y + ' MIN x ' + Versions[ Current.Map ][ Current.Version ].config.offset.min.x + ' y = ' + Versions[ Current.Map ][ Current.Version ].config.offset.min.y);

			for(var y = 0; y < Versions[ Current.Map ][ Current.Version ].config.offset.max.x - (Versions[ Current.Map ][ Current.Version ].config.offset.min.x -1); y++){
				for(var x = 0; x < Versions[ Current.Map ][ Current.Version ].config.offset.max.y - (Versions[ Current.Map ][ Current.Version ].config.offset.min.y - 1); x++){
					markers.push(new google.maps.Rectangle({
						strokeColor: '#FF0000',
						strokeOpacity: 0.8,
						strokeWeight: 1,	
						map: GoogleMap,
						bounds: new google.maps.LatLngBounds(
							projection.fromPointToLatLng(
								new google.maps.Point(
									0 + (x * 2),
									0 + (y * 2)
								)
							),
							projection.fromPointToLatLng(
								new google.maps.Point(
									2 + (x * 2),
									2 + (y * 2)
								)
							)
						)
					}));
				}
			}
		}*/


/*
		if( isDebug )
		{
			for( var i = 0; i < markers.length; i++ )
			{
				markers[i].setMap(null);
			}

			markers = [];

			markers.push(new google.maps.Marker({
				position: projection.fromPointToLatLng( new google.maps.Point(
					Versions[ Current.Map ][ Current.Version ].config.resx / 256,
					Versions[ Current.Map ][ Current.Version ].config.resy / 256
				) ),
				map: GoogleMap,
				title: 'Actual Map Center'
			}));

			// Actual map edge
			markers.push(new google.maps.Marker({
				position: projection.fromPointToLatLng( new google.maps.Point(
					Versions[ Current.Map ][ Current.Version ].config.resx / 128,
					Versions[ Current.Map ][ Current.Version ].config.resy / 128
				) ),
				map: GoogleMap,
				title: 'Actual Map Edge'
			}));

			markers.push(new google.maps.Rectangle({
				strokeColor: '#FF0000',
				strokeOpacity: 0.8,
				strokeWeight: 2,
				fillColor: '#FF0000',
				fillOpacity: 0.2,
				map: GoogleMap,
				bounds: new google.maps.LatLngBounds(
					projection.fromPointToLatLng( new google.maps.Point(0,0)),
					projection.fromPointToLatLng( new google.maps.Point(
					Versions[ Current.Map ][ Current.Version ].config.resx / 128,
					Versions[ Current.Map ][ Current.Version ].config.resy / 128
					) )

				)
			}));
		}
		*/
	}

	function SynchronizeTitleAndURL( isMapChange, point )
	{
		if( !point )
		{
			point = GoogleMap.getProjection().fromLatLngToPoint( GoogleMap.getCenter() );
		}

		var zoom = GoogleMap.getZoom();

		var current =
		{
			Zoom: zoom,
			Point: point,
			Current: Current
		};

		var title = Elements.Maps.options[ Elements.Maps.selectedIndex ].textContent + ' · ' + Versions[ Current.Map ][ Current.Version ].fullbuild + ' · Wow Minimap Browser';
		var url = '/' + Current.InternalMap + '/' + Current.Version + '/' + zoom + '/' + point.x.toFixed(2) + '/' + point.y.toFixed(2);

		if( isMapChange )
		{
			window.history.pushState( current, title, url );
		}
		else
		{
			window.history.replaceState( current, title, url );
		}

		document.title = title;

		d( 'URL: ' + url + ' (map change: ' + !!isMapChange + ')' );

	}
}());
