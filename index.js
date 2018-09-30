var firstData = [];
var secondData = [];

( function ( $, L, prettySize ) {
  var map, heat,
    heatOptions = {
      tileOpacity: 1,
      heatOpacity: 1,
      radius: 25,
      blur: 15
    };

  function status( message ) {
    $( '#currentStatus' ).text( message );
  }

  var files = [null, null];

  function uploadFiles(file, idx) {
    files[idx] = file;

    if (files[0] !== null && files[1] !== null) {
      stageTwo(files)
    }
  }

  // Start at the beginning
  stageOne();

  function stageOne () {
    // Initialize the map
    map = L.map( 'map' ).setView( [0,0], 2 );
    L.tileLayer( 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'location-history-visualizer, which this is based off of, is available <a href="https://github.com/theopolisme/location-history-visualizer">on GitHub</a>. Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors.',
      maxZoom: 18,
      minZoom: 2
    } ).addTo( map );

    $( '#file-1' ).change( function () {
      uploadFiles(this.files[0], 0);
    } );
    $( '#file-2' ).change( function () {
      uploadFiles(this.files[0], 1);
    } );
  }

  function initOboe(arr, callback) {
    var os = new oboe();
    os.node( 'locations.*', function ( location ) {
      var SCALAR_E7 = 0.0000001; // Since Google Takeout stores latlngs as integers
        arr.push( [ location.latitudeE7 * SCALAR_E7, location.longitudeE7 * SCALAR_E7, location.timestampMs ] );
      return oboe.drop;
    }).done(function() {
      //heat._latlngs = latlngs;
      //heat.redraw();
      callback();
    });

    return os;
  }

  function stageTwo ( files ) {
    heat = L.heatLayer( [], heatOptions ).addTo( map );

    try {
      if (!(/\.json$/i.test(files[0].name)) || !(/\.json$/i.test(files[1].name))) {
        status( 'Something went wrong generating your map. Ensure you\'re uploading a Google Takeout JSON file that contains location data and try again, or create an issue on GitHub if the problem persists. ( error: ' + ex.message + ' )' );
        return;
      }
    } catch ( ex ) {
      status( 'Something went wrong generating your map. Ensure you\'re uploading a Google Takeout JSON file that contains location data and try again, or create an issue on GitHub if the problem persists. ( error: ' + ex.message + ' )' );
      return;
    }

    // First, change tabs
    $( 'body' ).addClass( 'working' );
    $( '#intro' ).addClass( 'hidden' );
    $( '#working' ).removeClass( 'hidden' );


    var fileSizeOne = prettySize(files[0].size);
    var fileSizeTwo = prettySize(files[1].size);

    status( 'Preparing to import files ( ' + fileSizeOne + ' and ' + fileSizeTwo + ' )...' );

    parseJSONFile(files[0], initOboe(firstData, function() {
      status('Uploading second...');
      parseJSONFile(files[1], initOboe(secondData, function() {
        status('Generating map...');
        stageThree(  /* numberProcessed */ firstData.length + secondData.length );
      }));
    }));
  }

  function stageThree ( numberProcessed ) {
    // Google Analytics event - heatmap render
    ga('send', 'event', 'Heatmap', 'render', undefined, numberProcessed);

    var $done = $( '#done' );

    // Change tabs :D
    $( 'body' ).removeClass( 'working' );
    $( '#working' ).addClass( 'hidden' );
    $done.removeClass( 'hidden' );

    // Update count
    $( '#numberProcessed' ).text( numberProcessed.toLocaleString() );

    $( '#launch' ).click(function () {
      /*
      $( 'body' ).addClass( 'map-active' );
      $done.fadeOut();
      activateControls();
      */
      console.log(firstData);
      console.log(secondData);
    });

    function activateControls () {
      var $tileLayer = $( '.leaflet-tile-pane' ),
        $heatmapLayer = $( '.leaflet-heatmap-layer' ),
        originalHeatOptions = $.extend( {}, heatOptions ); // for reset

      // Update values of the dom elements
      function updateInputs () {
        var option;
        for ( option in heatOptions ) {
          if ( heatOptions.hasOwnProperty( option ) ) {
            document.getElementById( option ).value = heatOptions[option];
          }
        }
      }

      updateInputs();

      $( '.control' ).change( function () {
        switch ( this.id ) {
          case 'tileOpacity':
            $tileLayer.css( 'opacity', this.value );
            break;
          case 'heatOpacity':
            $heatmapLayer.css( 'opacity', this.value );
            break;
          default:
            heatOptions[ this.id ] = Number( this.value );
            heat.setOptions( heatOptions );
            break;
        }
      } );

      $( '#reset' ).click( function () {
        $.extend( heatOptions, originalHeatOptions );
        updateInputs();
        heat.setOptions( heatOptions );
        // Reset opacity too
        $heatmapLayer.css( 'opacity', originalHeatOptions.heatOpacity );
        $tileLayer.css( 'opacity', originalHeatOptions.tileOpacity );
      } );
    }
  }

  /*
  Break file into chunks and emit 'data' to oboe instance
  */

  function parseJSONFile( file, oboeInstance ) {
    var fileSize = file.size;
    var prettyFileSize = prettySize(fileSize);
    var chunkSize = 512 * 1024; // bytes
    var offset = 0;
    var self = this; // we need a reference to the current object
    var chunkReaderBlock = null;
    var readEventHandler = function ( evt ) {
      if ( evt.target.error == null ) {
        offset += evt.target.result.length;
        var chunk = evt.target.result;
        var percentLoaded = ( 100 * offset / fileSize ).toFixed( 0 );
        status( percentLoaded + '% of ' + prettyFileSize + ' loaded...' );
        oboeInstance.emit( 'data', chunk ); // callback for handling read chunk
      } else {
        return;
      }
      if ( offset >= fileSize ) {
        oboeInstance.emit( 'done' );
        return;
      }

      // of to the next chunk
      chunkReaderBlock( offset, chunkSize, file );
    }

    chunkReaderBlock = function ( _offset, length, _file ) {
      var r = new FileReader();
      var blob = _file.slice( _offset, length + _offset );
      r.onload = readEventHandler;
      r.readAsText( blob );
    }

    // now let's start the read with the first block
    chunkReaderBlock( offset, chunkSize, file );
  }

}( jQuery, L, prettySize ) );
