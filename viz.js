class Viz {
  constructor(map) {
    this.map = map;

    this.first = {
      progress: 0,
      lineProgress: 0,
      pointProgress: 0,
      points: [],
      name: "point-1"
    };
    this.second = {
      progress: 0,
      lineProgress: 0,
      pointProgress: 0,
      points: [],
      name: "point-2"
    };
    this.watch = [this.first, this.second];

    this.options = {
      tailTrail: 8,
      playing: true,
      frameRate: 3
    };

    this.controlsId;

    this.animation; // to store and cancel the animation
    this.mapBounds;
    this.time;
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

  initPoint(data, name, color) {
    var coord = this.latlng(data[0]);

    var point = {
      "type": "FeatureCollection",
      "features": [{
        "type": "Feature",
        "properties": {},
        "geometry": {
          "type": "LineString",
          "coordinates": [
            coord,
            coord
          ]
        }
      }]
    };

    this.map.addLayer({
      'id': name,
      'type': 'line',
      'source': {
        'type': 'geojson',
        'data': point
      },
      'paint': {
        'line-width': 5,
        'line-color': `#${color}`,
        'line-opacity': .8
      }
    });

    return point;
  }

  initLine(data) {
    var coord = this.latlng(data[0]);

    var line = {
      "type": "FeatureCollection",
      "features": [{
        "type": "Feature",
        "geometry": {
          "type": "LineString",
          "coordinates": [
            coord,
            coord
          ]
        }
      }]
    };

    return line;
  }

  pointName(name, i) {
    return `${name}-${i}`;
  }

  init(controlsId) {
    const c = this;
    //initialize initial lines to follow
    c.first.line = c.initLine(c.first.data);
    c.second.line = c.initLine(c.second.data);

    //initialize points on map
    for (let i = 0; i < c.options.tailTrail; i++) {
      c.first.points.push(c.initPoint(c.first.data, c.pointName(c.first.name, i), "ed6498"));
      //TODO: change this color to be something more pleasant
      c.second.points.push(c.initPoint(c.second.data, c.pointName(c.second.name, i), "000"));
    }

    c.controlsId = controlsId;

    c.animate(c);
  }

  pushNextCoord(set) {
    let changed = false;
    //continue along as long as this coord's timestamp is not ahead
    if (set.progress < set.data.length - 1 && (
      this.currTime(set) <= this.time ||
      set.progress == 0
    )) {
      //progress to next line if this one is done
      if (set.lineProgress == 0) {
        set.progress = set.progress + 1;
        const next = this.currLatLng(set);
        const coords = set.line.features[0].geometry.coordinates;
        coords.shift();
        coords.push(next);

        //segment line
        const distance = turf.lineDistance(set.line.features[0], 'kilometers');
        const lineFragments = [];
        for (let i = 0; i < distance; i += distance / this.options.frameRate) {
          const fragment = turf.along(set.line.features[0], i, 'kilometers').geometry.coordinates;
          if (set.prevPoint === undefined) {
            //push first ever fragment if none exists
            set.prevPoint = fragment;
          }
          lineFragments.push(fragment);
        }
        set.lineFragments = lineFragments;
        changed = true;
      }

      //time to do next line
      const point = set.points[set.pointProgress];
      const currPoint = set.lineFragments[set.lineProgress];
      point.features[0].geometry.coordinates = [
        set.prevPoint,
        currPoint
      ];
      set.prevPoint = currPoint;
      set.pointProgress = (set.pointProgress + 1) % set.points.length;
      if (set.lineFragments.length > 0) {
        set.lineProgress = (set.lineProgress + 1) % set.lineFragments.length;
      } else {
        set.lineProgress = 0;
      }

      for (let i = 0; i < set.points.length; i++) {
        this.map.getSource(this.pointName(set.name, i)).setData(set.points[i]);
      }
    }

    return changed;
  }

  formattedTime() {
    return moment(this.time).format('lll');
  }

  toggleOn() {
    this.options.playing = !this.options.playing;
  }

  adjustFrameRate(rate) {
    this.options.frameRate = rate;
  }

  watchBoth() {
    this.watch = [this.first, this.second];
  }

  watchFirst() {
    this.watch = [this.first];
  }

  watchSecond() {
    this.watch = [this.second];
  }

  progressAnimation(ref) {
    const firstChanged = ref.pushNextCoord(ref.first);
    const secondChanged = ref.pushNextCoord(ref.second);

    ref.setTime();
    $(ref.controlsId).find('#time').html(ref.formattedTime());

    if (firstChanged || secondChanged) {
      let combined = [];
      for (let i = 0; i < ref.watch.length; i++) {
        const set = ref.watch[i];
        combined = combined
          .concat(set.lineFragments)
          .concat(set.line.features[0].geometry.coordinates);
      }

      let mapBounds = combined.reduce(function(b, coord) {
        return b.extend(coord);
      }, new mapboxgl.LngLatBounds(combined[0], combined[0]));

      //fast jump to fit the page
      if (mapBounds !== ref.mapBounds) {
        ref.map.fitBounds(mapBounds, {
          padding: 20,
          easing: (t) => {
            return t + 0.2;
          }
        });

        ref.mapBounds = mapBounds;
      }
    }
  }

  animate(ref) {
    if (ref.options.playing) {
      ref.progressAnimation(ref);
    }

    ref.animation = requestAnimationFrame(() => {ref.animate(ref)});
  }
}
