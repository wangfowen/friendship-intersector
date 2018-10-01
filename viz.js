class Viz {
  constructor(map) {
    this.map = map;

    this.first = {
      progress: 0,
      name: "line-1-animation"
    };
    this.second = {
      progress: 0,
      name: "line-2-animation"
    };

    this.options = {
      tailTrail: 25
    };

    this.animation; // to store and cancel the animation
    this.bounds;
    this.time;
    this.controlsId;
  }

  latlng(data) {
    return [data[1], data[0]];
  }

  currLatLng(set) {
    return this.latlng(set.data[set.progress]);
  }

  currTime(set) {
    return set.data[set.progress][2];
  }

  setTime() {
    const c = this;
    c.time = Math.min(c.currTime(c.first), c.currTime(c.second));
  }

  addData(firstData, secondData) {
    this.first.data = firstData;
    this.second.data = secondData;
    this.setTime();
  }

  initLine(data, name, color) {
    var firstCoord = this.latlng(data[0]);
    var secondCoord = this.latlng(data[1]);

    var line = {
      "type": "FeatureCollection",
      "features": [{
        "type": "Feature",
        "geometry": {
          "type": "LineString",
          "coordinates": [
            firstCoord,
            secondCoord
          ]
        }
      }]
    };

    // add the line which will be modified in the animation
    this.map.addLayer({
      'id': name,
      'type': 'line',
      'source': {
        'type': 'geojson',
        'data': line
      },
      'layout': {
        'line-cap': 'round',
        'line-join': 'round'
      },
      'paint': {
        'line-color': `#${color}`,
        'line-width': 5,
        'line-opacity': .8
      }
    });

    return line;
  }

  init(controlsId) {
    const c = this;
    c.first.line = c.initLine(c.first.data, c.first.name, "ed6498");
    c.second.line = c.initLine(c.second.data, c.second.name, "000");

    c.controlsId = controlsId;

    c.animate(c);
  }

  pushNextCoord(set) {
    if (set.progress < set.data.length - 1 && this.currTime(set) <= this.time) {
      set.progress = set.progress + 1;
      const next = this.currLatLng(set);
      const coords = set.line.features[0].geometry.coordinates;
      coords.push(next);
      if (set.progress > this.options.tailTrail) {
        coords.shift();
      }
      this.map.getSource(set.name).setData(set.line);
      return coords;
    } else {
      return null;
    }
  }

  formattedTime() {
    return moment(this.time).format('lll');
  }

  animate(ref) {
    const firstCoords = ref.pushNextCoord(ref.first);
    const secondCoords = ref.pushNextCoord(ref.second);
    if (firstCoords !== null || secondCoords !== null) {
      ref.setTime();
      $(ref.controlsId).find('#time').html(ref.formattedTime());

      let combined;
      if (firstCoords === null) {
        combined = secondCoords;
      } else if (secondCoords === null) {
        combined = firstCoords;
      } else {
        combined = firstCoords.concat(secondCoords);
      }

      let bounds = combined.reduce(function(b, coord) {
        return b.extend(coord);
      }, new mapboxgl.LngLatBounds(combined[0], combined[0]));

      //fast jump to fit the page
      if (bounds !== ref.bounds) {
        ref.map.fitBounds(bounds, {
          padding: 20,
          easing: (t) => {
            return t + 0.1;
          }
        });

        ref.bounds = bounds;
      }

      ref.animation = requestAnimationFrame(() => {ref.animate(ref)});
    }
  }
}
