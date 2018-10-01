class Viz {
  constructor(map) {
    this.map = map;

    this.first = {progress: 0};
    this.second = {progress: 0};

    this.speedFactor = 30; // number of frames per longitude degree
    this.animation; // to store and cancel the animation
  }

  addData(firstData, secondData) {
    this.first.data = firstData;
    this.second.data = secondData;
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

  latlng(data) {
    return [data[1], data[0]];
  }

  init() {
    const c = this;
    c.first.name = "line-1-animation";
    c.second.name = "line-2-animation";
    c.first.line = c.initLine(c.first.data, c.first.name, "ed6498");
    c.second.line = c.initLine(c.second.data, c.second.name, "000");
    c.animate(c);
  }

  pushNextCoord(set) {
    if (set.progress < set.data.length - 1) {
      set.progress = set.progress + 1;
      const next = this.latlng(set.data[set.progress]);
      const coords = set.line.features[0].geometry.coordinates;
      coords.push(next);
      if (set.progress > 100) {
        coords.shift();
      }
      this.map.getSource(set.name).setData(set.line);
      return true;
    } else {
      return false;
    }
  }

  animate(ref) {
    if (ref.pushNextCoord(ref.first) && ref.pushNextCoord(ref.second)) {
      ref.animation = requestAnimationFrame(() => {ref.animate(ref)});
    }
  }
}
